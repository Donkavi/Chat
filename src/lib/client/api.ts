"use client";

import type { ApiErrorBody } from "@/shared/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "You appear to be offline. Check your connection and try again.");
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON (e.g. a proxy error page).
  }
  if (!res.ok) {
    const err = (parsed as ApiErrorBody | null)?.error;
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      window.dispatchEvent(new CustomEvent("langa:unauthenticated"));
    }
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? "Something went wrong. Please try again.", err?.fields);
  }
  return (parsed as { data: T } | null)?.data as T;
}

export const api = {
  get: <T>(url: string, init?: RequestInit) => request<T>("GET", url, undefined, init),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body ?? {}),
  delete: <T>(url: string, body?: unknown) => request<T>("DELETE", url, body),
  upload: <T>(url: string, form: FormData) => request<T>("POST", url, form),
};

export function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
