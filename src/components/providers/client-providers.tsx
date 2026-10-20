"use client";

import { MotionConfig } from "motion/react";
import { ToastProvider } from "@/components/ui/toast";

/** Providers needed on every page, signed in or not. */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
