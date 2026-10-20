import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { AVATAR_MAX_BYTES } from "@/shared/constants";

/**
 * Avatar storage behind a tiny interface. `STORAGE_DRIVER=local` writes to
 * disk (single-server deployments); `cloudinary` uploads via Cloudinary's
 * signed REST API. Add S3/R2 by implementing the same two functions.
 */

const LOCAL_KEY_RE = /^avatars\/[a-f0-9-]{36}\.webp$/;

function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Validate by magic bytes (not the client's claimed MIME type), then re-encode.
 * Re-encoding strips EXIF metadata — which can include GPS coordinates —
 * and neutralises polyglot files.
 */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  if (input.length > AVATAR_MAX_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");
  if (!sniffImageType(input)) throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Upload a JPEG, PNG or WebP image.");
  try {
    return await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate() // honour EXIF orientation before metadata is dropped
      .resize(640, 640, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "That image couldn't be processed. Try another one.");
  }
}

export interface StoredFile {
  url: string;
  key: string;
}

function uploadRoot() {
  // Runtime-configured directory; not part of the build output.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().UPLOAD_DIR);
}

function cloudinarySign(params: Record<string, string>) {
  const e = env();
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + e.CLOUDINARY_API_SECRET).digest("hex");
}

function cloudinaryConfig() {
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET) {
    throw new Error("STORAGE_DRIVER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
  }
  return { cloud: e.CLOUDINARY_CLOUD_NAME, apiKey: e.CLOUDINARY_API_KEY };
}

export async function storeAvatar(webp: Buffer): Promise<StoredFile> {
  const id = randomUUID();
  if (env().STORAGE_DRIVER === "cloudinary") {
    const { cloud, apiKey } = cloudinaryConfig();
    const params = { folder: "lumos/avatars", public_id: id, timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(webp)], { type: "image/webp" }), `${id}.webp`);
    for (const [k, v] of Object.entries(params)) form.set(k, v);
    form.set("api_key", apiKey);
    form.set("signature", cloudinarySign(params));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Cloudinary upload failed with status ${res.status}`);
    const body = (await res.json()) as { secure_url: string; public_id: string };
    return { url: body.secure_url, key: `cloudinary:${body.public_id}` };
  }
  const key = `avatars/${id}.webp`;
  const file = path.join(/*turbopackIgnore: true*/ uploadRoot(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, webp);
  return { url: `/api/uploads/${key}`, key };
}

export async function deleteStoredFile(key: string | null | undefined) {
  if (!key) return;
  try {
    if (key.startsWith("cloudinary:")) {
      const { cloud, apiKey } = cloudinaryConfig();
      const params = { public_id: key.slice("cloudinary:".length), timestamp: String(Math.floor(Date.now() / 1000)) };
      const form = new FormData();
      for (const [k, v] of Object.entries(params)) form.set(k, v);
      form.set("api_key", apiKey);
      form.set("signature", cloudinarySign(params));
      await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: "POST", body: form });
      return;
    }
    if (LOCAL_KEY_RE.test(key)) await unlink(path.join(/*turbopackIgnore: true*/ uploadRoot(), key));
  } catch {
    // Best effort: an orphaned file is not worth failing the user's request over.
  }
}

/** Read a locally stored upload. The key is validated so it can never escape UPLOAD_DIR. */
export async function readLocalUpload(key: string): Promise<Buffer | null> {
  if (!LOCAL_KEY_RE.test(key)) return null;
  try {
    return await readFile(path.join(/*turbopackIgnore: true*/ uploadRoot(), key));
  } catch {
    return null;
  }
}
