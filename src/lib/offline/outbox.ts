/**
 * Work captured on this device while it had no connection.
 *
 * Only two kinds of write are held, because they are the two the product promises to take offline: a register
 * submitted, and scores typed. Everything else needs a connection and says so. Each held write carries the moment it was
 * captured and an id the device made up, so the school's record can tell "changed since" from "changed by me" and a
 * retry never applies one twice.
 */

export type OutboxEntry = {
  clientId: string;
  kind: "ATTENDANCE" | "SCORE_ENTRY";
  classId: string;
  subjectId?: string;
  capturedAt: string;
  label: string;
  deviceLabel?: string;
  body: Record<string, unknown>;
};

export const OUTBOX_KEYS = { ATTENDANCE: "offline:attendance", SCORE_ENTRY: "offline:scores" } as const;
export const REPLAY_ENDPOINT = "/api/v1/sync/replay";

const ATTENDANCE = /^\/api\/v1\/attendance-management\/mark\/([^/]+)\/submit$/;
const SCORES = /^\/api\/v1\/score-results\/enter\/([^/]+)\/([^/]+)\/save$/;

/** Is this write one the device may hold? Returns what the server needs to judge it later. */
export function offlineTarget(endpoint: string, method: string): Pick<OutboxEntry, "kind" | "classId" | "subjectId"> | null {
  if (method.toUpperCase() !== "POST") return null;
  const register = ATTENDANCE.exec(endpoint);
  if (register) return { kind: "ATTENDANCE", classId: register[1] };
  const scores = SCORES.exec(endpoint);
  if (scores) return { kind: "SCORE_ENTRY", classId: scores[1], subjectId: scores[2] };
  return null;
}

/** A failure to reach the server at all, as opposed to the server answering "no". */
export function noConnection(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError;
}

function read(kind: OutboxEntry["kind"]): OutboxEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEYS[kind]) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function write(kind: OutboxEntry["kind"], entries: OutboxEntry[]) {
  try {
    if (entries.length) localStorage.setItem(OUTBOX_KEYS[kind], JSON.stringify(entries));
    else localStorage.removeItem(OUTBOX_KEYS[kind]);
  } catch {
    /* storage full or blocked: the caller has already been told it was not kept */
  }
}

export function readOutbox(): OutboxEntry[] {
  return [...read("ATTENDANCE"), ...read("SCORE_ENTRY")];
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Hold a write. A register for the same arm and day replaces the one held before it — the later marks are the intended ones. */
export function enqueue(target: NonNullable<ReturnType<typeof offlineTarget>>, body: Record<string, unknown>, label: string): OutboxEntry | null {
  const entry: OutboxEntry = { clientId: newId(), ...target, capturedAt: new Date().toISOString(), label, body };
  const held = read(target.kind).filter((other) => !(target.kind === "ATTENDANCE" && other.classId === target.classId && other.body.date === body.date));
  write(target.kind, [...held, entry]);
  return read(target.kind).some((other) => other.clientId === entry.clientId) ? entry : null;
}

export type FlushResult = { sent: number; applied: number; conflicts: number; refused: string[]; remaining: number };

function csrf() {
  return document.cookie.split("; ").find((item) => item.startsWith("fr_csrf="))?.split("=")[1] ?? "";
}

/** Send everything held. What the server answered for is removed; what it could not be asked stays for next time. */
export async function flushOutbox(): Promise<FlushResult> {
  const held = readOutbox();
  const result: FlushResult = { sent: 0, applied: 0, conflicts: 0, refused: [], remaining: held.length };
  if (!held.length || (typeof navigator !== "undefined" && navigator.onLine === false)) return result;
  for (let at = 0; at < held.length; at += 50) {
    const batch = held.slice(at, at + 50);
    let answers: Array<{ clientId: string; state: string; message: string }>;
    try {
      const response = await fetch(REPLAY_ENDPOINT, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ entries: batch }) });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: typeof answers };
      if (!response.ok || !payload.data) break; // not signed in, or the server is unwell: keep everything, try again later
      answers = payload.data;
    } catch {
      break;
    }
    const done = new Set(answers.map((answer) => answer.clientId));
    for (const kind of ["ATTENDANCE", "SCORE_ENTRY"] as const) write(kind, read(kind).filter((entry) => !done.has(entry.clientId)));
    for (const answer of answers) {
      result.sent += 1;
      if (answer.state === "APPLIED") result.applied += 1;
      else if (answer.state === "CONFLICT") result.conflicts += 1;
      else result.refused.push(answer.message);
    }
  }
  result.remaining = readOutbox().length;
  return result;
}
