/**
 * Development simulator: brings seed users online over REAL authenticated
 * Socket.IO connections (exactly like a browser), keeps their location fresh,
 * occasionally toggles someone offline/online, and replies to messages with a
 * typing indicator first. Lets one person test the whole product end to end.
 *
 *   npm run dev        # in one terminal
 *   npm run simulate   # in another
 */
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/shared/events";
import { loadDevEnv } from "./dev-guard";

const { uri, appUrl } = loadDevEnv();

const { connectDb, disconnectDb } = await import("../src/lib/db");
const { createSession } = await import("../src/lib/auth/session");
const { User } = await import("../src/server/models/User");
const { Session } = await import("../src/server/models/Session");

type Bot = {
  id: string;
  name: string;
  interests: string[];
  token: string;
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  beat?: ReturnType<typeof setInterval>;
};

const ONLINE_SHARE = 0.8;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function replyTo(bot: Bot, text: string, isFirst: boolean): string {
  const t = text.toLowerCase();
  const first = bot.name.split(" ")[0];
  if (isFirst && /\b(hi|hey|hello|ayubowan|hii+)\b/.test(t)) {
    return pick([
      `Hey! 👋 I'm ${first}. Nice to meet someone nearby!`,
      `Hi there! How's your day going? 😊`,
      `Hello! Thanks for saying hi — what brings you to Langa?`,
    ]);
  }
  if (t.includes("?")) {
    return pick([
      "Good question! Honestly, it depends on the day 😄 What about you?",
      `Hmm, I'd say ${bot.interests[0]?.toLowerCase() ?? "good food"} is my answer. You?`,
      "Haha I was just thinking about that. Tell me yours first!",
    ]);
  }
  for (const i of bot.interests) {
    if (t.includes(i.toLowerCase())) return `Wait, you're into ${i.toLowerCase()} too?! We should definitely meet up sometime.`;
  }
  return pick([
    "That's awesome 😄",
    "Haha love that!",
    "No way, same here!",
    "Ooh tell me more!",
    "Nice! Are you around Colombo this weekend?",
  ]);
}

async function markRead(bot: Bot, conversationId: string) {
  await fetch(`${appUrl}/api/conversations/${conversationId}/read`, {
    method: "POST",
    headers: { cookie: `langa_session=${bot.token}`, "content-type": "application/json" },
    body: "{}",
  }).catch(() => {});
}

function connect(bot: Bot) {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(appUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    extraHeaders: { cookie: `langa_session=${bot.token}` },
    reconnectionDelayMax: 5000,
  });
  bot.socket = socket;
  const replied = new Set<string>();

  socket.on("connect", () => {
    socket.emit("presence:heartbeat");
    clearInterval(bot.beat);
    bot.beat = setInterval(() => socket.emit("presence:heartbeat"), 25_000);
  });
  socket.on("connect_error", (e) => console.warn(`  [${bot.name}] connect error: ${e.message}`));

  socket.on("message:new", async ({ message, conversation }) => {
    if (message.senderId === bot.id) return;
    const isFirst = !replied.has(conversation.id);
    replied.add(conversation.id);
    await sleep(rand(1200, 2500));
    await markRead(bot, conversation.id);
    socket.emit("typing:start", { conversationId: conversation.id });
    await sleep(rand(1500, 3500));
    socket.emit("typing:stop", { conversationId: conversation.id });
    const content = replyTo(bot, message.content, isFirst);
    socket.emit("message:send", { conversationId: conversation.id, content, clientId: `sim${Date.now()}${Math.random().toString(36).slice(2, 8)}` }, (res) => {
      if (!res.ok) console.warn(`  [${bot.name}] send failed: ${res.error.message}`);
      else console.log(`  ${bot.name} → ${conversation.otherUser.displayName}: ${content}`);
    });
  });
}

function disconnect(bot: Bot) {
  clearInterval(bot.beat);
  bot.socket?.removeAllListeners();
  bot.socket?.disconnect();
  bot.socket = null;
}

async function main() {
  await connectDb(uri);
  const seeds = await User.find({ isSeed: true, username: { $ne: "demo" } })
    .select("_id displayName interests")
    .lean();
  if (seeds.length === 0) {
    console.log("No seed users found. Run `npm run seed` first.");
    return;
  }

  const bots: Bot[] = [];
  for (const u of seeds) {
    const { token } = await createSession(u._id, "langa-simulator");
    bots.push({ id: String(u._id), name: u.displayName, interests: u.interests, token, socket: null });
  }

  for (const bot of bots) if (Math.random() < ONLINE_SHARE) connect(bot);
  console.log(`\nSimulating ${bots.filter((b) => b.socket).length}/${bots.length} seed users online at ${appUrl}`);
  console.log("They'll appear in Nearby and reply to your messages. Ctrl+C to stop.\n");

  // Keep seeded locations fresh (they'd otherwise go stale after 30 minutes).
  const refreshLocations = () =>
    User.updateMany({ isSeed: true, username: { $ne: "demo" } }, { $set: { locationUpdatedAt: new Date() } })
      .exec()
      .catch((e) => console.warn(`  location refresh failed (will retry): ${e instanceof Error ? e.message : e}`));
  await refreshLocations();
  const locTimer = setInterval(refreshLocations, 5 * 60_000);

  // Some churn so presence changes are visible live.
  const churn = setInterval(() => {
    const bot = pick(bots);
    if (bot.socket) {
      disconnect(bot);
      console.log(`  ${bot.name} went offline`);
    } else {
      connect(bot);
      console.log(`  ${bot.name} came online`);
    }
  }, 75_000);

  const stop = async () => {
    clearInterval(locTimer);
    clearInterval(churn);
    bots.forEach(disconnect);
    await Session.deleteMany({ userAgent: "langa-simulator" });
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

// A dev tool should ride out transient DB/network hiccups (e.g. after laptop sleep).
process.on("unhandledRejection", (e) => console.warn(`  [simulator] ${e instanceof Error ? e.message : e}`));

main().catch(async (err) => {
  console.error("Simulator failed:", err instanceof Error ? err.message : err);
  await disconnectDb();
  process.exit(1);
});
