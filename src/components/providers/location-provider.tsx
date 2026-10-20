"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { LOCATION_REFRESH_MS } from "@/shared/constants";
import { useSession } from "./session-provider";

export type GeoPermission = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

interface LocationContextValue {
  permission: GeoPermission;
  sharing: boolean;
  updatedAt: string | null;
  busy: boolean;
  error: string | null;
  /** Ask the browser for a position (prompting if needed) and share it. Call from a user gesture. */
  enable: () => Promise<boolean>;
  /** Stop sharing and erase the stored location on the server. */
  disable: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside <LocationProvider>");
  return ctx;
}

function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      // City-level accuracy is plenty for "people within N km" and saves battery.
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 2 * 60_000,
    }),
  );
}

function describeGeoError(err: unknown): { message: string; denied: boolean } {
  if (typeof GeolocationPositionError !== "undefined" && err instanceof GeolocationPositionError) {
    if (err.code === err.PERMISSION_DENIED) return { message: "Location access is blocked in your browser.", denied: true };
    if (err.code === err.TIMEOUT) return { message: "Finding your location took too long. Try again.", denied: false };
    return { message: "Your location isn't available right now. Check your device's location settings.", denied: false };
  }
  if (err instanceof ApiError) return { message: err.message, denied: false };
  return { message: "We couldn't get your location. Try again.", denied: false };
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { me, patchMe } = useSession();
  const [permission, setPermission] = useState<GeoPermission>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  // Track the browser permission without ever triggering a prompt.
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const sync = () => status && setPermission(status.state as GeoPermission);
    const query: Promise<PermissionStatus | GeoPermission> = !("geolocation" in navigator)
      ? Promise.resolve("unsupported")
      : navigator.permissions
        ? navigator.permissions.query({ name: "geolocation" }).catch(() => "prompt" as const)
        : Promise.resolve("prompt");
    void query.then((res) => {
      if (cancelled) return;
      if (typeof res === "string") return setPermission(res);
      status = res;
      sync();
      res.addEventListener("change", sync);
    });
    return () => {
      cancelled = true;
      status?.removeEventListener("change", sync);
    };
  }, []);

  const push = useCallback(
    async (silent: boolean) => {
      if (inflight.current) return false;
      inflight.current = true;
      if (!silent) {
        setBusy(true);
        setError(null);
      }
      try {
        const pos = await readPosition();
        setPermission("granted");
        const res = await api.patch<{ locationUpdatedAt: string }>("/api/location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        patchMe({ isLocationSharingEnabled: true, locationUpdatedAt: res.locationUpdatedAt });
        setError(null);
        return true;
      } catch (err) {
        const { message, denied } = describeGeoError(err);
        if (denied) setPermission("denied");
        if (!silent || denied) setError(message);
        return false;
      } finally {
        inflight.current = false;
        if (!silent) setBusy(false);
      }
    },
    [patchMe],
  );

  const enable = useCallback(() => push(false), [push]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await api.delete("/api/location");
      patchMe({ isLocationSharingEnabled: false, locationUpdatedAt: null });
      setError(null);
    } finally {
      setBusy(false);
    }
  }, [patchMe]);

  // Background refresh: only when sharing is on, permission is already granted,
  // and the tab is visible — never prompts and never spams the API.
  const updatedAtRef = useRef(me.locationUpdatedAt);
  useEffect(() => {
    updatedAtRef.current = me.locationUpdatedAt;
  }, [me.locationUpdatedAt]);

  useEffect(() => {
    if (!me.isLocationSharingEnabled || permission !== "granted") return;
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      const last = updatedAtRef.current ? new Date(updatedAtRef.current).getTime() : 0;
      if (Date.now() - last >= LOCATION_REFRESH_MS - 5_000) void push(true);
    };
    maybeRefresh();
    const id = setInterval(maybeRefresh, 60_000);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [me.isLocationSharingEnabled, permission, push]);

  const value = useMemo<LocationContextValue>(
    () => ({
      permission,
      sharing: me.isLocationSharingEnabled,
      updatedAt: me.locationUpdatedAt,
      busy,
      error,
      enable,
      disable,
    }),
    [permission, me.isLocationSharingEnabled, me.locationUpdatedAt, busy, error, enable, disable],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
