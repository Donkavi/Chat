"use client";

import { useEffect, useState } from "react";
import { MapPin, MoreHorizontal, ShieldAlert, Ban, Sparkles, CalendarDays, MessageCircle, UserCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatDistance, formatLastSeen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Menu } from "@/components/ui/menu";
import { OnlineBadge } from "@/components/ui/online-dot";
import { useToast } from "@/components/ui/toast";
import { useLivePresence, useTrackPresence } from "@/components/providers/presence-provider";
import { ProfilePhoto } from "@/components/discover/profile-card";
import type { ProfileView, PublicUser } from "@/shared/types";
import { BlockDialog, ReportDialog } from "./safety-dialogs";
import { useStartChat } from "./use-start-chat";

type Preview = PublicUser & { distanceKm?: number | null };

/**
 * Full profile in a sheet. Renders instantly from `preview` (the card data)
 * and fills in details (shared interests, existing chat, block state) on fetch.
 */
export function ProfileSheet({
  userId,
  preview,
  onClose,
  onBlocked,
  hideMessageAction,
}: {
  userId: string | null;
  preview?: Preview | null;
  onClose: () => void;
  onBlocked?: (userId: string) => void;
  hideMessageAction?: boolean;
}) {
  const toast = useToast();
  // Results are keyed by user id, so switching profiles never shows stale data.
  const [loaded, setLoaded] = useState<{ id: string; profile?: ProfileView; error?: string } | null>(null);
  const [dialog, setDialog] = useState<"block" | "report" | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const { start, pendingId } = useStartChat();
  const current = loaded && loaded.id === userId ? loaded : null;
  const profile = current?.profile ?? null;
  const error = current?.error ?? null;
  const setProfile = (update: (p: ProfileView) => ProfileView) =>
    setLoaded((l) => (l?.profile ? { ...l, profile: update(l.profile) } : l));

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .get<ProfileView>(`/api/users/${userId}`)
      .then((p) => !cancelled && setLoaded({ id: userId, profile: p }))
      .catch((e) => !cancelled && setLoaded({ id: userId, error: e instanceof Error ? e.message : "Couldn't load this profile." }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const data: Preview | ProfileView | null = profile ?? (preview && preview.id === userId ? preview : null);
  useTrackPresence(data ? [data.id] : []);
  const live = useLivePresence(data);
  const distance = profile ? profile.distanceKm : (preview?.distanceKm ?? null);
  const shared = new Set((profile?.sharedInterests ?? []).map((s) => s.toLowerCase()));
  const blocked = profile?.isBlockedByMe ?? false;

  return (
    <>
      <Modal open={!!userId} onClose={onClose} size="md" bare title={data?.displayName ?? "Profile"} hideTitle>
        {!data ? (
          error ? (
            <div className="p-8 text-center">
              <p className="font-display text-lg font-semibold">Profile unavailable</p>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
          ) : (
            <div aria-busy className="space-y-4 p-6">
              <div className="skeleton aspect-[4/3] rounded-3xl" />
              <div className="skeleton h-6 w-1/2 rounded-full" />
              <div className="skeleton h-4 w-3/4 rounded-full" />
            </div>
          )
        ) : (
          <div>
            <div className="relative aspect-[4/3.4] overflow-hidden sm:aspect-[4/3]">
              <ProfilePhoto user={data} sizes="hero" />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
              {live.isOnline && !blocked && <OnlineBadge className="absolute top-4 left-4" />}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <h2 className="font-display text-3xl font-semibold tracking-tight text-white">
                  {data.displayName}
                  {data.age !== null && <span className="font-normal text-white/85">, {data.age}</span>}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
                  <span>@{data.username}</span>
                  {distance !== null && distance !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {formatDistance(distance)}
                    </span>
                  )}
                  {!live.isOnline && !blocked && live.lastSeenAt && <span>{formatLastSeen(live.lastSeenAt)}</span>}
                </div>
              </div>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {blocked && (
                <div className="flex items-center gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-ink">
                  <Ban className="size-5 shrink-0 text-danger" aria-hidden />
                  <p className="flex-1">You&apos;ve blocked {data.displayName}. They can&apos;t contact you.</p>
                </div>
              )}

              <section>
                <h3 className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">About</h3>
                <p className={cn("mt-2 text-[0.9375rem] leading-relaxed text-pretty", data.bio ? "text-ink" : "text-ink-subtle italic")}>
                  {data.bio || `${data.displayName} hasn't written a bio yet.`}
                </p>
              </section>

              {data.interests.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">Interests</h3>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {data.interests.map((i) => (
                      <Chip key={i} tone={shared.has(i.toLowerCase()) ? "primary" : "neutral"} className="px-3 py-1.5 text-[0.8125rem]">
                        {shared.has(i.toLowerCase()) && <Sparkles className="size-3.5" aria-hidden />}
                        {i}
                      </Chip>
                    ))}
                  </div>
                  {shared.size > 0 && (
                    <p className="mt-2.5 text-[0.8125rem] text-primary-ink">
                      You both like {[...(profile?.sharedInterests ?? [])].slice(0, 2).join(" and ")}
                      {shared.size > 2 ? " and more" : ""} — a great conversation starter.
                    </p>
                  )}
                </section>
              )}

              {profile && (
                <p className="flex items-center gap-2 text-[0.8125rem] text-ink-subtle">
                  <CalendarDays className="size-4" aria-hidden />
                  Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </p>
              )}

              <div className="flex gap-2">
                {blocked ? (
                  <Button
                    className="flex-1"
                    variant="secondary"
                    size="lg"
                    loading={unblocking}
                    onClick={async () => {
                      setUnblocking(true);
                      try {
                        await api.delete(`/api/users/${data.id}/block`);
                        setProfile((p) => ({ ...p, isBlockedByMe: false }));
                        toast.success(`${data.displayName} is unblocked`);
                      } catch (e) {
                        toast.error("Couldn't unblock", e instanceof Error ? e.message : undefined);
                      } finally {
                        setUnblocking(false);
                      }
                    }}
                  >
                    <UserCheck className="size-4.5" aria-hidden />
                    Unblock
                  </Button>
                ) : (
                  !hideMessageAction && (
                    <Button className="flex-1" size="lg" loading={pendingId === data.id} onClick={() => start(data.id)}>
                      {profile?.conversationId ? (
                        <>
                          <MessageCircle className="size-4.5" aria-hidden />
                          Continue chatting
                        </>
                      ) : (
                        "Say hello 👋"
                      )}
                    </Button>
                  )
                )}
                <Menu
                  label="More actions"
                  items={[
                    ...(!blocked ? [{ label: "Block", icon: <Ban />, onSelect: () => setDialog("block"), tone: "danger" as const }] : []),
                    { label: "Report", icon: <ShieldAlert />, onSelect: () => setDialog("report"), tone: "danger" as const },
                  ]}
                  trigger={({ toggle, open, id }) => (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-13 px-0"
                      onClick={toggle}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-controls={open ? id : undefined}
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-5" />
                    </Button>
                  )}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
      {data && (
        <>
          <BlockDialog
            open={dialog === "block"}
            onClose={() => setDialog(null)}
            user={data}
            onBlocked={() => {
              onBlocked?.(data.id);
              onClose();
            }}
          />
          <ReportDialog
            open={dialog === "report"}
            onClose={() => setDialog(null)}
            user={data}
            onBlocked={() => {
              onBlocked?.(data.id);
              onClose();
            }}
          />
        </>
      )}
    </>
  );
}
