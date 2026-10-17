import { apiGet } from "@/lib/api/server";
import { dayLabel, plural } from "@/lib/modules/live/m7-format";
import { addGuardianDrawer, duplicateReviewDrawer, editContactDrawer, inviteDrawer, mapChildDrawer, mergeDrawer, PG, phoneOnlyDrawer } from "@/lib/modules/live/m9-forms";
import { FEE_TONE, attTone, gradeTone, studentHref } from "@/lib/modules/live/m8-registry";
import type { FeeState } from "@/lib/modules/live/m8-types";
import type { Families, Family, FamilyRow, GuardianOptions } from "@/lib/modules/live/m9-types";
import { name as nameCell, pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Guardians: one guardian, one account, however many children. A family is not a row per child —
 * four children in three arms is ONE family, one login and one set of notifications — so the
 * register is folded by guardian and everything downstream counts families, not mappings.
 */

export const loadFamilies = () => apiGet<Families>(`${PG}/guardians`);
export const loadGuardianOptions = () => apiGet<GuardianOptions>(`${PG}/guardians/options`);
export const loadFamily = (id: string) => apiGet<Family>(`${PG}/guardians/${encodeURIComponent(id)}`);

export const familyHref = (id: string) => `/parents-guardians/guardians/${encodeURIComponent(id)}`;
const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

export const PORTAL_TONE: Record<string, PanelTone> = { Active: "positive", Invited: "attention", "Not activated": "negative" };
export const DELIVERY_TONE: Record<string, PanelTone> = { Delivered: "positive", Failing: "negative", "No number": "negative" };
export const CONSENT_TONE: Record<string, PanelTone> = { Complete: "positive", Gaps: "attention", None: "negative" };

const kids = (row: Pick<FamilyRow, "children">) => row.children.map((child) => `${child.name.split(" ")[0]} · ${child.arm}`).join("  ·  ");

export function guardiansTab(data: Families, o: GuardianOptions): TabContent {
  const { totals, rows } = data;
  const never = rows.filter((row) => row.portal !== "Active" && !row.phoneOnly);
  const average = totals.families ? (totals.children / totals.families).toFixed(1) : "0";
  const add = { label: "Add guardian", primary: true, drawer: addGuardianDrawer(o) };
  const invite = inviteDrawer(never.length, totals.neverChildren);
  const phoneOnly = phoneOnlyDrawer(never.map((row) => ({ id: row.id, name: row.name, phone: row.phone })));

  const cards: KpiCard[] = [
    { label: "Guardians", value: String(totals.families), sub: "One account per family", tone: "neutral" },
    { label: "Children mapped", value: String(totals.children), sub: `Average ${average} per family` },
    { label: "Portal activated", value: String(totals.active), unit: `of ${totals.families}`, sub: `${totals.families ? Math.round((totals.active / totals.families) * 100) : 0}% of families`, tone: "positive" },
    { label: "Never activated", value: String(never.length), sub: `${plural(totals.neverChildren, "child", "children")} unreachable`, tone: never.length ? "negative" : "positive", link: never.length ? "Resend the invites" : undefined, drawer: never.length ? invite : undefined },
    { label: "Delivery failing", value: String(totals.failing), sub: "Wrong number or opted out", tone: totals.failing ? "attention" : "positive" },
  ];

  const tableRows: TableRow[] = rows.map((row) => ({
    id: row.id,
    href: familyHref(row.id),
    keywords: `${row.name} ${row.phone} ${row.email ?? ""} ${row.children.map((child) => `${child.name} level:${child.level} arm:${child.arm}`).join(" ")}`,
    cells: [
      nameCell(row.name, `${plural(row.children.length, "child", "children")} · ${row.occupation ?? row.relation}`),
      text(row.relation),
      text(row.phone, { mono: true }),
      text(kids(row)),
      pill(row.phoneOnly ? "Phone-only" : row.portal, row.phoneOnly ? "neutral" : PORTAL_TONE[row.portal]),
      pill(row.delivery, DELIVERY_TONE[row.delivery]),
      pill(row.consent, CONSENT_TONE[row.consent]),
      row.owes ? text(naira(row.amount), { mono: true, strong: true, tone: "attention" }) : text("Settled"),
      { kind: "action" as const, label: "Open", href: familyHref(row.id) },
    ],
  }));

  const reach = [
    ["Reachable by at least one channel", `${totals.reachable} of ${totals.families}`, ""],
    ["Delivery failing", `${plural(totals.failing, "family", "families")}`, "Wrong number, unreachable network, or opted out"],
    ["No phone number on file", `${plural(totals.noPhone, "family", "families")}`, "Blocks SMS and every emergency broadcast"],
    ["Phone-only by choice", `${plural(totals.phoneOnly, "family", "families")}`, "Marked deliberately — never counted as a failure"],
    ["Never activated", `${plural(never.length, "family", "families")}`, "Invisible to everything digital"],
    ["Second contact on file", `${totals.second} of ${totals.families}`, "A family with one contact has a single point of failure"],
    ["Emergency broadcast reach", `${totals.families ? Math.round((totals.reachable / totals.families) * 100) : 0}%`, "The figure that matters on the day it matters"],
    ["Preferred language other than English", `${plural(totals.otherLanguage, "family", "families")}`, "Every send uses their chosen language"],
  ] as Array<[string, string, string]>;

  return {
    title: "Guardians",
    desc: "One guardian, one account, however many children.",
    primary: { label: "Add guardian", icon: "M12 5.5v13M5.5 12h13", drawer: addGuardianDrawer(o) },
    launchers: [{ label: "Resend every outstanding invite", drawer: invite }, { label: "Request the missing consent", href: "/parents-guardians/consent" }],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Families", per: 5, cards }] },
      ...(never.length ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: `${plural(never.length, "family", "families")} ${never.length === 1 ? "has" : "have"} never activated the portal — ${plural(totals.neverChildren, "child", "children")} between them`, body: "These families are invisible to the digital layer. No published report card, no fee reminder and no emergency broadcast reaches them, and nothing on any screen will look wrong until somebody asks why they never replied.", acts: [{ label: `Resend all ${never.length} invites`, drawer: invite }, { label: "Mark them phone-only", drawer: phoneOnly }] }] }] : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every family",
            tag: `${rows.length} guardians`,
            tagTone: "neutral",
            sub: "Open a family for their children, their balance and what has been sent.",
            meta: `${rows.length} guardians · ${totals.children} children · ${totals.active} activated`,
            search: "Find by guardian name, phone, email or child",
            filters: [
              { label: "Class", value: "All", options: ["All", ...data.options.levels], match: Object.fromEntries(data.options.levels.map((level) => [level, `level:${level}`])) },
              { label: "Arm", value: "All", options: ["All", ...data.options.arms], match: Object.fromEntries(data.options.arms.map((arm) => [arm, `arm:${arm}`])) },
              { label: "Portal", value: "All", options: ["All", "Active", "Invited", "Not activated", "Phone-only"], column: 4 },
              { label: "Consent", value: "All", options: ["All", "Complete", "Gaps", "None"], column: 6 },
              { label: "Delivery", value: "All", options: ["All", "Delivered", "Failing", "No number"], column: 5 },
            ],
            acts: [{ label: "Export to Excel", export: true }, { label: "Resend outstanding invites", drawer: invite }, add],
            head: ["Guardian", "Relation", "Phone", "Children · class and arm", "Portal", "Delivery", "Consent", "Owes", ""],
            noun: "guardian",
            nounPlural: "guardians",
            per: 10,
            selectable: true,
            bulkActs: [
              { label: "Resend the portal invite", drawer: { ...inviteDrawer(0, 0), title: "Resend the portal invite", facts: undefined, commitLabel: "Resend", commitDone: "Invites resent", commitDoneBody: "Each ticked family has a fresh link queued.", mode: "commit", submit: { endpoint: `${PG}/guardians/invite`, method: "POST" } }, selection: { key: "families", noun: "family" } },
              { label: "Request consent", href: "/parents-guardians/consent" },
              { label: "Message these families", href: "/communication-center/compose" },
              { label: "Export to Excel", primary: true, export: true },
            ],
            rows: tableRows,
            foot: "A guardian with four children has one account, one login and one set of notifications — never four.",
          },
        ],
      },
      {
        cols: "1fr 1.1fr",
        panels: [
          {
            type: "list",
            title: "Possible duplicates",
            sub: "Two records that share a phone number or an email are usually one family typed twice.",
            items: data.duplicates.length
              ? data.duplicates.slice(0, 6).map((item) => ({ label: item.label, sub: item.sub, pill: item.same ? "Review" : "Probably fine", tone: (item.same ? "attention" : "neutral") as PanelTone, viewLabel: item.same ? "Merge" : "Review", drawer: item.same ? mergeDrawer(rows, item.ids.slice(0, 2)) : duplicateReviewDrawer(item, rows) }))
              : [{ label: "No two guardians share a number or an email", sub: "Every family is on the register once.", pill: "None", tone: "positive" as PanelTone }],
          },
          { type: "facts", title: "Can the school actually reach these families", per: 2, facts: reach },
        ],
      },
    ],
  };
}

/* ───────────────────────── one family ───────────────────────── */

export type FamilyPage = { content: TabContent & { crumb: { label: string; href: string } } };

export function familyPage(f: Family, o: GuardianOptions, rows: FamilyRow[]): FamilyPage {
  const owing = f.children.filter((child) => child.owing > 0);
  const phoneOnly = phoneOnlyDrawer(rows.map((row) => ({ id: row.id, name: row.name, phone: row.phone })), { id: f.id, name: f.name, phone: f.phone });
  const portalNote = f.portal !== "Active" && !f.phoneOnly;
  const given = f.consents.filter((entry) => entry.status === "GIVEN").length;

  const children: TableRow[] = f.children.map((child) => ({
    href: studentHref(child.id),
    cells: [nameCell(child.name, `${child.gender} · ${child.boarding}`), text(child.adm, { mono: true }), text(child.arm), text(child.att === null ? "—" : `${child.att}%`, { mono: true, strong: true, tone: attTone(child.att) }), text(child.avg === null ? "—" : String(child.avg), { mono: true }), pill(child.grade, gradeTone(child.avg)), text(child.pos === null ? "—" : String(child.pos), { mono: true }), pill(child.fee, FEE_TONE[child.fee as FeeState] ?? "neutral"), { kind: "action" as const, label: "Open", href: studentHref(child.id) }],
  }));
  const balances: TableRow[] = owing.map((child) => ({ href: studentHref(child.id, "/fees"), cells: [nameCell(child.name, child.boarding), text(child.arm), text(naira(child.billed), { mono: true }), text(naira(child.paid), { mono: true }), text(naira(child.owing), { mono: true, strong: true, tone: "attention" }), pill(child.fee, FEE_TONE[child.fee as FeeState] ?? "neutral"), { kind: "action" as const, label: "Open", href: studentHref(child.id, "/fees") }] }));

  return {
    content: {
      crumb: { label: "Back to Guardians", href: "/parents-guardians/guardians" },
      title: f.name,
      desc: `${f.relation} of ${plural(f.children.length, "child", "children")} · ${f.phone} · since ${f.joined}.`,
      primary: { label: "Message this family", icon: "M4 5.5h16v13H4zM4 6l8 6 8-6", href: "/communication-center/compose" },
      launchers: [
        ...(f.portal !== "Active" ? [{ label: "Resend the portal invite", drawer: inviteDrawer(1, f.children.length, [f.id]) }] : []),
        { label: "Map another child", drawer: mapChildDrawer(f, o.students) },
        ...(given < f.consents.length ? [{ label: "Request the missing consent", href: "/parents-guardians/consent" }] : []),
        { label: "Edit the contact", drawer: editContactDrawer(f) },
      ],
      rows: [
        ...(portalNote ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: "This family has never activated the portal", body: `Nothing digital reaches them — no published report card, no fee reminder, no emergency broadcast. ${plural(f.children.length, "child")} ${f.children.length === 1 ? "is" : "are"} affected, and no screen in this product will look wrong until somebody asks why they never replied.`, acts: [{ label: "Resend the invite", drawer: inviteDrawer(1, f.children.length, [f.id]) }, { label: "Mark them phone-only", drawer: phoneOnly }] }] }] : []),
        ...(f.invalidPhone ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: "The phone number on file does not look like a Nigerian mobile", body: `${f.phone} would not receive an SMS. Correct it, or every message to this family fails.`, acts: [{ label: "Edit the contact", drawer: editContactDrawer(f) }] }] }] : []),
        { cols: "1fr", panels: [{ type: "kpi", title: "This family", per: 6, cards: [{ label: "Children", value: String(f.children.length), sub: f.children.map((child) => child.arm).join(", ").slice(0, 40), tone: "neutral" }, { label: "Portal", value: f.phoneOnly ? "Phone-only" : f.portal, sub: f.portal === "Active" ? "One login for all" : f.phoneOnly ? "Marked deliberately" : "Never signed in", tone: f.phoneOnly ? "neutral" : PORTAL_TONE[f.portal] }, { label: "Owes", value: f.owes ? naira(f.amount) : "Settled", sub: f.owes ? `${f.owes} of ${f.children.length} children` : "Nothing outstanding", tone: f.owes ? "attention" : "positive", link: f.owes ? "Open fees" : undefined, href: f.owes && f.familyHref ? f.familyHref : undefined }, { label: "Attendance", value: f.attendance === null ? "—" : `${f.attendance}%`, sub: "Across their children", tone: attTone(f.attendance) }, { label: "Consent", value: f.consent, sub: f.consent === "Complete" ? "Everything required is on file" : "Something is missing", tone: CONSENT_TONE[f.consent], link: f.consent !== "Complete" ? "Request it" : undefined, href: f.consent !== "Complete" ? "/parents-guardians/consent" : undefined }, { label: "Delivery", value: f.delivery, sub: f.delivery === "Delivered" ? "Messages arrive" : "Messages are bouncing", tone: DELIVERY_TONE[f.delivery] }] }] },
        { cols: "1fr", panels: [{ type: "table", title: "Children mapped to this guardian", tag: plural(f.children.length, "child", "children"), tagTone: "neutral", sub: "Open any child for their full record — the same page their class roster opens.", meta: f.children.map((child) => `${child.name.split(" ")[0]} · ${child.arm}`).join("  ·  "), acts: [{ label: "Message about one child", href: "/communication-center/compose" }, { label: "Map another child", primary: true, drawer: mapChildDrawer(f, o.students) }], head: ["Child", "Admission no", "Arm", "Att %", "Avg", "Grade", "Pos", "Fees", ""], noun: "child", nounPlural: "children", per: 8, rows: children, emptyTitle: "No child is mapped", emptyBody: "Map a child so the family can be reached about them.", foot: "Every child here shares one guardian account. A message about one child goes to this one inbox, never four." }] },
        {
          cols: "1.2fr 1fr",
          panels: [
            { type: "facts", title: "Contact", tag: f.delivery === "Delivered" ? "Reachable" : "Delivery failing", tagTone: f.delivery === "Delivered" ? "positive" : "negative", sub: "Who the school writes to, and how.", meta: `With the school since ${f.joined} · ${plural(f.children.length, "child", "children")} enrolled`, acts: [{ label: "Message them", href: "/communication-center/compose" }, { label: "Edit the contact", primary: true, drawer: editContactDrawer(f) }], per: 2, facts: [["Primary guardian", f.name, `${f.relation}${f.occupation ? ` · ${f.occupation}` : ""}`], ["Mobile number", f.phone, "Their login and every SMS"], ["Email", f.email ?? "Not given", ""], ["Second contact", f.secondName ?? (f.secondPhone ? "A second number" : "None on file"), f.secondPhone ?? "A single point of failure"], ["Preferred language", f.language, "Every send uses it"], ["Portal", f.phoneOnly ? "Phone-only" : f.portal, f.portal === "Active" ? "Has signed in" : "Never signed in"], ["Delivery", f.delivery, f.delivery === "Delivered" ? "Messages arrive" : "Messages are bouncing"], ["Home address", f.address ?? "Not given", ""]] },
            { type: "list", title: "Consent on file", sub: "Each records who gave it, when and by what means.", items: [...f.consents.map((entry) => ({ label: entry.name, sub: entry.status === "GIVEN" ? `Given${entry.on ? ` ${dayLabel(entry.on)}` : ""}${entry.means ? `, ${entry.means === "PORTAL" ? "in the portal" : entry.means === "PAPER" ? "on paper" : "in person"}` : ""}` : entry.status === "WITHDRAWN" ? "Withdrawn — never chased" : `Not recorded — ${entry.blocks.toLowerCase()}`, pill: entry.status === "GIVEN" ? "Given" : entry.status === "WITHDRAWN" ? "Withdrawn" : "Missing", tone: (entry.status === "GIVEN" ? "positive" : entry.status === "WITHDRAWN" ? "withheld" : entry.required ? "negative" : "attention") as PanelTone })), ...(given < f.consents.length ? [{ label: "Request what is missing", sub: "One message covering every gap for this family.", pill: "Request", tone: "neutral" as PanelTone, viewLabel: "Request", href: "/parents-guardians/consent" }] : [])] },
          ],
        },
        ...(owing.length ? [{ cols: "1fr", panels: [{ type: "table" as const, title: "What this family owes", tag: naira(f.amount), tagTone: "attention" as PanelTone, sub: "One balance across every child — a family pays once, not per child.", meta: `${owing.length} of ${f.children.length} children carry a balance · ${naira(f.amount)} in total`, acts: [{ label: "Open the family in Fee Management", primary: true, href: f.familyHref ?? "/fee-management/collections" }], head: ["Child", "Arm", "Billed", "Paid", "Outstanding", "State", ""], noun: "balance", nounPlural: "balances", noRowOpen: true, rows: balances }] }] : []),
        { cols: "1fr", panels: [{ type: "list", title: "Everything the school has sent this family", sub: "Every send against every child, newest first.", items: f.sent.length ? f.sent.map((entry) => ({ label: entry.label, sub: entry.sub, pill: entry.pill, tone: (/Accepted|Delivered/.test(entry.pill) ? "positive" : "attention") as PanelTone })) : [{ label: "Nothing has been sent yet", sub: "Invitations, reminders and consent requests appear here.", pill: "None", tone: "neutral" as PanelTone }] }] },
      ],
    },
  };
}
