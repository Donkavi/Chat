import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { getIO } from "@/server/realtime/hub";

export async function GET() {
  let db = "down";
  try {
    await connectDb();
    db = mongoose.connection.readyState === 1 ? "up" : "down";
  } catch {
    db = "down";
  }
  return Response.json(
    { status: db === "up" ? "ok" : "degraded", db, realtime: getIO() ? "up" : "unavailable" },
    { status: db === "up" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
