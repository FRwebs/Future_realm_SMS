import type { CalEvent } from "@/lib/modules/live/student/shared";
import { addDays, askDrawer, dayOf, dDow, dLong, dShort, dueText, handInDrawer, loadAskable, loadAssignments, loadCalendar, loadCards, loadMe, loadSubjects, loadTimetable, monday, num, ord, workPill } from "@/lib/modules/live/student/shared";
import type { Card, Me, Subjects, Work } from "@/lib/modules/live/student/shared";
import type { StudentContent } from "@/lib/modules/live/student/shared";
import type { BarRow, DrawerSpec, ListItem, Panel, PanelFact, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";
import { eventItem } from "@/lib/modules/live/student/today";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export async function timetablePage(query: Record<string, string | undefined>): Promise<StudentContent> {
  const [me, tt, cal] = await Promise.all([loadMe(), loadTimetable(), loadCalendar()]);
  const tabs = [{ label: "Week" }, { label: "Tests and exams" }];
  const tab = tabs.some((entry) => entry.label === query.tab) ? query.tab! : "Week";
  const head = { eyebrow: `${me.arm}${me.term ? ` · ${me.term.name}` : ""}`, title: "Timetable", desc: "Your lessons for the week, and every test the school has set for this term.", tabs, tab };

  if (tab === "Tests and exams") {
    const tests: CalEvent[] = cal.events.filter((event) => (event.cat === "Assessment" || event.cat === "Results") && event.end >= me.today);
    const comps = tt.components;
    const total = comps.reduce((sum, component) => sum + component.weight, 0) || 100;
    const facts: PanelFact[] = comps.map((component) => [component.name, `${num(Math.round((component.weight / total) * 1000) / 10)}%`, `Out of ${component.max}`]);
    return {
      ...head,
      rows: [row("minmax(0,1.3fr) minmax(0,1fr)", [
        { type: "list", title: "Coming up", sub: "Tests, assessment weeks and results days, in date order.", items: tests.map((event) => eventItem(event, "/portals/student/calendar")), empty: "No test or examination has been set yet." },
        { type: "facts", title: "How your term score is built", per: 1, facts: facts.length ? facts : [["Assessment", "Not set", "The school has not set its assessment components yet."]] },
      ])],
    };
  }

  const today = dayOf(me.today).getUTCDay();
  const periods = tt.periods;
  const rows = periods.map((period) => {
    if (period.kind === "break") return { brk: true as const, label: tt.slots.find((slot) => slot.kind === "break" && slot.from === period.from)?.subject ?? "Break", time: `${period.from}–${period.to}` };
    return {
      brk: false as const, label: `Period ${period.n}`, time: `${period.from}–${period.to}`, from: period.from,
      cells: [1, 2, 3, 4, 5].map((day) => { const slot = tt.slots.find((entry) => entry.day === day && entry.from === period.from && entry.kind !== "break"); return slot && slot.kind === "lesson" ? { subject: slot.subject, who: slot.teacher, lab: slot.lab } : null; }),
    };
  });
  const mon = monday(me.today);
  const live = tt.slots.find((slot) => slot.day === today && slot.kind === "lesson" && slot.from <= me.now && me.now < slot.to);
  return {
    ...head,
    rows: tt.published
      ? [row("1fr", [{
        type: "embed", component: "student-week",
        props: {
          title: `${me.term ? `Week ${me.term.week} · ` : ""}${dShort(mon)} – ${dShort(addDays(mon, 4))}`, sub: "Today is highlighted, and the lesson running now is ringed.", days: DAY_NAMES, today: today >= 1 && today <= 5 ? today : 0,
          now: live ? { day: today, from: live.from } : null, rows,
          foot: `Published by ${me.school}${me.term ? ` for ${me.term.name}` : ""}. When a teacher is covered, the change shows here on the day.`,
        },
      }])]
      : [row("1fr", [{ type: "note", tone: "attention", title: "Your timetable has not been published yet", body: "The school publishes each term’s timetable when it is ready. It appears here the moment it is." }])],
  };
}

/* ───────────────────────── subjects ───────────────────────── */

const SWATCH: Array<[string, string, string]> = [["#EAF6F0", "#17714F", "#CFE4DB"], ["#EBF1FA", "#2A5A96", "#DCE7F5"], ["#FDF6E7", "#8A6410", "#F2E4C6"], ["#EEEDFA", "#4A44A0", "#E1DFF4"], ["#FBF2EC", "#94553A", "#F0DDD0"], ["#F0F4FC", "#3A4E86", "#DBE3F3"], ["#F5F0FA", "#6B4E9E", "#E7DDF2"]];
const abbr = (name: string) => { const words = name.split(/\s+/).filter(Boolean); return (words.length > 1 ? words.map((word) => word[0]).join("").slice(0, 3) : name.slice(0, 3)).toUpperCase(); };

/** What a past term's subjects looked like, from the report card the school published for it — every mark final. */
async function pastSubjects(me: Me, cardId: string, tabs: NonNullable<StudentContent["tabs"]>, tab: string): Promise<StudentContent | null> {
  const { cards } = await loadCards();
  const card = cards.find((entry) => entry.id === cardId);
  if (!card) return null;
  const subjectCards = card.subjects.map((subject, index) => ({
    id: subject.id, name: subject.name, abbr: abbr(subject.name), teacher: subject.position ? `${ord(subject.position)} of ${subject.of} in ${card.arm}` : card.arm, swatch: SWATCH[index % SWATCH.length]!,
    flag: null, topic: null, open: "", final: { value: num(subject.total), sub: `${subject.grade}${subject.classAverage === null ? "" : ` · class average ${num(subject.classAverage)}`}` },
    parts: subject.parts.map((part) => ({ name: part.name, value: num(part.score), max: String(part.max), pending: false, fill: `${Math.min(100, Math.round((part.score / part.max) * 100))}%` })),
    foot: `Published ${dLong(card.published)}`, drawer: traceDrawer(card, subject, me), scheme: null,
  }));
  const best = [...card.subjects].sort((a, b) => b.total - a.total)[0];
  return {
    eyebrow: `${card.arm} · ${card.term} ${card.session}`, title: "Subjects", tabs, tab,
    desc: `What you studied in ${card.arm} that term. Every mark is final, exactly as published on ${dLong(card.published)}.`,
    rows: [
      row("1fr", [{
        type: "kpi", per: 5,
        cards: [
          { label: "Class and arm", value: card.arm, sub: me.formMaster ? `Form master ${me.formMaster.name}` : "", icon: "people" },
          { label: "Subjects that term", value: String(card.subjects.length), sub: "As published", icon: "layers" },
          { label: "Term average", value: num(card.average), sub: card.grade ? `Overall grade ${card.grade}` : "", tone: "progress", icon: "bars" },
          { label: "Position in arm", value: card.position ? `${ord(card.position)} of ${card.size}` : "—", sub: best ? `Best: ${best.name}` : "", tone: "positive", icon: "star" },
          { label: "Attendance", value: `${card.attendance.present} of ${card.attendance.days}`, sub: "Days present that term", icon: "calendar" },
        ],
      }]),
      row("1fr", [{ type: "embed", component: "student-subjects", props: { groups: [{ label: "All subjects", cards: subjectCards }] } }]),
    ],
  };
}

export async function subjectsPage(query: Record<string, string | undefined> = {}): Promise<StudentContent> {
  const [me, data, tt, past] = await Promise.all([loadMe(), loadSubjects(), loadTimetable(), loadCards()]);
  const thisTerm = me.term ? `${me.term.name} so far` : "This term";
  const tabs = [{ label: thisTerm }, ...past.cards.map((card) => ({ label: `${card.term} ${card.session}` }))];
  const tab = tabs.some((entry) => entry.label === query.tab) ? query.tab! : thisTerm;
  if (tab !== thisTerm) {
    const chosen = past.cards.find((card) => `${card.term} ${card.session}` === tab);
    const built = chosen ? await pastSubjects(me, chosen.id, tabs, tab) : null;
    if (built) return built;
  }
  const week = me.term?.week ?? 0;
  const core = data.subjects.filter((subject) => subject.core);
  const rest = data.subjects.filter((subject) => !subject.core);
  const periods = data.subjects.reduce((sum, subject) => sum + subject.periods, 0);
  const labs = data.subjects.reduce((sum, subject) => sum + subject.labs, 0);
  const releasedComponents = data.components.filter((component) => data.subjects.some((subject) => subject.parts.find((part) => part.code === component.code)?.score != null)).length;
  const tomorrow = addDays(me.today, 1);
  const test = tt.exams.find((exam) => exam.date === tomorrow);

  const card = (subject: Subjects["subjects"][number], index: number) => {
    const got = subject.parts.filter((part) => part.score !== null);
    const sum = got.reduce((total, part) => total + (part.score ?? 0), 0);
    const flag = subject.late ? { label: "Late work", tone: "negative" as const } : test && test.subject === subject.name ? { label: "Test tomorrow", tone: "attention" as const } : subject.nextDue && subject.nextDue <= tomorrow ? { label: "Due tomorrow", tone: "attention" as const } : null;
    const drawer: DrawerSpec = {
      kicker: "Subject", title: subject.name, sub: `${subject.teacher || "Teacher not assigned yet"} · ${subject.periods} ${subject.periods === 1 ? "period" : "periods"} a week`, mode: "view", readOnly: true,
      facts: [
        ["Teacher", subject.teacher || "Not assigned yet", ""], ["This week’s topic", subject.topic ?? "None posted", week ? `Week ${week}` : ""],
        ["Work still to hand in", subject.open ? `${subject.open} ${subject.open === 1 ? "task" : "tasks"}${subject.late ? ` · ${subject.late} late` : ""}` : "None", subject.nextDue ? `Next due ${dDow(subject.nextDue)}` : ""],
        ...subject.parts.map((part): [string, string, string] => [part.name, part.score === null ? "Pending" : `${num(part.score)} of ${part.max}`, part.score === null ? "Shows here when your teacher releases it" : "Released"]),
      ],
      next: { label: "See the work", href: "/portals/student/assignments" },
    };
    return {
      id: subject.id, name: subject.name, abbr: abbr(subject.name), teacher: `${subject.teacher || "Teacher not assigned"} · ${subject.periods} ${subject.periods === 1 ? "period" : "periods"} a week`,
      swatch: SWATCH[index % SWATCH.length]!, flag, topic: subject.topic, open: subject.open ? `${subject.open} ${subject.open === 1 ? "task" : "tasks"} open` : "",
      parts: subject.parts.map((part) => ({ name: part.name, value: part.score === null ? "" : num(part.score), max: String(part.max), pending: part.score === null, fill: part.score === null ? "0%" : `${Math.min(100, Math.round((part.score / part.max) * 100))}%` })),
      foot: got.length ? `${num(sum)} counted so far` : "Nothing counted yet", drawer, scheme: { kicker: "Scheme of work", title: subject.name, mode: "view", readOnly: true, load: `/portals/student/scheme/${subject.id}` } as DrawerSpec,
    };
  };

  const groups = [{ label: core.length && rest.length ? "Compulsory" : "All subjects", cards: core.map((subject, index) => card(subject, index)) }, { label: "Electives", cards: rest.map((subject, index) => card(subject, index + core.length)) }].filter((group) => group.cards.length);
  return {
    eyebrow: `${me.level}${me.stream ? ` · ${me.stream}` : ""}`, title: "Subjects", tabs: tabs.length > 1 ? tabs : undefined, tab: thisTerm, desc: "A mark shows as soon as your teacher releases it; until then it reads Pending. Open a subject for its topics and your work, or its scheme of work.",
    rows: [
      row("1fr", [{
        type: "kpi", per: 5,
        cards: [
          { label: "Class and arm", value: me.arm, sub: me.formMaster ? `Form master ${me.formMaster.name}` : "No form master named yet", icon: "people", href: "/portals/student/profile" },
          { label: "Subjects this term", value: String(data.subjects.length), sub: `${core.length} compulsory · ${rest.length} electives`, icon: "layers" },
          { label: "Periods a week", value: String(periods), sub: `${labs} of them in the laboratory`, icon: "grid", href: "/portals/student/timetable" },
          { label: "Assessments released", value: `${releasedComponents} of ${data.components.length}`, sub: data.components.length - releasedComponents ? "The rest follow as they are marked" : "All released", icon: "check", href: "/portals/student/timetable?tab=Tests+and+exams" },
          { label: "Week of term", value: me.term ? String(me.term.week) : "—", sub: me.term?.end ? `Term ends ${dShort(me.term.end)}` : "", icon: "calendar", href: "/portals/student/calendar" },
        ],
      }]),
      ...(data.subjects.length ? [row("1fr", [{ type: "embed", component: "student-subjects", props: { groups } }])] : [row("1fr", [{ type: "note", tone: "neutral", title: "No subjects yet", body: "Your class has no subjects set up for this term. The school adds them when it builds the term." }])]),
    ],
  };
}

/* ───────────────────────── assignments ───────────────────────── */

function workDrawer(work: Work, today: string): DrawerSpec {
  const [state, tone] = workPill(work, today);
  return {
    kicker: work.subject, title: work.title, sub: `Set by ${work.teacher} · ${dDow(work.set)}`, mode: "view", readOnly: true,
    facts: [
      ["Status", state, work.state === "marked" && work.markedAt ? `Marked ${dDow(work.markedAt)}` : work.state === "handed" && work.handedAt ? `Handed in ${dDow(work.handedAt.slice(0, 10))}` : `Due ${dDow(work.due)}`],
      ["Instructions", work.description || "Your teacher gave no written instructions.", work.attachmentUrl ? "A file came with it" : ""],
      ...(work.attachmentUrl ? [["The file", work.attachmentUrl, "Open it from your teacher’s link"] as [string, string, string]] : []),
      ...(work.comment ? [["Your note", work.comment, ""] as [string, string, string]] : []),
      ...(work.state === "marked" ? [["Your mark", work.score === null ? "Marked, no score" : `${num(work.score)}%`, tone === "positive" ? "Well done" : ""] as [string, string, string], ["Feedback", work.feedback || "Your teacher left no written feedback.", work.teacher] as [string, string, string]] : []),
    ],
  };
}

export async function assignmentsPage(query: Record<string, string | undefined>): Promise<StudentContent> {
  const [me, data, askable] = await Promise.all([loadMe(), loadAssignments(), loadAskable()]);
  const today = me.today;
  const todo = data.items.filter((item) => item.state === "todo" || item.state === "overdue").sort((a, b) => (a.state === b.state ? a.due.localeCompare(b.due) : a.state === "overdue" ? -1 : 1));
  const handed = data.items.filter((item) => item.state === "handed").sort((a, b) => (b.handedAt ?? "").localeCompare(a.handedAt ?? ""));
  const marked = data.items.filter((item) => item.state === "marked").sort((a, b) => (b.markedAt ?? "").localeCompare(a.markedAt ?? ""));
  const late = todo.filter((item) => item.state === "overdue");
  const scored = marked.filter((item) => item.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length) : null;
  const tabs = [{ label: "To do", count: todo.length }, { label: "Handed in", count: handed.length }, { label: "Marked", count: marked.length }];
  const tab = tabs.some((entry) => entry.label === query.tab) ? query.tab! : "To do";
  const nameCell = (item: Work): TableCellKind => ({ kind: "name", name: item.title, sub: item.subject, avatar: false });
  const txt = (value: string, tone?: PanelTone): TableCellKind => ({ kind: "text", text: value, ...(tone ? { tone } : {}) });
  const pillCell = (item: Work): TableCellKind => { const [label, tone] = workPill(item, today); return { kind: "pill", label, tone }; };

  let table: Panel;
  if (tab === "Handed in") {
    table = {
      type: "table", title: "Handed in", sub: "Waiting for your teacher to mark.", noun: "piece of work", nounPlural: "pieces of work", head: ["Assignment", "Teacher", "Handed in", "Was due", "Status", ""], per: 10, dense: true,
      rows: handed.map((item): TableRow => ({ drawer: workDrawer(item, today), keywords: `${item.title} ${item.subject}`, cells: [nameCell(item), txt(item.teacher), txt(item.handedAt ? dDow(item.handedAt.slice(0, 10)) : "—"), txt(dDow(item.due)), pillCell(item), { kind: "action", label: "Open", drawer: workDrawer(item, today) }] })),
      empty: "Nothing is waiting to be marked.", foot: "Most teachers mark homework within a week. You are told as soon as it is returned.",
    };
  } else if (tab === "Marked") {
    table = {
      type: "table", title: "Marked", sub: "Open one to read your teacher’s feedback.", noun: "piece of work", nounPlural: "pieces of work", head: ["Assignment", "Teacher", "Marked", "Score", ""], per: 10, dense: true,
      rows: marked.map((item): TableRow => ({ drawer: workDrawer(item, today), keywords: `${item.title} ${item.subject}`, cells: [nameCell(item), txt(item.teacher), txt(item.markedAt ? dDow(item.markedAt) : "—"), pillCell(item), { kind: "action", label: "Feedback", drawer: workDrawer(item, today) }] })),
      empty: "Nothing has been marked yet.",
    };
  } else {
    table = {
      type: "table", title: "To do", sub: todo.length ? "Late work first, then by due date." : "You are all caught up.", noun: "piece of work", nounPlural: "pieces of work", head: ["Assignment", "Teacher", "Set", "Due", "Status", ""], per: 10, dense: true,
      rows: todo.map((item): TableRow => ({ drawer: workDrawer(item, today), keywords: `${item.title} ${item.subject}`, cells: [nameCell(item), txt(item.teacher), txt(dDow(item.set)), txt(dueText(item, today), item.state === "overdue" ? "negative" : undefined), pillCell(item), { kind: "action", label: "Hand in", drawer: handInDrawer(item) }] })),
      empty: "Nothing to hand in.", foot: late.length ? `${late.length} ${late.length === 1 ? "piece of work is" : "pieces of work are"} late. Hand ${late.length === 1 ? "it" : "them"} in anyway — your teacher is told it is late.` : undefined,
    };
  }
  return {
    eyebrow: `${me.arm}${me.term ? ` · Week ${me.term.week}` : ""}`, title: "Assignments", desc: "Homework from all your subjects, in one place. Homework is practice — it is not part of your CA.", tabs, tab,
    launchers: [{ label: "Ask for more time", drawer: askDrawer(askable.people, { topic: "More time for an assignment" }) }],
    rows: [
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "To do", value: String(todo.length), sub: todo.length ? `Next: ${dueText(todo.find((item) => item.state === "todo") ?? todo[0]!, today).replace(/^(Today|Tomorrow)/, (word) => word.toLowerCase())}` : "Nothing to hand in", tone: todo.length ? "attention" : "positive", icon: "check" },
          { label: "Late", value: String(late.length), sub: late.length ? `${late[0]!.subject} · ${dueText(late[0]!, today)}` : "Nothing late", tone: late.length ? "negative" : "positive", icon: "hourglass" },
          { label: "Waiting to be marked", value: String(handed.length), sub: !handed.length ? "Nothing waiting" : handed.some((item) => item.late) ? `${handed.filter((item) => item.late).length} handed in late` : "All handed in on time", tone: "submitted", icon: "inbox" },
          { label: "Average mark", value: avg === null ? "—" : `${avg}%`, sub: `Across ${scored.length} marked ${scored.length === 1 ? "piece" : "pieces"}`, tone: avg !== null && avg >= 75 ? "positive" : "progress", icon: "bars" },
        ],
      }]),
      row("1fr", [table]),
    ],
  };
}

/* ───────────────────────── results ───────────────────────── */

const gradeTone = (grade: string): PanelTone => (/^[AB]/i.test(grade) ? "positive" : /^C/i.test(grade) ? "progress" : "attention");

function traceDrawer(card: Card, subject: Card["subjects"][number], me: Me): DrawerSpec {
  const out = subject.parts.reduce((sum, part) => sum + part.max, 0);
  return {
    kicker: `${card.term} ${card.session}`, title: `${subject.name} · how it was reached`, sub: `${me.name} · ${card.arm}`, mode: "view", readOnly: true,
    facts: [
      ...subject.parts.map((part): PanelFact => [part.name, `${num(part.score)} of ${part.max}`, `Counts for ${Math.round((part.max / (out || 1)) * 100)}% of the total`]),
      ["Total", `${num(subject.total)} of ${out}`, "The parts added together, as the school stored them"],
      ["Grade", subject.grade, "From the school’s grading scale"],
      ["Position", subject.position ? `${ord(subject.position)} of ${subject.of}` : "—", "Ties share a position"],
      ["Class average", subject.classAverage === null ? "—" : `${subject.classAverage} of ${out}`, "Everyone in your class who was marked"],
    ],
  };
}

function cardDrawer(card: Card, me: Me): DrawerSpec {
  const head = card.subjects[0]?.parts ?? [];
  return {
    kicker: "Report card", title: `${card.term} · ${card.session}`, sub: `${me.name} · ${card.arm} · published ${dLong(card.published)}`, mode: "view", readOnly: true,
    facts: [
      ["Average", num(card.average), card.position ? `${ord(card.position)} of ${card.size} in ${card.arm}` : "Not ranked"], ["Grade", card.grade || "—", ""],
      ["Attendance", `${card.attendance.present} of ${card.attendance.days} days`, ""],
      ...card.subjects.map((subject): PanelFact => [subject.name, `${num(subject.total)} · ${subject.grade}`, head.map((part, index) => `${part.name} ${num(subject.parts[index]?.score ?? 0)}`).join(" · ")]),
      ["Class teacher’s remark", card.teacherComment || "No remark was written.", ""], ["Principal’s remark", card.principalComment || "No remark was written.", ""],
    ],
  };
}

export async function resultsPage(query: Record<string, string | undefined>): Promise<StudentContent> {
  const [me, cardsData, subjects, askable] = await Promise.all([loadMe(), loadCards(), loadSubjects(), loadAskable()]);
  const cards = cardsData.cards;
  const latest = cards[0];
  const tabs = [{ label: "Report card" }, { label: "Progress over time", count: cards.length }];
  const tab = tabs.some((entry) => entry.label === query.tab) ? query.tab! : "Report card";
  const teacherOf = new Map(subjects.subjects.map((subject) => [subject.name, subject.teacher]));
  const head = {
    eyebrow: `${me.name} · ${me.arm}`, title: "Results", tabs, tab,
    desc: tab === "Progress over time" ? `Every report card you have received at ${me.school}, kept exactly as it was published.` : "Your latest report card, and what has been released this term. Tap any subject to see exactly how its score was reached.",
    launchers: [{ label: "Ask about a result", drawer: askDrawer(askable.people, { topic: "A question about a result" }) }],
    ...(latest ? { primary: { label: "Printable report card", href: `/api/v1/reports/report-card/${me.id}` } } : {}),
  };

  if (!latest) {
    return { ...head, rows: [row("1fr", [{ type: "note", tone: "neutral", title: "No report card has been published yet", body: "Your first report card appears here the day the school publishes it. Until then, what has been released this term shows on Subjects." }])] };
  }

  if (tab === "Progress over time") {
    const oldest = cards[cards.length - 1]!;
    const change = latest.average - oldest.average;
    const best = [...cards].sort((a, b) => (a.position ?? 999) / Math.max(1, a.size) - (b.position ?? 999) / Math.max(1, b.size))[0]!;
    const same = cards.filter((card) => card.arm === latest.arm).slice(0, 3).reverse();
    return {
      ...head,
      rows: [
        row("1fr", [{
          type: "kpi", per: 4,
          cards: [
            { label: "Report cards on record", value: String(cards.length), sub: `Since ${oldest.term} ${oldest.session}`, icon: "doc" },
            { label: "Latest average", value: num(latest.average), sub: `${latest.term} ${latest.session}`, tone: "progress", icon: "bars" },
            { label: "Change since the first card", value: `${change >= 0 ? "+" : "−"}${num(Math.abs(Math.round(change * 100) / 100))}`, sub: `${num(oldest.average)} → ${num(latest.average)}`, tone: change >= 0 ? "positive" : "attention", icon: "trendUp" },
            { label: "Best position", value: best.position ? `${ord(best.position)} of ${best.size}` : "—", sub: `${best.term} ${best.session}`, tone: "positive", icon: "trophy" },
          ],
        }]),
        row("1fr", [{
          type: "table", title: "Every report card", sub: "Kept exactly as published. Open any one to read it.", noun: "report card", nounPlural: "report cards", head: ["Report card", "Class", "Average", "Position", "Grade", "Attendance", "Published", ""], per: 12, dense: true,
          rows: cards.map((card, index): TableRow => ({
            drawer: cardDrawer(card, me), keywords: `${card.term} ${card.session}`,
            cells: [{ kind: "name", name: card.term, sub: `${card.session}${index === 0 ? " · latest" : ""}`, avatar: false }, { kind: "text", text: card.arm }, { kind: "text", text: num(card.average), strong: true }, { kind: "text", text: card.position ? `${ord(card.position)} of ${card.size}` : "—" }, { kind: "pill", label: card.grade || "—", tone: card.grade ? gradeTone(card.grade) : "neutral" }, { kind: "text", text: `${card.attendance.present} of ${card.attendance.days}` }, { kind: "text", text: dShort(card.published) }, { kind: "action", label: "Open", drawer: cardDrawer(card, me) }],
          })),
          foot: "A corrected card is issued as a new version. The original is never replaced.",
        }]),
        row(same.length > 1 ? "minmax(0,1fr) minmax(0,1.2fr)" : "1fr", [
          { type: "bars", title: "Term average over time", sub: "Every report card, oldest first.", rows: [...cards].reverse().map((card): BarRow => ({ label: `${card.term} ${card.session}`, value: card.average, display: num(card.average), tone: card === latest ? "positive" : "progress" })), foot: `${change >= 0 ? "Up" : "Down"} ${num(Math.abs(Math.round(change * 100) / 100))} points across ${cards.length} report cards.` },
          ...(same.length > 1 ? [{
            type: "table" as const, title: "Subject by subject", sub: `Your last ${same.length} report cards in ${latest.arm}.`, noun: "subject", nounPlural: "subjects", per: 0, dense: true, head: ["Subject", ...same.map((card) => `${card.term.replace(/ Term$/, "")} ${card.session.slice(2, 4)}`), "Change"],
            rows: latest.subjects.map((subject): TableRow => {
              const vals = same.map((card) => card.subjects.find((entry) => entry.name === subject.name)?.total ?? null);
              const first = vals.find((value) => value !== null) ?? null; const last = vals[vals.length - 1] ?? null; const delta = first !== null && last !== null ? last - first : null;
              return { cells: [{ kind: "text", text: subject.name, strong: true }, ...vals.map((value, index): TableCellKind => ({ kind: "text", text: value === null ? "—" : num(value), strong: index === vals.length - 1 })), { kind: "text", text: delta === null ? "—" : `${delta >= 0 ? "+" : "−"}${num(Math.abs(delta))}`, tone: delta === null ? "neutral" : delta >= 0 ? "positive" : "negative" }] };
            }),
            foot: "Green is a rise since the first of these cards; red is a fall.",
          }] : []),
        ]),
      ],
    };
  }

  const comps = latest.subjects[0]?.parts ?? [];
  const released = subjects.components.map((component) => {
    const scores = subjects.subjects.map((subject) => subject.parts.find((part) => part.code === component.code)?.score ?? null).filter((score): score is number => score !== null);
    return { component, avg: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null, count: scores.length };
  });
  const strongest = [...latest.subjects].sort((a, b) => b.total - a.total)[0];
  return {
    ...head,
    rows: [
      row("1fr", [{
        type: "facts", title: `${me.term?.name ?? "This term"} so far`, sub: released.some((entry) => entry.avg !== null) ? "Released since the last report card." : "Nothing has been released for this term yet.", per: 4,
        facts: [
          ...released.map((entry): PanelFact => [entry.component.name, entry.avg === null ? "Not yet" : `${num(Math.round(entry.avg * 10) / 10)} / ${entry.component.max}`, entry.avg === null ? "Released when your teachers approve it" : `Released for ${entry.count} ${entry.count === 1 ? "subject" : "subjects"}`]),
          ["Report card", "Not yet", "Published at the end of term"],
        ],
      }]),
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "Average", value: num(latest.average), sub: `${latest.term} ${latest.session}`, tone: "progress", icon: "bars" },
          { label: "Position", value: latest.position ? `${ord(latest.position)} of ${latest.size}` : "Not ranked", sub: `In ${latest.arm}`, icon: "trophy" },
          { label: "Strongest", value: strongest?.name ?? "—", sub: strongest ? `${num(strongest.total)} · ${strongest.grade}` : "", tone: "positive", icon: "star" },
          { label: "Attendance that term", value: `${latest.attendance.present} of ${latest.attendance.days}`, sub: "School days", icon: "calendar" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: `${latest.term} ${latest.session} report card`, sub: `Published ${dLong(latest.published)}. Tap any subject to see how its score was reached.`, noun: "subject", nounPlural: "subjects", per: 0, dense: true,
        head: ["Subject", ...comps.map((part) => `${part.name} · ${part.max}`), "Total", "Grade", "Position", ""],
        rows: latest.subjects.map((subject): TableRow => ({
          drawer: traceDrawer(latest, subject, me),
          cells: [{ kind: "name", name: subject.name, sub: teacherOf.get(subject.name) || undefined, avatar: false }, ...comps.map((part, index): TableCellKind => ({ kind: "text", text: subject.parts[index] ? num(subject.parts[index]!.score) : "—" })), { kind: "text", text: num(subject.total), strong: true }, { kind: "pill", label: subject.grade, tone: gradeTone(subject.grade) }, { kind: "text", text: subject.position ? ord(subject.position) : "—" }, { kind: "action", label: "Explain", drawer: traceDrawer(latest, subject, me) }],
        })),
        foot: "Each total is the parts added together, exactly as the school stored them. Grades follow your school’s grading scale.",
      }]),
      row("minmax(0,1.2fr) minmax(0,1fr)", [
        { type: "list", title: "What the teachers wrote", items: [{ label: latest.teacherComment || "No remark was written.", sub: me.formMaster ? `Form master · ${me.formMaster.name}` : "Form master" }, { label: latest.principalComment || "No remark was written.", sub: "Principal" }] },
        { type: "list", title: "Earlier report cards", acts: [{ label: "All of them", href: "/portals/student/results?tab=Progress+over+time" }], empty: "This is your first report card.", items: cards.slice(1, 4).map((card): ListItem => ({ label: `${card.term} ${card.session}`, sub: `${card.arm} · average ${num(card.average)} · published ${dShort(card.published)}`, pill: "Open", tone: "progress", drawer: cardDrawer(card, me) })) },
      ]),
    ],
  };
}
