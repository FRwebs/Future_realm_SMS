import { apiGet } from "@/lib/api/server";
import type { ArmRow } from "@/lib/modules/live/m3-types";
import type { DrawerSpec, PanelTone, TabContent, TableRow } from "@/lib/modules/panels";
import { bar, pill, row, text } from "@/lib/modules/panels";

/**
 * Class & Timetable → Lesson notes: every arm's notes this term, what is signed, what is waiting for review, and what was sent back.
 *
 * A teacher writes one note per topic and it serves every arm of that class they teach, so a note is keyed by subject, teacher and week —
 * never by arm; an arm's figures are read from the notes that apply to it. A draft belongs to the teacher and is never shown here: the
 * school sees a note from the moment it is submitted. Signing records that the note was read; it never changes what the teacher wrote.
 */

const API = "/api/v1/teacher-workspace";
const OVERVIEW = "/api/v1/class-structure/overview";
const SEND = "M5 12.5l4.5 4.5 9-10";

type Entry = {
  id: string; planId: string | null; teacher: string; subject: string; arms: string[]; week: number; topic: string; state: string;
  own: boolean; canSign: boolean; routedTo: string | null; age: number; at: string | null; resubmitted: boolean;
};
type Review = {
  scope: "school" | "department";
  term: { name: string; session: string; current: number | null; phase: string };
  rows: Entry[];
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const days = (age: number) => (age === 0 ? "Today" : `${age} ${age === 1 ? "day" : "days"}`);
/** A note due and not yet in the reviewer's hands: never written, or still a draft. */
const overdue = (entry: Entry, now: number) => (entry.state === "Not started" || entry.state === "Draft") && entry.week < now;

type ArmFigures = { arm: string; formMaster: string; subjects: Set<string>; due: number; signed: number; waiting: number; back: number; overdue: number };

export async function lessonNotesTab(): Promise<TabContent> {
  const [review, arms] = await Promise.all([
    apiGet<Review>(`${API}/notes/review`),
    apiGet<{ arms: ArmRow[] }>(OVERVIEW).then((overview) => overview.arms).catch(() => [] as ArmRow[])
  ]);
  const now = review.term.current ?? (review.term.phase === "after" ? 99 : 0);
  const week = review.term.current ? `weeks 1 – ${review.term.current}` : review.term.phase === "after" ? "the whole term" : "before the term opens";

  const due = review.rows.filter((entry) => entry.week <= now || entry.state !== "Not started");
  const signed = due.filter((entry) => entry.state === "Approved").length;
  const waiting = review.rows.filter((entry) => entry.state === "Submitted").sort((a, b) => b.age - a.age);
  const back = review.rows.filter((entry) => entry.state === "Returned");
  const late = review.rows.filter((entry) => overdue(entry, now));

  // One figure set per arm, read from the notes that apply to it. A note shared by several arms counts once for each.
  const byArm = new Map<string, ArmFigures>();
  for (const arm of arms) byArm.set(arm.name, { arm: arm.name, formMaster: arm.formMaster?.name ?? "Unassigned", subjects: new Set(), due: 0, signed: 0, waiting: 0, back: 0, overdue: 0 });
  for (const entry of review.rows) {
    for (const name of entry.arms) {
      const figures = byArm.get(name) ?? { arm: name, formMaster: "Unassigned", subjects: new Set<string>(), due: 0, signed: 0, waiting: 0, back: 0, overdue: 0 };
      byArm.set(name, figures);
      figures.subjects.add(entry.subject);
      if (entry.week > now && entry.state === "Not started") continue;
      figures.due += 1;
      if (entry.state === "Approved") figures.signed += 1;
      if (entry.state === "Submitted") figures.waiting += 1;
      if (entry.state === "Returned") figures.back += 1;
      if (overdue(entry, now)) figures.overdue += 1;
    }
  }
  const armList = [...byArm.values()].filter((figures) => figures.due > 0 || figures.subjects.size > 0).sort((a, b) => a.arm.localeCompare(b.arm, undefined, { numeric: true }));
  const stateOf = (figures: ArmFigures) => (figures.overdue ? "Behind" : figures.back ? "Sent back" : figures.waiting ? "Waiting on review" : "Up to date");
  const toneOf = (state: string): PanelTone => (state === "Behind" ? "attention" : state === "Sent back" ? "negative" : state === "Waiting on review" ? "submitted" : "positive");
  const upToDate = armList.filter((figures) => figures.due && !figures.overdue && !figures.back).length;

  const signable = waiting.filter((entry) => entry.canSign && entry.planId);
  const signSelected: DrawerSpec = {
    mode: "commit", kicker: "Lesson notes", title: "Sign the selected notes", sub: "Signing records that the note was read. It does not change what the teacher wrote.",
    commitLabel: "Sign", commitDone: "Notes signed", commitDoneBody: "Each teacher has been told in-app.",
    submit: { endpoint: `${API}/notes/review/sign`, method: "POST" }
  };
  const signAll: DrawerSpec = {
    ...signSelected, title: `Sign the ${signable.length} waiting`,
    facts: signable.slice(0, 6).map((entry): [string, string, string] => [`${entry.subject} · ${entry.arms.join(", ")}`, `Week ${entry.week} · ${entry.topic}`, entry.teacher]),
    submit: { endpoint: `${API}/notes/review/sign`, method: "POST", body: { planIds: signable.map((entry) => entry.planId) } }
  };

  const waitingRows: TableRow[] = waiting.map((entry) => ({
    id: entry.planId ?? entry.id,
    href: entry.planId ? `/lesson-notes/review/${entry.planId}?from=class-timetable` : undefined,
    keywords: `${entry.subject} ${entry.teacher} ${entry.topic} ${entry.arms.join(" ")}`,
    cells: [
      text(entry.subject, { strong: true }),
      text(entry.arms.join(", ") || "—"),
      { kind: "name", name: `Week ${entry.week} · ${entry.topic}`, sub: entry.resubmitted ? "Resubmitted after rework" : "First submission", avatar: false },
      text(entry.teacher),
      text(days(entry.age), entry.age > 5 ? { strong: true, tone: "attention" } : undefined),
      { kind: "action", label: entry.canSign ? "Review" : "Read", href: entry.planId ? `/lesson-notes/review/${entry.planId}?from=class-timetable` : undefined }
    ]
  }));

  return {
    title: "Lesson notes",
    desc: "Every arm’s notes this term — what is signed, what is waiting for review, and what was sent back.",
    primary: signable.length ? { label: `Review the ${signable.length} waiting`, icon: SEND, drawer: signAll } : undefined,
    launchers: [{ label: "Who teaches what", href: "/class-timetable/teaching" }, { label: "Open the timetable", href: "/class-timetable/timetable" }],
    rows: [
      row("1fr", [{
        type: "kpi", title: `${review.term.name} ${review.term.session} · ${week}`, per: 5,
        cards: [
          { label: "Signed to date", value: `${pct(signed, due.length)}%`, sub: `${signed.toLocaleString()} of ${due.length.toLocaleString()} notes due by now`, tone: pct(signed, due.length) >= 85 ? "positive" : "attention", icon: "check" },
          { label: "Waiting for review", value: String(waiting.length), sub: waiting.length ? `Oldest ${waiting[0]!.age} ${waiting[0]!.age === 1 ? "day" : "days"}` : "Nothing waiting", tone: waiting.length ? "submitted" : "positive", icon: "inbox", ...(waiting[0]?.planId ? { link: "Review the oldest", href: `/lesson-notes/review/${waiting[0].planId}?from=class-timetable` } : {}) },
          { label: "Sent back for rework", value: String(back.length), sub: "With the teacher", tone: back.length ? "negative" : "positive", icon: "undo" },
          { label: "Overdue", value: String(late.length), sub: "Taught weeks with no note", tone: late.length ? "attention" : "positive", icon: "hourglass" },
          { label: "Arms up to date", value: String(upToDate), unit: `of ${armList.length}`, sub: "Nothing overdue or sent back", tone: armList.length && upToDate === armList.length ? "positive" : "neutral", icon: "board" }
        ]
      }]),
      row("1fr", [{
        type: "table", title: "Waiting for review", tag: `${waiting.length} ${waiting.length === 1 ? "note" : "notes"}`, tagTone: waiting.length ? "submitted" : "positive",
        sub: "Oldest first. A resubmitted note came back from rework.", noun: "note", nounPlural: "notes",
        search: "Find a subject, arm, teacher or topic",
        head: ["Subject", "Applies to", "Week · topic", "Teacher", "Waiting", ""],
        rows: waitingRows, per: 8, selectable: signable.length > 0,
        bulkActs: signable.length ? [{ label: "Sign the selected", primary: true, drawer: signSelected, selection: { key: "planIds", noun: "note" } }] : undefined,
        emptyTitle: "Nothing is waiting for review", emptyBody: "Every submitted note has been signed or sent back.",
        foot: "Signing records the read, never a change to the note."
      }]),
      row("1fr", [{
        type: "table", title: "Every arm", tag: `${armList.length} ${armList.length === 1 ? "arm" : "arms"}`, tagTone: "neutral",
        sub: "Each arm’s notes this term and how complete they are.", noun: "arm", nounPlural: "arms",
        search: "Find an arm or a form master",
        head: ["Arm", "Form master", "Subjects", "Signed", "Waiting", "Sent back", "Overdue", "State"],
        rows: armList.map((figures): TableRow => ({
          keywords: `${figures.arm} ${figures.formMaster}`,
          cells: [
            text(figures.arm, { strong: true }),
            { kind: "name", name: figures.formMaster, sub: "Form master", avatar: false },
            text(String(figures.subjects.size)),
            bar(pct(figures.signed, figures.due), `${pct(figures.signed, figures.due)}%`, pct(figures.signed, figures.due) >= 85 ? "positive" : "attention"),
            figures.waiting ? text(String(figures.waiting)) : text("—"),
            figures.back ? text(String(figures.back), { strong: true, tone: "negative" }) : text("—"),
            figures.overdue ? text(String(figures.overdue), { strong: true, tone: "attention" }) : text("—"),
            pill(stateOf(figures), toneOf(stateOf(figures)))
          ]
        })),
        per: 8,
        emptyTitle: "No arm has a note due yet", emptyBody: "Arms appear here once a scheme of work has weeks that have come round.",
        foot: "A note shared by several arms counts once for each."
      }])
    ]
  };
}
