import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { ConfigStore } from "../staff-access/staff-access.shared";

/**
 * How a school's decisions are routed.
 *
 * Decisions live in the modules that raise them — a score correction in Score Entry, a waiver in Fee
 * Management — and the queue reads them where they are. What the queue owns is the routing: who may decide
 * each kind from here, how long it may wait, and what happens when it has waited too long.
 */

export type RouteType = "SCORE_CORRECTION" | "SCORE_SHEET" | "RESULTS_PUBLICATION" | "ATTENDANCE_CORRECTION" | "FEE_WAIVER" | "RECORD_CHANGE" | "LEAVE" | "STAFF_ACCESS" | "MASS_COMMUNICATION" | "TIMETABLE_CHANGE" | "OTHER";

export type RouteDefault = { type: RouteType; name: string; module: string; moduleSlug: string; approver: string; second: string; escalateDays: number; why: string; blocks: string; bulk: boolean; evidence: boolean };

/** In the order the queue lists them. */
export const ROUTE_DEFAULTS: RouteDefault[] = [
  { type: "SCORE_SHEET", name: "Score sheet approval", module: "Scores & Results", moduleSlug: "score-entry-results", approver: "Exam Officer", second: "", escalateDays: 3, why: "The last check before a mark is final", blocks: "Every report card in the arm", bulk: true, evidence: false },
  { type: "SCORE_CORRECTION", name: "Score correction", module: "Scores & Results", moduleSlug: "score-entry-results", approver: "Exam Officer", second: "Principal", escalateDays: 5, why: "Changes a number a family may already have seen", blocks: "One child's result", bulk: false, evidence: false },
  { type: "RESULTS_PUBLICATION", name: "Results publication", module: "Report Cards", moduleSlug: "report-cards", approver: "Principal", second: "Proprietor", escalateDays: 3, why: "Irreversible once published", blocks: "The arm's report cards", bulk: false, evidence: false },
  { type: "ATTENDANCE_CORRECTION", name: "Register correction", module: "Attendance", moduleSlug: "attendance", approver: "Principal", second: "", escalateDays: 2, why: "Changes a child's attendance figure", blocks: "One register", bulk: true, evidence: false },
  { type: "FEE_WAIVER", name: "Fee waiver", module: "Fee Management", moduleSlug: "fee-management", approver: "Principal", second: "", escalateDays: 7, why: "Money leaving the ledger", blocks: "A family's balance", bulk: false, evidence: false },
  { type: "RECORD_CHANGE", name: "Record change", module: "Student Records", moduleSlug: "student-records", approver: "Principal", second: "", escalateDays: 5, why: "Evidence required", blocks: "The child's record", bulk: true, evidence: false },
  { type: "LEAVE", name: "Staff leave", module: "Staff & Access", moduleSlug: "staff-access", approver: "Principal", second: "", escalateDays: 3, why: "Decided stage by stage under the leave sequence", blocks: "The member of staff's cover", bulk: true, evidence: false },
  { type: "STAFF_ACCESS", name: "Access above the role template", module: "Staff & Access", moduleSlug: "staff-access", approver: "Proprietor", second: "", escalateDays: 3, why: "More reach than the role intends", blocks: "The staff member", bulk: false, evidence: false },
  { type: "MASS_COMMUNICATION", name: "Mass communication above threshold", module: "Communication", moduleSlug: "communication-center", approver: "Principal", second: "", escalateDays: 1, why: "A message to many families", blocks: "The send", bulk: false, evidence: false },
  { type: "TIMETABLE_CHANGE", name: "Timetable publication", module: "Classes & Timetable", moduleSlug: "class-timetable", approver: "Principal", second: "", escalateDays: 3, why: "Changes where every teacher stands", blocks: "The new week", bulk: false, evidence: false },
  { type: "OTHER", name: "Anything else", module: "Approvals & Workflow", moduleSlug: "approvals-workflow", approver: "Principal", second: "", escalateDays: 5, why: "A decision with no module of its own", blocks: "Whatever it was raised for", bulk: false, evidence: false },
];

export type RouteConfig = { approver: string; second: string; escalateDays: number; escalateTo: string; evidence: boolean; bulk: boolean; who: string; notify: string };

export const APPROVER_LABELS = ["Principal", "Proprietor", "Exam Officer", "Bursar", "Administrator", "Head of Department", "Vice Principal", "HR Officer"];
export const ESCALATE_TO = ["The Principal", "The Proprietor", "Nobody — it just waits"];
export const WHO_MAY_SUBMIT = ["Anyone with Create in the module", "Heads of department and above", "School leadership only"];

/** Which of a route's settings the module that raises the decision actually checks when somebody submits it. */
export const ENFORCED: Partial<Record<RouteType, { evidence: boolean; who: boolean }>> = {
  SCORE_CORRECTION: { evidence: true, who: true },
  RECORD_CHANGE: { evidence: true, who: true },
  FEE_WAIVER: { evidence: false, who: true },
};

const LEADERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN", "PRINCIPAL", "ADMINISTRATOR", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES", "HEAD_TEACHER"]);
const HEADS = new Set([...LEADERS, "HEAD_OF_DEPARTMENT", "EXAM_OFFICER", "EXAMINATION_OFFICER"]);
export const NOTIFY = ["On every step", "On the decision only", "Never"];

/** The roles behind each label a school can choose — a role, never a person, so a resignation does not strand a route. */
export const ROLES_OF: Record<string, string[]> = {
  Principal: ["PRINCIPAL"],
  Proprietor: ["PROPRIETOR", "SCHOOL_OWNER"],
  "Exam Officer": ["EXAM_OFFICER", "EXAMINATION_OFFICER"],
  Bursar: ["BURSAR", "ACCOUNTANT"],
  Administrator: ["ADMINISTRATOR", "ADMIN_OFFICER"],
  "Head of Department": ["HEAD_OF_DEPARTMENT"],
  "Vice Principal": ["VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES"],
  "HR Officer": ["HR_OFFICER"],
};

/** Who can decide anything routed here, whoever the route names: the people who own the school's decisions. */
export const OWNERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN", "PRINCIPAL"]);
/** Who sees every decision in flight, not only their own. */
export const OVERSIGHT = new Set([...OWNERS, "ADMINISTRATOR", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION"]);

export const roleLabel = (role: string) => role.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
export const labelOfRole = (role: string) => Object.entries(ROLES_OF).find(([, roles]) => roles.includes(role))?.[0] ?? roleLabel(role);

export type Route = RouteDefault & RouteConfig & { overridden: boolean };

/**
 * Called by the module that raises a decision, at the moment somebody submits it: may this person raise it,
 * and has the evidence the route asks for come with it? Only what the module can really check is checked.
 */
export async function assertSubmission(session: Pick<SessionPayload, "schoolId" | "role">, type: RouteType, o: { evidence?: boolean } = {}) {
  const route = (await loadRoutes(session.schoolId)).find((entry) => entry.type === type);
  const enforced = ENFORCED[type];
  if (!route || !enforced) return;
  if (enforced.who && route.who === WHO_MAY_SUBMIT[1] && !HEADS.has(session.role)) throw new ForbiddenException(`The school's route for a ${route.name.toLowerCase()} lets heads of department and above raise it.`);
  if (enforced.who && route.who === WHO_MAY_SUBMIT[2] && !LEADERS.has(session.role)) throw new ForbiddenException(`The school's route for a ${route.name.toLowerCase()} lets only school leadership raise it.`);
  if (enforced.evidence && route.evidence && !o.evidence) throw new BadRequestException(`The school's route for a ${route.name.toLowerCase()} asks for evidence, and none came with this one.`);
}

export const defaultConfig = (item: RouteDefault): RouteConfig => ({ approver: item.approver, second: item.second, escalateDays: item.escalateDays, escalateTo: "The Principal", evidence: item.evidence, bulk: item.bulk, who: WHO_MAY_SUBMIT[0], notify: NOTIFY[0] });

export async function loadRoutes(schoolId: string): Promise<Route[]> {
  const rows = await new ConfigStore(schoolId, "approval-routes").list<Partial<RouteConfig>>();
  const byCode = new Map(rows.map((row) => [row.code, row.data]));
  return ROUTE_DEFAULTS.map((item) => {
    const own = byCode.get(item.type);
    return { ...item, ...defaultConfig(item), ...(own ?? {}), overridden: Boolean(own) } as Route;
  });
}

/** May this person decide something on this route, at this step? */
export function mayDecide(session: Pick<SessionPayload, "role">, route: Route, step: 1 | 2): boolean {
  if (OWNERS.has(session.role)) return true;
  const label = step === 2 && route.second ? route.second : route.approver;
  return (ROLES_OF[label] ?? []).includes(session.role);
}

/** Never negative: a record whose decision is stamped before its request was raised took no time, not less than none. */
export const daysBetween = (from: Date, to: Date = new Date()) => Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);

/* ───────────────────────── what a decision looks like, wherever it lives ───────────────────────── */

export type Source = "SCORE_CORRECTION" | "SCORE_SHEET" | "ATTENDANCE_CORRECTION" | "FEE_WAIVER" | "RECORD_CHANGE" | "LEAVE" | "NATIVE";

export type Person = { id: string; name: string; role: string } | null;

export type Item = {
  key: string;
  source: Source;
  id: string;
  type: RouteType;
  title: string;
  summary: string | null;
  requester: Person;
  raisedAt: Date;
  state: "Awaiting" | "In review";
  step: 1 | 2;
  blocking: string | null;
  evidence: string | null;
  /** Where the decision is also visible in its own module. */
  href: string;
  /** A native decision can be named to one person or to a role. */
  nativeAssigneeId?: string | null;
  nativeAssigneeRole?: string | null;
  /** What the module that holds it needs to be told to decide it. */
  ref: Record<string, string>;
};

export type Decided = { key: string; type: RouteType; title: string; requesterId: string | null; requesterName: string | null; decidedById: string | null; decidedByName: string | null; raisedAt: Date; decidedAt: Date; outcome: "Approved" | "Declined" | "Returned"; note: string | null };

export const itemKey = (source: Source, id: string) => `${source}:${id}`;
export const parseKey = (key: string): { source: Source; id: string } => {
  const index = key.indexOf(":");
  return { source: key.slice(0, index) as Source, id: key.slice(index + 1) };
};
