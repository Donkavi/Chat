import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { HeroVisual } from "@/components/marketing/hero-visual";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Link href="/" className="w-fit" aria-label="Lumos home">
          <Logo />
        </Link>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[25rem]">{children}</div>
        </main>
        <p className="text-center text-xs text-ink-subtle lg:text-left">Lumos is for adults 18+. Be kind, stay safe.</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-ambient lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12" aria-hidden>
        <div className="absolute inset-4 rounded-[2.5rem] border border-border/60 bg-bg-elevated/40" />
        <div className="relative w-full max-w-lg">
          <HeroVisual compact />
          <div className="mt-6 text-center">
            <p className="font-display text-3xl font-semibold tracking-tight text-ink">
              Meet new people. <span className="text-sunset">Right around you.</span>
            </p>
            <p className="mt-2 text-ink-muted">Discover. Connect. Chat.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
