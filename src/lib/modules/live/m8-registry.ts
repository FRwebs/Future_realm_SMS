import { apiGet } from "@/lib/api/server";
import { plural } from "@/lib/modules/live/m7-format";
import { listDrawer, moveDrawer, resendDrawer, SR } from "@/lib/modules/live/m8-forms";
import type { EnrolOptions, FeeState, Registry, RegistryRow, StudentState } from "@/lib/modules/live/m8-types";
import { name as nameCell, pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Registry: the authoritative record of every student. The same list the class rosters are cut
 * from, so a child opened here and a child opened from their arm land on one record.
 */

export const loadRegistry = () => apiGet<Registry>(`${SR}/registry`);
export const loadEnrolOptions = () => apiGet<EnrolOptions>(`${SR}/registry/enrol-options`);
export const loadMoveOptions = () => apiGet<Array<{ id: string; name: string; level: string; seats: number }>>(`${SR}/registry/move-options`);

export const studentHref = (id: string, section = "") => `/student-records/registry/${encodeURIComponent(id)}${section}`;

export const FEE_TONE: Record<FeeState, PanelTone> = { Paid: "positive", "Part paid": "attention", Outstanding: "negative", "Not billed": "neutral" };
export const STATE_TONE: Record<StudentState, PanelTone> = { Enrolled: "positive", Blocked: "negative", Withdrawn: "neutral", Alumni: "neutral" };
export const attTone = (value: number | null): PanelTone | undefined => (value === null ? undefined : value < 75 ? "negative" : value < 92 ? "attention" : "positive");
export const gradeTone = (avg: number | null): PanelTone => (avg === null ? "neutral" : avg >= 65 ? "positive" : avg >= 45 ? "attention" : "negative");

export function registryTab(data: Registry, rooms: Array<{ id: string; name: string; level: string; seats: number }>): TabContent {
  const { totals, rows } = data;
  const unplaced = rows.filter((row) => row.state === "Enrolled" && row.arm === "No arm");
  const noPortal = data.totals.noGuardianPortal;
  const unreachableChildren = rows.filter((row) => row.guardian && row.portal !== "Active").length;
  const enrolAction = { label: "Add student", primary: true, href: "/student-records/registry/new" };
  const resend = { label: `Resend ${plural(noPortal, "portal invite")}`, drawer: resendDrawer(noPortal, unreachableChildren) };

  const cards: KpiCard[] = [
    { label: "Enrolled", value: String(totals.enrolled), sub: `Across ${plural(totals.arms, "arm")}`, tone: "positive" },
    { label: "Net this term", value: `${totals.in - totals.out >= 0 ? "+" : "−"}${Math.abs(totals.in - totals.out)}`, sub: `${totals.in} in · ${totals.out} out`, tone: totals.in - totals.out >= 0 ? "positive" : "attention" },
    { label: "Alumni and withdrawn", value: `${totals.alumni} / ${totals.withdrawn}`, sub: "A status filter, not a tab" },
    {
      label: "No class arm",
      value: String(totals.withoutArm),
      sub: totals.withoutArm ? "In no register" : "Everybody is placed",
      tone: totals.withoutArm ? "negative" : "positive",
      link: totals.withoutArm ? "Allocate them" : undefined,
      drawer: totals.withoutArm ? listDrawer("Registry", "Students with no class arm", "A student with no arm is in no register and on no broadsheet.", unplaced.slice(0, 20).map((row) => ({ label: row.name, sub: row.adm })), "Move them from the registry's bulk bar: tick them, then “Move to another arm”.") : undefined,
    },
    { label: "Fees outstanding", value: String(totals.owingFamilies), sub: "Families, not children", tone: totals.owingFamilies ? "attention" : "positive", link: "Open the debtor list", href: "/fee-management/collections" },
  ];

  const tableRows: TableRow[] = rows.map((row) => ({
    id: row.id,
    href: studentHref(row.id),
    keywords: `${row.name} ${row.adm} ${row.arm} ${row.guardian?.name ?? ""} ${row.guardian?.phone ?? ""} level:${row.level}`,
    cells: [
      nameCell(row.name, `${row.boarding} · ${row.arm}`),
      text(row.adm, { mono: true }),
      row.arm === "No arm" ? text("No arm", { tone: "negative", strong: true }) : text(row.arm),
      text(row.gender),
      row.guardian ? nameCell(row.guardian.name, `${row.guardian.relation} · ${row.guardian.phone}`, { avatar: false }) : text("None on file", { tone: "negative", strong: true }),
      text(row.att === null ? "—" : `${row.att}%`, { mono: true, strong: true, tone: attTone(row.att) }),
      text(row.avg === null ? "—" : String(row.avg), { mono: true }),
      pill(row.grade, gradeTone(row.avg)),
      pill(row.fee, FEE_TONE[row.fee]),
      pill(row.portal, row.portal === "Active" ? "positive" : "attention"),
      pill(row.state, STATE_TONE[row.state]),
      { kind: "action" as const, label: "Open", href: studentHref(row.id) },
    ],
  }));

  return {
    title: "Registry",
    desc: "The authoritative record of every student.",
    primary: { label: "Add student", icon: "M12 5.5v13M5.5 12h13", href: "/student-records/registry/new" },
    launchers: [
      {
        label: "Migrate from another system",
        drawer: {
          mode: "info",
          kicker: "Registry · migration",
          title: "Migrate from another system",
          sub: "Upload, map, validate, preview, approve, commit, reconcile, sign off.",
          facts: [
            ["How it runs", "With a Future Realm migration specialist", "They map your columns, validate every row and show you a preview before anything is written"],
            ["What you do", "Hand over your files, check the preview, sign off", "Nothing is written until you approve the preview"],
            ["Rejected rows", "Listed with the row, the reason and the correction", "Never silently dropped"],
            ["Afterwards", "A reconciliation report you can keep", "Open it under Changes · Migration state"],
          ],
          readOnly: true,
          readOnlyNote: "Ask your Future Realm contact to open a migration job for this school.",
        },
      },
      { label: "Export the whole registry", href: "/student-records/registry/export" },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every student",
            tag: `${rows.length} records`,
            tagTone: "neutral",
            sub: "Open any child for their full record — the same page their class roster opens.",
            meta: `${totals.enrolled} enrolled · ${totals.alumni} alumni · ${totals.withdrawn} withdrawn · ${plural(noPortal, "guardian")} without a portal`,
            search: "Find by name, admission number, arm or guardian",
            filters: [
              { label: "Arm", value: "All", options: ["All", "No arm", ...data.options.arms], column: 2 },
              { label: "Class", value: "All", options: ["All", ...data.options.levels], match: Object.fromEntries(data.options.levels.map((level) => [level, `level:${level}`])) },
              { label: "Gender", value: "All", options: ["All", "Female", "Male"], column: 3 },
              { label: "State", value: "All", options: ["All", "Enrolled", "Blocked", "Withdrawn", "Alumni"], column: 10 },
              { label: "Fees", value: "All", options: ["All", "Paid", "Part paid", "Outstanding", "Not billed"], column: 8 },
              { label: "Portal", value: "All", options: ["All", "Active", "Not activated"], column: 9 },
            ],
            acts: [{ label: "Export to Excel", export: true }, resend, enrolAction],
            head: ["Student", "Admission no", "Arm", "Gender", "Primary guardian", "Att %", "Avg", "Grade", "Fees", "Portal", "State", ""],
            noun: "student",
            nounPlural: "students",
            per: 12,
            selectable: true,
            bulkActs: [
              { label: "Move to another arm", drawer: moveDrawer(rooms), selection: { key: "students", noun: "student" } },
              { label: "Request consent", href: "/parents-guardians/consent" },
              { label: "Message their guardians", href: "/communication-center/compose" },
              { label: "Resend the portal invite", drawer: { ...resendDrawer(noPortal, unreachableChildren), title: "Resend the portal invite", facts: undefined, mode: "commit", commitLabel: "Resend", commitDone: "Invites resent", commitDoneBody: "Each ticked student's guardians have a fresh link queued.", submit: { endpoint: `${SR}/registry/resend`, method: "POST" } }, selection: { key: "students", noun: "student" } },
              { label: "Export to Excel", primary: true, export: true },
            ],
            rows: tableRows,
            foot: "A student with no arm is in no register and on no broadsheet — fix that before anything else on this page.",
          },
        ],
      },
    ],
  };
}

export type { RegistryRow };
