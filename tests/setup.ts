import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import mongoose from "mongoose";

// Vitest already sets NODE_ENV=test.
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123456789";
process.env.APP_URL = "http://localhost:3000";

const { connectDb, disconnectDb } = await import("@/lib/db");
// Register every model so their indexes are built.
await Promise.all([
  import("@/server/models/User"),
  import("@/server/models/Session"),
  import("@/server/models/Conversation"),
  import("@/server/models/Message"),
  import("@/server/models/Block"),
  import("@/server/models/Report"),
  import("@/server/models/PasswordResetToken"),
]);

beforeAll(async () => {
  const base = inject("mongoUri");
  const db = `lumos_test_${Math.random().toString(36).slice(2, 10)}`;
  await connectDb(`${base.replace(/\/?$/, "/")}${db}`);
  // Build indexes (2dsphere, unique keys) before any test relies on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  (globalThis as unknown as { __lumosRateLimit?: Map<string, unknown> }).__lumosRateLimit?.clear();
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase().catch(() => {});
  await disconnectDb();
});
