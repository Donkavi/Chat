import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", true);

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Connect (once) and reuse the connection. State is tracked on the mongoose
 * instance itself, so the custom server and Next.js route bundles each get a
 * live connection even if they end up with separate module instances.
 */
export async function connectDb(uri = env().MONGODB_URI): Promise<typeof mongoose> {
  const state = mongoose.connection.readyState;
  if (state === mongoose.ConnectionStates.connected) return mongoose;
  if (state === mongoose.ConnectionStates.connecting) {
    await mongoose.connection.asPromise();
    return mongoose;
  }
  connecting ??= mongoose
    .connect(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 8000 })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
