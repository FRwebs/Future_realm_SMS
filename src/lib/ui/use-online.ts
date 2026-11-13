"use client";

import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Whether this device has a connection right now. The server render and the first paint say yes, so nothing flashes "offline". */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
