import { z } from "zod";

const DEV_SECRET = "dev-only-insecure-secret-change-me-0123456789abcdef";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/langa"),
  APP_URL: z.url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32).optional(),
  STORAGE_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("Langa <no-reply@example.com>"),
});

export type Env = z.infer<typeof schema> & { AUTH_SECRET: string };

let cached: Env | null = null;

/** Parsed, validated server environment. Never import this from client components. */
export function env(): Env {
  if (cached) return cached;
  // Treat empty strings from .env files as "unset" so optional values behave.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.parse(raw);
  let secret = parsed.AUTH_SECRET;
  if (!secret) {
    if (parsed.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set (32+ characters) in production.");
    }
    secret = DEV_SECRET;
  }
  cached = { ...parsed, AUTH_SECRET: secret };
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
