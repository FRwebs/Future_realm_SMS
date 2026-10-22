import { apiGet } from "@/lib/api/server";
import { checks, text } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * Audit & Security → Integrations: the keys a school issues so another system can read a small slice of its record. A key is shown
 * once; it works only while the school's plan includes API access, and the plan is checked on every call.
 */

const API = "/api/v1/api-access";
const PLUS = "M12 5.5v13M5.5 12h13";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";

type Overview = {
  entitled: boolean; why: string; scopes: Array<{ key: string; label: string; detail: string }>;
  keys: Array<{ id: string; name: string; prefix: string; scopes: string[]; createdAt: string; by: string; lastUsedAt: string | null; calls: number; revoked: boolean }>;
};
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "Never");

export async function integrationsTab(): Promise<TabContent> {
  const v = await apiGet<Overview>(API);
  const live = v.keys.filter((key) => !key.revoked);
  const labelOf = (scope: string) => v.scopes.find((entry) => entry.key === scope)?.label ?? scope;
  const create: DrawerSpec = {
    mode: "form", kicker: "Integrations", title: "Create an API key", sub: "A key reads what you tick, and nothing else. It cannot change anything in the school’s record.",
    commitLabel: "Create the key", commitDone: "Key created", commitDoneBody: "Copy it now. It is shown once.", reviewNote: "The key stops working the moment the school’s plan no longer includes API access.",
    fields: [
      text("Name", { required: true, span: 2, placeholder: "e.g. Bursar’s spreadsheet sync" }),
      checks("It may read", v.scopes.map((scope) => scope.label), [], { span: 2, required: true, hint: v.scopes.map((scope) => `${scope.label}: ${scope.detail}`).join(" · ") }),
    ] as FormField[],
    submit: { endpoint: `${API}/keys`, method: "POST", map: { Name: "name", "It may read": "scopes" }, encode: { "It may read": Object.fromEntries(v.scopes.map((scope) => [scope.label, scope.key])) } },
  };
  const revoke = (key: Overview["keys"][number]): DrawerSpec => ({
    mode: "commit", kicker: "Integrations", title: `Revoke ${key.name}`, sub: "Whatever uses it stops working at once. This cannot be undone — make a new key if you need one.",
    facts: [["Key", `${key.prefix}…`, key.name], ["Last used", day(key.lastUsedAt), `${key.calls} calls in all`]], commitLabel: "Revoke it", commitDone: "Key revoked", commitDoneBody: "It no longer opens anything.",
    submit: { endpoint: `${API}/keys/${key.id}/revoke`, method: "POST" },
  });
  const rows: TableRow[] = v.keys.map((key) => ({
    keywords: `${key.name} ${key.prefix}`,
    cells: [
      { kind: "name", name: key.name, sub: `${key.prefix}…`, avatar: false }, cell(key.scopes.map(labelOf).join(", ") || "—"), cell(`${day(key.createdAt)}${key.by ? ` · ${key.by}` : ""}`), cell(day(key.lastUsedAt)), cell(String(key.calls), { mono: true }),
      pill(key.revoked ? "Revoked" : "Live", key.revoked ? "neutral" : "positive"), key.revoked ? cell("") : { kind: "action", label: "Revoke", drawer: revoke(key) },
    ] as TableCellKind[],
  }));
  const docs: PanelFact[] = [
    ["Base address", "/api/v1/open", "Send `Authorization: Bearer <your key>`"],
    ["GET /students", "Active students", "?page=2 · ?classId=…"],
    ["GET /classes", "Every arm and its roll", ""],
    ["GET /attendance", "Daily totals per arm", "?date=2026-10-22"],
    ["Limits", "Sixty calls a minute for each key", "Read-only · no names in attendance"],
  ];
  return {
    title: "Integrations", desc: "Keys that let another system read a small, plain slice of the school’s record.",
    primary: v.entitled ? { label: "Create an API key", icon: PLUS, drawer: create } : undefined,
    rows: ([
      v.entitled ? null : row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: "API access is not part of this school’s plan", body: `${v.why} Existing keys do not work, and new ones cannot be made. Moving to a plan that includes it — or an exception approved by Future Realm — turns it on.` }]),
      row("1fr", [{ type: "kpi", per: 3, cards: [
        { label: "Live keys", value: String(live.length), sub: "Of ten a school may hold", tone: live.length ? "progress" : "neutral" },
        { label: "Calls so far", value: String(v.keys.reduce((sum, key) => sum + key.calls, 0)), sub: "Across every key, ever" },
        { label: "Plan", value: v.entitled ? "Included" : "Not included", sub: v.why, tone: v.entitled ? "positive" : "attention" },
      ] }]),
      row("1fr", [{ type: "table", title: "Your keys", sub: "A key is shown once, when it is made. Only its first characters are kept to tell it apart.", meta: `${v.keys.length}`, noun: "key", nounPlural: "keys", head: ["Key", "May read", "Made", "Last used", "Calls", "State", ""], rows, per: 10, noRowOpen: true, empty: "No key has been made." }]),
      row("1fr", [{ type: "facts", title: "What a key opens", per: 1, facts: docs }]),
    ].filter(Boolean) as PanelRow[]),
  };
}
