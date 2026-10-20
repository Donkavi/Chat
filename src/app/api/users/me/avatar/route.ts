import { AppError } from "@/lib/errors";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { AVATAR_MAX_BYTES } from "@/shared/constants";
import { authed } from "@/server/http";
import { removeAvatar, setAvatar } from "@/server/services/users";

export const POST = authed(async ({ req, user }) => {
  enforce(`upload:${user._id}`, LIMITS.uploads, "Too many uploads. Try again in a few minutes.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > AVATAR_MAX_BYTES + 64 * 1024) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError("BAD_REQUEST", "Upload an image file.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Upload an image file.");
  if (file.size > AVATAR_MAX_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");
  return setAvatar(user, Buffer.from(await file.arrayBuffer()));
});

export const DELETE = authed(async ({ user }) => removeAvatar(user));
