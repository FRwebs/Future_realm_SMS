import type { Metadata } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { apiGet } from "@/lib/api/server";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { getServerSession } from "@/lib/auth/session";
import type { DrawerSpec, TableRow } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";

export const metadata: Metadata = { title: "Students are asking" };

type Observed = { id: string; student: string; arm: string; topic: string; text: string; at: string; to: string };
type Item = { id: string; student: string; arm: string; topic: string; text: string; at: string; read: boolean; replies: Array<{ text: string; at: string }>; answered: boolean };

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

function replyDrawer(item: Item): DrawerSpec {
  return {
    kicker: item.arm || "Student", title: item.topic, sub: `${item.student} asked on ${day(item.at)}`, mode: "form",
    facts: [["Their question", item.text, ""], ...item.replies.map((reply, index): [string, string, string] => [index === 0 ? "You answered" : "And later", reply.text, day(reply.at)])],
    fields: [{ kind: "area", label: "Your answer", placeholder: `Answer ${item.student.split(" ")[0]} the way you would in class.`, value: "", required: true, span: 2 }],
    commitLabel: "Send the answer", commitDone: "Answer sent", commitDoneBody: `${item.student.split(" ")[0]} will see it in Messages.`,
    submit: { endpoint: `/api/v1/teacher-workspace/student-questions/${item.id}/reply`, method: "POST", map: { "Your answer": "text" } },
  };
}

export default async function StudentQuestionsPage() {
  const session = await getServerSession();
  if (!session) return null;
  const teacher = await getTeacherWorkspace(session.role, session.schoolId);
  if (!teacher) return <AccessDenied backHref="/command-center/today" />;
  const data = await apiGet<{ items: Item[]; waiting: number; observed?: Observed[] }>("/api/v1/teacher-workspace/student-questions");
  const rows: TableRow[] = data.items.map((item) => ({
    drawer: replyDrawer(item), keywords: `${item.student} ${item.topic} ${item.arm}`,
    cells: [
      { kind: "name", name: item.student, sub: item.arm, avatar: false }, { kind: "text", text: item.topic }, { kind: "text", text: day(item.at) },
      { kind: "pill", label: item.answered ? "Answered" : "Waiting on you", tone: item.answered ? "positive" : "attention" }, { kind: "action", label: item.answered ? "Read" : "Answer", drawer: replyDrawer(item) },
    ],
  }));
  const observed: TableRow[] = (data.observed ?? []).map((item) => ({
    keywords: `${item.student} ${item.topic} ${item.to}`,
    drawer: { kicker: item.arm || "Your arm", title: item.topic, sub: `${item.student} asked ${item.to} on ${day(item.at)}`, mode: "view", readOnly: true, facts: [["Their question", item.text, ""], ["Asked of", item.to, "They answer it; you can only read it."]] },
    cells: [{ kind: "name", name: item.student, sub: item.arm, avatar: false }, { kind: "text", text: item.topic }, { kind: "text", text: item.to }, { kind: "text", text: day(item.at) }],
  }));
  return (
    <ModuleWorkspace
      eyebrow="My Day" title="Students are asking" back={{ label: "Back to My Day", href: "/command-center/today" }}
      description="Questions your students have put to you. Your answer reaches them in their Messages; nobody else sees it."
      rows={[
        row("1fr", [{ type: "kpi", per: 2, cards: [{ label: "Waiting on you", value: String(data.waiting), sub: data.waiting ? "Answer the oldest first" : "Nothing is waiting", tone: data.waiting ? "attention" : "positive", icon: "message" }, { label: "Asked in all", value: String(data.items.length), sub: "Newest first", icon: "inbox" }] }]),
        row("1fr", [{ type: "table", title: "Questions", sub: "Open one to read it and answer.", noun: "question", nounPlural: "questions", head: ["Student", "About", "Asked", "State", ""], rows, per: 12, dense: true, empty: "No student has asked you anything yet." }]),
        ...(data.observed !== undefined && (data.observed.length || observed.length) ? [row("1fr", [{ type: "table" as const, title: "Your arm’s questions to other teachers", sub: "Read only. Your school lets a form master see what its arm asks, as a safeguard — the teacher who was asked answers.", noun: "question", nounPlural: "questions", head: ["Student", "About", "Asked of", "Asked"], rows: observed, per: 12, dense: true, noRowOpen: false, empty: "Nothing yet." }])] : []),
      ]}
    />
  );
}
