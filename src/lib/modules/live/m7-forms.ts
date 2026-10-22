import type { DrawerSpec, FormField, MatrixRow, PickerOption } from "@/lib/modules/panels";
import {
  schoolModuleActions,
  schoolModules,
  schoolPermissionKey,
  schoolPermissionKeysForRoleTemplate,
  schoolRoleTemplates,
} from "@/lib/modules/school-modules";

import type {
  AccessOverview,
  Assignment,
  DirectoryRow,
  ModuleGrant,
  PersonAccess,
  StaffRecord,
  TemplateGrid,
} from "@/lib/modules/live/m7-types";

/**
 * Every modal in Staff & Access, as data.
 *
 * People and arms are chosen by name on screen and travel as ids, so each form carries the
 * pairing beside the field it belongs to (`encode`).
 */

export const API = "/api/v1/staff-access";
export const ACTIONS = schoolModuleActions;

export const text = (label: string, o: Record<string, unknown> = {}) => ({ label, kind: "text", ...o }) as FormField;
export const area = (label: string, o: Record<string, unknown> = {}) => ({ label, kind: "area", ...o }) as FormField;
export const select = (label: string, options: string[], o: Record<string, unknown> = {}) => ({ label, kind: "select", options, value: options[0], ...o }) as FormField;
export const choice = (label: string, options: string[], o: Record<string, unknown> = {}) => ({ label, kind: "choice", options, value: options[0], ...o }) as FormField;
export const checks = (label: string, options: string[], checked: string[], o: Record<string, unknown> = {}) => ({ label, kind: "checks", options, checked, ...o }) as FormField;
export const toggle = (label: string, on: boolean, onLabel: string, offLabel: string, o: Record<string, unknown> = {}) => ({ label, kind: "toggle", on, onLabel, offLabel, ...o }) as FormField;
export const fixed = (label: string, value: string, o: Record<string, unknown> = {}) => ({ label, kind: "static", value, ...o }) as FormField;

export const SCOPES = [
  "Only their own subject-arms",
  "Their form class and their subject-arms",
  "Their whole department",
  "A single campus",
  "The whole school",
];
export const FEES = [
  "Cannot see fee information",
  "Can see paid or unpaid, never amounts",
  "Can see full amounts",
  "Can see amounts and record payments",
];
export const APPROVES = [
  "Nothing",
  "Score sheets only",
  "Score sheets and report cards",
  "Fee adjustments only",
  "Payments and waivers",
  "Everything routed to this role",
];
export const KEEP = "As the new template has it";

/** A list of choices that always holds what is set today, even where it is not one of the standard few. */
export const withCurrent = (options: string[], current: string) => (current && !options.includes(current) ? [current, ...options] : options);

export const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));

export function peopleOptions(people: Array<{ userId: string; name: string; role: string; department: string }>): PickerOption[] {
  return people.map((person) => ({ value: person.userId, label: person.name, sub: person.role, group: person.department }));
}

/** Rows of a matrix: every tab of every module, grouped by the module's name. */
export function tabRows(moduleNames?: string[]): MatrixRow[] {
  return schoolModules
    .filter((module) => !moduleNames || moduleNames.includes(module.name))
    .flatMap((module) =>
      module.tabs.map((tab) => ({ key: `${module.slug}.${tab.slug}`, label: tab.label, sub: module.name, group: module.name })),
    );
}

/** The ticks a template carries, as the matrix stores them. */
export function templateTicks(template: string): string[] {
  const keys = new Set(schoolPermissionKeysForRoleTemplate(template));
  return schoolModules.flatMap((module) =>
    module.tabs.flatMap((tab) =>
      ACTIONS.filter((action) => keys.has(schoolPermissionKey(module.slug, tab.slug, action))).map((action) => `${module.slug}.${tab.slug}|${action}`),
    ),
  );
}

/** What a module grants, from a person's or a template's grid. */
function moduleTicks(modules: ModuleGrant[]): string[] {
  return modules.flatMap((module) => ACTIONS.filter((action) => module.all[action]).map((action) => `${module.slug}|${action}`));
}

const LEADERS = new Set(["Proprietor", "Principal"]);

/* ───────────────────────── the whole map, in one modal ───────────────────────── */

export function permMapDrawer(target: { kind: "person"; person: PersonAccess } | { kind: "template"; grid: TemplateGrid }): DrawerSpec {
  const isTemplate = target.kind === "template";
  const modules = isTemplate ? target.grid.modules : target.person.modules;
  const leader = isTemplate ? LEADERS.has(target.grid.name) : LEADERS.has(target.person.role);
  const who = isTemplate ? `The ${target.grid.name} template` : target.person.name;
  const first = isTemplate ? target.grid.name : target.person.name.split(" ")[0];
  return {
    mode: "edit",
    kicker: `${isTemplate ? "Role template" : "Permissions"} · ${isTemplate ? target.grid.name : target.person.role}`,
    title: isTemplate ? `The ${target.grid.name} template` : `The access map — ${target.person.name}`,
    sub: "Sixteen modules down, six actions across. Open a module to set its tabs.",
    commitDone: isTemplate ? `${target.grid.name} template saved` : `Access saved · ${target.person.name}`,
    commitDoneBody: isTemplate
      ? "Everybody on this template has it from their next screen. Anything granted to a person individually stays as it was."
      : "The map is live on their next screen. The map it replaced is kept in the audit log under your name.",
    reviewNote: isTemplate
      ? "The template changes for everyone on it. Individual grants and refusals on top of it are untouched."
      : `Every tick operates over their data scope: ${(isTemplate ? "" : target.person.scope).toLowerCase()}.`,
    fields: [
      {
        label: isTemplate ? "What this template grants in each module" : `What ${first} may do in each module`,
        kind: "matrix",
        span: 2,
        cols: [...ACTIONS],
        rowHead: "Module",
        rows: modules.map((module) => ({
          key: module.slug,
          label: module.name,
          sub: module.level ? `${module.tabs.length} tabs · ${module.levelLabel}` : "Absent from their navigation",
          lock: leader ? [] : ["Delete"],
        })),
        checked: moduleTicks(modules),
        hint: `A module with no tick is absent from the navigation entirely — never shown greyed out. Deletion stays with leadership, so it is closed here. ${who} is changed only in what you tick.`,
      } as FormField,
    ],
    submit: {
      endpoint: isTemplate ? `${API}/access/templates/${encodeURIComponent(target.grid.name)}/grid` : `${API}/access/people/${target.person.userId}/grid`,
      method: "PUT" as never,
      body: { scope: "module" },
      map: { [isTemplate ? "What this template grants in each module" : `What ${first} may do in each module`]: "ticks" },
      reasonKey: "reason",
      reasonRequired: true,
    },
  };
}

export function permTabsDrawer(
  target: { kind: "person"; person: PersonAccess } | { kind: "template"; grid: TemplateGrid },
  module: ModuleGrant,
): DrawerSpec {
  const isTemplate = target.kind === "template";
  const leader = isTemplate ? LEADERS.has(target.grid.name) : LEADERS.has(target.person.role);
  const money = /Payments|Collections|Structures|Credits|Plan/;
  const destructive = /Routing|Structures|Policies|Curriculum|Profile|Data Protection/;
  const label = "What may be done in each tab";
  return {
    mode: "edit",
    kicker: `${isTemplate ? "Role template" : "Permissions"} · ${isTemplate ? target.grid.name : target.person.name}`,
    title: `${module.name} — ${isTemplate ? `${target.grid.name} template` : target.person.name}`,
    sub: `${module.description} Every tab inside it, and each action within each tab.`,
    commitDone: `${module.name} saved`,
    commitDoneBody: isTemplate
      ? `The template now grants exactly this in ${module.name}. Everyone on it has it from their next screen.`
      : "It takes effect on their next screen. Nothing else about their access changed.",
    reviewNote: "Approval never applies to a person’s own submission, whatever this grid says.",
    fields: [
      {
        label,
        kind: "matrix",
        span: 2,
        cols: [...ACTIONS],
        rowHead: `Tab in ${module.name}`,
        rows: module.tabs.map((tab) => ({
          key: tab.rowKey,
          label: tab.label,
          lock: [...(leader ? [] : ["Delete"]), ...(money.test(tab.label) ? ["Delete"] : []), ...(destructive.test(tab.label) && !leader ? ["Create", "Edit"] : [])].filter(
            (value, index, all) => all.indexOf(value) === index,
          ),
        })),
        checked: module.tabs.flatMap((tab) => ACTIONS.filter((action) => tab.a[action]).map((action) => `${tab.rowKey}|${action}`)),
        hint: "A tab with no View tick is absent from the module. A dash is an action this role may never hold.",
      } as FormField,
    ],
    submit: {
      endpoint: isTemplate ? `${API}/access/templates/${encodeURIComponent(target.grid.name)}/grid` : `${API}/access/people/${target.person.userId}/grid`,
      method: "PUT" as never,
      body: { scope: "tabs", moduleSlug: module.slug },
      map: { [label]: "ticks" },
      reasonKey: "reason",
      reasonRequired: true,
    },
  };
}

/* ───────────────────────── changing a role ───────────────────────── */

const PICK = "Choose the new role";

export function changeRoleDrawer(person: PersonAccess, overview: AccessOverview): DrawerSpec {
  const current = overview.people.find((item) => item.userId === person.userId);
  const nowOn = new Set(current?.moduleSlugs ?? person.modules.filter((module) => module.level > 0).map((module) => module.slug));
  const targets = overview.templates.filter((template) => template.name !== person.role);
  const moduleName = (slug: string) => schoolModules.find((module) => module.slug === slug)?.name ?? slug;
  const cases = Object.fromEntries(
    targets.map((template) => {
      const next = new Set(template.moduleSlugs);
      const gained = template.moduleSlugs.filter((slug) => !nowOn.has(slug)).map(moduleName);
      const lost = Array.from(nowOn).filter((slug) => !next.has(slug)).map(moduleName);
      return [
        template.name,
        {
          value: `${gained.length ? `${gained.length} modules gained` : "No new modules"} · ${lost.length ? `${lost.length} removed` : "nothing removed"} · ${template.moduleSlugs.length} of 16 after the change`,
          hint: `${gained.length ? `Gains: ${gained.join(", ")}. ` : ""}${lost.length ? `Loses: ${lost.join(", ")} — these become absent from their navigation, not greyed out.` : "They keep every module they can reach today."}`,
        },
      ];
    }),
  );
  const fields: FormField[] = [
    fixed("Role today", person.role, { span: 2, hint: `${person.department} · ${person.modules.filter((module) => module.level > 0).length} of 16 modules · ${person.scope.toLowerCase()}${person.above ? ` · plus ${person.above} actions held individually` : ""}` }),
    select("Change their role to", [PICK, ...targets.map((template) => template.name)], { required: true, span: 2, hint: "Every role in this school, including any custom role you have created" }),
    {
      label: "What changes for them",
      kind: "static",
      span: 2,
      value: "Pick a role to see what changes",
      by: { field: "Change their role to", cases },
      hint: "The comparison is drawn from the two roles themselves, never from a description of them.",
    } as FormField,
    select("Data scope after the change", [KEEP, ...SCOPES], { required: true, span: 2, hint: "Seeded from the new template. Scope decides whose records every permission operates on." }),
    select("Can approve after the change", [KEEP, ...APPROVES], { required: true }),
    fixed("Effective", "Immediately", { hint: "It applies on their next screen — they are not signed out. A dated change is not offered yet." }),
    ...(person.above
      ? [choice("They hold more than the template individually", ["Remove it with the old role", "Keep it and record why"], { span: 2, hint: "This was granted to this person, not to their role, so a role change does not decide it for you." })]
      : []),
    choice("Their sensitive groups", person.sensitive.length ? [`Keep all ${person.sensitive.length}`, "Remove them with the old role"] : ["They hold none"], {
      span: 2,
      hint: person.sensitive.length ? `${person.sensitive.join(", ")} · each is logged at every reveal either way` : "Nothing behind a logged reveal is affected by this change.",
    }),
    select("Work routed to their old role", ["Move it with them", "Leave it with the old role", "Send it to their line manager"], {
      required: true,
      span: 2,
      hint: "Leaving it behind is what silently stops a school — approvals queue against a role nobody now holds.",
    }),
    area("Why the role is changing", { required: true, span: 2, placeholder: "Promoted, moved department, covering a vacancy… Kept on their record and shown at every recertification." }),
    toggle("Tell them", true, "Told in-app what changed", "Silent change", { span: 2 }),
  ];
  return {
    mode: "form",
    kicker: `Permissions · ${person.role}`,
    title: `Change the role · ${person.name}`,
    sub: "Pick the new role and see exactly what they gain and lose.",
    commitLabel: "Change the role",
    commitDone: `${person.name.split(" ")[0]}’s role is changed`,
    commitDoneBody: "Their access matches the new role from their next screen.",
    reviewNote: "A role change replaces what the old template gave them. Anything granted to this person individually is decided here, not silently kept.",
    fields,
    submit: {
      endpoint: `${API}/access/people/${person.userId}/role`,
      method: "POST",
      map: {
        "Change their role to": "role",
        "Data scope after the change": "scope",
        "Can approve after the change": "approve",
        "They hold more than the template individually": "individual",
        "Their sensitive groups": "sensitive",
        "Work routed to their old role": "routed",
        "Why the role is changing": "reason",
        "Tell them": "tell",
      },
      encode: { "Change their role to": { [PICK]: "" } },
    },
  };
}

/* ───────────────────────── scope, templates, copying ───────────────────────── */

export function scopeDrawer(person: PersonAccess): DrawerSpec {
  return {
    mode: "form",
    kicker: `Permissions · ${person.name}`,
    title: "Change data scope",
    commitLabel: "Change the scope",
    commitDone: "Data scope changed",
    commitDoneBody: "It is recorded against the account and shown on every access map.",
    reviewNote:
      "Scope decides WHOSE records every permission applies to. It is recorded here and shown everywhere; teachers are narrowed to their own subject-arms and form class by assignment today, and the other scopes are advisory until each module reads them.",
    fields: [
      select("Scope", withCurrent(SCOPES, person.scope), { value: person.scope, required: true, span: 2 }),
      select("Fee amounts", withCurrent(FEES, person.fees), { value: person.fees, required: true, span: 2, hint: "Independent of scope — a teacher scoped to their own class still should not see what that family owes." }),
      select("Can approve", withCurrent(APPROVES, person.approve), { value: person.approve, span: 2 }),
      select("Historic data", ["This term only", "This session", "Every session since they joined", "All history"], { value: "This session" }),
      text("Scope ends", { type: "date", value: person.scopeEnds ?? "", optional: true, hint: "Leave blank for “when I change it”" }),
      area("Reason for this scope", { required: true, span: 2 }),
    ],
    submit: {
      endpoint: `${API}/access/people/${person.userId}/profile`,
      method: "PATCH",
      map: { Scope: "scope", "Fee amounts": "fees", "Can approve": "approve", "Historic data": "historic", "Scope ends": "scopeEnds", "Reason for this scope": "reason" },
    },
  };
}

export function applyTemplateDrawer(overview: AccessOverview, o: { userIds?: string[]; names?: string; role?: string } = {}): DrawerSpec {
  const templates = overview.templates.map((template) => template.name);
  return {
    mode: "form",
    kicker: "Permissions",
    title: o.userIds ? `Apply a role template · ${o.names ?? ""}` : "Apply a role template",
    commitLabel: "Apply it",
    commitDone: "Template applied",
    commitDoneBody: "Their access matches the template exactly from their next screen. Sensitive groups are untouched — those are granted person by person.",
    reviewNote: "Everything they hold individually on top of the template is removed, so they are exactly what the template says.",
    fields: [
      select("Template", templates, { value: o.role && templates.includes(o.role) ? o.role : templates[0], required: true, span: 2 }),
      area("Why", { span: 2, optional: true, placeholder: "Reset after recertification…" }),
    ],
    submit: {
      endpoint: `${API}/access/apply-template`,
      method: "POST",
      ...(o.userIds ? { body: { userIds: o.userIds } } : {}),
      map: { Template: "role", Why: "reason" },
    },
  };
}

export function copyModuleDrawer(person: PersonAccess, module: ModuleGrant, overview: AccessOverview): DrawerSpec {
  return {
    mode: "form",
    kicker: `Permissions · ${person.name}`,
    title: `Copy ${module.name} access`,
    commitLabel: "Copy it",
    commitDone: "Access copied",
    commitDoneBody: "The other people now have the same actions in this module. Nothing else about their access changed.",
    reviewNote: "This copies only this one module. Their data scope stays their own, so the same ticks can still mean very different reach.",
    fields: [
      {
        label: "Copy to",
        kind: "picker",
        required: true,
        span: 2,
        options: peopleOptions(overview.people.filter((item) => item.userId !== person.userId)),
        checked: [],
        placeholder: "Search by name or role",
        groupAll: "All departments",
      } as FormField,
      choice("If they already have access here", ["Replace it entirely", "Add to what they have"], { span: 2, value: "Add to what they have" }),
      fixed("Not copied", "Data scope, fee visibility and sensitive groups", { span: 2, hint: "Those stay as each person’s own — copying them is how over-access spreads through a school." }),
    ],
    submit: {
      endpoint: `${API}/access/people/${person.userId}/copy-module`,
      method: "POST",
      body: { moduleSlug: module.slug },
      map: { "Copy to": "to", "If they already have access here": "mode" },
    },
  };
}

export function recertifyDrawer(overview: AccessOverview, o: { userIds?: string[]; title?: string; count?: number } = {}): DrawerSpec {
  const people = overview.people;
  const above = people.filter((person) => person.above > 0).length;
  const risky = people.filter((person) => person.account !== "Active").length;
  const last = overview.recertification.last;
  const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Never");
  return {
    mode: "decide",
    kicker: "Permissions",
    title: o.title ?? "Termly access recertification",
    sub: "Confirm every access in the school for this term as it stands.",
    facts: [
      ["People", String(o.count ?? people.length), "Everyone who can sign in"],
      ["Above their role template", String(above), "Each is listed below for a decision"],
      ["Never activated or dormant", String(risky), "Holding routing they have never read"],
      ["Last recertified", day(last?.at), last ? `By ${last.by} · ${last.people} people` : "Not yet done"],
      ["Due", day(overview.recertification.dueOn), "A term after the last one"],
      ["Effect of confirming", "Access stays exactly as it is", "Recorded against your name"],
    ],
    commitLabel: "Confirm their access",
    commitDone: "Access confirmed",
    commitDoneBody: "It is on the record under your name, with the date, for every person you confirmed.",
    submit: { endpoint: `${API}/access/recertify`, method: "POST", ...(o.userIds ? { body: { userIds: o.userIds } } : {}) },
  };
}

/* ───────────────────────── sensitive groups & delegations ───────────────────────── */

const RECORD_TYPES = [
  "Safeguarding concerns",
  "Disciplinary file",
  "Health and welfare records",
  "Counselling and guidance notes",
  "Special educational needs plans",
  "Family circumstances",
  "Staff salary band and next of kin",
  "Staff disciplinary file",
  "Full-school data export",
];

export function sensitiveGroupDrawer(overview: AccessOverview, group?: AccessOverview["groups"][number]): DrawerSpec {
  const isNew = !group;
  const holders = peopleOptions(overview.people);
  return {
    mode: "form",
    kicker: "Permissions · sensitive records",
    title: group ? `Manage · ${group.name}` : "Create a sensitive group",
    sub: group ? "What it covers, who holds it, and what happens at every reveal." : "What it closes off, who may hold it, and what a reveal costs.",
    commitLabel: group ? "Save this group" : "Create the group",
    commitDone: group ? `${group.name} saved` : "Sensitive group created",
    commitDoneBody: "Every reveal any holder makes is written to the audit log before the record opens.",
    reviewNote: "Logging is not optional on a sensitive group: the audit entry is written at the moment somebody continues past the warning, not when they close the record.",
    fields: [
      text("What this group is called", { required: true, span: 2, value: group?.name ?? "", placeholder: "Boarding house incident records", hint: "It appears at every grant, on every recertification and in the audit log" }),
      area("Why this school holds these separately", { required: true, span: 2, value: "", placeholder: "One or two sentences. This is what the next administrator reads before granting it to anybody." }),
      checks("Records inside this group", RECORD_TYPES, group?.covers ?? [], { required: true, span: 2, addable: true, addPlaceholder: "A record type this school holds that is not listed", addLabel: "Add this record type", hint: "Anything ticked here is closed to everybody in the school except a holder of this group." }),
      checks("Which roles may ever be given it", overview.templates.map((template) => template.name), ["Proprietor", "Principal"], { span: 2, hint: "A guard rail, not a grant: nobody is given it by their role." }),
      {
        label: "Who holds it from today",
        kind: "picker",
        span: 2,
        options: holders,
        checked: group?.holderIds ?? [],
        placeholder: "Search by name, role or department",
        groupAll: "All departments",
        hint: "Named people only. Two or three is normal; a group with eight holders is not a sensitive group.",
      } as FormField,
      fixed("At every reveal", "The holder’s name, the record and the time are written to the audit log", { span: 2, hint: "This cannot be switched off. It is what makes the group safe to grant at all." }),
      toggle("Require a typed reason at each reveal", true, "A reason is required and kept", "Reveal is logged without a reason", { span: 2 }),
      toggle("Require the password again", true, "Re-entered at each reveal", "Once per session"),
      select("Notify at each reveal", ["Nobody — the log is enough", "The Proprietor", "The holder’s line manager", "The child’s form master"]),
      select("Grants to this group need", ["The Proprietor’s approval", "The Principal’s approval", "Two approvals · Principal and Proprietor", "No approval — any administrator may grant it"], { required: true, span: 2, hint: "The last option is how a sensitive group quietly stops being sensitive." }),
      select("Every grant expires", ["At the end of each term", "At the end of each session", "After one year", "Only when it is removed"], { value: "At the end of each session", required: true }),
      select("Review it every", ["Term · at recertification", "Session", "Year"]),
      toggle("Tell the holders what they now hold", true, "Each is told what they hold and that reveals are logged", "Silent grant", { span: 2 }),
    ],
    ...(group
      ? {
          remove: {
            endpoint: `${API}/access/sensitive-groups/${group.slug}`,
            noun: "sensitive group",
            warn: "Deleting this group opens every record inside it to anybody whose role reaches that module. Nothing about the records changes — only who may read them.",
          },
        }
      : {}),
    submit: {
      endpoint: isNew ? `${API}/access/sensitive-groups` : `${API}/access/sensitive-groups/${group.slug}`,
      method: (isNew ? "POST" : "PUT") as never,
      map: {
        "What this group is called": "name",
        "Why this school holds these separately": "why",
        "Records inside this group": "covers",
        "Which roles may ever be given it": "roles",
        "Who holds it from today": "holders",
        "Require a typed reason at each reveal": "typedReason",
        "Require the password again": "password",
        "Notify at each reveal": "notify",
        "Grants to this group need": "approval",
        "Every grant expires": "expiry",
        "Review it every": "review",
        "Tell the holders what they now hold": "tellHolders",
      },
    },
  };
}

export function delegationDrawer(overview: { people: Array<{ userId: string; name: string }> }): DrawerSpec {
  return {
    mode: "form",
    kicker: "Permissions",
    title: "Record a delegation",
    commitLabel: "Record it",
    commitDone: "Delegation recorded",
    commitDoneBody: "It is on the Directory and in the access decisions until it ends, and it shows as expired the day after.",
    reviewNote: "A delegation is a named person holding a named responsibility for a while. It never lasts without an end date.",
    fields: [
      {
        label: "Who holds it",
        kind: "select",
        value: overview.people[0]?.name ?? "",
        options: overview.people.map((person) => person.name),
        required: true,
        span: 2,
      } as FormField,
      text("What they hold", { required: true, span: 2, placeholder: "Exam Officer approval for Sciences" }),
      text("Ends", { type: "date", value: "", required: true, hint: "A delegation with no end date survives every recertification" }),
      area("Why", { required: true, span: 2, placeholder: "Mr Adeyemi is on leave" }),
    ],
    submit: {
      endpoint: `${API}/access/delegations`,
      method: "POST",
      map: { "Who holds it": "userId", "What they hold": "holds", Ends: "expiresOn", Why: "reason" },
      encode: { "Who holds it": Object.fromEntries(overview.people.map((person) => [person.name, person.userId])) },
    },
  };
}

/* ───────────────────────── custom roles ───────────────────────── */

export function customRoleDrawer(overview: AccessOverview, from?: string): DrawerSpec {
  const templates = overview.templates.map((template) => template.name);
  const start = from && templates.includes(from) ? from : "An empty role";
  const moduleNames = schoolModules.map((module) => module.name);
  const seedFor = (name: string) => {
    const ticks = templateTicks(name);
    const reached = new Set(ticks.map((tick) => tick.split(".")[0]));
    return { ticks, modules: schoolModules.filter((module) => reached.has(module.slug)).map((module) => module.name) };
  };
  const seeded = start === "An empty role" ? { ticks: [`${schoolModules[0].slug}.${schoolModules[0].tabs[0].slug}|View`], modules: [schoolModules[0].name] } : seedFor(start);
  const sets = Object.fromEntries(["An empty role", ...templates].map((name) => [name, name === "An empty role" ? [`${schoolModules[0].slug}.${schoolModules[0].tabs[0].slug}|View`] : templateTicks(name)]));
  return {
    mode: "form",
    kicker: "Permissions · role templates",
    title: from && templates.includes(from) ? `Create a role from the ${from} template` : "Create a custom role",
    sub: "The modules, the tabs inside them, the actions, and who goes on it.",
    commitLabel: "Create the role",
    commitDone: "Custom role created",
    commitDoneBody: "It is in the template picker straight away. Nobody is on it until you map somebody to it.",
    reviewNote: "A template is a starting point: it seeds what a new account gets, and it never silently changes somebody already working.",
    fields: [
      text("Role name", { required: true, span: 2, placeholder: "Head of Boarding", hint: "What an administrator will pick from a list two years from now" }),
      area("What this role is for", { required: true, span: 2, placeholder: "One sentence. The next administrator reads exactly this when choosing it." }),
      select("Start from", ["An empty role", ...templates], { value: start, required: true, span: 2, hint: "What it inherits: the grid below arrives from this template; change any tick afterwards." }),
      checks("Modules this role can open", moduleNames, seeded.modules, { required: true, span: 2, hint: "What you leave unticked is absent from their navigation, not greyed out." }),
      {
        label: "Tabs inside those modules, and what they may do in each",
        kind: "matrix",
        span: 2,
        rowHead: "Module · tab",
        cols: ["View", "Create", "Edit", "Approve"],
        rows: tabRows(),
        checked: seeded.ticks,
        groupFrom: "Modules this role can open",
        seeds: { field: "Start from", sets },
        quick: [
          { label: "View everything, change nothing", set: "view" },
          { label: "Everything in these modules", set: "all" },
          { label: "Clear it all", set: "none" },
        ],
        hint: "Tick a module above and its tabs arrive here — then adjust any tick.",
      } as FormField,
      select("Default data scope", SCOPES, { required: true, span: 2, hint: "Scope decides whose records every tick above operates on." }),
      select("Default fee visibility", FEES, { required: true }),
      select("Can approve", APPROVES, { required: true }),
      toggle("Is a teaching role", false, "Asked for subjects and arms on onboarding", "Asked for duties instead", { span: 2 }),
      {
        label: "Map existing staff onto this role now",
        kind: "picker",
        span: 2,
        options: peopleOptions(overview.people),
        checked: [],
        placeholder: "Search by name, current role or department",
        groupAll: "All departments",
        hint: "Optional — but a role nobody is on changes nothing.",
      } as FormField,
      choice("For the people you mapped", ["Replace what they hold with this role", "Add this role on top of what they hold"], { span: 2, value: "Add this role on top of what they hold", hint: "Replace also clears whatever was granted to them individually; their own role template stays." }),
      toggle("Tell the people you mapped", true, "Told in-app what changed", "Silent change", { span: 2 }),
    ],
    submit: {
      endpoint: `${API}/access/roles`,
      method: "POST",
      map: {
        "Role name": "name",
        "What this role is for": "purpose",
        "Start from": "startFrom",
        "Modules this role can open": "modules",
        "Tabs inside those modules, and what they may do in each": "ticks",
        "Default data scope": "scope",
        "Default fee visibility": "fees",
        "Can approve": "approve",
        "Is a teaching role": "teaching",
        "Map existing staff onto this role now": "people",
        "For the people you mapped": "mode",
        "Tell the people you mapped": "tell",
      },
    },
  };
}

/* ───────────────────────── simulation ───────────────────────── */

export function simulateDrawer(o: { name: string; role: string; modules: ModuleGrant[]; scope: string; approve: string; fees: string; sensitive: string[]; template?: boolean }): DrawerSpec {
  const on = o.modules.filter((module) => module.level > 0);
  const off = o.modules.filter((module) => module.level === 0);
  return {
    mode: "view",
    kicker: "Permission simulator",
    title: o.template ? `This is what the ${o.name} template sees` : `This is what ${o.name} will see`,
    sub: "Their navigation exactly as it will render — what is absent is absent, not locked.",
    tone: "progress",
    facts: [
      ["Modules visible", `${on.length} of 16`],
      ["Modules absent entirely", `${off.length}`, off.length ? "Not locked — absent" : "None"],
      ["Tabs they can open", String(on.reduce((sum, module) => sum + module.tabs.filter((tab) => tab.a.View).length, 0))],
      ["Data scope", o.scope],
      ["Can approve", o.approve],
      ["Sees fee amounts", o.fees],
      ["Sensitive groups", o.sensitive.length ? o.sensitive.join(", ") : "None"],
      ["Their navigation", on.map((module) => module.name).join(" · ") || "Nothing", off.length ? `Absent: ${off.map((module) => module.name).join(", ")}` : undefined],
    ],
  };
}

/* ───────────────────────── a person's account ───────────────────────── */

export function suspendDrawer(person: { staffId: string; name: string; suspended?: boolean }, candidates: Array<{ id: string; label: string }> = []): DrawerSpec {
  if (person.suspended) {
    return {
      mode: "commit",
      kicker: "Permissions",
      title: `Restore ${person.name}`,
      sub: "They can sign in again immediately. Everything they held is as it was left.",
      facts: [["Person", person.name], ["Effect", "Account active again", "Anything reassigned stays with its new owner"]],
      commitLabel: "Restore the account",
      commitDone: "Account restored",
      commitDoneBody: `${person.name} can sign in again.`,
      submit: { endpoint: `${API}/staff/${person.staffId}/suspend`, method: "POST", body: { lift: true }, reasonKey: "reason", reasonRequired: true, reasonLabel: "Why they are coming back" },
    };
  }
  return {
    mode: "form",
    kicker: "Permissions",
    title: `Suspend an account · ${person.name}`,
    commitLabel: "Suspend the account",
    commitDone: "Account suspended",
    commitDoneBody: "They cannot sign in. The record and the history are intact.",
    reviewNote: "Suspension keeps the record and the history intact — it is not deletion, and it is reversible at any time.",
    fields: [
      choice("Reason", ["Dormant — no sign-in for 90 days", "Left the school", "On extended leave", "Under investigation", "Security concern"], { span: 2 }),
      select("Work routed to them", ["Move it to their line manager", "Move it to a named person", "Leave it queued"], { required: true, span: 2, hint: "Leaving it queued is what silently stops a school — nothing reaches anybody." }),
      select("Move it to", ["Nobody in particular", ...candidates.map((candidate) => candidate.label)], { span: 2, hint: "Only used if you chose a named person" }),
      select("Their teaching and form duties", ["Reassign now", "Leave assigned for now"], { span: 2, hint: "An arm whose form master is suspended has nobody marking its register." }),
      select("Suspend until", ["I lift it", "A date I choose"]),
      text("Lift on", { type: "date", value: "", optional: true }),
      area("Note for the record", { span: 2, optional: true }),
    ],
    submit: {
      endpoint: `${API}/staff/${person.staffId}/suspend`,
      method: "POST",
      map: { Reason: "reason", "Work routed to them": "routed", "Move it to": "moveTo", "Their teaching and form duties": "duties", "Suspend until": "until", "Lift on": "liftOn", "Note for the record": "note" },
      encode: { "Move it to": Object.fromEntries(candidates.map((candidate) => [candidate.label, candidate.id])) },
    },
  };
}

export function inviteDrawer(rows: Array<Pick<DirectoryRow, "userId" | "name" | "role" | "accountDays"> & { phone?: string | null; email?: string }>, o: { selection?: boolean; title?: string } = {}): DrawerSpec {
  const only = rows.length === 1 ? rows[0] : null;
  return {
    mode: "form",
    kicker: "Staff · onboarding",
    title: o.title ?? (only ? `Resend the activation link · ${only.name}` : "Resend the activation links"),
    sub: "A new link is issued and the old one stops working immediately.",
    commitLabel: only ? "Issue the link" : `Issue ${rows.length} links`,
    commitDone: "Activation link issued",
    commitDoneBody: "It is below. Send it by the channel that suits them — it works once.",
    reviewNote: "Only the newest link can be used. Nothing is sent from here: you hand each link to the person it is for.",
    fields: [
      ...(only
        ? [
            fixed("Staff member", only.name, { hint: `${only.role} · never signed in · ${only.accountDays} days since the account was made` }),
            fixed("Goes to", [only.phone, only.email].filter(Boolean).join(" and ") || "Their account", { hint: "You send it — SMS and email are not sent from here" }),
          ]
        : [fixed("Who", o.selection ? "The people you ticked" : `${rows.length} staff members`, { span: 2, hint: rows.slice(0, 4).map((row) => row.name).join(", ") + (rows.length > 4 ? ` and ${rows.length - 4} more` : "") })]),
      select("Link valid for", ["1 day", "3 days", "7 days", "14 days"], { value: "7 days", required: true }),
    ],
    submit: {
      endpoint: `${API}/staff/invite`,
      method: "POST",
      ...(o.selection ? {} : { body: { userIds: rows.map((row) => row.userId) } }),
      map: { "Link valid for": "days" },
      encode: { "Link valid for": { "1 day": "1", "3 days": "3", "7 days": "7", "14 days": "14" } },
    },
  };
}

/* ───────────────────────── assignments and the record ───────────────────────── */

export function assignmentDrawer(
  record: Pick<StaffRecord, "id" | "name" | "role" | "department" | "periods" | "ceiling">,
  options: { subjects: Array<{ id: string; name: string }>; arms: Array<{ id: string; name: string }> },
  row?: Assignment,
): DrawerSpec {
  const isNew = !row;
  const subjects = options.subjects.map((subject) => ({ value: subject.id, label: subject.name }));
  const arms = options.arms.map((arm) => ({ value: arm.id, label: arm.name }));
  const kinds = ["Subject", "Form class", "Duty", "Approval", "Function"];
  return {
    mode: isNew ? "form" : "view",
    kicker: `${record.role} · ${record.department}`,
    title: isNew ? `Assign something to ${record.name.split(" ")[0]}` : `${row.what}`,
    sub: "What they hold, where it applies, and what it costs them a week.",
    commitLabel: "Assign it",
    commitDone: "Assignment added",
    commitDoneBody: "It is on their record from today, and whatever it decides routes to them.",
    reviewNote: "A role says what somebody may do. An assignment says what they actually hold.",
    ...(row
      ? {
          facts: [
            ["What they hold", row.what],
            ["Kind", row.kind],
            ["Applies to", row.where],
            ["Load", row.load],
            ["State", row.state],
          ],
          remove: { endpoint: `${API}/staff/${record.id}/assignments/${encodeURIComponent(row.id)}`, noun: "assignment", warn: "Whatever this person does under it stops routing to them." },
          readOnlyNote: "Remove it here; to change it, remove it and assign it again.",
        }
      : {}),
    fields: isNew
      ? [
          choice("Kind", kinds, { span: 2, required: true }),
          { ...select("Subject", subjects.map((item) => item.label), { required: true }), when: { field: "Kind", equals: "Subject" } } as FormField,
          { ...select("Arm", arms.map((item) => item.label), { required: true }), when: { field: "Kind", equals: ["Subject", "Form class"] } } as FormField,
          { ...text("Periods a week", { value: "3" }), when: { field: "Kind", equals: "Subject" } } as FormField,
          { ...text("What they hold", { required: true, placeholder: "Fee collection desk" }), when: { field: "Kind", equals: ["Duty", "Approval", "Function"] } } as FormField,
          { ...select("Applies to", ["The whole school", "Their department", "Their form class", "Every student", "All staff", "The bursary"], { required: true }), when: { field: "Kind", equals: ["Duty", "Approval", "Function"] } } as FormField,
          { ...select("Load", ["Standing", "Daily", "Weekly", "Per term", "Monthly", "On request", "As raised"]), when: { field: "Kind", equals: ["Duty", "Approval", "Function"] } } as FormField,
          text("Start date", { type: "date", value: "", optional: true }),
          select("Ends", ["When I remove it", "On a date I choose"]),
          text("End date", { type: "date", value: "", optional: true, hint: "Only used if you chose a date" }),
          fixed("Resulting load", `${record.periods} periods a week, before this`, { span: 2, hint: `The school ceiling is ${record.ceiling} a week.` }),
        ]
      : [],
    submit: {
      endpoint: `${API}/staff/${record.id}/assignments`,
      method: "POST",
      map: { Kind: "kind", Subject: "subjectId", Arm: "classId", "Periods a week": "periods", "What they hold": "what", "Applies to": "where", Load: "load", "Start date": "startDate", Ends: "ends", "End date": "endDate" },
      encode: { Subject: pair(subjects), Arm: pair(arms) },
    },
  };
}

export function editRecordDrawer(record: StaffRecord, o: { departments: string[]; people: Array<{ id: string; name: string }> }): DrawerSpec {
  const NOBODY = "Nobody";
  return {
    mode: "edit",
    kicker: "Staff record",
    title: record.name,
    commitDone: `${record.name}’s record saved`,
    commitDoneBody: "Both the previous and the new values are kept on the record.",
    fields: [
      text("Staff number", { value: record.staffNo, required: true }),
      text("Designation", { value: record.designation, required: true }),
      select("Department", Array.from(new Set(["No department", ...o.departments])), { value: record.department }),
      select("Employment", ["Full time", "Part time", "Contract", "Locum · cover", "Volunteer", "National Youth Service"], { value: record.employment }),
      text("Phone", { value: record.phone ?? "" }),
      text("Email", { value: record.email }),
      select("Reports to", [NOBODY, ...o.people.map((person) => person.name)], { value: record.reportsTo?.name ?? NOBODY, span: 2, hint: "Where approvals and escalations about them go" }),
      text("Home address", { value: record.personal.address ?? "", optional: true, span: 2 }),
    ],
    submit: {
      endpoint: `${API}/staff/${record.id}`,
      method: "PATCH",
      map: { "Staff number": "staffNo", Designation: "designation", Department: "department", Employment: "employmentType", Phone: "phone", Email: "email", "Reports to": "reportsTo", "Home address": "address" },
      encode: { "Reports to": { [NOBODY]: "", ...Object.fromEntries(o.people.map((person) => [person.name, person.id])) } },
      reasonKey: "reason",
      reasonRequired: true,
    },
  };
}

/** Every template, for pickers elsewhere. */
export const TEMPLATE_NAMES = schoolRoleTemplates.map((template) => template.name);

/* ───────────────────────── adding someone ───────────────────────── */

export type Option = { id: string; label: string };

const DOCUMENTS = [
  "Signed contract",
  "Qualification certificates",
  "Means of identification",
  "Police clearance / safeguarding check",
  "Medical fitness certificate",
  "Two written references",
];
const MESSAGING = ["Nobody", "Guardians of their own class", "All guardians", "Staff", "Everyone"];
const DUTIES = [
  "Fee collection and receipting",
  "Bank reconciliation",
  "Admissions and enquiries",
  "Student records and registry",
  "Guardian communication",
  "Health and welfare",
  "Counselling and guidance",
  "Library",
  "ICT and devices",
  "Transport",
  "Catering",
  "Security and gate",
  "Facilities",
  "Procurement",
];

/**
 * The staff wizard. The role chosen in the second stage decides what the third asks and
 * what the fourth starts from, exactly as the mockup has it — the fields that depend on
 * the role carry the dependency as data (`when`, `seeds`).
 */
export function addStaffDrawer(o: {
  roles: Array<{ label: string; teaching: boolean; template: string }>;
  departments: string[];
  people: Array<{ id: string; name: string; role: string }>;
  subjects: Option[];
  arms: Option[];
  groups: string[];
  nextStaffNo: string;
  ceiling: number;
}): DrawerSpec {
  const roles = o.roles.map((role) => role.label);
  const teaching = o.roles.filter((role) => role.teaching).map((role) => role.label);
  const nonTeaching = o.roles.filter((role) => !role.teaching).map((role) => role.label);
  const first = roles[0] ?? "Subject Teacher";
  const moduleNames = schoolModules.map((module) => module.name);
  const tickSets = Object.fromEntries(o.roles.map((role) => [role.label, templateTicks(role.template)]));
  const moduleSets = Object.fromEntries(
    o.roles.map((role) => {
      const reached = new Set(tickSets[role.label].map((tick) => tick.split(".")[0]));
      return [role.label, schoolModules.filter((module) => reached.has(module.slug)).map((module) => module.name)];
    }),
  );
  const reportsTo = o.people.map((person) => `${person.name} · ${person.role}`);
  const byName = pair(o.people.map((person) => ({ value: person.id, label: `${person.name} · ${person.role}` })));
  const armLabels = o.arms.map((arm) => arm.label);
  const modulesLabel = "Modules they can open";
  const tabsLabel = "Tabs inside those modules, and what they may do in each";
  const ceilingNote = `Checked against the school ceiling of ${o.ceiling} when the timetable is built`;

  return {
    mode: "form",
    kicker: "Staff · onboarding",
    title: "Add a staff member",
    sub: "Who they are, what they hold, and what they can open from the first sign-in.",
    commitLabel: "Create staff member",
    commitDone: "Staff member created",
    commitDoneBody: "Their access is live exactly as you set it. No password is ever set here — they choose their own from the activation link below, which you hand to them.",
    reviewNote: "Their role and the access you defined decide what they can see and do from the first sign-in. Nothing is written until you create the account.",
    page: {
      reviewDesc: "The person, their role, their assignment and their access — all of it, before the account exists.",
      confirmBody: "Their role and the access you defined decide what they can see and do from the first sign-in.",
      railTitle: "How staff onboarding works here",
      rail: [
        ["No password here", "They set their own from the activation link"],
        ["The role decides the shape", "Teaching roles are asked for subjects; others are not"],
        ["Access is explicit", "The role seeds it; you confirm every module"],
        ["Nothing is silent", "Every grant is logged against your name"],
        ["The link", "Shown to you once created — you hand it over, and it can be resent from their record"],
      ],
      footNote: "Nothing is written until you create the account. The activation link is issued at that moment, not before.",
      back: { label: "Back to the directory", href: "/staff-access/directory" },
    },
    steps: [
      {
        title: "Person",
        hint: "Who they are, and how the school reaches them.",
        fields: [
          text("Full name", { required: true, span: 2, placeholder: "Mrs Amaka Eze", hint: "As it should appear on a report card signature and in the staff directory" }),
          select("Title", ["Mrs", "Mr", "Miss", "Ms", "Dr", "Prof", "Alhaji", "Hajiya", "Rev"], { required: true }),
          choice("Gender", ["Female", "Male"]),
          text("Mobile number", { required: true, placeholder: "+234 803 000 0000", hint: "This is their login and the number the activation link is meant for" }),
          text("Work email", { required: true, placeholder: "amaka@school.ng", hint: "Their account is made under this address" }),
          text("Staff number", { value: o.nextStaffNo, hint: "Generated — change it if your school numbers differently" }),
          select("Nationality", ["Nigerian", "Ghanaian", "Kenyan", "South African", "British", "Indian", "Other"]),
          text("Home address", { span: 2, optional: true }),
          text("Next of kin", { optional: true, placeholder: "Name and relationship" }),
          text("Next of kin number", { optional: true }),
        ],
      },
      {
        title: "Role",
        hint: "The role decides what the rest of this flow asks you.",
        fields: [
          select("Role", roles, { required: true, span: 2, hint: "Not every staff member teaches. Choosing a non-teaching role removes the subject and arm questions entirely." }),
          {
            label: "This role teaches",
            kind: "static",
            span: 2,
            value: "You will be asked for subjects and arms next",
            by: {
              field: "Role",
              cases: Object.fromEntries(
                o.roles.map((role) => [
                  role.label,
                  role.teaching
                    ? { value: "Yes — you will be asked for subjects and arms next", hint: "A teaching role must be mapped to at least one subject-arm before any score can exist under their name." }
                    : { value: "No — the teaching step becomes duties", hint: "No subject, no arm, no register and no score sheet will ever be routed to this person." },
                ]),
              ),
            },
          } as FormField,
          select("Department or unit", Array.from(new Set(["No department", ...o.departments])), { required: true }),
          select("Employment type", ["Full time", "Part time", "Contract", "Locum · cover", "Volunteer", "National Youth Service"], { required: true }),
          text("Start date", { type: "date", value: "", required: true, hint: "Recorded as the day they join. Their link works as soon as you hand it over." }),
          select("Reports to", ["Nobody in particular", ...reportsTo], { hint: "Where approvals and escalations about them go" }),
          checks("Documents on file", DOCUMENTS, ["Signed contract", "Means of identification"], { span: 2, hint: "A safeguarding check missing on a staff member who works with children stays flagged on their record until it is on file." }),
        ],
      },
      {
        title: "Teaching or duties",
        hint: "A teaching role is asked what it teaches and to whom; any other role is asked what it is responsible for.",
        fields: [
          { ...checks("Subjects taught", o.subjects.map((item) => item.label), [], { required: true, span: 2, hint: "Only these subjects appear to them, and only for the arms below." }), when: { field: "Role", equals: teaching } } as FormField,
          { ...checks("Class arms", armLabels, [], { required: true, span: 2, hint: "Subject × arm is the unit of teaching here — they will see one score sheet per combination." }), when: { field: "Role", equals: teaching } } as FormField,
          { ...select("Form master of", ["Not a form master", ...armLabels], { span: 2, hint: "A form master owns the daily register, the remarks and the guardian conversations for one arm. An arm can only have one." }), when: { field: "Role", equals: "Form Master" } } as FormField,
          { ...text("Periods a week", { value: "", unit: "periods", optional: true, hint: ceilingNote }), when: { field: "Role", equals: teaching } } as FormField,
          {
            ...checks("Responsible for", DUTIES, [], { required: true, span: 2, addable: true, addPlaceholder: "Boarding house supervision, exam invigilation…", addLabel: "Add this duty", hint: "Anything this school asks of them that is not on the list — type it and add it." }),
            when: { field: "Role", equals: nonTeaching },
          } as FormField,
          {
            ...select("Works with children directly", ["Yes · safeguarding check required", "No · non-contact role"], { required: true, span: 2, hint: "A yes makes the safeguarding check a blocking requirement on their record." }),
            when: { field: "Role", equals: nonTeaching },
          } as FormField,
          { ...text("Working hours", { value: "07:30 – 16:00" }), when: { field: "Role", equals: nonTeaching } } as FormField,
          { ...select("Days on site", ["Monday to Friday", "Monday to Saturday", "Shift pattern", "As required"]), when: { field: "Role", equals: nonTeaching } } as FormField,
        ],
      },
      {
        title: "Access",
        hint: "What they can open, how far their data reaches, and what they may approve.",
        fields: [
          {
            label: "Seeded from",
            kind: "static",
            span: 2,
            value: "The template for the role you chose",
            by: {
              field: "Role",
              cases: Object.fromEntries(
                o.roles.map((role) => [
                  role.label,
                  {
                    value: `The ${role.template} template · ${moduleSets[role.label].length} of 16 modules`,
                    hint: "A template is a starting point, never the answer. Confirm every line below — what you leave unticked is absent from their navigation, not greyed out.",
                  },
                ]),
              ),
            },
          } as FormField,
          { ...checks(modulesLabel, moduleNames, moduleSets[first] ?? [], { required: true, span: 2 }), seeds: { field: "Role", sets: moduleSets } } as FormField,
          {
            label: tabsLabel,
            kind: "matrix",
            span: 2,
            rowHead: "Module · tab",
            cols: ["View", "Create", "Edit", "Approve"],
            rows: tabRows(),
            checked: tickSets[first] ?? [],
            groupFrom: modulesLabel,
            seeds: { field: "Role", sets: tickSets },
            quick: [
              { label: "View everything, change nothing", set: "view" },
              { label: "Everything the role allows", set: "all" },
              { label: "Clear it all", set: "none" },
            ],
            hint: "Tick a module above and its tabs appear here, already set the way the role’s template sets them — then adjust any tick. A tab with no View tick is absent from that module for them.",
          } as FormField,
          select("Data scope", SCOPES, { required: true, span: 2, hint: "Scope is the strongest control here. A teacher scoped to their own arms cannot be shown another arm’s results." }),
          select("Fee amounts", FEES, { value: FEES[0], required: true, hint: "The single most common mistake in a school system is showing a class teacher what a family owes." }),
          select("Can approve", APPROVES, { required: true, hint: "Nobody can approve their own submission, whatever is set here." }),
          o.groups.length
            ? checks("Sensitive groups", o.groups, [], { span: 2, hint: "Granted individually, never inherited from a role. Every reveal is written to the audit log with their name." })
            : fixed("Sensitive groups", "None exist yet", { span: 2, hint: "Create one in Permissions, then grant it person by person. Nothing is closed off until you do." }),
          checks("Can send messages to", MESSAGING, [], { span: 2 }),
          toggle("Can export data to Excel or PDF", false, "Exports allowed · every export is logged", "No exports", { span: 2 }),
          toggle("Require two-step sign-in", false, "Required · recorded on the account", "Password only", { span: 2 }),
          text("Access ends", { type: "date", value: "", optional: true, span: 2, hint: "A locum or a contract staff member should always have an end date — it is what stops dormant accounts accumulating." }),
        ],
      },
      {
        title: "Review",
        hint: "The person, the role, the assignment and the access — all of it, before the account exists.",
        fields: [
          fixed("What happens when you create this", "The account exists, the access is live, and an activation link is issued", { span: 2, hint: "Until they use that link they cannot sign in, and anything routed to their role waits unread — which is why the link is resendable from their record." }),
          fixed("The link", "Shown to you once created — nothing is sent to their phone or email from here", { span: 2, hint: "You hand it to them by whichever channel suits." }),
          select("Link valid for", ["1 day", "3 days", "7 days", "14 days"], { value: "7 days", required: true }),
          toggle("Announce them to the staff directory", true, "Existing staff are told who joined and in what role", "No announcement", { span: 2 }),
        ],
      },
    ],
    submit: {
      endpoint: `${API}/staff`,
      method: "POST",
      map: {
        "Full name": "name",
        Title: "title",
        Gender: "gender",
        "Mobile number": "phone",
        "Work email": "email",
        "Staff number": "staffNo",
        Nationality: "nationality",
        "Home address": "address",
        "Next of kin": "kin",
        "Next of kin number": "kinPhone",
        Role: "role",
        "Department or unit": "department",
        "Employment type": "employment",
        "Start date": "startDate",
        "Reports to": "reportsTo",
        "Documents on file": "documents",
        "Subjects taught": "subjects",
        "Class arms": "arms",
        "Form master of": "formArm",
        "Periods a week": "periods",
        "Responsible for": "responsibilities",
        "Works with children directly": "children",
        "Working hours": "hours",
        "Days on site": "days",
        [modulesLabel]: "modules",
        [tabsLabel]: "ticks",
        "Data scope": "scope",
        "Fee amounts": "fees",
        "Can approve": "approve",
        "Sensitive groups": "sensitive",
        "Can send messages to": "messaging",
        "Can export data to Excel or PDF": "exports",
        "Require two-step sign-in": "twoStep",
        "Access ends": "accessEnds",
        "Link valid for": "validFor",
        "Announce them to the staff directory": "announce",
      },
      encode: {
        "Department or unit": { "No department": "" },
        "Reports to": { "Nobody in particular": "", ...byName },
        "Subjects taught": pair(o.subjects.map((item) => ({ value: item.id, label: item.label }))),
        "Class arms": pair(o.arms.map((item) => ({ value: item.id, label: item.label }))),
        "Form master of": { "Not a form master": "", ...pair(o.arms.map((item) => ({ value: item.id, label: item.label }))) },
      },
    },
  };
}

/* ───────────────────────── leaving ───────────────────────── */

export function offboardDrawer(plan: {
  id: string;
  name: string;
  formClasses: Array<{ id: string; name: string; roll: number }>;
  subjects: Array<{ id: string; subject: string; arm: string }>;
  unsubmittedSheets: number;
  delegations: number;
  routedApprovals: number;
  candidates: Array<{ id: string; name: string; role: string }>;
}): DrawerSpec {
  const first = plan.name.split(" ")[0];
  const who = plan.candidates.map((candidate) => `${candidate.name} · ${candidate.role}`);
  const byLabel = pair(plan.candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${candidate.role}` })));
  const NOBODY = "Choose who takes it over";
  const fields: FormField[] = [];
  const nest: Record<string, [string, string]> = {};
  plan.formClasses.forEach((arm) => {
    const label = `Form master of ${arm.name}`;
    fields.push(select(label, [NOBODY, ...who], { required: true, span: 2, hint: `${arm.roll} on the roll · the register, the remarks and the guardian conversations go with it` }));
    nest[label] = ["formMasters", arm.id];
  });
  plan.subjects.forEach((row) => {
    const label = `${row.subject} · ${row.arm}`;
    fields.push(select(label, [NOBODY, ...who], { required: true, span: 2, hint: "The score sheet moves with it, exactly as it stands" }));
    nest[label] = ["subjects", row.id];
  });
  return {
    mode: "form",
    kicker: "Staff · offboarding",
    title: `Offboard ${plan.name}`,
    sub: "Everything they hold finds an owner before the account closes.",
    commitLabel: "Complete the exit",
    commitDone: `${first} has left`,
    commitDoneBody: "Their account is closed, what they held has moved, and the history stays on the record.",
    reviewNote: "The exit cannot complete while anything they hold has no owner. The account is closed, never deleted.",
    steps: [
      {
        title: "Reason",
        hint: "Why they are leaving, and their last working day.",
        fields: [
          select("Reason for leaving", ["Resignation", "End of contract", "Retirement", "Dismissal", "Redundancy", "Death in service", "Transfer to another school"], { required: true, span: 2 }),
          text("Last working day", { type: "date", value: "", required: true }),
          area("Note for the record", { span: 2, optional: true, placeholder: "Anything the next administrator should know." }),
        ],
      },
      {
        title: "What they hold",
        hint: "Everything below is routed to them today.",
        fields: [
          fixed("Form classes", plan.formClasses.length ? plan.formClasses.map((arm) => arm.name).join(", ") : "None", { span: 2 }),
          fixed("Subject-arms they teach", plan.subjects.length ? `${plan.subjects.length} · ${plan.subjects.slice(0, 4).map((row) => `${row.subject} ${row.arm}`).join(", ")}${plan.subjects.length > 4 ? "…" : ""}` : "None", { span: 2 }),
          fixed("Score sheets not yet submitted", String(plan.unsubmittedSheets), { hint: plan.unsubmittedSheets ? "They move to whoever takes the subject over, as they stand" : "Nothing is left half-done" }),
          fixed("Approvals waiting on them", String(plan.routedApprovals), { hint: plan.routedApprovals ? "They wait on a role nobody will hold — they are reassigned here" : "Nothing waits on them" }),
          fixed("Delegations they hold", String(plan.delegations)),
        ],
      },
      {
        title: "Reassign",
        hint: "Name who takes each one over. Nothing is left with a closed account.",
        fields: fields.length ? fields : [fixed("Nothing to reassign", "They hold no form class and no subject", { span: 2 })],
      },
      {
        title: "Confirm",
        hint: "What leaving does to their account.",
        fields: [
          toggle("Revoke every delegation they hold", true, "Their delegations end today", "Their delegations stay until they expire", { span: 2 }),
          ...(plan.unsubmittedSheets
            ? [text("Type OFFBOARD to confirm", { span: 2, value: "", required: true, placeholder: "OFFBOARD", hint: `${plan.unsubmittedSheets} score ${plan.unsubmittedSheets === 1 ? "sheet is" : "sheets are"} unfinished and will be finished by whoever takes them over.` })]
            : []),
        ],
      },
    ],
    submit: {
      endpoint: `${API}/staff/${plan.id}/offboard`,
      method: "POST",
      map: {
        "Reason for leaving": "reason",
        "Last working day": "lastDay",
        "Note for the record": "note",
        "Revoke every delegation they hold": "revokeDelegations",
        "Type OFFBOARD to confirm": "confirm",
      },
      nest,
      encode: Object.fromEntries(Object.keys(nest).map((label) => [label, { [NOBODY]: "", ...byLabel }])),
    },
  };
}

/** Opening a person's sensitive fields: a reason first, and the opening is logged. */
export function revealDrawer(person: { id: string; name: string }): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Sensitive record",
    title: `Open ${person.name}’s sensitive fields`,
    sub: "Next of kin, salary band, health details and emergency contacts.",
    tone: "sensitive",
    facts: [
      ["What is logged", "Your name, the record and the time", "Written before the fields open — not when you close them"],
      ["Who may open it", "The Proprietor, the person themselves, and holders of the group that covers staff salary and next of kin"],
    ],
    commitLabel: "Continue and open them",
    commitDone: "Opened and logged",
    commitDoneBody: "These fields are shown once, below. Opening them again is logged again.",
    submit: { endpoint: `${API}/staff/${person.id}/reveal`, method: "POST", reasonKey: "reason", reasonRequired: true, reasonLabel: "Why you are opening them" },
  };
}

/** Someone who already has an account — a teacher at two schools, an external examiner — is added with a role here instead of a second account. */
export function addExistingAccountDrawer(): DrawerSpec {
  const roles: Array<[string, string]> = [["Subject teacher", "SUBJECT_TEACHER"], ["Teaching assistant", "TEACHING_ASSISTANT"], ["Cover / substitute", "COVER_TEACHER"], ["Class teacher", "CLASS_TEACHER"], ["Head of department", "HEAD_OF_DEPARTMENT"], ["Examination officer", "EXAMINATION_OFFICER"], ["Bursar", "BURSAR"], ["Administrator", "ADMINISTRATOR"]];
  return {
    mode: "form",
    kicker: "Staff · access",
    title: "Add someone who already has an account",
    sub: "They keep one login and switch between schools from the menu under their name. Their role here is separate from any other.",
    commitLabel: "Add them",
    commitDone: "Added",
    commitDoneBody: "They are told by email and can switch to this school straight away. Remove them from the Directory whenever you need to.",
    reviewNote: "Nothing about their other schools is shown to you, or yours to them.",
    fields: [
      text("Their account email", { required: true, span: 2, placeholder: "name@example.com" }),
      select("Role here", roles.map(([label]) => label), { span: 2 }),
      text("Ends on", { optional: true, placeholder: "YYYY-MM-DD — leave blank for no end date", hint: "Use an end date for an external examiner." }),
      text("Note", { optional: true, span: 2 }),
    ],
    submit: { endpoint: "/api/v1/memberships", method: "POST", map: { "Their account email": "email", "Role here": "role", "Ends on": "expiresAt", Note: "note" }, encode: { "Role here": Object.fromEntries(roles) } },
  };
}
