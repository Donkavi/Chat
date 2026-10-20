"use client";

import type { Me } from "@/shared/types";
import { SessionProvider } from "./session-provider";
import { RealtimeProvider } from "./realtime-provider";
import { PresenceProvider } from "./presence-provider";
import { ChatProvider } from "./chat-provider";
import { LocationProvider } from "./location-provider";

/** Providers for the signed-in app. */
export function AppProviders({ me, children }: { me: Me; children: React.ReactNode }) {
  return (
    <SessionProvider initialMe={me}>
      <RealtimeProvider>
        <PresenceProvider>
          <LocationProvider>
            <ChatProvider>{children}</ChatProvider>
          </LocationProvider>
        </PresenceProvider>
      </RealtimeProvider>
    </SessionProvider>
  );
}
