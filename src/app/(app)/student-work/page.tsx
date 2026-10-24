import type { Metadata } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { apiGet } from "@/lib/api/server";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { getServerSession } from "@/lib/auth/session";
import type { DrawerSpec, TableRow } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";

export const metadata: Metadata = { title: "Student work" };

const API = "/api/v1/teacher-workspace/student-work";
type Overview = {
  options: Array<{ classId: string; subjectId: string; label: string }>;
  set: Array<{ id: string; title: string; subject: string; arm: string; due: string; max: number; roll: number; handed: number; marked: number }>;
  waiting: Array<{ id: string; student: string; title: string; subject: string; arm: string; handedAt: string; late: boolean; max: number; note: string; link: string }>;
};

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

function markDrawer(item: Overview["waiting"][number]): DrawerSpec {
  return {
    kicker: `${item.subject} · ${item.arm}`, title: `Mark · ${item.title}`, sub: `${item.student} handed it in ${day(item.handedAt)}${item.late ? " — late" : ""}`, mode: "form",
    facts: [["Their note", item.note || "None", ""], ["Their link", item.link || "None", ""]],
    fields: [
      { kind: "text", label: `Mark out of ${item.max}`, value: "", required: true, placeholder: `0 to ${item.max}` },
      { kind: "area", label: "A word back", value: "", placeholder: "What was good, and what to do next.", span: 2, optional: true },
    ],
    commitLabel: "Send the mark", commitDone: "Marked", commitDoneBody: `${item.student.split(" ")[0]} is told. Homework is practice — it is not part of the CA.`,
    submit: { endpoint: `${API}/submissions/${item.id}/mark`, method: "POST", map: { [`Mark out of ${item.max}`]: "score", "A word back": "feedback" } },
  };
}

export default async function StudentWorkPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await getTeacherWorkspace(session.role, session.schoolId))) return <AccessDenied backHref="/command-center/today" />;
  const data = await apiGet<Overview>(API);
  const setDrawer: DrawerSpec = {
    kicker: "Homework", title: "Set homework", mode: "form", sub: "Every child in the arm is told in-app. Homework is practice — it never counts towards the CA.",
    fields: [
      { kind: "select", label: "For", options: data.options.map((option) => option.label), value: data.options[0]?.label, required: true },
      { kind: "text", label: "Title", value: "", required: true, placeholder: "e.g. Exercise 4, page 62" },
      { kind: "text", label: "Due", type: "date", value: "", required: true },
      { kind: "text", label: "Full mark", value: "100", required: true, unit: "marks", hint: "What the best possible answer scores." },
      { kind: "area", label: "Instructions", value: "", span: 2, optional: true, placeholder: "What to do, and what to hand in." },
    ],
    commitLabel: "Set it", commitDone: "Homework set", commitDoneBody: "The arm’s students can see it now.",
    submit: { endpoint: `${API}/homework`, method: "POST", map: { For: "to", Title: "title", Due: "dueAt", "Full mark": "max", Instructions: "description" } },
  };
  const waiting: TableRow[] = data.waiting.map((item) => ({
    drawer: markDrawer(item), keywords: `${item.student} ${item.title} ${item.subject}`,
    cells: [{ kind: "name", name: item.student, sub: item.arm, avatar: false }, { kind: "text", text: item.title }, { kind: "text", text: item.subject }, { kind: "text", text: day(item.handedAt) }, { kind: "pill", label: item.late ? "Late" : "On time", tone: item.late ? "attention" : "positive" }, { kind: "action", label: "Mark", drawer: markDrawer(item) }],
  }));
  const set: TableRow[] = data.set.map((item) => ({
    keywords: `${item.title} ${item.subject} ${item.arm}`,
    cells: [{ kind: "name", name: item.title, sub: `${item.subject} · ${item.arm}`, avatar: false }, { kind: "text", text: day(item.due) }, { kind: "text", text: `${item.max}` }, { kind: "text", text: `${item.handed} of ${item.roll}` }, { kind: "text", text: `${item.marked} of ${item.handed}` }],
  }));
  return (
    <ModuleWorkspace
      eyebrow="My Day" title="Student work" back={{ label: "Back to My Day", href: "/command-center/today" }}
      description="Set homework for the arms you teach, see what has been handed in, and mark it. The mark goes to the student alone."
      primary={data.options.length ? { label: "Set homework", drawer: setDrawer } : undefined}
      rows={[
        row("1fr", [{ type: "kpi", per: 3, cards: [
          { label: "To mark", value: String(data.waiting.length), sub: data.waiting.length ? "Oldest first" : "Nothing waiting", tone: data.waiting.length ? "attention" : "positive", icon: "inbox" },
          { label: "Homework set", value: String(data.set.length), sub: "Newest due date first", icon: "doc" },
          { label: "Handed in", value: String(data.set.reduce((sum, item) => sum + item.handed, 0)), sub: `${data.set.reduce((sum, item) => sum + item.marked, 0)} marked`, icon: "check" },
        ] }]),
        row("1fr", [{ type: "table", title: "Waiting to be marked", sub: "Oldest first.", noun: "piece of work", nounPlural: "pieces of work", head: ["Student", "Homework", "Subject", "Handed in", "", ""], rows: waiting, per: 12, dense: true, empty: "Nothing is waiting to be marked." }]),
        row("1fr", [{ type: "table", title: "Homework you have set", sub: "How many have handed in, and how many you have marked.", noun: "homework", nounPlural: "homework", head: ["Homework", "Due", "Out of", "Handed in", "Marked"], rows: set, per: 12, dense: true, noRowOpen: true, empty: data.options.length ? "You have not set any yet." : "You are not named on an arm and subject yet, so there is nobody to set homework for." }]),
      ]}
    />
  );
}
