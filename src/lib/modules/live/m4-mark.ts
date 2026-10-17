import { AT } from "@/lib/modules/live/m4-forms";
import { apiGet } from "@/lib/api/server";
import { dayStrip, markHref, tone } from "@/lib/modules/live/m4-register";
import type { MarkState, Overview } from "@/lib/modules/live/m4-types";
import { name as nameCell, pill, text, type PanelRow, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Mark — taking a register. It starts by choosing the arm, because a register is always one arm's. */

export const loadMarkState = (classId: string, date?: string) => apiGet<MarkState>(`${AT}/mark/${encodeURIComponent(classId)}${date ? `?date=${encodeURIComponent(date)}` : ""}`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";

export function markTab(o: Overview): TabContent {
  const d = o.day;
  const rows: TableRow[] = o.arms
    .slice()
    .sort((a, b) => Number(a.state === "Marked") - Number(b.state === "Marked"))
    .map((arm) => ({
      id: arm.id,
      keywords: `${arm.name} ${arm.master ?? ""}`,
      cells: [
        text(arm.name, { strong: true }),
        arm.master ? nameCell(arm.master, "Form master") : text("Nobody named", { tone: "negative", strong: true }),
        text(String(arm.roll), { mono: true }),
        pill(arm.state, tone(arm.state)),
        text(arm.state === "Marked" ? (arm.markedAt ?? "Earlier") : arm.state === "In progress" ? "Being marked" : "—"),
        { kind: "action" as const, label: arm.state === "Marked" ? "Open" : arm.state === "In progress" ? "Continue" : "Mark", href: markHref(arm.id, o.date) },
      ],
    }));
  return {
    title: "Mark a register",
    desc: "Choose the class arm first.",
    primary: { label: "Open the whole-school view", icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", href: "/attendance/register" },
    rows: [
      { cols: "1fr", panels: [{ type: "note", tone: "progress", icon: WARN, title: "Marking is normally the form master's job", body: "This is here for the days you have to do it yourself — a teacher is away, a phone has died, a register was never opened. Everything you mark here is logged under your name.", acts: [{ label: "See who has not marked", href: "/attendance/compliance" }] }] },
      ...(o.note ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "progress" as const, icon: WARN, title: "Showing an earlier day", body: `${o.note} Choosing an arm below opens that day's register.` }] }] : []),
      {
        cols: "1fr",
        panels: [{
          type: "kpi", title: `${o.today ? "Today, across the school" : "On this day, across the school"}`, sub: `${o.label} · cutoff ${o.policy.markCutoff}`, per: 4,
          cards: [
            { label: "Registers marked", value: String(d.marked), unit: `of ${d.arms} arms`, sub: `${d.unmarked + d.partial} still open`, tone: d.unmarked ? "attention" : "positive" },
            { label: "Children accounted for", value: d.accounted.toLocaleString(), unit: `of ${d.roll.toLocaleString()}`, sub: "Across the arms marked so far", tone: "positive" },
            { label: "Absent so far", value: String(d.absent), sub: "Each one needs a reason on the register", tone: d.absent ? "attention" : "positive" },
            { label: "Past the cutoff", value: String(d.pastCutoff), unit: "arms", sub: d.pastCutoff ? "Their form masters can be told from Compliance" : "Nothing is overdue", tone: d.pastCutoff ? "negative" : "positive" },
          ],
        }],
      },
      {
        cols: "1fr",
        panels: [{
          type: "table", title: "Choose an arm to mark", sub: "Unmarked arms first. Open one and the register opens with every child in it.",
          meta: `${d.arms} arms · ${d.unmarked} unmarked`, search: "Find an arm by name or form master",
          filters: [{ label: "State", value: "All", options: ["All", "Marked", "In progress", "Unmarked"], column: 3 }],
          head: ["Arm", "Form master", "Children", "State", "Marked at", ""], noun: "arm", nounPlural: "arms", per: 10, rows,
          foot: "Mark an unmarked arm, or Open a marked one to review and correct it. A register for an earlier day needs a reason.",
        }],
      },
    ],
  };
}

export type MarkPage = { content: TabContent & { crumb: { label: string; href: string } } };

export function markPage(s: MarkState): MarkPage {
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [
      s.mode === "submitted"
        ? { type: "note", tone: "positive", icon: "M5 12.5l4.5 4.5 9-10", title: `The register for ${s.arm.name} is submitted`, body: s.whyNot ? "This arm now reads Marked on the whole-school view. It closed to free edits at midnight." : `This arm now reads Marked${s.markedAt ? ` (taken at ${s.markedAt})` : ""}. A correction made today needs no approval and keeps both values; after midnight it goes to an approver.` }
        : s.backdated
          ? { type: "note", tone: "attention", icon: WARN, title: "This register is for a day that has passed", body: `It was never taken. A backdated register is permitted to approvers, always carries its reason, and is listed on Compliance.${s.canBackdate ? "" : " You do not hold that permission."}` }
          : { type: "note", tone: "progress", icon: WARN, title: s.mode === "draft" ? "A draft is waiting" : "Nobody is present until you say so", body: "Tap a status on each row, then preview and submit. The register will not submit until every child is set — use Mark the rest present once the exceptions are in." },
    ],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "marker", classId: s.arm.id, arm: s.arm.name, date: s.date, label: s.label, students: s.students, reasons: s.reasons, mode: s.mode, whyNot: s.whyNot, backdated: s.backdated,
      cutoff: s.policy.markCutoff, startedAt: s.startedAt, markedAt: s.markedAt, draftEndpoint: `${AT}/mark/${s.arm.id}/draft`, submitEndpoint: `${AT}/mark/${s.arm.id}/submit`, overviewHref: "/attendance/register",
    }],
  });
  rows.push(dayStrip(s.days, s.date, (iso) => markHref(s.arm.id, iso), "Another day's register", {}));
  return {
    content: {
      crumb: { label: "Back to choosing an arm", href: "/attendance/mark" },
      title: `Mark register · ${s.arm.name}`,
      desc: `${s.label}${s.arm.master ? ` · form master ${s.arm.master}` : ""}. ${s.mode === "submitted" ? "Submitted — correct it until midnight without an approval." : "Nobody is present until you say so."}`,
      primary: { label: "See the whole school", icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", href: "/attendance/register" },
      launchers: [
        { label: "Choose a different arm", href: "/attendance/mark" },
        { label: "This day's register", href: `/attendance/register/${s.arm.id}?date=${s.date}` },
      ],
      rows,
    },
  };
}

