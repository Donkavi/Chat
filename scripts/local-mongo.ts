/**
 * Development convenience: run a disk-backed MongoDB on 127.0.0.1:27017
 * without installing MongoDB or Docker. Data persists in ./.mongo-data.
 * Uses the binary that mongodb-memory-server downloads on first run.
 *
 *   npm run db:local
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = path.resolve(process.cwd(), ".mongo-data");
mkdirSync(dbPath, { recursive: true });
const port = Number(process.env.MONGO_PORT || 27017);

console.log("Starting local MongoDB (the first run downloads the server binary)…");
const server = await MongoMemoryServer.create({
  instance: { port, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
});
console.log(`\n  MongoDB ready at ${server.getUri()}langa`);
console.log(`  Data directory: ${dbPath}`);
console.log("  Press Ctrl+C to stop.\n");

const stop = async () => {
  await server.stop({ doCleanup: false, force: false });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
