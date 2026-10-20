/**
 * Development seed: fictional profiles around Colombo (and a few further away)
 * plus a demo account with two existing chats.
 *
 *   npm run seed
 *
 * Only documents flagged `isSeed: true` (and their chats) are replaced; real
 * accounts are never touched. Refuses non-local databases (see dev-guard).
 */
import { loadDevEnv } from "./dev-guard";
import { AREAS, DEMO_ACCOUNT, PEOPLE, SEED_CONVERSATIONS, SEED_PASSWORD } from "./seed-data";

const { uri } = loadDevEnv();

const { connectDb, disconnectDb } = await import("../src/lib/db");
const { hashPassword } = await import("../src/lib/auth/password");
const { toGeoPoint } = await import("../src/lib/geo");
const { User } = await import("../src/server/models/User");
const { Conversation, participantsKeyFor } = await import("../src/server/models/Conversation");
const { Message } = await import("../src/server/models/Message");
const { Block } = await import("../src/server/models/Block");
const { Session } = await import("../src/server/models/Session");

// Deterministic jitter so profiles don't stack on the exact same point.
function jitter(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return (x - Math.floor(x) - 0.5) * 0.012;
}

async function main() {
  await connectDb(uri);
  await Promise.all([User.init(), Conversation.init(), Message.init(), Block.init(), Session.init()]);

  const old = await User.find({ isSeed: true }).select("_id").lean();
  const oldIds = old.map((u) => u._id);
  const oldConvs = await Conversation.find({ participants: { $in: oldIds } }).select("_id").lean();
  await Message.deleteMany({ conversationId: { $in: oldConvs.map((c) => c._id) } });
  await Conversation.deleteMany({ _id: { $in: oldConvs.map((c) => c._id) } });
  await Block.deleteMany({ $or: [{ blockerId: { $in: oldIds } }, { blockedUserId: { $in: oldIds } }] });
  await Session.deleteMany({ userId: { $in: oldIds } });
  await User.deleteMany({ isSeed: true });
  console.log(`Removed ${oldIds.length} previous seed users.`);

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const now = new Date();

  const docs = PEOPLE.map((p, i) => {
    const [lat, lng] = AREAS[p.area];
    return {
      email: `${p.username.replace(/\./g, "_")}@seed.lumos.lk`,
      username: p.username,
      displayName: p.displayName,
      passwordHash,
      avatarUrl: `https://randomuser.me/api/portraits/${p.gender}/${p.photo}.jpg`,
      bio: p.bio,
      interests: p.interests,
      age: p.age,
      location: toGeoPoint({ lat: lat + jitter(i + 1), lng: lng + jitter(i + 101) }),
      locationUpdatedAt: now,
      isLocationSharingEnabled: true,
      isDiscoverable: true,
      isOnline: false,
      lastSeenAt: new Date(now.getTime() - (i % 7) * 13 * 60_000),
      privacySettings: { showOnlineStatus: i % 11 !== 5, showAge: true },
      isSeed: true,
    };
  });

  const [dLat, dLng] = AREAS[DEMO_ACCOUNT.area];
  const demo = await User.create({
    email: DEMO_ACCOUNT.email,
    username: DEMO_ACCOUNT.username,
    displayName: DEMO_ACCOUNT.displayName,
    passwordHash: await hashPassword(DEMO_ACCOUNT.password),
    bio: DEMO_ACCOUNT.bio,
    interests: DEMO_ACCOUNT.interests,
    age: DEMO_ACCOUNT.age,
    avatarUrl: "https://randomuser.me/api/portraits/women/17.jpg",
    location: toGeoPoint({ lat: dLat, lng: dLng }),
    locationUpdatedAt: now,
    isLocationSharingEnabled: true,
    isSeed: true,
  });
  const created = await User.insertMany(docs);
  const byUsername = new Map(created.map((u) => [u.username, u]));
  console.log(`Created ${created.length} seed profiles + demo account.`);

  for (const conv of SEED_CONVERSATIONS) {
    const other = byUsername.get(conv.with);
    if (!other) continue;
    const msgs = conv.messages.map((m, i) => ({
      senderId: m.fromDemo ? demo._id : other._id,
      content: m.text,
      createdAt: new Date(now.getTime() - m.minutesAgo * 60_000),
      clientId: `seed-${conv.with}-${i}`,
    }));
    const last = msgs[msgs.length - 1];
    const unreadForDemo = [...msgs].reverse().findIndex((m) => m.senderId.equals(demo._id));
    const c = await Conversation.create({
      participants: [demo._id, other._id],
      participantsKey: participantsKeyFor(demo._id, other._id),
      members: [
        { userId: demo._id, unreadCount: unreadForDemo === -1 ? msgs.length : unreadForDemo, lastReadAt: unreadForDemo === 0 ? last.createdAt : null },
        { userId: other._id, unreadCount: 0, lastReadAt: last.createdAt },
      ],
      createdBy: msgs[0].senderId,
      lastMessageAt: last.createdAt,
      activityAt: last.createdAt,
    });
    const inserted = await Message.insertMany(msgs.map((m) => ({ ...m, conversationId: c._id, updatedAt: m.createdAt })));
    const lastMsg = inserted[inserted.length - 1];
    await Conversation.updateOne(
      { _id: c._id },
      { $set: { lastMessage: { messageId: lastMsg._id, senderId: lastMsg.senderId, content: lastMsg.content, createdAt: lastMsg.createdAt } } },
    );
  }
  console.log(`Created ${SEED_CONVERSATIONS.length} demo conversations.`);

  console.log("\n  Demo login:  demo@lumos.lk  /  lumos-demo-123");
  console.log("  Seed users:  <username>  /  lumos-demo-123   (e.g. amaya.f)");
  console.log("\n  Seed users only appear in Nearby while online. Run `npm run simulate`");
  console.log("  (with the app running) to bring them online and have them reply to chats.\n");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
