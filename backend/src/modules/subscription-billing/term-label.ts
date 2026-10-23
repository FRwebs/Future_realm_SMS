/**
 * A term, written the way a school says it: "Second Term 2025/2026".
 *
 * Kept here rather than in `billing.shared` so the mid-term services do not
 * depend on a helper that module may or may not export yet — this one is tiny,
 * has no imports, and cannot drift.
 */
export function termLabel(term: { name: string; academicSession?: { name: string } | null }): string {
  return `${term.name} ${term.academicSession?.name ?? ""}`.trim();
}
