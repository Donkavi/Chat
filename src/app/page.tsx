import Link from "next/link";
import { ArrowRight, Compass, MessageCircleHeart, MapPinned, ShieldCheck, EyeOff, Ban, Lock, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/current-user";
import { Logo } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ThemeIconToggle } from "@/components/ui/theme-toggle";
import { HeroVisual } from "@/components/marketing/hero-visual";

const STEPS = [
  {
    icon: MapPinned,
    kicker: "Discover",
    title: "See who's around you",
    text: "Turn on location, pick a radius from 1 to 100 km, and browse people who are online right now.",
  },
  {
    icon: Sparkles,
    kicker: "Connect",
    title: "Find your common ground",
    text: "Profiles highlight the interests you share, so the first message practically writes itself.",
  },
  {
    icon: MessageCircleHeart,
    kicker: "Chat",
    title: "Say hello in real time",
    text: "Private, instant conversations with typing indicators and read receipts. No swiping required.",
  },
];

const PRIVACY = [
  { icon: Lock, title: "Never your exact location", text: "Others only see an approximate distance like “2.5 km away”." },
  { icon: EyeOff, title: "Invisible when you want", text: "Hide from Nearby, hide your online status, or pause location in one tap." },
  { icon: Ban, title: "Block and report", text: "Blocked people can't message you or find you. Reports are reviewed by our team." },
  { icon: ShieldCheck, title: "Private conversations", text: "Only the two people in a chat can ever read it." },
];

const FACES = [
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
  "https://randomuser.me/api/portraits/men/75.jpg",
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/discover" : "/register";

  return (
    <div className="min-h-dvh bg-ambient bg-grain">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Lumos home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <a href="#how" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted transition hover:text-ink md:block">
            How it works
          </a>
          <a href="#safety" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted transition hover:text-ink md:block">
            Safety
          </a>
          <ThemeIconToggle />
          {user ? (
            <Link href="/discover" className={buttonClasses("primary", "sm")}>
              Open Lumos
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonClasses("ghost", "sm")}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClasses("primary", "sm", "hidden sm:inline-flex")}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pt-14 lg:pb-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-ink-muted shadow-soft backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-online animate-pulse-ring" />
                <span className="relative size-2 rounded-full bg-online" />
              </span>
              Now live across Sri Lanka
            </span>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.035em] text-ink sm:text-6xl xl:text-7xl">
              Meet new people.
              <br />
              <span className="text-sunset">Right around you.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted text-pretty">
              Discover interesting people nearby, start a conversation, and make new connections.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className={buttonClasses("primary", "lg", "group")}>
                <Compass className="size-5" aria-hidden />
                Start discovering
                <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              {!user && (
                <Link href="/login" className={buttonClasses("secondary", "lg")}>
                  I have an account
                </Link>
              )}
            </div>
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {FACES.map((src, i) => (
                  <Avatar key={src} name={`Member ${i + 1}`} src={src} size="md" ring />
                ))}
              </div>
              <p className="text-sm leading-snug text-ink-muted">
                People are meeting in <strong className="text-ink">Colombo</strong>, <strong className="text-ink">Kandy</strong>,{" "}
                <strong className="text-ink">Galle</strong> and beyond.
              </p>
            </div>
          </div>
          <HeroVisual />
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-10 border-y border-border/60 bg-bg-elevated/60 py-20 backdrop-blur sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="font-display text-sm font-bold tracking-[0.18em] text-primary uppercase">How it works</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight text-ink text-balance sm:text-5xl">
              Discover. Connect. Chat.
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, kicker, title, text }, i) => (
                <article
                  key={kicker}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-border bg-surface p-7 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
                >
                  <span className="absolute -top-6 -right-2 font-display text-[7rem] leading-none font-bold text-surface-2 select-none" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="relative grid size-12 place-items-center rounded-2xl bg-sunset text-white shadow-[0_10px_24px_-10px_rgb(240_83_44/0.8)]">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <p className="relative mt-6 text-xs font-bold tracking-[0.14em] text-primary-ink uppercase">{kicker}</p>
                  <h3 className="relative mt-1.5 font-display text-xl font-semibold tracking-tight text-ink">{title}</h3>
                  <p className="relative mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="safety" className="scroll-mt-10 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1320] px-6 py-12 text-white sm:px-12 sm:py-16 dark:border dark:border-border dark:bg-surface">
              <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-[#f0532c]/25 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-[#7656f5]/25 blur-3xl" aria-hidden />
              <div className="relative grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <p className="font-display text-sm font-bold tracking-[0.18em] text-[#ffb19c] uppercase">Privacy by design</p>
                  <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Your location stays yours.</h2>
                  <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-white/70">
                    Lumos does the distance maths on our servers. Your coordinates are never sent to other people — not in the app, not in our API.
                  </p>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {PRIVACY.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                      <Icon className="size-5 text-[#ffb19c]" aria-hidden />
                      <p className="mt-3 font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/65">{text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-ink text-balance sm:text-5xl">Someone interesting is nearby.</h2>
            <p className="mt-4 max-w-md text-lg text-ink-muted">It only takes a minute to set up your profile and say hello.</p>
            <Link href={primaryHref} className={buttonClasses("primary", "lg", "mt-8")}>
              {user ? "Open Discover" : "Create your free account"}
              <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:px-8">
          <Logo className="scale-90" />
          <p>Made with care in Sri Lanka · For adults 18+</p>
        </div>
      </footer>
    </div>
  );
}
