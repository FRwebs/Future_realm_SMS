import { registryStudents } from "@/lib/modules/students-data";

/**
 * The audit log, the integrity monitors and the school's own data-protection
 * record.
 *
 * Nothing on these screens can be edited. The log is immutable and kept for ten
 * years, and it covers Future Realm's own access to this workspace as plainly
 * as it covers the school's — a vendor session is an entry like any other.
 */

export type AuditCategory =
  | "Scores"
  | "Exports"
  | "Attendance"
  | "Finance"
  | "Vendor"
  | "Sensitive"
  | "Approvals"
  | "Guardians";

export type AuditEntry = {
  when: string;
  actor: string;
  role: string;
  /** Marks a Future Realm person rather than a member of the school. */
  vendor?: boolean;
  action: string;
  detail: string;
  category: AuditCategory;
};

export const auditEntries: AuditEntry[] = [
  { when: "Today, 09:41", actor: "Mr S. Adeyemi", role: "Exam Officer", action: "Requested a score correction", detail: "Tunde Ogunlesi · Chemistry · 29 → 51 · “question 6 marked out of 5 instead of 15”", category: "Scores" },
  { when: "Today, 09:14", actor: "Mr S. Adeyemi", role: "Exam Officer", action: "Generated a broadsheet", detail: "SSS 2A · Second Term · computed totals view · exported to Excel", category: "Exports" },
  { when: "Today, 08:12", actor: "Adaeze Nwosu", role: "Principal · you", action: "Marked a register", detail: "JSS 2A · 4 September · 31 present, 2 absent, 1 late · 48 seconds", category: "Attendance" },
  { when: "Today, 08:02", actor: "Mrs C. Obi", role: "Bursar", action: "Recorded a payment", detail: "Fatima Bello · ₦339,000 · bank transfer · GTB/2609/883914 · receipt 1842", category: "Finance" },
  { when: "Yesterday, 22:04", actor: "Tobi Aluko", role: "Future Realm", vendor: true, action: "Opened a support session", detail: "Read-only · 22 minutes · ticket #4821 · viewed 3 message campaigns", category: "Vendor" },
  { when: "Yesterday, 16:38", actor: "Adaeze Nwosu", role: "Principal · you", action: "Viewed a sensitive record", detail: "Aisha Mohammed · counselling notes · access logged and the family may request this log", category: "Sensitive" },
  { when: "Yesterday, 14:11", actor: "Mrs F. Adeniyi", role: "Exam Officer", action: "Approved 12 score sheets", detail: "JSS 1 · English Language · examination component · no anomalies flagged", category: "Approvals" },
  { when: "2 Sep, 11:20", actor: "Dr E. Nwosu", role: "Proprietor", action: "Returned an approval", detail: "Backdated register · “state which network outage — the annex or the whole school?”", category: "Approvals" },
  { when: "2 Sep, 09:55", actor: "Miss G. Etim", role: "Registrar", action: "Resolved a submission", detail: "Contact update · Mr Tayo Ade · accepted · old number recorded as superseded", category: "Guardians" },
];

export type VendorSession = {
  who: string;
  role: string;
  when: string;
  duration: string;
  why: string;
  access: "Read-only" | "Elevated · confirmed";
};

/**
 * Future Realm's own access to this workspace.
 *
 * Elevated access requires the school's recorded confirmation before it
 * proceeds — a vendor never quietly holds more than read-only.
 */
export const vendorSessions: VendorSession[] = [
  { who: "Tobi Aluko", role: "Account Manager", when: "Yesterday", duration: "22 min", why: "Ticket #4821 — investigating a failed SMS batch", access: "Read-only" },
  { who: "Ngozi Iheanacho", role: "Support Engineer", when: "28 Aug", duration: "41 min", why: "Ticket #4712 — offline register failed to sync on one device", access: "Read-only" },
  { who: "Tobi Aluko", role: "Account Manager", when: "14 Aug", duration: "8 min", why: "Ticket #4680 — credit top-up applied to the wrong channel", access: "Read-only" },
  { who: "Ngozi Iheanacho", role: "Support Engineer", when: "11 Mar 2024", duration: "3h 12min", why: "Migration assistance — elevated access confirmed by Dr E. Nwosu at 09:04", access: "Elevated · confirmed" },
];

export const auditTotals = {
  entries: "184,220",
  categories: 11,
  sensitiveReads: 4,
  exports: 9,
  retention: "10 years",
};

/* --------------------------------------------------------------- Monitors */

export type IntegrityMonitor = {
  monitor: string;
  open: number;
  found: string;
  age: string;
};

/**
 * Ten monitors. A monitor with nothing open still says what it looked for —
 * a clean check is a result, not an absence.
 */
export const integrityMonitors: IntegrityMonitor[] = [
  { monitor: "Score entered outside the window", open: 2, found: "Two Project scores entered on 2 September · the window closed 13 March", age: "2 days" },
  { monitor: "Score edited after publication", open: 0, found: "Nothing found — the policy locks scores after submission", age: "—" },
  { monitor: "Duplicate bank reference", open: 1, found: "GTB/2609/881204 submitted twice, 6 minutes apart, for two students", age: "3 days" },
  { monitor: "Payment with no invoice", open: 2, found: "₦42,000 and ₦18,000 received against no published invoice", age: "5 days" },
  { monitor: "Attendance on a closed day", open: 1, found: "JSS 1C marked on 30 August — a mid-term break day", age: "5 days" },
  { monitor: "Segregation of duties", open: 0, found: "A standing school-scale exception is declared — see below", age: "—" },
  { monitor: "Unusual bulk action", open: 1, found: "62 student promotions committed in 4 minutes on 20 August · typed confirmation was given", age: "15 days" },
  { monitor: "Unusual sensitive read", open: 0, found: "4 sensitive reads this term, all by holders of the group, all logged", age: "—" },
  { monitor: "Unclosed cash-up", open: 2, found: "1 September with a ₦2,000 variance · 3 September not counted", age: "9 days" },
  { monitor: "Export outside working hours", open: 0, found: "Every export this term was taken between 07:00 and 19:00 WAT", age: "—" },
];

export const openFlags = integrityMonitors.reduce((total, monitor) => total + monitor.open, 0);

export type SecurityCheck = {
  check: string;
  count: number;
  state: "Critical" | "Attention" | "Normal";
  detail: string;
  action: string;
};

export const securityChecks: SecurityCheck[] = [
  { check: "Users without two-factor", count: 6, state: "Critical", detail: "One holds full-school export", action: "Require it" },
  { check: "Dormant accounts", count: 1, state: "Attention", detail: "Mr Peter Obi · 96 days", action: "Suspend" },
  { check: "Active sessions", count: 12, state: "Normal", detail: "9 devices · 3 users signed in twice", action: "Terminate" },
  { check: "Failed logins, 7 days", count: 14, state: "Attention", detail: "11 from the dormant account", action: "Review" },
  { check: "Permission changes, 30 days", count: 4, state: "Normal", detail: "2 above template, both with reasons", action: "Review" },
  { check: "Exports, 30 days", count: 9, state: "Normal", detail: "All by permitted holders", action: "Review" },
  { check: "Sensitive reads, 30 days", count: 4, state: "Normal", detail: "All by group holders, all logged", action: "Review" },
];

/* -------------------------------------------------------- Data protection */

export type SubjectRequestType =
  | "Access"
  | "Correction"
  | "Objection or withdrawal"
  | "Portability"
  | "Erasure";

export type SubjectRequest = {
  reference: string;
  type: SubjectRequestType;
  requester: string;
  about: string;
  owner: string;
  ownerRole: string;
  /** Days remaining against the statutory 30, or the date it closed. */
  daysLeft: string;
  closed?: boolean;
};

export const subjectRequests: SubjectRequest[] = [
  { reference: "DSR/26/0011", type: "Access", requester: "Mr Sani Mohammed", about: "Aisha · SSS 2A", owner: "Mrs C. Obi", ownerRole: "DPO", daysLeft: "4 days" },
  { reference: "DSR/26/0012", type: "Correction", requester: "Mrs I. Adebayo", about: "Chioma · SSS 2A", owner: "Miss G. Etim", ownerRole: "Registrar", daysLeft: "19 days" },
  { reference: "DSR/26/0013", type: "Objection or withdrawal", requester: "Mrs A. Nwankwo", about: "Chioma · no arm", owner: "Mrs C. Obi", ownerRole: "DPO", daysLeft: "24 days" },
  { reference: "DSR/26/0014", type: "Portability", requester: "Mr C. Nwachukwu", about: "Peter · SSS 3A", owner: "Mrs C. Obi", ownerRole: "DPO", daysLeft: "27 days" },
  { reference: "DSR/26/0009", type: "Erasure", requester: "Anyanwu family", about: "Ngozi · withdrawn", owner: "Mrs C. Obi", ownerRole: "DPO", daysLeft: "Closed 22 Aug", closed: true },
];

export const openRequests = subjectRequests.filter((entry) => !entry.closed);

export type RetentionClass = {
  dataClass: string;
  retention: string;
  basis: string;
  hosted: string;
};

export const retentionSchedule: RetentionClass[] = [
  { dataClass: "Student academic record", retention: "Permanent", basis: "Legitimate interest · a transcript may be requested decades later", hosted: "Nigeria" },
  { dataClass: "Attendance records", retention: "7 years", basis: "Education authority requirement", hosted: "Nigeria" },
  { dataClass: "Financial records", retention: "7 years", basis: "Tax and audit requirement", hosted: "Nigeria" },
  { dataClass: "Health and welfare notes", retention: "Until 25th birthday", basis: "Explicit consent · sensitive category", hosted: "Nigeria" },
  { dataClass: "Safeguarding records", retention: "Until 25th birthday", basis: "Legal obligation · sensitive category", hosted: "Nigeria" },
  { dataClass: "Message and delivery logs", retention: "2 years", basis: "Legitimate interest · dispute resolution", hosted: "Nigeria" },
  { dataClass: "Audit log", retention: "10 years", basis: "Legal obligation · immutable", hosted: "Nigeria" },
];

/** Students with no core consent on file, of the whole roll. */
export const consentGap = 6;
export const consentHeld = registryStudents.length - consentGap;
