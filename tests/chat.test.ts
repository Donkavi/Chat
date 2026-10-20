import { describe, expect, it } from "vitest";
import { POST as createConversationRoute, GET as listConversationsRoute } from "@/app/api/conversations/route";
import { GET as messagesRoute, POST as sendRoute } from "@/app/api/conversations/[id]/messages/route";
import { POST as readRoute } from "@/app/api/conversations/[id]/read/route";
import { POST as reportRoute } from "@/app/api/reports/route";
import { getOrCreateConversation, listConversations, markConversationRead } from "@/server/services/conversations";
import { listMessages, sendMessage } from "@/server/services/messages";
import { blockUser, unblockUser } from "@/server/services/blocks";
import { Conversation } from "@/server/models/Conversation";
import { Message } from "@/server/models/Message";
import { Report } from "@/server/models/Report";
import { Block } from "@/server/models/Block";
import { body, cookieFor, makeUser, noParams, params, req } from "./helpers";

let seq = 0;
const cid = () => `client${String(++seq).padStart(6, "0")}`;

describe("conversations", () => {
  it("reuses the existing conversation between two people (either direction)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c1 = await getOrCreateConversation(a._id, String(b._id));
    const c2 = await getOrCreateConversation(a._id, String(b._id));
    const c3 = await getOrCreateConversation(b._id, String(a._id));
    expect(c1.id).toBe(c2.id);
    expect(c1.id).toBe(c3.id);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("survives concurrent creation without duplicates", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const results = await Promise.all(Array.from({ length: 6 }, () => getOrCreateConversation(a._id, String(b._id))));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("refuses self-conversations, unknown users and blocked users", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const cookie = await cookieFor(a);
    expect((await createConversationRoute(req("POST", "/api/conversations", { cookie, body: { userId: String(a._id) } }), noParams)).status).toBe(400);
    expect((await createConversationRoute(req("POST", "/api/conversations", { cookie, body: { userId: "0".repeat(24) } }), noParams)).status).toBe(404);
    expect((await createConversationRoute(req("POST", "/api/conversations", { cookie, body: { userId: "not-an-id" } }), noParams)).status).toBe(422);
    await blockUser(b._id, String(a._id));
    expect((await createConversationRoute(req("POST", "/api/conversations", { cookie, body: { userId: String(b._id) } }), noParams)).status).toBe(404);
  });

  it("only shows a new conversation to the recipient once a message is sent", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    expect((await listConversations(a._id)).items).toHaveLength(1);
    expect((await listConversations(b._id)).items).toHaveLength(0);
    await sendMessage(a._id, { conversationId: conv.id, content: "Hello!", clientId: cid() });
    const forB = await listConversations(b._id);
    expect(forB.items).toHaveLength(1);
    expect(forB.items[0].lastMessage?.content).toBe("Hello!");
  });
});

describe("messages", () => {
  it("persists messages, tracks unread counts and read receipts", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    await sendMessage(a._id, { conversationId: conv.id, content: "one", clientId: cid() });
    await sendMessage(a._id, { conversationId: conv.id, content: "two", clientId: cid() });

    let forB = await listConversations(b._id);
    expect(forB.items[0].unreadCount).toBe(2);
    expect(forB.unreadTotal).toBe(2);
    expect((await listConversations(a._id)).items[0].unreadCount).toBe(0);

    await markConversationRead(conv.id, b._id);
    forB = await listConversations(b._id);
    expect(forB.items[0].unreadCount).toBe(0);
    const forA = await listConversations(a._id);
    expect(forA.items[0].otherLastReadAt).not.toBeNull();
  });

  it("is idempotent per clientId (safe retries)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    const id = cid();
    const first = await sendMessage(a._id, { conversationId: conv.id, content: "hi", clientId: id });
    const retry = await sendMessage(a._id, { conversationId: conv.id, content: "hi", clientId: id });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.message.id).toBe(first.message.id);
    expect(await Message.countDocuments()).toBe(1);
  });

  it("takes the sender from the session, not the request", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    const res = await sendRoute(
      req("POST", `/api/conversations/${conv.id}/messages`, { cookie: await cookieFor(a), body: { content: "hey", clientId: cid(), senderId: String(b._id) } }),
      params({ id: conv.id }),
    );
    expect(res.status).toBe(201);
    const { data } = await body<{ data: { message: { senderId: string } } }>(res);
    expect(data.message.senderId).toBe(String(a._id));
  });

  it("denies access to conversations you're not part of", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const outsider = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    await sendMessage(a._id, { conversationId: conv.id, content: "private", clientId: cid() });
    const cookie = await cookieFor(outsider);

    expect((await messagesRoute(req("GET", `/api/conversations/${conv.id}/messages`, { cookie }), params({ id: conv.id }))).status).toBe(404);
    expect(
      (await sendRoute(req("POST", `/api/conversations/${conv.id}/messages`, { cookie, body: { content: "x", clientId: cid() } }), params({ id: conv.id }))).status,
    ).toBe(404);
    expect((await readRoute(req("POST", `/api/conversations/${conv.id}/read`, { cookie }), params({ id: conv.id }))).status).toBe(404);
    expect((await messagesRoute(req("GET", `/api/conversations/${conv.id}/messages`), params({ id: conv.id }))).status).toBe(401);
    const list = await listConversationsRoute(req("GET", "/api/conversations", { cookie }), noParams);
    expect((await body<{ data: { items: unknown[] } }>(list)).data.items).toHaveLength(0);
  });

  it("blocks messaging in both directions while a block exists", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    await blockUser(a._id, String(b._id));
    await expect(sendMessage(a._id, { conversationId: conv.id, content: "x", clientId: cid() })).rejects.toMatchObject({ code: "BLOCKED" });
    await expect(sendMessage(b._id, { conversationId: conv.id, content: "x", clientId: cid() })).rejects.toMatchObject({ code: "BLOCKED" });
    await unblockUser(a._id, String(b._id));
    await expect(sendMessage(b._id, { conversationId: conv.id, content: "back", clientId: cid() })).resolves.toBeTruthy();
  });

  it("validates message content", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    const cookie = await cookieFor(a);
    for (const content of ["", "   ", "x".repeat(2001)]) {
      const res = await sendRoute(req("POST", `/api/conversations/${conv.id}/messages`, { cookie, body: { content, clientId: cid() } }), params({ id: conv.id }));
      expect(res.status).toBe(422);
    }
  });

  it("paginates history newest-first with a cursor and supports catch-up", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const conv = await getOrCreateConversation(a._id, String(b._id));
    for (let i = 1; i <= 7; i++) await sendMessage(i % 2 ? a._id : b._id, { conversationId: conv.id, content: `m${i}`, clientId: cid() });

    const page1 = await listMessages(conv.id, a._id, { limit: 3 });
    expect(page1.items.map((m) => m.content)).toEqual(["m5", "m6", "m7"]);
    const page2 = await listMessages(conv.id, a._id, { limit: 3, before: page1.nextCursor! });
    expect(page2.items.map((m) => m.content)).toEqual(["m2", "m3", "m4"]);
    const page3 = await listMessages(conv.id, a._id, { limit: 3, before: page2.nextCursor! });
    expect(page3.items.map((m) => m.content)).toEqual(["m1"]);
    expect(page3.nextCursor).toBeNull();

    const after = await listMessages(conv.id, a._id, { limit: 50, after: page2.items[2].id });
    expect(after.items.map((m) => m.content)).toEqual(["m5", "m6", "m7"]);
  });
});

describe("reports", () => {
  it("records a report, optionally blocks, and collapses duplicates", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const cookie = await cookieFor(a);
    const res = await reportRoute(req("POST", "/api/reports", { cookie, body: { userId: String(b._id), reason: "spam", alsoBlock: true } }), noParams);
    expect(res.status).toBe(200);
    await reportRoute(req("POST", "/api/reports", { cookie, body: { userId: String(b._id), reason: "harassment", details: "again" } }), noParams);
    const reports = await Report.find().lean();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ reason: "harassment", status: "open", details: "again" });
    expect(await Block.exists({ blockerId: a._id, blockedUserId: b._id })).toBeTruthy();
    expect((await reportRoute(req("POST", "/api/reports", { cookie, body: { userId: String(b._id), reason: "made-up" } }), noParams)).status).toBe(422);
    expect((await reportRoute(req("POST", "/api/reports", { cookie, body: { userId: String(a._id), reason: "spam" } }), noParams)).status).toBe(400);
  });
});
