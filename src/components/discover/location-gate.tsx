"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { MapPin, ShieldCheck, EyeOff, PauseCircle, Lock, RefreshCw, MessageCircle } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { useLocation } from "@/components/providers/location-provider";
import { Radar } from "./radar";

const PROMISES = [
  { icon: ShieldCheck, title: "Approximate distance only", text: "Others see “2.5 km away” — never your exact location." },
  { icon: EyeOff, title: "You're in control", text: "Hide from Nearby or pause sharing anytime in Settings." },
  { icon: PauseCircle, title: "Only while you're active", text: "You appear to others only when you're online." },
];

/**
 * Shown on Discover until location sharing is on. The browser permission
 * prompt is only triggered by the button — never on page load.
 */
export function LocationGate({ stale = false }: { stale?: boolean }) {
  const { permission, enable, busy, error } = useLocation();
  const denied = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative overflow-hidden rounded-[2rem] border border-border bg-surface shadow-soft"
      aria-labelledby="location-gate-title"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[var(--glow-1)] blur-3xl" aria-hidden />
      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-14 lg:p-12">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-ink">
            <MapPin className="size-3.5" aria-hidden />
            {denied ? "Location blocked" : stale ? "Location out of date" : "One quick step"}
          </span>
          <h2 id="location-gate-title" className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink text-balance sm:text-4xl">
            {denied
              ? "Location access is turned off"
              : unsupported
                ? "Your browser can't share location"
                : stale
                  ? "Refresh your location to see who's around"
                  : "See who's around you right now"}
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted text-pretty sm:text-base">
            {denied
              ? "Lumos needs your approximate location to find people nearby. You can allow it in your browser settings — it takes a few seconds."
              : unsupported
                ? "Try a recent version of Chrome, Safari, Firefox or Edge to discover people nearby. You can still chat with your existing connections."
                : "Lumos uses your location to find people within your chosen radius. We only use it to calculate approximate distances."}
          </p>

          {denied ? (
            <ol className="mt-6 space-y-3 rounded-2xl bg-surface-2 p-5 text-sm text-ink">
              {[
                <>Click the <Lock className="inline size-3.5 align-[-2px]" aria-label="lock" /> or site-settings icon next to the address bar.</>,
                <>Find <strong>Location</strong> and choose <strong>Allow</strong>.</>,
                <>Come back here and tap <strong>Try again</strong>.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold text-primary shadow-soft">{i + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
              <li className="pl-9 text-[0.8125rem] text-ink-muted">On a phone, also check that location is enabled for your browser in system settings.</li>
            </ol>
          ) : (
            !unsupported && (
              <ul className="mt-6 grid gap-3">
                {PROMISES.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{title}</span>
                      <span className="block text-sm text-ink-muted">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}

          {error && !denied && (
            <p role="alert" className="mt-5 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {!unsupported && (
              <Button size="lg" loading={busy} onClick={() => void enable()} className="sm:min-w-56">
                {denied ? (
                  <>
                    <RefreshCw className="size-4.5" aria-hidden /> Try again
                  </>
                ) : (
                  <>
                    <MapPin className="size-4.5" aria-hidden /> {stale ? "Update my location" : "Enable location"}
                  </>
                )}
              </Button>
            )}
            <Link href="/chats" className={buttonClasses("secondary", "lg")}>
              <MessageCircle className="size-4.5" aria-hidden />
              Go to my chats
            </Link>
          </div>
        </div>
        <div className="hidden justify-center lg:flex">
          <Radar className="size-72" />
        </div>
      </div>
    </motion.section>
  );
}
