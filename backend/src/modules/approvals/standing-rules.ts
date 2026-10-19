import { ConfigStore } from "../staff-access/staff-access.shared";

/**
 * A standing rule is a decision the school has agreed needs no human.
 *
 * Only one kind is real today, because it is the only kind a module calls: a record change so small it can
 * only be a correction — a letter in a surname. The rule decides it at the moment it is requested, says so on
 * the record, and every firing is counted and logged. A rule can be revoked at once.
 */

export type StandingRule = { kind: "RECORD_CHANGE_SMALL"; fields: string[]; maxChars: number; state: "Active" | "Revoked"; createdBy: string; createdById: string; createdAt: string; fired: number; why: string; revokedAt?: string };

export const RULE_FIELDS = ["Given name", "Surname", "Home address", "Nationality"];

/** How many characters apart two spellings are — a change this small can only be a correction. */
export function distance(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}

/** The active rule that covers this change, if the school has agreed one — and counts the firing. */
export async function ruleFor(schoolId: string, change: { field: string; before: string | null; after: string }): Promise<{ id: string; name: string } | null> {
  const store = new ConfigStore(schoolId, "standing-rules");
  const rules = await store.list<StandingRule>();
  for (const rule of rules) {
    const data = rule.data;
    if (data.state !== "Active" || data.kind !== "RECORD_CHANGE_SMALL" || !data.fields.includes(change.field)) continue;
    if (!change.before || distance(change.before, change.after) > data.maxChars) continue;
    await store.put(rule.code ?? rule.id, rule.name, { ...data, fired: (data.fired ?? 0) + 1 });
    return { id: rule.id, name: rule.name };
  }
  return null;
}
