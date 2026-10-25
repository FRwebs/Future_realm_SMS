import { apiGet } from "@/lib/api/server";
import type { PanelTone, TabContent, TableRow } from "@/lib/modules/panels";
import { bar, pill, row, text } from "@/lib/modules/panels";

/**
 * Class & Timetable → Homework: how much homework the school sets, how much comes back, and how long handed-in work waits to be marked —
 * by teacher and by arm. For the people who answer for it. It reads no student's answer; it counts.
 */

type Tally = { name: string; set: number; expected: number; handed: number; marked: number; waiting: number; oldest: number; stale: number };
type School = { term: string | null; since: string; totals: { set: number; handed: number; expected: number; waiting: number; stale: number; teachersSetting: number; teachersNamed: number }; teachers: Tally[]; arms: Tally[] };

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

export async function homeworkTab(): Promise<TabContent> {
  const d = await apiGet<School>("/api/v1/teacher-workspace/student-work/school");
  const t = d.totals;
  const back = pct(t.handed, t.expected);
  const tone = (value: number, good: number, ok: number): PanelTone => (value >= good ? "positive" : value >= ok ? "attention" : "negative");
  const teacherRows: TableRow[] = d.teachers.map((entry) => ({
    keywords: entry.name,
    cells: [
      text(entry.name, { strong: true }), text(String(entry.set), { mono: true }),
      bar(pct(entry.handed, entry.expected), `${pct(entry.handed, entry.expected)}%`, tone(pct(entry.handed, entry.expected), 80, 55)),
      entry.waiting ? text(String(entry.waiting), { strong: entry.stale > 0, tone: entry.stale ? "attention" : undefined }) : text("—"),
      entry.waiting ? text(days(entry.oldest), entry.oldest > 7 ? { strong: true, tone: "negative" } : undefined) : text("—"),
      pill(entry.stale ? "Marking is behind" : entry.waiting ? "Marking" : "Up to date", entry.stale ? "attention" : "positive"),
    ],
  }));
  const armRows: TableRow[] = d.arms.map((entry) => ({
    keywords: entry.name,
    cells: [text(entry.name, { strong: true }), text(String(entry.set), { mono: true }), bar(pct(entry.handed, entry.expected), `${pct(entry.handed, entry.expected)}%`, tone(pct(entry.handed, entry.expected), 80, 55)), bar(pct(entry.marked, entry.handed), `${pct(entry.marked, entry.handed)}%`, tone(pct(entry.marked, entry.handed), 80, 50)), entry.waiting ? text(String(entry.waiting)) : text("—")],
  }));
  return {
    title: "Homework",
    desc: "How much homework is set, how much comes back, and how long it waits to be marked — by teacher and by arm.",
    launchers: [{ label: "Who teaches what", href: "/class-timetable/teaching" }],
    rows: [
      row("1fr", [{
        type: "kpi", title: `${d.term ?? "This term"} · set since ${new Date(d.since).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`, per: 5,
        cards: [
          { label: "Homework set", value: String(t.set), sub: `${t.teachersSetting} of ${t.teachersNamed} teachers have set some`, tone: t.set ? "neutral" : "attention", icon: "doc" },
          { label: "Handed in", value: `${back}%`, sub: `${t.handed.toLocaleString("en-NG")} of ${t.expected.toLocaleString("en-NG")} expected`, tone: t.expected ? tone(back, 80, 55) : "neutral", icon: "check" },
          { label: "Waiting to be marked", value: String(t.waiting), sub: t.waiting ? "Handed in, not yet marked" : "Nothing waiting", tone: t.waiting ? "submitted" : "positive", icon: "inbox" },
          { label: "Waiting over a week", value: String(t.stale), sub: t.stale ? "Marking is behind" : "Marking is keeping up", tone: t.stale ? "negative" : "positive", icon: "hourglass" },
          { label: "Teachers not setting any", value: String(Math.max(0, t.teachersNamed - t.teachersSetting)), sub: "Of those named on an arm", tone: t.teachersNamed > t.teachersSetting ? "neutral" : "positive", icon: "people" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "By teacher", tag: `${d.teachers.length} ${d.teachers.length === 1 ? "teacher" : "teachers"}`, tagTone: "neutral", sub: "Marking that is behind first.", noun: "teacher", nounPlural: "teachers", search: "Find a teacher",
        head: ["Teacher", "Set", "Handed in", "To mark", "Oldest", "State"], rows: teacherRows, per: 10,
        emptyTitle: "No homework has been set", emptyBody: "Teachers set it from Student work, on their My Day.", foot: "Handed in is what students returned out of everyone who was expected to. Homework is practice — it is not part of the CA.",
      }]),
      row("1fr", [{
        type: "table", title: "By arm", tag: `${d.arms.length} ${d.arms.length === 1 ? "arm" : "arms"}`, tagTone: "neutral", sub: "How each class is keeping up.", noun: "arm", nounPlural: "arms", search: "Find an arm",
        head: ["Arm", "Set", "Handed in", "Marked", "To mark"], rows: armRows, per: 10, emptyTitle: "Nothing set for any arm yet", emptyBody: "Arms appear here once homework is set for them.",
      }]),
    ],
  };
}
