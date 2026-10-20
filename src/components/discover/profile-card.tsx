"use client";

import { motion } from "motion/react";
import { MapPin, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance, initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { OnlineBadge } from "@/components/ui/online-dot";
import { useLivePresence } from "@/components/providers/presence-provider";
import type { NearbyUser } from "@/shared/types";
import { useState } from "react";

const PHOTO_GRADIENTS = [
  "from-[#ffb38a] via-[#f0532c] to-[#b9306b]",
  "from-[#b9a8ff] via-[#7656f5] to-[#3d2a99]",
  "from-[#8ee3c8] via-[#21a58a] to-[#13615a]",
  "from-[#ffd38a] via-[#f0922c] to-[#c2531f]",
  "from-[#9cc8ff] via-[#4f7cf0] to-[#3a2fa8]",
];

function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return PHOTO_GRADIENTS[Math.abs(h) % PHOTO_GRADIENTS.length];
}

/** Portrait photo, or a warm gradient with large initials when there's no photo. */
export function ProfilePhoto({ user, className, sizes = "card" }: { user: Pick<NearbyUser, "id" | "displayName" | "avatarUrl">; className?: string; sizes?: "card" | "hero" }) {
  const [failed, setFailed] = useState(false);
  if (user.avatarUrl && !failed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className)}
      />
    );
  }
  return (
    <div className={cn("grid size-full place-items-center bg-gradient-to-br", gradientFor(user.id), className)}>
      <span className={cn("font-display font-bold text-white/90", sizes === "hero" ? "text-7xl" : "text-5xl")}>{initials(user.displayName)}</span>
    </div>
  );
}

export function ProfileCard({
  user,
  index,
  onOpen,
  onHello,
  helloPending,
}: {
  user: NearbyUser;
  index: number;
  onOpen: () => void;
  onHello: () => void;
  helloPending: boolean;
}) {
  const live = useLivePresence(user);
  const away = !live.isOnline && user.isOnline;
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: away ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: Math.min(index, 12) * 0.035 }}
      className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-soft transition-shadow duration-300 hover:shadow-lift sm:rounded-[1.75rem]"
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[4/5] overflow-hidden text-left outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
        aria-label={`View ${user.displayName}'s profile`}
      >
        <ProfilePhoto user={user} className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute top-3 left-3">
          {live.isOnline ? (
            <OnlineBadge />
          ) : away ? (
            <span className="rounded-full bg-black/35 px-2.5 py-1 text-[0.6875rem] font-semibold text-white/90 backdrop-blur-md">Just left</span>
          ) : null}
        </span>
        <span className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
          <span className="block font-display text-lg leading-tight font-semibold text-white sm:text-xl">
            <span className="line-clamp-1">
              <span className="sm:hidden">{user.displayName.split(" ")[0]}</span>
              <span className="hidden sm:inline">{user.displayName}</span>
              {user.age !== null && <span className="font-normal text-white/85">, {user.age}</span>}
            </span>
          </span>
          <span className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-white/85">
            <MapPin className="size-3.5" aria-hidden />
            {formatDistance(user.distanceKm)}
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        {user.bio ? (
          <p className="line-clamp-2 hidden text-sm leading-relaxed text-ink-muted sm:block">{user.bio}</p>
        ) : (
          <p className="hidden text-sm text-ink-subtle italic sm:block">No bio yet — say hi and find out more.</p>
        )}
        {user.interests.length > 0 && (
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            {user.interests.slice(0, 3).map((i) => (
              <Chip key={i}>{i}</Chip>
            ))}
            {user.interests.length > 3 && <Chip>+{user.interests.length - 3}</Chip>}
          </div>
        )}
        <div className="mt-auto flex gap-2">
          <Button
            size="sm"
            className="h-10 flex-1 rounded-2xl text-sm sm:h-11"
            onClick={onHello}
            loading={helloPending}
            aria-label={`Say hello to ${user.displayName}`}
          >
            <Hand className="size-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">Say hello 👋</span>
            <span className="sm:hidden">Hello</span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border bg-surface sm:rounded-[1.75rem]" aria-hidden>
      <div className="skeleton aspect-[4/5]" />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="skeleton hidden h-3.5 w-5/6 rounded-full sm:block" />
        <div className="skeleton hidden h-3.5 w-3/5 rounded-full sm:block" />
        <div className="hidden gap-1.5 sm:flex">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton h-10 w-full rounded-2xl sm:h-11" />
      </div>
    </div>
  );
}
