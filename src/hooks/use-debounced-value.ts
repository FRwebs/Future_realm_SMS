"use client";

import { useEffect, useState } from "react";

/** A value that follows `value` only once it has stopped changing for `delayMs` — so typing asks the server once, not per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return settled;
}
