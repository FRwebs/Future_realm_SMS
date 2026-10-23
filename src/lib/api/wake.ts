"use client";

import { useSyncExternalStore } from "react";

/**
 * Waking the API.
 *
 * On a plan that stops an idle service, the first request after a quiet spell waits for the API to start — up to a minute — and a sign-in
 * that was sent into that wait looks like a failure. So the moment a page that people arrive on is open, it quietly asks the API's health
 * door (`/api/health`, no sign-in, no database) and keeps asking until it answers. By the time someone has typed their email and password
 * it is usually awake; if it is not, the sign-in form says so and waits, rather than failing.
 *
 * A tab asks at most every four minutes (the service sleeps after fifteen), and asks once however many things on the page want to know.
 */
export type ApiState = "checking" | "waking" | "ready" | "unreachable";

const FRESH_FOR_MS = 4 * 60_000;
const STORAGE_KEY = "fr_api_ready";
const ATTEMPTS = 10;
const ATTEMPT_TIMEOUT_MS = 20_000;
const SHOW_WAKING_AFTER_MS = 1_200;

let state: ApiState = "checking";
let running: Promise<ApiState> | null = null;
const listeners = new Set<() => void>();

function set(next: ApiState) {
  if (state === next) return;
  state = next;
  listeners.forEach((listener) => listener());
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ping(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    if (!response.ok) return false;
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function remembered(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(STORAGE_KEY));
    return Boolean(at) && Date.now() - at < FRESH_FOR_MS;
  } catch {
    return false;
  }
}

/** Ask until the API answers. Safe to call from anywhere, any number of times: there is one asking at a time. */
export function wakeApi(): Promise<ApiState> {
  if (typeof window === "undefined") return Promise.resolve("ready");
  if (running) return running;
  if (remembered()) {
    set("ready");
    return Promise.resolve("ready");
  }
  // A fast answer should not flash a "waking" message: it only appears if the first answer is slow.
  const slow = setTimeout(() => set("waking"), SHOW_WAKING_AFTER_MS);
  running = (async () => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      if (await ping()) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
          /* private window: it simply asks again next time */
        }
        set("ready");
        return "ready" as ApiState;
      }
      set("waking");
      await sleep(2_000);
    }
    set("unreachable");
    return "unreachable" as ApiState;
  })().finally(() => {
    clearTimeout(slow);
    running = null;
  });
  return running;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether the API is answering yet, as far as this tab knows. */
export function useApiState(): ApiState {
  return useSyncExternalStore(subscribe, () => state, () => "checking" as ApiState);
}
