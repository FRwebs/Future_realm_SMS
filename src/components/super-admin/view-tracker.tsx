"use client";

import { useEffect } from "react";

/** Quietly tells My Work that this record was opened, so it can be offered again under "Recently viewed". */
export function ViewTracker({ kind, entityId, label, href }: { kind: "SCHOOL" | "TICKET" | "PARTNER" | "MIGRATION" | "OTHER"; entityId: string; label: string; href: string }) {
  useEffect(() => {
    const csrf = document.cookie.split("; ").find((item) => item.startsWith("fr_csrf="))?.split("=")[1] ?? "";
    void fetch("/api/super-admin/my-work/views", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ kind, entityId, label, href }) }).catch(() => undefined);
  }, [kind, entityId, label, href]);
  return null;
}
