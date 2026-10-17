import {
  applyTemplateDrawer,
  customRoleDrawer,
  inviteDrawer,
  recertifyDrawer,
  sensitiveGroupDrawer,
} from "@/lib/modules/live/m7-forms";
import type { AccessOverview, AccountState, GroupRow, Person, TemplateRow } from "@/lib/modules/live/m7-types";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type ListItem,
  type PanelTone,
  type TabContent,
  type TableCellKind,
  type TableRow,
} from "@/lib/modules/panels";

const ACCOUNT_TONE: Record<AccountState, PanelTone> = {
  Active: "positive",
  Dormant: "attention",
  "Never activated": "negative",
  Suspended: "neutral",
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const dayLong = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export const personHref = (userId: string) => `/staff-access/permissions/people/${userId}`;
export const roleHref = (name: string) => `/staff-access/permissions/role/${encodeURIComponent(name)}`;

/** Where a person stands against the template they are on, in the mockup's words. */
export function againstTemplate(person: Pick<Person, "above" | "below">): "Above template" | "Below template" | "At template" {
  if (person.above > 0) return "Above template";
  if (person.below > 0) return "Below template";
  return "At template";
}

function templatesDrawer(templates: TemplateRow[]): DrawerSpec {
  return {
    mode: "view",
    kicker: "Permissions · role templates",
    title: "Role templates",
    sub: "What a new account starts from. Open one to see and change every module and tab it grants.",
    facts: templates.map((template) => [
      template.name + (template.custom ? " · custom" : ""),
      `${plural(template.people, "person", "people")} · ${template.reach} of 16 modules`,
      `${template.scope} · ${template.approve === "Nothing" ? "approves nothing" : `approves ${template.approve.toLowerCase()}`}`,
    ]),
    readOnlyNote: "Open a template from the table below this tab’s people to edit it.",
    readOnly: true,
  };
}

export function permissionsTab(overview: AccessOverview): TabContent {
  const { people, templates, groups, delegations } = overview;
  const never = people.filter((person) => person.account === "Never activated");
  const dormant = people.filter((person) => person.account === "Dormant");
  const above = people.filter((person) => person.above > 0);
  const holders = new Set(groups.flatMap((group) => group.holderIds));
  const recertify = recertifyDrawer(overview);
  const due = overview.recertification.dueOn;
  const last = overview.recertification.last;
  const asLink = (rows: Person[]) =>
    inviteDrawer(
      rows.map((person) => ({ userId: person.userId, name: person.name, role: person.role, accountDays: person.accountDays })),
      { title: "Resend the activation links" },
    );

  const cards: KpiCard[] = [
    { label: "People with access", value: String(people.length), sub: "Everyone who can sign in" },
    {
      label: "Above their role template",
      value: String(above.length),
      tone: above.length ? "attention" : "positive",
      sub: above.length ? "Holding more than their role gives" : "Everyone is at or below their template",
      ...(above.length ? { link: "Review them", drawer: recertify } : {}),
    },
    {
      label: "Never activated",
      value: String(never.length),
      tone: never.length ? "negative" : "positive",
      sub: never.length ? "Holding access they have never used" : "Everyone has signed in",
      ...(never.length ? { link: "Resend invitations", drawer: asLink(never) } : {}),
    },
    { label: "Sensitive group holders", value: String(holders.size), sub: `Across ${plural(groups.length, "group")}` },
    {
      label: "Recertification",
      value: due ? dayLong(due) : "Not scheduled",
      tone: due && new Date(due).getTime() < Date.now() ? "attention" : "neutral",
      sub: last ? `Last confirmed by ${last.by}` : "Not yet done",
    },
  ];

  const templateNames = Array.from(new Set(people.map((person) => person.role)));
  const scopes = Array.from(new Set(people.map((person) => person.scope)));
  const accounts = Array.from(new Set(people.map((person) => person.account)));
  const groupNames = groups.map((group) => group.name);
  const tok = (kind: string, value: string) => `${kind}:${value}|`;
  const matchFor = (kind: string, values: string[]) => Object.fromEntries(values.map((value) => [value, tok(kind, value)]));

  const personRows: TableRow[] = people.map((person) => {
    const cells: TableCellKind[] = [
      nameCell(person.isYou ? `${person.name} (you)` : person.name, person.department),
      text(person.role),
      text(`${person.reach} of 16`),
      text(person.scope),
      text(person.fees),
      text(person.approve === "Nothing" ? "—" : person.approve),
      text(person.sensitive.length ? person.sensitive.join(", ") : "None", { tone: person.sensitive.length ? "sensitive" : undefined }),
      person.account === "Never activated"
        ? { kind: "pill", label: person.account, tone: ACCOUNT_TONE[person.account], drawer: asLink([person]) }
        : pill(person.account, ACCOUNT_TONE[person.account]),
      { kind: "action", label: "Open the map", href: personHref(person.userId) },
    ];
    return {
      id: person.userId,
      cells,
      href: personHref(person.userId),
      keywords: `${tok("role", person.role)}${tok("scope", person.scope)}${tok("vs", againstTemplate(person))}${tok("acct", person.account)}${tok("sens", person.sensitive.length ? "Holds a group" : "Holds none")}${person.sensitive.map((group) => tok("sens", group)).join("")}`,
    };
  });

  const templateRows: TableRow[] = templates.map((template) => ({
    id: template.name,
    cells: [
      { kind: "name", name: template.name, sub: template.custom ? "Custom role" : "Built in", avatar: false },
      text(String(template.people)),
      text(`${template.reach} of 16`),
      text(template.scope),
      text(template.approve === "Nothing" ? "—" : template.approve),
      { kind: "action", label: "Open", href: roleHref(template.name) },
    ],
    href: roleHref(template.name),
    keywords: `${tok("tscope", template.scope)}${tok("tapprove", template.approve)}`,
  }));
  const templateScopes = Array.from(new Set(templates.map((template) => template.scope)));
  const templateApproves = Array.from(new Set(templates.map((template) => template.approve)));

  const groupItems: ListItem[] = groups.map((group) => ({
    label: group.name,
    sub: `${group.holders.length ? group.holders.join(", ") : "Nobody holds it yet"} · ${plural(group.covers.length, "record type")}`,
    pill: plural(group.holders.length, "holder"),
    tone: group.holders.length > 4 ? "attention" : "sensitive",
    viewLabel: "Manage",
    drawer: sensitiveGroupDrawer(overview, group),
  }));

  // What needs a decision this term, with the reason in plain words.
  type Decision = { person: Person; why: string; detail: string; tone: PanelTone; act: TableCellKind };
  const decisions: Decision[] = [
    ...above.map<Decision>((person) => ({
      person,
      why: "Above their role template",
      detail: `${person.above} ${person.above === 1 ? "action" : "actions"} granted individually${person.aboveWhere.length ? ` · ${person.aboveWhere.slice(0, 2).join(", ")}` : ""}`,
      tone: "attention",
      act: { kind: "action", label: "Decide", href: personHref(person.userId) },
    })),
    ...never.map<Decision>((person) => ({
      person,
      why: "Never activated",
      detail: `Account is ${person.accountDays} days old, with no sign-in`,
      tone: "negative",
      act: { kind: "action", label: "Resend", drawer: asLink([person]) },
    })),
    ...dormant.map<Decision>((person) => ({
      person,
      why: "Dormant",
      detail: `No sign-in for ${person.accountDays} days`,
      tone: "attention",
      act: { kind: "action", label: "Decide", href: personHref(person.userId) },
    })),
    ...delegations
      .filter((item) => item.status === "Expired")
      .map<Decision>((item) => ({
        person: people.find((person) => person.userId === item.userId) ?? ({ userId: item.userId, name: item.person, role: "", department: "" } as Person),
        why: "Delegation has expired",
        detail: `${item.holds} · ended ${dayLong(item.expiresOn)}`,
        tone: "neutral",
        act: { kind: "action", label: "Open", href: personHref(item.userId) },
      })),
  ];
  const decisionRows: TableRow[] = decisions.map((item) => ({
    id: `${item.person.userId}:${item.why}`,
    cells: [nameCell(item.person.name, item.person.role), pill(item.why, item.tone), text(item.detail), item.act],
    href: personHref(item.person.userId),
  }));

  return {
    title: "Permissions",
    desc: "Who can reach what, how far their data reaches, and what they may approve.",
    primary: { label: "Review everyone’s access", drawer: recertify },
    launchers: [
      { label: "Open the role templates", drawer: templatesDrawer(templates) },
      { label: "Create a custom role", drawer: customRoleDrawer(overview) },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Access in force", sub: "Read from the permission engine, not from a description of it", per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Who can reach what",
            sub: "Every person, the template they are on and what they hold on top of it.",
            meta: `${plural(people.length, "person", "people")} · ${above.length} above template`,
            noun: "person",
            nounPlural: "people",
            search: "Find a person by name, role or department",
            filters: [
              { label: "Role", value: "All roles", options: ["All roles", ...templateNames], match: matchFor("role", templateNames) },
              { label: "Data scope", value: "All scopes", options: ["All scopes", ...scopes], match: matchFor("scope", scopes) },
              { label: "Against template", value: "Any", options: ["Any", "Above template", "At template", "Below template"], match: matchFor("vs", ["Above template", "At template", "Below template"]) },
              { label: "Account", value: "All accounts", options: ["All accounts", ...accounts], match: matchFor("acct", accounts) },
              { label: "Sensitive", value: "Any", options: ["Any", "Holds a group", "Holds none", ...groupNames], match: matchFor("sens", ["Holds a group", "Holds none", ...groupNames]) },
            ],
            acts: [{ label: "Export the access map", export: true }],
            selectable: true,
            bulkActs: [
              { label: "Confirm access for this term", drawer: recertifyDrawer(overview, { title: "Confirm access for this term" }), selection: { key: "userIds", noun: "person" } },
              { label: "Change their role", drawer: applyTemplateDrawer(overview, { names: "the people you ticked" }), selection: { key: "userIds", noun: "person" } },
              { label: "Apply a role template", drawer: applyTemplateDrawer(overview), selection: { key: "userIds", noun: "person" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Person", "Role template", "Modules", "Data scope", "Fee amounts", "Can approve", "Sensitive", "Account", ""],
            rows: personRows,
            per: 10,
            empty: "Nobody matches this filter.",
            foot: "Open a person’s map to see all sixteen modules and every tab inside them, and to change any tick.",
          },
        ],
      },
      {
        cols: "1.4fr 1fr",
        panels: [
          {
            type: "table",
            title: "Role templates",
            sub: "What a new account starts from — and what everyone on it holds.",
            tag: String(templates.length),
            meta: `${plural(templates.length, "template")}`,
            noun: "template",
            nounPlural: "templates",
            search: "Find a template",
            filters: [
              { label: "Scope", value: "All scopes", options: ["All scopes", ...templateScopes], match: matchFor("tscope", templateScopes) },
              { label: "Can approve", value: "Any", options: ["Any", ...templateApproves], match: matchFor("tapprove", templateApproves) },
            ],
            acts: [{ label: "Create a custom role", drawer: customRoleDrawer(overview) }],
            head: ["Template", "People", "Modules", "Data scope", "Can approve", ""],
            rows: templateRows,
            per: 8,
            empty: "No template matches.",
          },
          {
            type: "list",
            title: "Sensitive groups",
            sub: "Records closed to everyone except a named few. Every reveal is logged.",
            tag: String(groups.length),
            acts: [{ label: "Create a sensitive group", drawer: sensitiveGroupDrawer(overview) }],
            items: groupItems,
            foot: groupItems.length ? "A group with many holders has stopped being a sensitive group." : "No sensitive group exists yet.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Access that needs a decision this term",
            sub: "Someone above their template, never activated, dormant, or holding a delegation that has ended.",
            tag: String(decisions.length),
            tagTone: decisions.length ? "attention" : "positive",
            noun: "decision",
            nounPlural: "decisions",
            acts: decisions.length ? [{ label: "Confirm all as they are", drawer: recertifyDrawer(overview, { title: "Confirm all as they are" }) }] : [],
            head: ["Person", "Why", "Detail", ""],
            rows: decisionRows,
            emptyTitle: "Nothing needs a decision",
            emptyBody: "Everyone is at their template, activated, and holding nothing that has ended.",
            empty: "Nothing needs a decision.",
          },
        ],
      },
    ],
  };
}

export type { GroupRow };
