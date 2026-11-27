import type { Prisma } from "@prisma/client";

/**
 * What changed between two states of a record: only the fields that differ, as they were and as they are now — the "before" and
 * "after" an audit entry has to carry. Dates travel as ISO strings, money as text, so the log reads the same wherever it is opened.
 */
const NEVER = new Set(["updatedAt", "createdAt"]);

function plain(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && typeof (value as { toFixed?: unknown }).toFixed === "function") return String(value);
  if (typeof value === "object") return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  return value as Prisma.InputJsonValue;
}

export function changeOf(before: object | null | undefined, after: object, only?: string[]): { old: Prisma.InputJsonObject; new: Prisma.InputJsonObject } | null {
  const was = (before ?? {}) as Record<string, unknown>;
  const now = after as Record<string, unknown>;
  const oldValue: Record<string, Prisma.InputJsonValue | null> = {};
  const newValue: Record<string, Prisma.InputJsonValue | null> = {};
  for (const key of only ?? Object.keys(now)) {
    if (NEVER.has(key) || !(key in now)) continue;
    const a = plain(was[key]);
    const b = plain(now[key]);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    oldValue[key] = a;
    newValue[key] = b;
  }
  return Object.keys(newValue).length ? { old: oldValue as Prisma.InputJsonObject, new: newValue as Prisma.InputJsonObject } : null;
}

/** The reason a person gave for a change, if they gave one. */
export const reasonOf = (body: unknown): string | undefined => {
  const value = (body as { reason?: unknown } | null)?.reason;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
};
