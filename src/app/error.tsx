"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="text-5xl" aria-hidden>
          😕
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-ink-muted">An unexpected error occurred. It&apos;s not you — please try again.</p>
        <Button size="lg" className="mt-8" onClick={reset}>
          <RotateCw className="size-4.5" aria-hidden /> Try again
        </Button>
      </div>
    </main>
  );
}
