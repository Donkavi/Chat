import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is only ever requested by our own origin; camera/mic are never used.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the project root so a stray lockfile in a parent folder isn't mistaken for the workspace root.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // These packages use native bindings or rely on module-level singletons shared
  // with the custom server (server.ts), so they must not be bundled.
  serverExternalPackages: ["mongoose", "@node-rs/argon2", "sharp", "socket.io", "nodemailer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
