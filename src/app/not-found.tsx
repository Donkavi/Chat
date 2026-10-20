import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Radar } from "@/components/discover/radar";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ambient px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <Radar className="size-40">
          <span className="relative font-display text-3xl font-bold text-primary">404</span>
        </Radar>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">Nothing nearby here</h1>
        <p className="mt-2 text-ink-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link href="/" className={buttonClasses("primary", "lg", "mt-8")}>
          <Compass className="size-5" aria-hidden /> Take me home
        </Link>
      </div>
    </main>
  );
}
