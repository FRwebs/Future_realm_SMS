import { prisma } from "../../../../src/lib/db/prisma";

/** The Back Office modules a person's access is set against, in sidebar order. */
export const BACK_OFFICE_MODULES = [
  { id: "schools", label: "School Accounts" },
  { id: "migration", label: "Onboarding & Migration" },
  { id: "billing", label: "Subscriptions & Billing" },
  { id: "partners", label: "Partners & Commission" },
  { id: "users", label: "Users" },
  { id: "communications", label: "Communications" },
  { id: "support", label: "Support" },
  { id: "curriculum", label: "Curriculum & Academics" },
  { id: "plans", label: "Plans & Features" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "security", label: "Security & Compliance" },
  { id: "team", label: "Team & Access" },
  { id: "analytics", label: "Analytics & BI" },
  { id: "settings", label: "Settings" }
] as const;

/** The six things a person can do in a module. A level is a shorthand for a set of these; a person can also be given an exact set. */
export const ACTIONS = [
  { id: "view", label: "View" },
  { id: "export", label: "Export" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "approve", label: "Approve or decide" },
  { id: "delete", label: "Delete" }
] as const;
export type ActionId = (typeof ACTIONS)[number]["id"];
/** What each level allows. Viewing and exporting what you can see go together; Full adds deleting. */
export const LEVEL_ACTIONS: Record<string, readonly ActionId[]> = {
  NONE: [],
  VIEW: ["view", "export"],
  EDIT: ["view", "export", "create", "edit", "approve"],
  FULL: ["view", "export", "create", "edit", "approve", "delete"]
};

/** Which of the six a request is, from its method and path. */
export function actionOfRequest(method: string, path: string): ActionId {
  const m = method.toUpperCase();
  if (m === "DELETE") return "delete";
  if (["GET", "HEAD", "OPTIONS"].includes(m)) return /(export|download|csv)/i.test(path) ? "export" : "view";
  if (/(approve|reject|decide|settle|validate|publish|sign-off|confirm|escalat|countersign|revoke|elevat|dismiss|suspend|reactivate)/i.test(path)) return "approve";
  return m === "POST" ? "create" : "edit";
}

export type Level = "NONE" | "VIEW" | "EDIT" | "FULL";
export const RANK: Record<Level, number> = { NONE: 0, VIEW: 1, EDIT: 2, FULL: 3 };
const LEVELS = new Set<string>(["NONE", "VIEW", "EDIT", "FULL"]);

/** The first path segment after /api/super-admin/ decides which module a request belongs to. */
const SEGMENT_MODULE: Record<string, string> = {
  schools: "schools", "schools-provisioning": "schools", "schools-pending-verification": "schools", "web-address-registry": "schools", "ownership-transfers": "schools", crm: "schools", impersonate: "schools",
  migration: "migration",
  billing: "billing",
  partners: "partners",
  users: "users", "user-case-review-context": "users",
  communications: "communications", whatsapp: "communications",
  support: "support", "support-desk": "support",
  "config-library": "curriculum",
  "feature-flags": "plans", "feature-flag-extras": "plans", plans: "plans", "plans-features": "plans",
  system: "infrastructure", "infra-extras": "infrastructure",
  security: "security", "audit-logs": "security", compliance: "security",
  "internal-team": "team",
  analytics: "analytics", "analytics-bi": "analytics",
  settings: "settings"
};

export function moduleOfPath(path: string): string | null {
  const match = /^\/api\/super-admin\/([^/?]+)/.exec(path);
  return match ? (SEGMENT_MODULE[match[1]] ?? null) : null;
}

const ALWAYS_FULL = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);
const TTL_MS = 10_000;
const cache = new Map<string, { at: number; grid: Record<string, string>; custom: Record<string, string[]>; template: Record<string, string>; grants: Set<string> }>();

async function load(userId: string, role: string) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const [rows, template, grants] = await Promise.all([
    prisma.internalPermissionGrid.findMany({ where: { userId } }),
    prisma.internalPermissionTemplate.findUnique({ where: { roleName: role } }),
    prisma.internalAccessGrant.findMany({ where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { moduleId: true } })
  ]);
  const entry = {
    at: Date.now(),
    grid: Object.fromEntries(rows.filter((row) => row.accessLevel !== "INHERIT").map((row) => [row.moduleId, row.accessLevel])),
    custom: Object.fromEntries(rows.filter((row) => row.customActions).map((row) => [row.moduleId, row.actions])),
    template: template && typeof template.defaultGrid === "object" && template.defaultGrid ? (template.defaultGrid as Record<string, string>) : {},
    grants: new Set(grants.map((g) => g.moduleId))
  };
  cache.set(userId, entry);
  return entry;
}

export const forgetAccess = (userId?: string) => (userId ? cache.delete(userId) : cache.clear());

/**
 * What a person may do in a module. Super Admin and Platform Owner always have everything. For anyone else the answer is the
 * person's own grid row, else their role's template, raised to Edit by a live time-bound grant. Where nothing has been set the
 * answer is UNSET — the role guard on the endpoint decides, exactly as it did before a grid existed.
 */
export async function levelFor(userId: string, role: string, moduleId: string): Promise<Level | "UNSET"> {
  if (ALWAYS_FULL.has(role)) return "FULL";
  const entry = await load(userId, role);
  const set = entry.grid[moduleId] ?? entry.template[moduleId];
  const base = set && LEVELS.has(set) ? (set as Level) : null;
  const granted = entry.grants.has(moduleId);
  if (!base) return granted ? "EDIT" : "UNSET";
  return granted && RANK[base] < RANK.EDIT ? "EDIT" : base;
}

export async function levelsFor(userId: string, role: string): Promise<Record<string, Level | "UNSET">> {
  const out: Record<string, Level | "UNSET"> = {};
  for (const module of BACK_OFFICE_MODULES) out[module.id] = await levelFor(userId, role, module.id);
  return out;
}

/**
 * Whether a person may do this action in the module. Super Admin and the Platform Owner may do everything; a person given an
 * exact set may do exactly that set; otherwise their level (or role template) decides. Where nothing is set the endpoint's own
 * role check decides, as before.
 */
export async function actionAllowed(userId: string, role: string, moduleId: string, action: ActionId): Promise<boolean> {
  if (ALWAYS_FULL.has(role)) return true;
  const entry = await load(userId, role);
  const exact = entry.custom[moduleId];
  if (exact) return exact.includes(action);
  const level = await levelFor(userId, role, moduleId);
  if (level === "UNSET") return true;
  return LEVEL_ACTIONS[level].includes(action);
}

export async function actionsFor(userId: string, role: string, moduleId: string): Promise<{ actions: ActionId[]; custom: boolean }> {
  if (ALWAYS_FULL.has(role)) return { actions: ACTIONS.map((a) => a.id), custom: false };
  const entry = await load(userId, role);
  const exact = entry.custom[moduleId];
  if (exact) return { actions: exact as ActionId[], custom: true };
  const level = await levelFor(userId, role, moduleId);
  return { actions: level === "UNSET" ? [] : [...LEVEL_ACTIONS[level]], custom: false };
}

/** The exact set of actions somebody was given in a module, or null when their level (or role) decides. */
export async function customActionsFor(userId: string, role: string, moduleId: string): Promise<string[] | null> {
  if (ALWAYS_FULL.has(role)) return null;
  return (await load(userId, role)).custom[moduleId] ?? null;
}
