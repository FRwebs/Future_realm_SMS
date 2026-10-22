import { apiGet } from "@/lib/api/server";
import { area, checks, fixed, select, text } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * Staff & Access → Learning. Where a school writes the courses its staff take, and reads what came of them: who has finished what,
 * the certificates people have filed from elsewhere (verified here before they count), and what they have asked to learn.
 */

const API = "/api/v1/learning/manage";
const PLUS = "M12 5.5v13M5.5 12h13";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";

type Manage = {
  staff: number; cpdTarget: number | null; sections: string[]; personas: string[]; formats: string[]; topics: string[];
  funding: Array<{ id: string; who: string; course: string; provider: string; hours: number; priceLabel: string; price: number; reason: string | null; asked: string }>; fundingTotal: string;
  courses: Array<{ id: string; title: string; section: string; hours: number; format: string; certificateName: string; lessons: number; published: boolean; archived: boolean; required: boolean; requiredBy: string | null; requiredFor: string[]; started: number; finished: number }>;
  pending: Array<{ id: string; who: string; name: string; issuedBy: string; issued: string; hours: number; hasFile: boolean; filed: string }>;
  suggestions: Array<{ id: string; who: string; topic: string; why: string | null; at: string }>;
};
export type ManagedCourse = {
  id: string; title: string; summary: string | null; section: string; provider: string; hours: number; format: string; certificateName: string; validMonths: number | null; pathway: string | null; outcomes: string[]; task: string | null; personas: string[]; subjects: string[]; topics: string[]; topicOptions: string[]; price: number | null; requiredFor: string[]; requiredBy: string | null; requiredNote: string | null;
  published: boolean; archived: boolean; started: number; finished: number; sections: string[]; personaOptions: string[]; formats: string[];
  lessons: Array<{ position: number; title: string; minutes: number; body: string; question: string; options: string[]; correct: number; explanation: string | null }>;
};

const PERSONA_LABELS: Record<string, string> = { "form-master": "Form masters", "head-of-department": "Heads of department", "subject-teacher": "Subject teachers", "early-years": "Early years teachers", "teaching-assistant": "Teaching assistants", cover: "Cover teachers" };
const labelOf = (slug: string) => PERSONA_LABELS[slug] ?? slug;
const slugOf = Object.fromEntries(Object.entries(PERSONA_LABELS).map(([slug, label]) => [label, slug]));
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "");

export const loadManagedCourse = (id: string) => apiGet<ManagedCourse>(`${API}/courses/${id}`);

function courseFields(course: ManagedCourse | null, o: { sections: string[]; formats: string[]; personas: string[]; topics?: string[] }): FormField[] {
  const personaLabels = o.personas.map(labelOf);
  return [
    text("Title", { required: true, span: 2, value: course?.title ?? "", placeholder: "e.g. Safeguarding children — the basics" }),
    area("What it is about", { span: 2, optional: true, value: course?.summary ?? "" }),
    select("Section", o.sections, { value: course?.section ?? o.sections[0] }),
    select("Format", o.formats, { value: course?.format ?? o.formats[0] }),
    text("Hours it takes", { required: true, value: course ? String(course.hours) : "", placeholder: "e.g. 1.5" }),
    text("Provider", { optional: true, value: course?.provider ?? "", hint: "Leave blank to use the school’s name." }),
    text("Certificate it earns", { required: true, value: course?.certificateName ?? "", placeholder: "e.g. Safeguarding — Level 1" }),
    text("Valid for (months)", { optional: true, value: course?.validMonths ? String(course.validMonths) : "", hint: "Leave blank if the certificate does not expire." }),
    text("Price (₦)", { optional: true, value: course && course.price ? String(course.price) : "", hint: "Leave blank for a free course. A paid course opens for a teacher once the school funds it or they record paying for it." }),
    text("Pathway level", { optional: true, value: course?.pathway ?? "", hint: "e.g. Foundation — courses with the same level are grouped." }),
    area("You will be able to", { span: 2, optional: true, value: (course?.outcomes ?? []).join("\n"), hint: "One outcome per line." }),
    area("Try it in the classroom", { span: 2, optional: true, value: course?.task ?? "" }),
    checks("About", o.topics ?? [], course?.topics ?? [], { span: 2, hint: "When a teacher’s own classes, results or deadlines raise one of these, this course is recommended to them, with the reason." }),
    checks("Written for", personaLabels, (course?.personas ?? []).map(labelOf), { span: 2, hint: "Leave all unticked to offer it to every teacher." }),
    area("Subjects it fits", { span: 2, optional: true, value: (course?.subjects ?? []).join("\n"), hint: "One word per line, matched against the subjects a teacher takes. Blank means every subject." }),
    checks("Required of", ["Everyone", ...personaLabels], (course?.requiredFor ?? []).map((slug) => (slug === "all" ? "Everyone" : labelOf(slug))), { span: 2, hint: "Leave all unticked if it is optional." }),
    text("Required by", { type: "date", optional: true, value: course?.requiredBy ?? "" }),
    area("Why it is required", { span: 2, optional: true, value: course?.requiredNote ?? "", placeholder: "e.g. Set for every member of staff by the Principal." }),
  ] as FormField[];
}
const courseMap = { Title: "title", "What it is about": "summary", Section: "section", Format: "format", "Hours it takes": "hours", Provider: "provider", "Certificate it earns": "certificateName", "Valid for (months)": "validMonths", "Pathway level": "pathway", "Price (₦)": "price", About: "topics", "You will be able to": "outcomes", "Try it in the classroom": "task", "Written for": "personas", "Subjects it fits": "subjects", "Required of": "requiredFor", "Required by": "requiredBy", "Why it is required": "requiredNote" };
const courseEncode = { "Written for": slugOf, "Required of": { Everyone: "all", ...slugOf } };

export async function learningTab(): Promise<TabContent> {
  const v = await apiGet<Manage>(API);
  const o = { sections: v.sections, formats: v.formats, personas: v.personas, topics: v.topics };
  const create: DrawerSpec = {
    mode: "form", kicker: "Learning", title: "Write a course", sub: "It starts as a draft. Add its lessons, then publish it to the staff it is written for.",
    commitLabel: "Create the course", commitDone: "Course created", commitDoneBody: "Open it from the list to add lessons.", fields: courseFields(null, o),
    submit: { endpoint: `${API}/courses`, method: "POST", map: courseMap, encode: courseEncode },
  };
  const rows: TableRow[] = v.courses.map((course) => ({
    keywords: `${course.title} ${course.section}`, href: `/staff-access/learning/${course.id}`,
    cells: [
      { kind: "name", name: course.title, sub: `${course.certificateName}${course.required ? ` · required${course.requiredBy ? ` by ${day(course.requiredBy)}` : ""}` : ""}`, avatar: false }, cell(course.section), cell(`${course.lessons}`, { mono: true }),
      pill(course.archived ? "Archived" : course.published ? "Published" : "Draft", course.archived ? "neutral" : course.published ? "positive" : "progress"), cell(course.published ? `${course.finished} of ${course.started} started` : "—"),
      { kind: "action", label: "Open", href: `/staff-access/learning/${course.id}` },
    ] as TableCellKind[],
  }));
  const verify = (item: Manage["pending"][number], decision: "verify" | "reject"): DrawerSpec => ({
    mode: decision === "verify" ? "commit" : "form", kicker: "Certificate", title: decision === "verify" ? `Verify ${item.name}` : `Do not accept ${item.name}`, sub: `${item.who} · issued by ${item.issuedBy}, ${item.issued}.`,
    facts: [["Held by", item.who, ""], ["Issued by", item.issuedBy, item.issued], ["CPD", item.hours ? `${item.hours} hours` : "None stated", ""], ["A photo", item.hasFile ? "Attached" : "None attached", ""]],
    commitLabel: decision === "verify" ? "Verify it" : "Do not accept it", commitDone: decision === "verify" ? "Certificate verified" : "Certificate not accepted", commitDoneBody: "They are told.",
    ...(decision === "reject" ? { fields: [area("Why", { required: true, span: 2 })] as FormField[] } : {}),
    submit: { endpoint: `${API}/certificates/${item.id}/decide`, method: "POST", body: { decision }, ...(decision === "reject" ? { map: { Why: "note" } } : {}) },
  });
  const pending: TableRow[] = v.pending.map((item) => ({
    keywords: `${item.who} ${item.name}`,
    cells: [{ kind: "name", name: item.name, sub: item.who, avatar: false }, cell(item.issuedBy), cell(item.issued), cell(item.hasFile ? "Photo attached" : "No photo"), { kind: "action", label: "Verify", drawer: verify(item, "verify") }, { kind: "action", label: "Decline", drawer: verify(item, "reject") }] as TableCellKind[],
  }));
  const settle = (item: Manage["funding"][number], decision: "APPROVED" | "DECLINED"): DrawerSpec => ({
    mode: decision === "APPROVED" ? "commit" : "form", kicker: "Training funding", title: decision === "APPROVED" ? `Fund ${item.course} for ${item.who}` : `Do not fund ${item.course}`,
    sub: `${item.who} asked the school to pay ${item.priceLabel}. ${item.reason ? `Their reason: “${item.reason}”` : ""}`,
    facts: [["Course", item.course, item.provider], ["Price", item.priceLabel, `${item.hours} hours`], ["Asked", item.asked, ""], ["If approved", "The course opens for them now", "They are told"]],
    commitLabel: decision === "APPROVED" ? "Approve it" : "Do not approve it", commitDone: decision === "APPROVED" ? "Funding approved" : "Not approved", commitDoneBody: "They are told.",
    ...(decision === "DECLINED" ? { fields: [area("Why not — they read this", { required: true, span: 2 })] as FormField[] } : {}),
    submit: { endpoint: `${API}/funding/${item.id}/decide`, method: "POST", body: { decision }, ...(decision === "DECLINED" ? { map: { "Why not — they read this": "note" } } : {}) },
  });
  const funding: TableRow[] = v.funding.map((item) => ({
    keywords: `${item.who} ${item.course}`,
    cells: [{ kind: "name", name: item.course, sub: `${item.who} · asked ${item.asked}`, avatar: false }, cell(item.provider), cell(item.priceLabel, { mono: true }), cell(item.reason ?? "—"), { kind: "action", label: "Approve", drawer: settle(item, "APPROVED") }, { kind: "action", label: "Decline", drawer: settle(item, "DECLINED") }] as TableCellKind[],
  }));
  const policy: DrawerSpec = {
    mode: "form", kicker: "Learning", title: "Yearly CPD expectation", sub: "Hours of professional development the school expects of each teacher in a session. It shows beside each teacher’s own hours.",
    commitLabel: "Save", commitDone: "Saved", commitDoneBody: "Teachers see it on their Training page.", fields: [text("Hours a session", { value: v.cpdTarget === null ? "" : String(v.cpdTarget), optional: true, hint: "Leave blank to set no expectation." })] as FormField[],
    submit: { endpoint: `${API}/policy`, method: "POST", map: { "Hours a session": "cpdTarget" } },
  };
  const published = v.courses.filter((course) => course.published && !course.archived);
  const requiredOpen = published.filter((course) => course.required);
  return {
    title: "Learning", desc: "The courses your staff take, what came of them, and what they have filed from elsewhere.",
    primary: { label: "Write a course", icon: PLUS, drawer: create }, launchers: [{ label: "CPD expectation", drawer: policy }],
    rows: ([
      row("1fr", [{
        type: "kpi", sub: "Counted from enrolments and certificates. A teacher’s answers are never shown here — only that a course was finished.", per: 4,
        cards: [
          { label: "Published courses", value: String(published.length), sub: `${v.courses.filter((course) => !course.published && !course.archived).length} in draft`, tone: published.length ? "positive" : "neutral" },
          { label: "Required courses", value: String(requiredOpen.length), sub: requiredOpen.length ? `${requiredOpen.reduce((sum, course) => sum + course.finished, 0)} completions so far across ${v.staff} teachers` : "None set", tone: requiredOpen.length ? "progress" : "neutral" },
          { label: "Waiting to be verified", value: String(v.pending.length), sub: v.pending.length ? "Certificates staff filed from elsewhere" : v.funding.length ? `${v.funding.length} funding request${v.funding.length === 1 ? "" : "s"} waiting · ${v.fundingTotal}` : "Nothing waiting", tone: v.pending.length || v.funding.length ? "attention" : "positive" },
          { label: "Suggestions", value: String(v.suggestions.length), sub: v.cpdTarget === null ? "No yearly CPD expectation is set" : `Yearly expectation: ${v.cpdTarget} hours` },
        ],
      }]),
      row("1fr", [{ type: "table", title: "Courses", sub: "Open one to write its lessons, choose who it is for, and publish it.", meta: `${v.courses.length}`, noun: "course", nounPlural: "courses", search: "Find a course", head: ["Course", "Section", "Lessons", "State", "Finished", ""], rows, per: 10, empty: "No course has been written yet. Write one, add its lessons, and publish it.", foot: "This school writes its own courses. There is no platform course library in this build." }]),
      v.funding.length ? row("1fr", [{ type: "table", title: "Funding requests", tag: v.fundingTotal, tagTone: "attention", sub: "Staff asked the school to pay for these. Approving one opens the course for them; declining says why.", meta: `${v.funding.length}`, noun: "request", nounPlural: "requests", head: ["Course", "Provider", "Price", "Their reason", "", ""], rows: funding, noRowOpen: true, per: 8 }]) : null,
      v.pending.length ? row("1fr", [{ type: "table", title: "Certificates to verify", sub: "Staff filed these from outside the school. They count only once you have checked them.", meta: `${v.pending.length} waiting`, noun: "certificate", nounPlural: "certificates", head: ["Certificate", "Issued by", "Issued", "Evidence", "", ""], rows: pending, per: 10, noRowOpen: true }]) : null,
      v.suggestions.length ? row("1fr", [{ type: "list", title: "What staff have asked to learn", sub: "If enough colleagues ask for the same thing, it is worth writing.", items: v.suggestions.map((item) => ({ label: item.topic, sub: `${item.who} · ${item.at}${item.why ? ` — ${item.why}` : ""}` })) }]) : null,
    ].filter(Boolean) as PanelRow[]),
  };
}

export function courseEditorPage(c: ManagedCourse): TabContent & { crumb: { label: string; href: string } } {
  const o = { sections: c.sections, formats: c.formats, personas: c.personaOptions, topics: c.topicOptions };
  const lessonFields = (lesson: ManagedCourse["lessons"][number] | null): FormField[] => [
    text("Lesson title", { required: true, span: 2, value: lesson?.title ?? "" }),
    text("Minutes", { value: String(lesson?.minutes ?? 10) }),
    select("Right answer is", ["1", "2", "3", "4", "5", "6"], { value: String((lesson?.correct ?? 0) + 1) }),
    area("The lesson", { required: true, span: 2, value: lesson?.body ?? "", placeholder: "The explanation itself — enough for a colleague to learn from.", hint: "At least a few sentences." }),
    text("The question", { required: true, span: 2, value: lesson?.question ?? "", hint: "Every lesson ends with one question." }),
    area("Answers", { required: true, span: 2, value: (lesson?.options ?? []).join("\n"), hint: "One answer per line, two to six. Say which is right above." }),
    area("Why that answer is right", { span: 2, optional: true, value: lesson?.explanation ?? "", hint: "Shown, in part, when someone chooses a wrong answer." }),
  ] as FormField[];
  const lessonSubmit = (position: number | null) => ({ endpoint: `${API}/courses/${c.id}/lessons${position === null ? "" : `/${position}`}`, method: (position === null ? "POST" : "PUT") as "POST" | "PUT", map: { "Lesson title": "title", Minutes: "minutes", "Right answer is": "correct", "The lesson": "body", "The question": "question", Answers: "options", "Why that answer is right": "explanation" }, encode: { "Right answer is": { "1": "0", "2": "1", "3": "2", "4": "3", "5": "4", "6": "5" } } });
  const addLesson: DrawerSpec = { mode: "form", kicker: c.title, title: `Add lesson ${c.lessons.length + 1}`, sub: "A lesson is an explanation and one question that ends it.", commitLabel: "Add the lesson", commitDone: "Lesson added", commitDoneBody: "It is at the end of the course.", fields: lessonFields(null), submit: lessonSubmit(null) };
  const edit: DrawerSpec = { mode: "form", kicker: "Course", title: "Edit the course", commitLabel: "Save", commitDone: "Course saved", commitDoneBody: "", fields: courseFields(c, o), submit: { endpoint: `${API}/courses/${c.id}`, method: "PUT" as never, map: courseMap, encode: courseEncode } };
  const state = (to: "publish" | "archive" | "restore"): DrawerSpec => ({
    mode: "commit", kicker: c.title, title: to === "publish" ? "Publish the course" : to === "archive" ? "Archive the course" : "Restore the course",
    sub: to === "publish" ? "It appears in the catalogue of the staff it is written for, and a required course lands on their My Day." : to === "archive" ? "It leaves the catalogue. People who finished it keep their certificates." : "It returns to the catalogue.",
    facts: [["Lessons", String(c.lessons.length), c.lessons.length ? "" : "A course needs at least one"], ["Required", c.requiredFor.length ? c.requiredFor.map((slug) => (slug === "all" ? "Everyone" : labelOf(slug))).join(", ") : "No", c.requiredBy ? day(c.requiredBy) : ""]],
    commitLabel: to === "publish" ? "Publish it" : to === "archive" ? "Archive it" : "Restore it", commitDone: "Done", commitDoneBody: "", submit: { endpoint: `${API}/courses/${c.id}/state`, method: "POST", body: { state: to } },
  });
  const lessonRows: TableRow[] = c.lessons.map((lesson) => ({
    keywords: lesson.title,
    cells: [
      cell(String(lesson.position), { mono: true }), { kind: "name", name: lesson.title, sub: lesson.question, avatar: false }, cell(`${lesson.minutes} min`), cell(`${lesson.options.length} answers · right: ${lesson.correct + 1}`),
      { kind: "action", label: "Edit", drawer: { mode: "form", kicker: c.title, title: `Edit lesson ${lesson.position}`, commitLabel: "Save the lesson", commitDone: "Lesson saved", commitDoneBody: "", fields: lessonFields(lesson), submit: lessonSubmit(lesson.position) } as DrawerSpec },
      { kind: "action", label: "Remove", drawer: { mode: "commit", kicker: c.title, title: `Remove lesson ${lesson.position}`, sub: "The lessons after it move up one.", facts: [["Lesson", lesson.title, ""]], commitLabel: "Remove it", commitDone: "Lesson removed", commitDoneBody: "", submit: { endpoint: `${API}/courses/${c.id}/lessons/${lesson.position}`, method: "DELETE" } } as DrawerSpec },
    ] as TableCellKind[],
  }));
  const status = c.archived ? "Archived" : c.published ? "Published" : "Draft";
  return {
    crumb: { label: "Back to Learning", href: "/staff-access/learning" },
    title: c.title, desc: `${c.section} · ${c.hours} hours · ${c.format} · earns “${c.certificateName}”.`,
    primary: { label: "Add a lesson", icon: PLUS, drawer: addLesson },
    launchers: [{ label: "Edit the course", drawer: edit }, c.archived ? { label: "Restore", drawer: state("restore") } : c.published ? { label: "Archive", drawer: state("archive") } : { label: "Publish", drawer: state("publish") }],
    rows: [
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "State", value: status, sub: c.published ? "In the catalogue of the staff it is written for" : "Staff cannot see it yet", tone: c.published && !c.archived ? "positive" : "progress" },
          { label: "Lessons", value: String(c.lessons.length), sub: `${c.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)} minutes in all`, tone: c.lessons.length ? "positive" : "attention" },
          { label: "Started", value: String(c.started), sub: c.published ? "Staff who opened it" : "Nobody — it is a draft" },
          { label: "Finished", value: String(c.finished), sub: c.started ? `${Math.round((c.finished / c.started) * 100)}% of those who started` : "", tone: c.finished ? "positive" : "neutral" },
        ],
      }]),
      row("1fr", [{ type: "table", title: "Lessons", sub: "In the order a person takes them.", meta: `${c.lessons.length}`, noun: "lesson", nounPlural: "lessons", head: ["#", "Lesson", "Time", "Question", "", ""], rows: lessonRows, per: 0, noRowOpen: true, empty: "No lessons yet. Add the first one." }]),
      row("1fr 1fr", [
        { type: "facts", title: "Who it is for", per: 1, facts: [["Written for", c.personas.length ? c.personas.map(labelOf).join(", ") : "Every teacher", ""], ["Subjects", c.subjects.length ? c.subjects.join(", ") : "Every subject", ""], ["Required of", c.requiredFor.length ? c.requiredFor.map((slug) => (slug === "all" ? "Everyone" : labelOf(slug))).join(", ") : "Nobody — optional", c.requiredBy ? `By ${day(c.requiredBy)}` : ""], ["Pathway", c.pathway ?? "None", ""]] as PanelFact[] },
        { type: "facts", title: "What it earns", per: 1, facts: [["Certificate", c.certificateName, ""], ["Valid for", c.validMonths ? `${c.validMonths} months` : "Does not expire", ""], ["Provider", c.provider, ""], ["Price", c.price ? `₦${c.price.toLocaleString("en-NG")}` : "Free to staff", ""]] as PanelFact[] },
      ]),
      ...(c.published && c.started ? [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "People have started this course", body: "A lesson cannot be taken out from under them. To change it, archive this course and write a new one." }])] : []),
    ] as PanelRow[],
  };
}
void fixed;
