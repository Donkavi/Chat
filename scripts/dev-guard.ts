import nextEnv from "@next/env";

/**
 * Load .env files and refuse to run development tooling against anything that
 * doesn't look like a local database, unless ALLOW_SEED=true is set explicitly.
 */
export function loadDevEnv() {
  nextEnv.loadEnvConfig(process.cwd(), true);
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/langa";
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run development scripts with NODE_ENV=production.");
  }
  const local = /^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(uri);
  if (!local && process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "MONGODB_URI is not a local database. Set ALLOW_SEED=true only if you are sure this is a disposable development database.",
    );
  }
  return { uri, appUrl: process.env.APP_URL || "http://localhost:3000" };
}
