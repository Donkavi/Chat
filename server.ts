/**
 * Langa server: one Node process serving the Next.js app and the Socket.IO
 * realtime endpoint on the same port.
 *
 * Persistent WebSockets need a long-lived process, so deploy this to a host
 * that runs Node servers (a VM, container, Render, Railway, Fly.io…) rather
 * than a serverless platform. See README → Deployment.
 */
import { createServer } from "node:http";
import next from "next";
import nextEnv from "@next/env";

const dev = process.env.NODE_ENV !== "production";
// Load .env* files before any module reads process.env.
nextEnv.loadEnvConfig(process.cwd(), dev);

const { env } = await import("./src/lib/env");
const { connectDb, disconnectDb } = await import("./src/lib/db");
const { createSocketServer } = await import("./src/server/realtime/socket-server");
const { PresenceService } = await import("./src/server/realtime/presence");

const config = env();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";
const appOrigin = new URL(config.APP_URL).origin;
const allowedOrigins = [
  ...new Set([appOrigin, ...(dev ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`] : [])]),
];

async function main() {
  await connectDb();
  await PresenceService.resetAll();

  const app = next({ dev, hostname: "localhost", port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });
  const realtime = createSocketServer(httpServer, { allowedOrigins });

  httpServer.listen(port, hostname, () => {
    console.log(`> Langa ready on ${appOrigin} (${dev ? "development" : "production"})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`> ${signal} received, shutting down…`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await realtime.close().catch(() => {});
    await disconnectDb().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err instanceof Error ? err.message : err);
  process.exit(1);
});
