"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Compass, MessageCircle, UserRound, Settings2, WifiOff, MapPin, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeIconToggle } from "@/components/ui/theme-toggle";
import { useSession } from "@/components/providers/session-provider";
import { useChats } from "@/components/providers/chat-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { useLocation } from "@/components/providers/location-provider";

const NAV = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 26 }}
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold text-white tabular-nums ring-2 ring-bg",
            className,
          )}
        >
          {count > 99 ? "99+" : count}
          <span className="sr-only"> unread messages</span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function ConnectionBanner() {
  const { status } = useRealtime();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (status === "connected") return;
    // Don't flash the banner for quick reconnects.
    const t = setTimeout(() => setShow(true), 2500);
    return () => {
      clearTimeout(t);
      setShow(false);
    };
  }, [status]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 pt-safe"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning-soft px-4 py-2 text-sm font-medium text-ink shadow-lift">
            <WifiOff className="size-4 text-warning" aria-hidden />
            Reconnecting… messages will sync when you&apos;re back.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, signOut } = useSession();
  const { unreadTotal } = useChats();
  const { sharing } = useLocation();
  const inThread = /^\/chats\/[^/]+/.test(pathname);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-ambient">
      <ConnectionBanner />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lift"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col border-r border-border/70 bg-bg-elevated/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/discover" className="px-3" aria-label="Langa home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-[0.9375rem] font-semibold transition",
                  active ? "text-ink" : "text-ink-muted hover:bg-surface-2/70 hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl border border-border bg-surface shadow-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className={cn("relative size-5", active && "text-primary")} strokeWidth={active ? 2.4 : 2} aria-hidden />
                <span className="relative flex-1">{label}</span>
                {href === "/chats" && <UnreadBadge count={unreadTotal} className="relative" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <Link
            href="/settings#privacy"
            className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface/80 px-3.5 py-3 text-sm transition hover:border-border-strong"
          >
            <span className={cn("grid size-8 place-items-center rounded-xl", sharing ? "bg-primary-soft text-primary" : "bg-surface-2 text-ink-subtle")}>
              <MapPin className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{sharing ? "Location on" : "Location off"}</span>
              <span className="block truncate text-xs text-ink-muted">{sharing ? "Approximate distance only" : "You're hidden from nearby"}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
            <Avatar name={me.displayName} src={me.avatarUrl} seed={me.id} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{me.displayName}</p>
              <p className="truncate text-xs text-ink-muted">@{me.username}</p>
            </div>
            <ThemeIconToggle className="size-9 rounded-xl" />
            <button
              type="button"
              onClick={() => void signOut()}
              className="grid size-9 place-items-center rounded-xl text-ink-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4.5" />
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className={cn("lg:pl-68", !inThread && "pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0")}>
        {children}
      </main>

      {/* Mobile bottom navigation */}
      {!inThread && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-bg-elevated/85 pb-safe backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-4 px-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold transition",
                      active ? "text-primary" : "text-ink-subtle hover:text-ink",
                    )}
                  >
                    <span className="relative">
                      {active && (
                        <motion.span
                          layoutId="tab-active"
                          className="absolute -inset-x-3.5 -inset-y-1 rounded-full bg-primary-soft"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <Icon className="relative size-5.5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                      {href === "/chats" && <UnreadBadge count={unreadTotal} className="absolute -top-2 -right-3" />}
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
