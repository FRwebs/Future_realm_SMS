import { apiGet } from "@/lib/api/server";
import { notifyPersonDrawer } from "@/lib/modules/live/m4-forms";
import { bandDrawer, cardDrawer, formMasterDrawer, notifyBehind, RC, remarkHref, reviewDrawer } from "@/lib/modules/live/m6-forms";
import type { PublishDate, RemarkPage, RemarksOverview } from "@/lib/modules/live/m6-types";
import { gradeTone, num, stateTone } from "@/lib/modules/live/m5-enter";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent, type TableRow, type TrackerRow } from "@/lib/modules/panels";

/** Remarks — read what a teacher wrote, add your review, move to the next child. */

export const loadRemarks = (query: { level?: string; arm?: string }) => {
  const params = new URLSearchParams();
  if (query.level) params.set("level", query.level);
  if (query.arm) params.set("arm", query.arm);
  return apiGet<RemarksOverview>(`${RC}/remarks${params.toString() ? `?${params.toString()}` : ""}`);
};
export const loadRemarkPage = (classId: string, studentId: string) => apiGet<RemarkPage>(`${RC}/remarks/${encodeURIComponent(classId)}/${encodeURIComponent(studentId)}`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const PEN = "M4 20h4L19 9l-4-4L4 16zM14.5 5.5l4 4";
export const bandTone = (band: string): PanelTone => (band === "Excellent" || band === "Very good" || band === "Good" ? "positive" : band === "Fair" || band === "Weak" ? "attention" : band === "Not scored" ? "neutral" : "negative");
export const dateText = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const publishCard = (d: PublishDate) => ({ label: "Publish date", value: d ? dateText(d.iso) : "—", sub: d ? (d.days > 0 ? `${d.days} days away` : d.days === 0 ? "Today" : `${-d.days} days ago`) : "No release date is set" });

export function remarksTab(o: RemarksOverview, school: string): TabContent {
  const k = o.kpis;
  const rows: PanelRow[] = [];
  if (o.unavailable) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "No arm has results to write remarks on yet", body: "A report card is built from approved score sheets. Offer subjects to an arm and approve its sheets, and its children appear here.", acts: [{ label: "Open the review queue", href: "/score-entry-results/review" }] }] });
    return { title: "Reports", desc: "Read what a teacher wrote, add your review, move to the next child.", rows };
  }
  const target = k.firstWaiting ?? k.first;
  const href = (item: { classId: string; id: string } | null) => (item ? remarkHref(item.classId, item.id) : undefined);
  const scopeArms = o.arm ? o.arms.filter((arm) => arm.id === o.arm) : o.arms.filter((arm) => !o.level || arm.level === o.level);
  const band = bandDrawer(o.arms, scopeArms.map((arm) => arm.name), o.bands, o.label);
  const publish = publishCard(o.publishDate);
  const params = (level: string | null, arm?: string) => `/report-cards/remarks${level || arm ? `?${[level ? `level=${encodeURIComponent(level)}` : "", arm ? `arm=${arm}` : ""].filter(Boolean).join("&")}` : ""}`;

  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: `In view · ${o.label}`, per: 5,
      cards: [
        { label: "Students in view", value: k.students.toLocaleString("en-NG"), sub: o.arm ? "One arm" : o.level ? `Every arm in ${o.level}` : "Every arm in the school" },
        { label: "Teacher report in", value: k.teacherIn.toLocaleString("en-NG"), unit: `of ${k.students}`, sub: `${k.students - k.teacherIn} not submitted yet`, tone: k.teacherIn === k.students ? "positive" : "attention" },
        { label: "Awaiting your review", value: k.waiting.toLocaleString("en-NG"), sub: "Teacher is in, you are not", tone: k.waiting ? "attention" : "positive", link: k.waiting ? "Start reviewing" : undefined, href: k.waiting ? href(k.firstWaiting) : undefined },
        { label: "Reviewed", value: k.reviewed.toLocaleString("en-NG"), sub: "Written by the Principal", tone: "positive" },
        { ...publish },
      ],
    }],
  });
  rows.push({ cols: "1fr", panels: [{ type: "days", title: "Choose the class", sub: "Narrow the list to one class, then one arm.", days: [{ label: "All classes", href: params(null), state: o.level || o.arm ? "plain" : "now" }, ...o.levels.map((level) => ({ label: level, href: params(level), state: level === o.level && !o.arm ? ("now" as const) : ("plain" as const) }))] }] });
  const armsHere = o.arms.filter((arm) => !o.level || arm.level === o.level);
  if (armsHere.length > 1 || o.arm) rows.push({ cols: "1fr", panels: [{ type: "days", title: "Choose the arm", days: armsHere.map((arm) => ({ label: arm.name, href: params(o.level, arm.id), state: o.arm === arm.id ? ("now" as const) : ("plain" as const) })) }] });

  const tableRows: TableRow[] = o.students.map((student) => ({
    id: student.id,
    keywords: `${student.name} ${student.adm} ${student.arm} teacher:${student.teacher} review:${student.reviewed ? "Reviewed" : "Not reviewed"}`,
    cells: [
      nameCell(student.name, student.arm), text(student.adm, { mono: true }), text(student.arm), text(num(student.average), { mono: true, strong: true }),
      pill(student.band, bandTone(student.band)), text(student.attendance === null ? "—" : `${student.attendance}%`, { mono: true, strong: true, tone: student.attendance === null ? undefined : student.attendance < 75 ? "negative" : student.attendance < 92 ? "attention" : "positive" }),
      pill(student.teacher, stateTone(student.teacher)), pill(student.reviewed ? "Reviewed" : "Not reviewed", student.reviewed ? "positive" : "attention"),
      { kind: "action" as const, label: "View", href: remarkHref(student.classId, student.id) },
    ],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Students", tag: o.label, tagTone: "neutral", sub: "Open one to see the term result, the teacher's report and your review in one place.", meta: `${o.students.length.toLocaleString("en-NG")} students`,
      search: "Find a student by name or admission number",
      filters: [
        { label: "Teacher report", value: "All", options: ["All", "Submitted", "Draft", "Not written"], match: { Submitted: "teacher:Submitted", Draft: "teacher:Draft", "Not written": "teacher:Not written" } },
        { label: "My review", value: "All", options: ["All", "Reviewed", "Not reviewed"], match: { Reviewed: "review:Reviewed", "Not reviewed": "review:Not reviewed" } },
      ],
      acts: [{ label: "Apply a band review to the whole arm", drawer: band }, ...(target ? [{ label: "Review the next", primary: true, href: href(target) }] : [])],
      head: ["Student", "Admission no", "Arm", "Avg", "Band", "Attendance", "Teacher report", "My review", ""], noun: "student", nounPlural: "students", selectable: true, per: 12,
      bulkActs: [
        { label: "Export selected", primary: true, export: true },
      ],
      rows: tableRows, empty: "Nobody is in this view.",
    }],
  });
  const tracker: TrackerRow[] = o.tracker.map((entry) => ({ unit: `${entry.owner ?? "No form master"} · ${entry.arm}`, sub: `${entry.written} of ${entry.roll} form master remarks`, owner: entry.owner ?? "Nobody named", role: entry.owner ? "Form master" : "Name a form master", state: entry.state, age: entry.state === "Complete" ? "—" : `${entry.roll - entry.written} owed`, overdue: entry.state === "Not started", href: remarkHref(entry.classId, o.students.find((student) => student.classId === entry.classId)?.id ?? "") }));
  rows.push({
    cols: "1fr",
    panels: [{ type: "tracker", title: "Who is behind", sub: "By form master and arm.", meta: `${o.students.filter((student) => student.teacher === "Submitted").length} of ${o.students.length} written`, noun: "authors complete", groups: ["By author", "By state"], clear: { title: "Every report is written", body: `All ${o.students.length} cards have their form master's remark.` }, rows: tracker }],
  });
  return {
    title: "Reports", desc: "Read what a teacher wrote, add your review, move to the next child.",
    primary: target ? { label: k.waiting ? `Review the next of ${k.waiting}` : "Open the first student", icon: PEN, href: href(target) } : undefined,
    launchers: o.owing.length ? [{ label: "Notify the form masters behind", drawer: notifyBehind(o.owing, school) }] : [],
    rows,
  };
}

/* ───────────────────────── one child ───────────────────────── */

export function remarkPage(p: RemarkPage, school: string): { content: TabContent & { crumb: { label: string; href: string } } } {
  const s = p.summary;
  const review = reviewDrawer(p);
  const fm = formMasterDrawer(p);
  const unlocked = !p.published;
  const rows: PanelRow[] = [];
  rows.push({ cols: "1fr", panels: [{ type: "days", title: `${p.position} of ${p.of} · ${p.arm.name}`, sub: "Walk the arm without going back to the list.", days: p.peers.map((peer) => ({ label: peer.name.split(" ").slice(0, 2).map((part, index) => (index === 0 ? part : `${part[0]}.`)).join(" "), sub: peer.reviewed ? "Reviewed" : undefined, href: remarkHref(p.arm.id, peer.id), state: peer.id === p.student.id ? ("now" as const) : peer.reviewed ? ("done" as const) : ("plain" as const) })) }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "The result you are reviewing", per: 6,
      cards: [
        { label: "Term average", value: s.blocked && s.average === null ? "Blocked" : num(s.average), sub: s.armAverage === null ? "" : `Arm ${s.armAverage}`, tone: s.blocked ? "negative" : s.average !== null && s.armAverage !== null && s.average >= s.armAverage ? "positive" : "attention" },
        { label: "Position", value: s.pos === null ? "—" : String(s.pos), sub: `Of ${s.outOf}` },
        { label: "Grade", value: s.grade ?? "—", sub: s.band },
        { label: "Best subject", value: s.best?.total === null || !s.best ? "—" : String(s.best.total), sub: s.best?.name ?? "", tone: "positive" },
        { label: "Weakest subject", value: s.weakest?.total === null || !s.weakest ? "—" : String(s.weakest.total), sub: s.weakest?.name ?? "", tone: s.weakest && (s.weakest.total ?? 100) < 50 ? "negative" : "attention" },
        { label: "Attendance", value: p.attendance.pct === null ? "—" : `${p.attendance.pct}%`, sub: `${plural(p.attendance.absent, "day")} absent`, tone: p.attendance.pct === null ? "neutral" : p.attendance.pct >= 92 ? "positive" : p.attendance.pct >= 75 ? "attention" : "negative" },
      ],
    }],
  });
  if (s.blocked) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "This child's card is blocked on scores", body: `${s.blockedBy.slice(0, 3).join(" · ")}. You can still write your review — the card waits for the sheets.`, acts: [{ label: "Open the review queue", href: `/score-entry-results/review/${p.arm.id}` }] }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "This term, subject by subject", meta: `${s.passed} of ${s.subjects} at credit or above`, head: ["Subject", "Total", "Grade", "Pos", "Class avg", "Standing"], noun: "subject", nounPlural: "subjects", noRowOpen: true,
      rows: p.subjects.map((subject) => ({ cells: [text(subject.name, { strong: true }), text(num(subject.total), { mono: true, strong: true }), subject.grade ? pill(subject.grade, gradeTone(subject.grade)) : text("—"), text(subject.pos === null ? "—" : String(subject.pos), { mono: true }), text(num(subject.classAvg), { mono: true }), text(subject.state === "Approved" ? subject.standing : `Sheet ${subject.state.toLowerCase()}`, { tone: subject.state === "Approved" ? undefined : "attention" })] })),
    }],
  });
  const notifyFm = p.teacher.ownerId && p.teacher.by ? notifyPersonDrawer({ endpoint: `${RC}/notify`, id: p.teacher.ownerId, name: p.teacher.by, role: "Form master", kicker: "Report cards", owes: `A remark for ${p.student.name} in ${p.arm.name}`, items: 1, oldest: "This term", last: "Never", href: "/report-cards/remarks", school }) : undefined;
  rows.push({
    cols: "1fr",
    panels: [{
      type: "quotes", title: "What the form master submitted", sub: p.teacher.state === "Submitted" ? "Read this before writing your own." : p.teacher.text ? "A draft — the form master has not submitted it yet." : "Nothing has come in for this child yet.",
      quotes: [{ label: "Form master's remark", text: p.teacher.text, by: p.teacher.by ?? "Form master", role: p.teacher.role, when: p.teacher.when, pill: p.teacher.state, tone: stateTone(p.teacher.state), emptyText: `No remark has been submitted for ${p.student.first}. You can still write your review — the card will wait for the form master.`, act: p.teacher.state !== "Submitted" && notifyFm ? `Notify ${p.teacher.by}` : unlocked && p.canWriteFormMaster ? (p.teacher.state === "Submitted" ? "Change it" : "Write it") : undefined, trigger: p.teacher.state !== "Submitted" && notifyFm ? { drawer: notifyFm } : unlocked && p.canWriteFormMaster ? { drawer: fm } : undefined }],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "quotes", title: "Your review", sub: "This is the sentence a family reads most carefully. It prints under the form master's.",
      quotes: [{ label: "Principal's review", text: p.mine.text, by: p.mine.by ?? "You", role: "Principal", when: p.mine.state === "Submitted" ? "On the card" : p.mine.state === "Draft" ? "Draft · not on the card" : "", pill: p.mine.state === "Submitted" ? "Reviewed" : p.mine.state === "Draft" ? "Draft" : "Not written", tone: p.mine.state === "Submitted" ? "positive" : "attention", emptyText: `Nothing is written yet. A suggestion for this band is ready: “${p.suggestion}”`, act: unlocked && p.canReview ? (p.mine.text ? "Change your review" : "Write your review") : undefined, trigger: unlocked && p.canReview ? { drawer: review } : undefined }],
    }],
  });
  rows.push({
    cols: "1.05fr 1fr",
    panels: [
      { type: "bars", title: `How ${p.student.first} has performed before`, sub: "Term average, oldest first — so a review can say whether this is a rise or a fall.", rows: [...p.history.map((entry) => ({ label: entry.term, value: Math.round(entry.average), display: `${entry.average}${entry.pos ? ` · ${entry.pos}` : ""}`, tone: "positive" as PanelTone })), { label: `${p.term.name} · this term`, value: Math.round(s.average ?? 0), display: s.average === null ? "Blocked" : `${s.average}${s.pos ? ` · ${s.pos}` : ""}`, tone: (s.average === null ? "negative" : "progress") as PanelTone }] },
      { type: "quotes", title: "What the family was told before", sub: "So two consecutive reviews do not contradict each other.", quotes: p.history.filter((entry) => entry.remark).slice(-2).reverse().map((entry) => ({ label: entry.term, text: entry.remark ?? "", by: "School", role: `${entry.term} · average ${entry.average}`, when: entry.published ? `Published ${dateText(entry.published.slice(0, 10))}` : "", pill: entry.state === "PUBLISHED" ? "Published" : "Not published", tone: (entry.state === "PUBLISHED" ? "positive" : "neutral") as PanelTone })) },
    ],
  });
  return {
    content: {
      crumb: { label: "Back to reports", href: "/report-cards/remarks" },
      title: p.student.name, desc: `${p.arm.name} · ${p.student.adm} · average ${num(s.average)} · position ${s.pos ?? "—"}. ${p.mine.state === "Submitted" ? "Reviewed." : "Awaiting your review."}`,
      primary: unlocked && p.canReview ? { label: p.next ? "Submit and open the next" : "Submit the review", icon: "M5 12.5l4.5 4.5 9-10", drawer: review } : undefined,
      launchers: [
        { label: "Preview the card", drawer: cardDrawer(p.student.id, p.term.id, p.student.name) },
        { label: "Open the full record", href: `/student-records/registry/${p.student.id}` },
      ],
      rows,
    },
  };
}

