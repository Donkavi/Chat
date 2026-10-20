"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import { EyeOff, MapPin, MoreHorizontal, PauseCircle, RefreshCw, Users, ArrowRight } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { RADIUS_OPTIONS_KM, type RadiusKm } from "@/lib/geo";
import { greeting } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/providers/session-provider";
import { useLocation } from "@/components/providers/location-provider";
import { useTrackPresence } from "@/components/providers/presence-provider";
import { useNow } from "@/components/hooks/use-now";
import { ProfileSheet } from "@/components/people/profile-sheet";
import { useStartChat } from "@/components/people/use-start-chat";
import type { NearbyResponse, NearbyUser } from "@/shared/types";
import { LocationGate } from "./location-gate";
import { ProfileCard, ProfileCardSkeleton } from "./profile-card";
import { RadiusSelector } from "./radius-selector";
import { Radar } from "./radar";

const RADIUS_KEY = "langa-radius";
const RADIUS_EVENT = "langa-radius-change";
const DEFAULT_RADIUS: RadiusKm = 10;
const AUTO_REFRESH_MS = 45_000;

let memoryRadius: RadiusKm | null = null;

function readRadius(): RadiusKm {
  if (memoryRadius) return memoryRadius;
  try {
    const v = Number(localStorage.getItem(RADIUS_KEY));
    return (RADIUS_OPTIONS_KM as readonly number[]).includes(v) ? (v as RadiusKm) : DEFAULT_RADIUS;
  } catch {
    return DEFAULT_RADIUS;
  }
}

function writeRadius(r: RadiusKm) {
  memoryRadius = r;
  try {
    localStorage.setItem(RADIUS_KEY, String(r));
  } catch {
    // Remembering the radius is a convenience only.
  }
  window.dispatchEvent(new Event(RADIUS_EVENT));
}

function subscribeRadius(cb: () => void) {
  window.addEventListener(RADIUS_EVENT, cb);
  return () => window.removeEventListener(RADIUS_EVENT, cb);
}

/** The chosen radius, remembered per browser. */
function useRadius() {
  return useSyncExternalStore(subscribeRadius, readRadius, () => DEFAULT_RADIUS);
}

function updatedLabel(iso: string | null, now: number) {
  if (!iso) return "";
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  return "Updated over an hour ago";
}

type LoadState = "idle" | "loading" | "ready" | "error" | "needs-location";

export function DiscoverView() {
  const { me } = useSession();
  const location = useLocation();
  const toast = useToast();
  const now = useNow();
  const { start, pendingId } = useStartChat();

  const radius = useRadius();
  const [people, setPeople] = useState<NearbyUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<NearbyUser | null>(null);
  const requestSeq = useRef(0);

  const fetchPage = useCallback(
    (opts: { silent?: boolean } = {}) => {
      const seq = ++requestSeq.current;
      return api
        .get<NearbyResponse>(`/api/nearby?radiusKm=${radius}`)
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setPeople(res.users);
          setCursor(res.nextCursor);
          setState("ready");
          setError(null);
        })
        .catch((e) => {
          if (seq !== requestSeq.current) return;
          if (e instanceof ApiError && e.code === "LOCATION_REQUIRED") {
            setState("needs-location");
            // Already permitted in this browser: refresh silently instead of asking.
            if (location.permission === "granted") void location.enable();
            return;
          }
          if (!opts.silent) {
            setError(e instanceof Error ? e.message : "Couldn't load people nearby.");
            setState("error");
          }
        });
    },
    [radius, location],
  );

  // (Re)load when sharing turns on, the radius changes, or our location is refreshed.
  useEffect(() => {
    if (!location.sharing) return;
    void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.sharing, radius, location.updatedAt]);

  // Keep the list lively: quiet refresh while the tab is visible.
  useEffect(() => {
    if (!location.sharing || state !== "ready") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchPage({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [location.sharing, state, fetchPage]);

  useTrackPresence(people.map((p) => p.id));

  const changeRadius = (r: RadiusKm) => {
    if (r === radius) return;
    setState("loading");
    writeRadius(r);
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await api.get<NearbyResponse>(`/api/nearby?radiusKm=${radius}&cursor=${cursor}`);
      setPeople((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.users.filter((u) => !seen.has(u.id))];
      });
      setCursor(res.nextCursor);
    } catch (e) {
      toast.error("Couldn't load more people", e instanceof Error ? e.message : undefined);
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchPage({ silent: true });
    setRefreshing(false);
  };

  const nextRadius = RADIUS_OPTIONS_KM.find((r) => r > radius);
  const firstName = me.displayName.split(" ")[0];
  const showGate = !location.sharing || location.permission === "denied" || state === "needs-location";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-10 lg:pt-10">
      {/* Header */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-ink-muted">
            {greeting()}, {firstName} 👋
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">People around you</h1>
          <p className="mt-2 max-w-lg text-[0.9375rem] text-ink-muted">
            Online now and open to meeting someone new. Say hello — the best conversations start with one.
          </p>
        </div>

        {location.sharing && location.permission !== "denied" && (
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-[0.8125rem] font-medium text-ink shadow-soft">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-online animate-pulse-ring" />
                <span className="relative size-2 rounded-full bg-online" />
              </span>
              Sharing approximate location
              <span className="hidden text-ink-subtle sm:inline">· {updatedLabel(location.updatedAt, now)}</span>
            </span>
            <Menu
              label="Location options"
              items={[
                { label: "Update location now", icon: <MapPin />, onSelect: () => void location.enable() },
                {
                  label: "Pause location sharing",
                  icon: <PauseCircle />,
                  onSelect: async () => {
                    await location.disable();
                    setPeople([]);
                    setState("idle");
                    toast.info("Location sharing paused", "You're hidden from Nearby until you turn it back on.");
                  },
                },
              ]}
              trigger={({ toggle, open, id }) => (
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="rounded-full"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-controls={open ? id : undefined}
                  aria-label="Location options"
                >
                  <MoreHorizontal className="size-4.5" />
                </Button>
              )}
            />
          </div>
        )}
      </header>

      {!me.isDiscoverable && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3.5 text-sm text-ink sm:flex-row sm:items-center">
          <EyeOff className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1">
            <strong>You&apos;re hidden from Nearby.</strong> You can browse, but others won&apos;t see you here.
          </p>
          <Link href="/settings#privacy" className="font-semibold text-primary-ink hover:underline">
            Change in Settings
          </Link>
        </div>
      )}

      {showGate ? (
        <div className="mt-8">
          <LocationGate stale={location.sharing && state === "needs-location"} />
        </div>
      ) : (
        <>
          {/* Radius */}
          <div className="sticky top-0 z-20 -mx-4 mt-8 border-b border-transparent bg-bg/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:w-auto">
                <RadiusSelector value={radius} onChange={changeRadius} />
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-sm text-ink-muted" aria-live="polite">
                  {state === "ready" &&
                    (people.length === 0
                      ? `No one within ${radius} km`
                      : `${people.length}${cursor ? "+" : ""} ${people.length === 1 ? "person" : "people"} within ${radius} km`)}
                </p>
                <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh" disabled={refreshing || state === "loading"}>
                  <RefreshCw className={cn("size-4.5", refreshing && "animate-spin")} />
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {state === "loading" || state === "idle" ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 min-[1800px]:grid-cols-5" aria-busy="true" aria-label="Loading people nearby">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProfileCardSkeleton key={i} />
                ))}
              </div>
            ) : state === "error" ? (
              <div className="py-16 text-center">
                <p className="font-display text-xl font-semibold">Something went wrong</p>
                <p className="mt-1 text-sm text-ink-muted">{error}</p>
                <Button
                  className="mt-6"
                  variant="secondary"
                  onClick={() => {
                    setState("loading");
                    void fetchPage();
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : people.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <Radar className="size-44">
                  <span className="relative grid size-14 place-items-center rounded-full bg-surface text-primary shadow-lift">
                    <Users className="size-6" aria-hidden />
                  </span>
                </Radar>
                <h2 className="mt-8 font-display text-2xl font-semibold tracking-tight text-ink">It&apos;s quiet around here</h2>
                <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
                  Nobody&apos;s online within {radius} km right now. Try a wider radius, or check back soon — people pop online all the time.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  {nextRadius && (
                    <Button onClick={() => changeRadius(nextRadius)}>
                      Search {nextRadius} km <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  )}
                  <Button variant="secondary" onClick={refresh} loading={refreshing}>
                    <RefreshCw className="size-4" aria-hidden /> Check again
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 min-[1800px]:grid-cols-5">
                  <AnimatePresence mode="popLayout">
                    {people.map((p, i) => (
                      <ProfileCard
                        key={p.id}
                        user={p}
                        index={i}
                        onOpen={() => setSelected(p)}
                        onHello={() => void start(p.id)}
                        helloPending={pendingId === p.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {cursor && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                      Show more people
                    </Button>
                  </div>
                )}
                {!cursor && nextRadius && people.length < 6 && (
                  <p className="mt-10 text-center text-sm text-ink-muted">
                    Want more?{" "}
                    <button type="button" onClick={() => changeRadius(nextRadius)} className="font-semibold text-primary-ink hover:underline">
                      Widen to {nextRadius} km
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      <ProfileSheet
        userId={selected?.id ?? null}
        preview={selected}
        onClose={() => setSelected(null)}
        onBlocked={(id) => setPeople((prev) => prev.filter((p) => p.id !== id))}
      />
    </div>
  );
}
