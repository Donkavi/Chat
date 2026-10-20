"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import type { Me } from "@/shared/types";

interface SessionContextValue {
  me: Me;
  setMe: (me: Me) => void;
  patchMe: (patch: Partial<Me>) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export function SessionProvider({ initialMe, children }: { initialMe: Me; children: React.ReactNode }) {
  const [me, setMe] = useState(initialMe);
  const router = useRouter();

  useEffect(() => {
    const onUnauth = () => router.replace("/login?expired=1");
    window.addEventListener("langa:unauthenticated", onUnauth);
    return () => window.removeEventListener("langa:unauthenticated", onUnauth);
  }, [router]);

  const patchMe = useCallback((patch: Partial<Me>) => setMe((m) => ({ ...m, ...patch })), []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.replace("/");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(() => ({ me, setMe, patchMe, signOut }), [me, patchMe, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
