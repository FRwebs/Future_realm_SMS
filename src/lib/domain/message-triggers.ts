/**
 * The moments the platform writes to a school by itself. Each can be worded from an approved message template; with none
 * attached it uses the wording in the code. Placeholders are written {{like_this}}.
 */
export const TRIGGERS = [
  { key: "trial.ending", label: "Free trial ends soon", vars: ["school", "endDate"] },
  { key: "trial.ended", label: "Free trial has ended (school is read-only)", vars: ["school", "lockDate"] },
  { key: "trial.lock_reminder", label: "School will be locked soon", vars: ["school", "days"] },
  { key: "trial.locked", label: "School has been locked", vars: ["school"] },
  { key: "discount.reverify", label: "Discount needs verifying again", vars: ["school", "kind", "endDate"] },
  { key: "discount.ended", label: "Discount has ended", vars: ["school", "kind"] },
  { key: "dormant.notice", label: "School has been inactive", vars: ["school", "days", "address", "releaseDate"] },
  { key: "address.released", label: "Web address has been released", vars: ["address", "days"] },
  { key: "trial.day1", label: "Trial day 1 — download your first report card", vars: ["school"] },
  { key: "trial.day3", label: "Trial day 3 — import your students", vars: ["school"] },
  { key: "trial.day7", label: "Trial day 7 — invite your teachers", vars: ["school"] },
  { key: "trial.day14", label: "Trial day 14 — progress summary", vars: ["school", "students", "teachers", "setup"] },
  { key: "trial.pricing", label: "Trial — days left, plus pricing for their student count", vars: ["school", "days", "students"] }
] as const;

export type TriggerKey = (typeof TRIGGERS)[number]["key"];
export const TRIGGER_KEYS = TRIGGERS.map((t) => t.key) as [TriggerKey, ...TriggerKey[]];
