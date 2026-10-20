"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/providers/session-provider";
import { AVATAR_ACCEPTED_TYPES, AVATAR_MAX_BYTES } from "@/shared/constants";
import type { Me } from "@/shared/types";

export function AvatarUploader() {
  const { me, setMe } = useSession();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Unsupported image", "Upload a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("That photo is too large", "Choose an image under 5 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const updated = await api.upload<Me>("/api/users/me/avatar", form);
      setMe(updated);
      toast.success("Looking good!", "Your new photo is live.");
    } catch (e) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
      setPreview(null);
      URL.revokeObjectURL(url);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setMe(await api.delete<Me>("/api/users/me/avatar"));
    } catch (e) {
      toast.error("Couldn't remove photo", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar name={me.displayName} src={preview ?? me.avatarUrl} seed={me.id} size="2xl" ring />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="absolute right-0 bottom-0 grid size-10 place-items-center rounded-full border-4 border-surface bg-primary text-white shadow-lift transition hover:bg-primary-hover disabled:opacity-70"
          aria-label="Change profile photo"
        >
          {busy ? <Spinner className="size-4" /> : <Camera className="size-4.5" />}
        </button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Profile photo</p>
        <p className="max-w-56 text-[0.8125rem] leading-snug text-ink-muted">A clear, friendly photo helps people say hello. JPEG, PNG or WebP up to 5 MB.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-sm font-semibold text-primary-ink hover:underline">
            Upload new
          </button>
          {me.avatarUrl && (
            <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-danger">
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={AVATAR_ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
