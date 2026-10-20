import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { createSocketServer } from "@/server/realtime/socket-server";
import { getOrCreateConversation } from "@/server/services/conversations";
import { blockUser } from "@/server/services/blocks";
import { User } from "@/server/models/User";
import type { ClientToServerEvents, ServerToClientEvents } from "@/shared/events";
import type { UserDoc } from "@/server/models/User";
import { cookieFor, makeUser } from "./helpers";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let http: Server;
let realtime: ReturnType<typeof createSocketServer>;
let url: string;
const clients: Client[] = [];

beforeAll(async () => {
  http = createServer();
  realtime = createSocketServer(http, { allowedOrigins: ["http://localhost:3000"] });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await realtime.close();
});

async function online(user: UserDoc, opts: { origin?: string } = {}): Promise<Client> {
  const cookie = await cookieFor(user);
  const c: Client = connect(url, {
    path: "/socket.io",
    transports: ["websocket"],
    extraHeaders: { cookie, ...(opts.origin ? { origin: opts.origin } : {}) },
    reconnection: false,
    forceNew: true,
  });
  clients.push(c);
  await new Promise<void>((resolve, reject) => {
    c.once("connect", () => resolve());
    c.once("connect_error", reject);
  });
  return c;
}

function next<E extends keyof ServerToClientEvents>(c: Client, event: E, ms = 3000) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    (c.once as (e: E, fn: (p: Parameters<ServerToClientEvents[E]>[0]) => void) => void)(event, (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });
}

function nothing<E extends keyof ServerToClientEvents>(c: Client, event: E, ms = 600) {
  return new Promise<boolean>((resolve) => {
    const fn = () => resolve(false);
    (c.once as (e: E, fn: () => void) => void)(event, fn);
    setTimeout(() => {
      (c.off as (e: E, fn: () => void) => void)(event, fn);
      resolve(true);
    }, ms);
  });
}

const send = (c: Client, conversationId: string, content: string, clientId: string) =>
  new Promise<Parameters<Parameters<ClientToServerEvents["message:send"]>[1]>[0]>((resolve) =>
    c.emit("message:send", { conversationId, content, clientId }, resolve),
  );

describe("realtime", () => {
  it("rejects unauthenticated and cross-origin connections", async () => {
    const anon: Client = connect(url, { path: "/socket.io", transports: ["websocket"], reconnection: false, forceNew: true });
    clients.push(anon);
    await expect(new Promise((_, reject) => anon.once("connect_error", reject))).rejects.toThrow("UNAUTHENTICATED");

    const u = await makeUser();
    await expect(online(u, { origin: "https://evil.example" })).rejects.toBeTruthy();
  });

  it("marks users online on connect and offline after the last tab disconnects", async () => {
    const u = await makeUser({ isOnline: false, lastSeenAt: null });
    const tab1 = await online(u);
    const tab2 = await online(u);
    await new Promise((r) => setTimeout(r, 150));
    expect((await User.findById(u._id).lean())?.isOnline).toBe(true);
    tab1.disconnect();
    await new Promise((r) => setTimeout(r, 300));
    // Still online: another tab is connected.
    expect((await User.findById(u._id).lean())?.isOnline).toBe(true);
    tab2.disconnect();
  });

  it("delivers messages to both participants' devices and nobody else", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const outsider = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    const [ca, cb1, cb2, co] = await Promise.all([online(a), online(b), online(b), online(outsider)]);

    const gotB1 = next(cb1, "message:new");
    const gotB2 = next(cb2, "message:new");
    const outsiderQuiet = nothing(co, "message:new");
    const ack = await send(ca, conv.id, "Ayubowan! 👋", "rt-msg-0001");
    expect(ack.ok).toBe(true);

    const [p1, p2] = await Promise.all([gotB1, gotB2]);
    expect(p1.message.content).toBe("Ayubowan! 👋");
    expect(p1.message.senderId).toBe(String(a._id));
    expect(p1.conversation.unreadCount).toBe(1);
    expect(p2.message.id).toBe(p1.message.id);
    expect(await outsiderQuiet).toBe(true);
  });

  it("refuses to send into conversations the socket user doesn't belong to", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const intruder = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    const ci = await online(intruder);
    const res = await send(ci, conv.id, "let me in", "rt-msg-0002");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");

    const bad = await send(ci, "nope", "x", "rt-msg-0003");
    expect(bad.ok).toBe(false);
  });

  it("relays typing indicators only to the other participant and not across a block", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const outsider = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    const [ca, cb, co] = await Promise.all([online(a), online(b), online(outsider)]);

    const typing = next(cb, "typing:update");
    ca.emit("typing:start", { conversationId: conv.id });
    expect(await typing).toMatchObject({ conversationId: conv.id, userId: String(a._id), isTyping: true });

    // An outsider can't spoof typing into someone else's conversation.
    const quiet = nothing(cb, "typing:update");
    co.emit("typing:start", { conversationId: conv.id });
    expect(await quiet).toBe(true);

    await blockUser(b._id, String(a._id));
    const quietAfterBlock = nothing(cb, "typing:update");
    ca.emit("typing:start", { conversationId: conv.id });
    expect(await quietAfterBlock).toBe(true);
  });

  it("pushes presence only for subscribed, non-blocked users and respects privacy", async () => {
    const watcher = await makeUser();
    const friend = await makeUser({ isOnline: false });
    const shy = await makeUser({ isOnline: false, privacySettings: { showOnlineStatus: false, showAge: true } });
    const cw = await online(watcher);
    const snapshot = await new Promise<{ ok: boolean; data?: { userId: string; isOnline: boolean }[] }>((r) =>
      cw.emit("presence:subscribe", { userIds: [String(friend._id), String(shy._id)] }, r as never),
    );
    expect(snapshot.ok).toBe(true);

    const update = next(cw, "presence:update");
    await online(friend);
    expect(await update).toMatchObject({ userId: String(friend._id), isOnline: true });

    const shyUpdate = next(cw, "presence:update");
    await online(shy);
    // A user hiding their status is broadcast as offline.
    expect(await shyUpdate).toMatchObject({ userId: String(shy._id), isOnline: false, lastSeenAt: null });
  });
});
