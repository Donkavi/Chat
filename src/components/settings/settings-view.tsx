"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Radar, Eye, Cake, Palette, ShieldOff, LogOut, Trash2, Lock, Check, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { SwitchRow } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ThemeSegmented } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/providers/session-provider";
import { useLocation } from "@/components/providers/location-provider";
import type { Me, PublicUser } from "@/shared/types";

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 rounded-[1.75rem] border border-border bg-surface p-5 shadow-soft sm:p-7" aria-labelledby={`${id ?? title}-h`}>
      <h2 id={`${id ?? title}-h`} className="font-display text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function VisibilitySummary({ me }: { me: Me }) {
  const rows = [
    { ok: true, text: "Your name, photo, bio and interests" },
    { ok: me.privacySettings.showAge && me.age !== null, text: "Your age" },
    { ok: me.privacySettings.showOnlineStatus, text: "When you're online or last active" },
    { ok: me.isDiscoverable && me.isLocationSharingEnabled, text: "You in Nearby, with approximate distance" },
    { ok: false, text: "Your exact location — never shared with anyone", always: true },
  ];
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-4">
      <p className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">What others can see</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.text} className="flex items-center gap-2.5 text-sm">
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", r.ok ? "bg-online/15 text-online" : "bg-surface-3 text-ink-subtle")}>
              {r.ok ? <Check className="size-3.5" aria-hidden /> : r.always ? <Lock className="size-3" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            </span>
            <span className={r.ok ? "text-ink" : "text-ink-muted"}>
              <span className="sr-only">{r.ok ? "Visible: " : "Hidden: "}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlockedList() {
  const toast = useToast();
  const [list, setList] = useState<PublicUser[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<PublicUser[]>("/api/users/me/blocks")
      .then(setList)
      .catch(() => setList([]));
  }, []);
  if (list === null)
    return (
      <div className="space-y-3 py-3" aria-busy="true">
        <div className="skeleton h-12 rounded-2xl" />
      </div>
    );
  if (list.length === 0) return <p className="py-3 text-sm text-ink-muted">You haven&apos;t blocked anyone.</p>;
  return (
    <ul className="divide-y divide-border">
      {list.map((u) => (
        <li key={u.id} className="flex items-center gap-3 py-3">
          <Avatar name={u.displayName} src={u.avatarUrl} seed={u.id} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{u.displayName}</p>
            <p className="truncate text-xs text-ink-muted">@{u.username}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={pending === u.id}
            onClick={async () => {
              setPending(u.id);
              try {
                await api.delete(`/api/users/${u.id}/block`);
                setList((l) => l?.filter((x) => x.id !== u.id) ?? null);
                toast.success(`${u.displayName} is unblocked`);
              } catch (e) {
                toast.error("Couldn't unblock", e instanceof Error ? e.message : undefined);
              } finally {
                setPending(null);
              }
            }}
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Delete your account?" description="This permanently deletes your profile, photos, conversations and messages. It can't be undone.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.delete("/api/users/me", { password: password || undefined, confirm });
            router.replace("/?deleted=1");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't delete your account.");
            setBusy(false);
          }
        }}
      >
        {me.hasPassword && (
          <Input label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        <Input label='Type "DELETE" to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Keep my account
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={confirm !== "DELETE" || (me.hasPassword && !password)}>
            <Trash2 className="size-4" aria-hidden /> Delete forever
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SettingsView() {
  const { me, setMe, signOut } = useSession();
  const location = useLocation();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updatePrivacy = async (key: "isDiscoverable" | "showOnlineStatus" | "showAge", value: boolean) => {
    setPending(key);
    try {
      setMe(await api.patch<Me>("/api/users/me/privacy", { [key]: value }));
    } catch (e) {
      toast.error("Couldn't update your settings", e instanceof Error ? e.message : undefined);
    } finally {
      setPending(null);
    }
  };

  const toggleLocation = async (on: boolean) => {
    setPending("location");
    try {
      if (on) {
        const ok = await location.enable();
        if (!ok) toast.error("Location unavailable", location.permission === "denied" ? "Allow location for this site in your browser settings." : undefined);
      } else {
        await location.disable();
        toast.info("Location sharing is off", "Your stored location has been deleted.");
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Settings</h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">Privacy, appearance and your account.</p>
      </header>

      <div className="mt-8 space-y-6">
        <Section id="privacy" title="Privacy" description="You decide who can find you and what they see.">
          <div className="divide-y divide-border">
            <SwitchRow
              icon={<MapPin className="size-5" />}
              label="Share my location"
              description={
                location.permission === "denied"
                  ? "Location is blocked in your browser. Allow it in site settings to turn this on."
                  : "Used only to calculate approximate distances. Turning this off deletes your stored location."
              }
              checked={location.sharing}
              disabled={pending === "location" || location.busy}
              onChange={toggleLocation}
            />
            <SwitchRow
              icon={<Radar className="size-5" />}
              label="Appear in Nearby"
              description="Let people around you discover your profile while you're online."
              checked={me.isDiscoverable}
              disabled={pending === "isDiscoverable"}
              onChange={(v) => updatePrivacy("isDiscoverable", v)}
            />
            <SwitchRow
              icon={<Eye className="size-5" />}
              label="Show when I'm online"
              description="If off, nobody sees your online dot or last-active time."
              checked={me.privacySettings.showOnlineStatus}
              disabled={pending === "showOnlineStatus"}
              onChange={(v) => updatePrivacy("showOnlineStatus", v)}
            />
            <SwitchRow
              icon={<Cake className="size-5" />}
              label="Show my age"
              description={me.age === null ? "Add your age on your profile first." : "Display your age next to your name."}
              checked={me.privacySettings.showAge}
              disabled={pending === "showAge"}
              onChange={(v) => updatePrivacy("showAge", v)}
            />
          </div>
          <VisibilitySummary me={me} />
        </Section>

        <Section title="Appearance">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-10 place-items-center rounded-2xl bg-surface-2 text-ink-muted">
                <Palette className="size-5" aria-hidden />
              </span>
              <p className="text-[0.9375rem] font-semibold text-ink">Theme</p>
            </div>
            <ThemeSegmented />
          </div>
        </Section>

        <Section title="Blocked people" description="Blocked people can't message you or see you in Nearby.">
          <BlockedList />
        </Section>

        <Section title="Account">
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Email</p>
                <p className="truncate text-sm text-ink-muted">{me.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Sign out</p>
                <p className="text-sm text-ink-muted">Sign out on this device.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                <LogOut className="size-4" aria-hidden /> Sign out
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-danger">
                  <ShieldOff className="size-4" aria-hidden /> Delete account
                </p>
                <p className="text-sm text-ink-muted">Permanently remove your profile and all your conversations.</p>
              </div>
              <Button variant="danger-soft" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </div>
          </div>
        </Section>
      </div>
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
