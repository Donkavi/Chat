"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { AtSign, Check, Loader2, MapPin, X } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { profileUpdateSchema } from "@/lib/validation";
import { useUsernameCheck } from "@/components/hooks/use-username-check";
import { cn } from "@/lib/utils";
import { BIO_MAX_LENGTH } from "@/shared/constants";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { OnlineBadge } from "@/components/ui/online-dot";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/providers/session-provider";
import { ProfilePhoto } from "@/components/discover/profile-card";
import type { Me } from "@/shared/types";
import { AvatarUploader } from "./avatar-uploader";
import { InterestPicker } from "./interest-picker";

type Form = { displayName: string; username: string; bio: string; interests: string[]; age: string };

function toForm(me: Me): Form {
  return { displayName: me.displayName, username: me.username, bio: me.bio, interests: me.interests, age: me.age ? String(me.age) : "" };
}

export function ProfileEditor({ welcome = false }: { welcome?: boolean }) {
  const { me, setMe } = useSession();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(me));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const usernameState = useUsernameCheck(form.username, me.username);

  const dirty = useMemo(() => JSON.stringify(toForm(me)) !== JSON.stringify(form), [me, form]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      displayName: form.displayName,
      username: form.username,
      bio: form.bio,
      interests: form.interests,
      age: form.age.trim() ? Number(form.age) : null,
    };
    const parsed = profileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<Me>("/api/users/me", parsed.data);
      setMe(updated);
      setForm(toForm(updated));
      toast.success("Profile saved", "Here's how people nearby will see you.");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error("Couldn't save your profile", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const usernameHint =
    usernameState === "checking" ? (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking…
      </span>
    ) : usernameState === "available" ? (
      <span className="inline-flex items-center gap-1 text-online">
        <Check className="size-3.5" aria-hidden /> Available
      </span>
    ) : usernameState === "taken" ? (
      <span className="inline-flex items-center gap-1 text-danger">
        <X className="size-3.5" aria-hidden /> Already taken
      </span>
    ) : (
      "Letters, numbers, dots and underscores."
    );

  const preview = {
    id: me.id,
    displayName: form.displayName || "Your name",
    avatarUrl: me.avatarUrl,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Your profile</h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">Make a great first impression. Only share what you&apos;re comfortable with.</p>
      </header>

      {welcome && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-6 flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-sunset p-5 text-white shadow-lift sm:flex-row sm:items-center sm:p-6"
        >
          <span className="text-4xl" aria-hidden>
            🎉
          </span>
          <div className="flex-1">
            <p className="font-display text-xl font-semibold">Welcome to Lumos, {me.displayName.split(" ")[0]}!</p>
            <p className="mt-1 text-sm text-white/85">Add a photo and a few interests — then head to Discover to see who&apos;s around.</p>
          </div>
          <Link href="/discover" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[#b8361a] transition hover:bg-white/90">
            Go to Discover
          </Link>
        </motion.div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form onSubmit={save} className="space-y-6" noValidate>
          <section className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
            <AvatarUploader />
          </section>

          <section className="space-y-5 rounded-[1.75rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Display name" value={form.displayName} maxLength={40} onChange={(e) => set("displayName", e.target.value)} error={errors.displayName} autoComplete="name" />
              <Input
                label="Username"
                value={form.username}
                maxLength={24}
                leading={<AtSign className="size-4" />}
                onChange={(e) => set("username", e.target.value.toLowerCase())}
                error={errors.username || (usernameState === "taken" ? "That username is taken." : undefined)}
                hint={usernameHint}
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <Textarea
              label="Bio"
              value={form.bio}
              maxLength={BIO_MAX_LENGTH}
              onChange={(e) => set("bio", e.target.value)}
              error={errors.bio}
              placeholder="Coffee enthusiast, weekend hiker, always up for a kottu run…"
              trailingLabel={
                <span className={cn("text-xs tabular-nums", form.bio.length > BIO_MAX_LENGTH - 20 ? "text-primary-ink" : "text-ink-subtle")}>
                  {form.bio.length}/{BIO_MAX_LENGTH}
                </span>
              }
            />
            <div className="max-w-48">
              <Input
                label="Age (optional)"
                type="number"
                inputMode="numeric"
                min={18}
                max={120}
                value={form.age}
                onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 3))}
                error={errors.age}
                hint="You can hide it in Settings."
              />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
            <InterestPicker value={form.interests} onChange={(v) => set("interests", v)} error={errors.interests} />
          </section>

          <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-4 lg:static lg:px-0">
            <motion.div
              initial={false}
              animate={{ y: dirty ? 0 : 8, opacity: dirty ? 1 : 0.92 }}
              className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-bg-elevated/95 p-2 pl-4 shadow-lift backdrop-blur-xl lg:max-w-none lg:justify-end lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
            >
              <p className="flex-1 text-sm text-ink-muted lg:hidden">{dirty ? "You have unsaved changes" : "All changes saved"}</p>
              {dirty && (
                <Button variant="ghost" onClick={() => setForm(toForm(me))} className="hidden lg:inline-flex">
                  Discard
                </Button>
              )}
              <Button type="submit" loading={saving} disabled={!dirty || usernameState === "taken"}>
                Save changes
              </Button>
            </motion.div>
          </div>
        </form>

        {/* Live preview */}
        <aside className="hidden lg:block" aria-label="Preview">
          <div className="sticky top-10">
            <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">How others see you</p>
            <div className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-lift">
              <div className="relative aspect-[4/5]">
                <ProfilePhoto user={preview} sizes="hero" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                <OnlineBadge className="absolute top-3 left-3" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="font-display text-xl font-semibold text-white">
                    {preview.displayName}
                    {form.age && me.privacySettings.showAge && <span className="font-normal text-white/85">, {form.age}</span>}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] text-white/85">
                    <MapPin className="size-3.5" aria-hidden /> 2.5 km away
                  </p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <p className={cn("line-clamp-3 text-sm leading-relaxed", form.bio ? "text-ink-muted" : "text-ink-subtle italic")}>
                  {form.bio || "Your bio will appear here."}
                </p>
                {form.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.interests.slice(0, 3).map((i) => (
                      <Chip key={i}>{i}</Chip>
                    ))}
                    {form.interests.length > 3 && <Chip>+{form.interests.length - 3}</Chip>}
                  </div>
                )}
                <div className="pointer-events-none flex h-11 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white opacity-90">Say hello 👋</div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-ink-subtle">Distance shown is an example. Your exact location is never shared.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
