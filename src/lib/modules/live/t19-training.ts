import { apiGet } from "@/lib/api/server";
import { area, choice, text } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * M19 for a teaching person: Training. Courses written by their school, fitted to the work they do; each lesson ends in one question,
 * and the certificate at the end is theirs — with a code anyone can check. The school sees that a course was finished, never the answers.
 */

const API = "/api/v1/teacher-workspace";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const PLUS = "M12 5.5v13M5.5 12h13";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const CHECK = "m4.5 12.5 4.5 4.5 9-10";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";

export type Course = { id: string; title: string; summary: string | null; section: string; provider: string; hours: number; format: string; certificateName: string; validMonths: number | null; pathway: string | null; lessons: number; done: number; completed: boolean; state: string; required: boolean; requiredBy: string | null; requiredNote: string | null; dueDays: number | null; outcomes: string[] };
type Cert = { id: string; name: string; by: string; issued: string; issuedAt: string; expires: string; expiresAt: string | null; days: number | null; hours: number; code: string; state: string; external: boolean; courseId: string | null; note: string | null };
type Home = { persona: string; cpd: { hours: number; target: number | null }; required: Course[]; inProgress: Course[]; recommended: Array<{ course: Course; why: string }>; pathways: Array<{ name: string; total: number; done: number; titles: string[] }>; certificates: number; expiring: Cert | null; total: number; completed: number };
type Catalogue = { sections: string[]; courses: Course[] };
type Certificates = { cpd: { hours: number; target: number | null }; holder: string; school: string; certificates: Cert[] };
export type CoursePage = { id: string; title: string; summary: string | null; provider: string; hours: number; format: string; certificateName: string; validMonths: number | null; outcomes: string[]; task: string | null; required: { by: string | null; note: string | null } | null; lessons: Array<{ position: number; title: string; minutes: number; summary: string; done: boolean }>; done: number; completed: boolean; certificate: Cert | null };
export type LessonPage = { course: { id: string; title: string; hours: number; certificateName: string; provider: string; required: { by: string | null; note: string | null } | null; lessonsTotal: number; done: number }; outline: Array<{ position: number; title: string; minutes: number; done: boolean }>; lesson: { position: number; title: string; minutes: number; body: string; question: string; options: string[]; done: boolean } };

const length = (hours: number) => (hours < 1 ? `${Math.round(hours * 60)} min` : Number.isInteger(hours) ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `${Math.floor(hours)} h ${Math.round((hours % 1) * 60)} min`);
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "");
const stateTone = (state: string, required: boolean): PanelTone => (state === "Completed" ? "positive" : required || state === "Required" ? "attention" : state === "In progress" ? "progress" : "neutral");

export const courseHref = (id: string) => `/training/catalogue/${id}`;
export const lessonHref = (id: string, position: number) => `/training/catalogue/${id}/lessons/${position}`;
export const loadCourse = (id: string) => apiGet<CoursePage>(`${API}/learning/courses/${id}`);
export const loadLesson = (id: string, position: string) => apiGet<LessonPage>(`${API}/learning/courses/${id}/lessons/${position}`);

export async function teacherTrainingTab(tabSlug: string, query: Record<string, string | undefined>): Promise<TabContent | null | undefined> {
  if (tabSlug === "for-you") return forYouTab(await apiGet<Home>(`${API}/learning/home`));
  if (tabSlug === "catalogue") return catalogueTab(await apiGet<Catalogue>(`${API}/learning/catalogue`), query);
  if (tabSlug === "certificates") return certificatesTab(await apiGet<Certificates>(`${API}/learning/certificates`));
  return undefined;
}

const suggest: DrawerSpec = {
  mode: "form", kicker: "Training", title: "Suggest a course", sub: "It goes to the staff development lead. If enough colleagues ask for the same thing, it is written.",
  commitLabel: "Send the suggestion", commitDone: "Suggestion sent", commitDoneBody: "Thank you — it is on the list the school reads when it plans training.",
  fields: [text("What you want to learn", { required: true, span: 2, placeholder: "e.g. Teaching phonics to older readers" }), area("Why it would help your teaching", { span: 2, optional: true })] as FormField[],
  submit: { endpoint: `${API}/learning/suggestions`, method: "POST", map: { "What you want to learn": "topic", "Why it would help your teaching": "why" } },
};

function noCourses(title: string, desc: string): TabContent {
  return { title, desc, launchers: [{ label: "Suggest a course", drawer: suggest }], rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "Your school has not published a course for your work yet", body: "Courses are written by the school and fitted to the work its staff do. When one is published for you, it appears here with what it earns. You can suggest one now." }])] };
}

function courseList(title: string, sub: string, courses: Course[], why?: Map<string, string>) {
  return {
    type: "list" as const, title, sub,
    items: courses.map((course) => ({
      label: course.title, sub: `${course.provider} · ${length(course.hours)} · ${course.format}${course.required && !course.completed && course.requiredBy ? ` · due ${day(course.requiredBy)}` : ""}${why?.get(course.id) ? ` — ${why.get(course.id)}` : ""}`,
      pill: course.required && !course.completed ? "Required" : course.state, tone: stateTone(course.state, course.required), viewLabel: course.completed ? "Review" : course.done ? "Continue" : "Start", href: courseHref(course.id),
    })),
  };
}

function forYouTab(v: Home): TabContent {
  if (!v.total) return noCourses("Training", "Courses that fit the work you already do, and certificates your school recognises.");
  const next = v.required[0] ?? v.inProgress[0] ?? v.recommended[0]?.course ?? null;
  const due = v.required[0] ?? null;
  const why = new Map(v.recommended.map((entry) => [entry.course.id, entry.why]));
  const L = v.cpd.target;
  return {
    title: "Training", desc: "Courses that fit the work you already do, and certificates your school recognises.",
    primary: next ? { label: `${next.done ? "Continue" : "Start"} ${next.title}`.slice(0, 48), icon: ARROW, href: courseHref(next.id) } : undefined,
    launchers: [{ label: "Browse every course", href: "/training/catalogue" }, { label: "Your certificates", href: "/training/certificates" }],
    rows: ([
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "CPD this year", value: String(v.cpd.hours), unit: L !== null ? `of ${L} hours` : "hours", sub: L !== null ? "The school’s yearly expectation · counts in your appraisal" : "The school has not set a yearly expectation", tone: L !== null && v.cpd.hours >= L ? "positive" : "progress" },
          { label: "Required by your school", value: String(v.required.length), sub: v.required.length ? v.required.map((course) => `${course.title}${course.requiredBy ? ` · due ${day(course.requiredBy)}` : ""}`).join("; ") : "Everything required is done", tone: v.required.length ? "attention" : "positive" },
          { label: "In progress", value: String(v.inProgress.length + v.required.filter((course) => course.done).length), sub: "Pick up exactly where you stopped" },
          { label: "Certificates", value: String(v.certificates), sub: v.expiring ? `${v.expiring.name} ${v.expiring.state === "Expired" ? "has expired" : `expires ${v.expiring.expires}`}` : "All current", tone: v.expiring ? "attention" : "positive", ...({ link: "View them", href: "/training/certificates" } as object) },
        ],
      }]),
      due ? row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: `${due.title} is required${due.requiredBy ? ` by ${day(due.requiredBy)}` : ""}${due.dueDays !== null ? ` · ${due.dueDays < 0 ? `${-due.dueDays} days overdue` : `${due.dueDays} days`}` : ""}`, body: `${due.requiredNote ? `${due.requiredNote} ` : "Set by your school. "}${length(due.hours)}, ${due.format.toLowerCase()} — stop whenever you like and carry on from the same lesson. The school sees that you finished, not your answers.`, acts: [{ label: due.done ? "Continue it" : "Start it", href: courseHref(due.id) }] }]) : null,
      v.required.length || v.inProgress.length ? row("1fr", [courseList("Continue where you left off", "Required first, then what you started.", [...v.required, ...v.inProgress])]) : null,
      v.recommended.length ? row("1fr", [courseList("Recommended for you", "Chosen from your own subjects, deadlines and certificates — each one says why.", v.recommended.map((entry) => entry.course), why)]) : null,
      row("1.15fr 1fr", [
        v.pathways.length
          ? { type: "list", title: "Pathways your school sets out", sub: "Each level is a set of courses; finish them all and you have completed it.", items: v.pathways.map((pathway) => ({ label: pathway.name, sub: `${pathway.done} of ${pathway.total} courses · ${pathway.titles.join(", ")}`, pill: pathway.done === pathway.total ? "Complete" : pathway.done ? "In progress" : "Not started", tone: (pathway.done === pathway.total ? "positive" : pathway.done ? "progress" : "neutral") as PanelTone, viewLabel: "Open", href: "/training/catalogue" })) }
          : { type: "note", tone: "neutral", icon: EYE, title: "Your school has not set out a pathway", body: "A pathway groups courses into levels a teacher works through. When the school defines one, your progress through it appears here." },
        {
          type: "facts", title: "Who sees what", per: 1, sub: "Your learning is yours. The school sees what it needs, nothing more.",
          facts: [
            ["Courses finished and certificates", "Your school", "On your staff record · counts in your appraisal"],
            ["Required courses", "Set by your school", "They arrive here and on My Day the moment they are assigned"],
            ["Your answers and attempts", "Only you", "Nobody marks you on a practice question"],
            ["If you leave", "Every certificate stays yours", "Each one has a code anyone can verify"],
          ] as PanelFact[],
        },
      ]),
    ].filter(Boolean) as PanelRow[]),
  };
}

function catalogueTab(v: Catalogue, query: Record<string, string | undefined>): TabContent {
  if (!v.courses.length) return noCourses("Catalogue", "Pick a section, then a course.");
  const sec = v.sections.includes(query.sec ?? "") ? (query.sec as string) : "All";
  const list = v.courses.filter((course) => sec === "All" || course.section === sec);
  const cards = [{ name: "All", sub: "Every course open to you", count: v.courses.length }, ...v.sections.map((name) => ({ name, sub: v.courses.filter((course) => course.section === name).length ? "Written for you" : "None for your role yet", count: v.courses.filter((course) => course.section === name).length }))].filter((card) => card.name === "All" || card.count > 0);
  const rows: TableRow[] = list.map((course) => ({
    keywords: `${course.title} ${course.provider} ${course.section}`, href: courseHref(course.id),
    cells: [
      { kind: "name", name: course.title, sub: `${course.certificateName}${course.required && !course.completed ? ` · required${course.requiredBy ? ` by ${day(course.requiredBy)}` : ""}` : ""}`, avatar: false }, cell(course.provider), cell(length(course.hours)), cell(course.format), pill(course.state, stateTone(course.state, course.required)),
      { kind: "action", label: course.completed ? "Review" : course.done ? "Continue" : "Start", href: courseHref(course.id) },
    ] as TableCellKind[],
  }));
  return {
    title: "Catalogue", desc: "Pick a section, then a course. Every course here was written by your school.", launchers: [{ label: "Suggest a course", drawer: suggest }],
    rows: [
      row("1fr", [{ type: "tiles", title: "Sections", per: 4, tiles: cards.map((card) => ({ label: card.name, sub: `${card.count} ${card.count === 1 ? "course" : "courses"} · ${card.sub}`, tone: (card.name === sec ? "positive" : "neutral") as PanelTone, href: `/training/catalogue?sec=${encodeURIComponent(card.name)}` })) }]),
      row("1fr", [{ type: "table", title: sec === "All" ? "Every course" : sec, sub: "Required first, then the ones that fit your work.", meta: `${list.length} course${list.length === 1 ? "" : "s"}`, noun: "course", nounPlural: "courses", search: "Find a course, a provider or a topic", head: ["Course", "Provider", "Length", "Format", "State", ""], rows, per: 12, noRowOpen: false, empty: "Nothing in this section.", foot: "Paid courses from outside providers are not offered here yet." }]),
    ],
  };
}

function certificatesTab(v: Certificates): TabContent {
  const exp = v.certificates.filter((cert) => cert.state === "Expiring" || cert.state === "Expired");
  const addExt: DrawerSpec = {
    mode: "form", kicker: "Training", title: "Add a certificate from elsewhere", sub: "A qualification you earned outside this school. The office verifies it before it counts.",
    commitLabel: "Send for verification", commitDone: "Sent for verification", commitDoneBody: "The office checks it. It appears here as Pending until then.", reviewNote: "This goes to the school office to verify against the photo you attach.",
    fields: [
      text("Certificate", { required: true, span: 2, placeholder: "e.g. Postgraduate Diploma in Education" }), text("Issued by", { required: true, placeholder: "The awarding body" }), text("Issued on", { type: "date", required: true }),
      text("Expires", { type: "date", optional: true, hint: "Leave blank if it does not expire." }), text("CPD hours", { optional: true, placeholder: "e.g. 12" }),
      { label: "Photo of the certificate", kind: "asset", options: ["No photo", "Attach a photo", "Remove it"], span: 2 } as FormField,
    ],
    submit: { endpoint: `${API}/learning/certificates`, method: "POST", map: { Certificate: "name", "Issued by": "issuedBy", "Issued on": "issuedOn", Expires: "expiresOn", "CPD hours": "hours", "Photo of the certificate": "evidence" } },
  };
  const viewOf = (cert: Cert): DrawerSpec => ({
    mode: "view", readOnly: true, kicker: cert.external ? "Certificate · from elsewhere" : "Certificate", title: cert.name,
    facts: [["Held by", v.holder, v.school], ["Issued by", cert.by, cert.issued], ["Valid until", cert.expires, cert.state === "Expiring" ? "Renew it before it lapses" : ""], ["CPD", length(cert.hours), "Counts towards this year’s hours while valid"], ["Verification code", cert.code, "Anyone can check it at /api/v1/learning/verify/" + cert.code], ["State", cert.state, cert.note ?? (cert.state === "Pending" ? "Waiting for the office to verify it" : "")]],
  });
  const rows: TableRow[] = v.certificates.map((cert) => ({
    keywords: `${cert.name} ${cert.by}`,
    cells: [{ kind: "name", name: cert.name, sub: `${length(cert.hours)} of CPD`, avatar: false }, cell(cert.by), cell(cert.issued), cell(cert.expires), cell(cert.code, { mono: true }), pill(cert.state, cert.state === "Valid" ? "positive" : cert.state === "Pending" ? "progress" : "attention"), { kind: "action", label: cert.state === "Pending" ? "Details" : "View", drawer: viewOf(cert) }] as TableCellKind[],
  }));
  return {
    title: "Certificates", desc: "Everything you have earned, with a code anyone can verify. Each one is on your staff record and stays yours.",
    primary: { label: "Add a certificate from elsewhere", icon: PLUS, drawer: addExt },
    rows: ([
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "Certificates", value: String(v.certificates.length), sub: `${v.certificates.filter((cert) => !cert.external).length} from your school · ${v.certificates.filter((cert) => cert.external).length} from elsewhere` },
          { label: "Expiring soon", value: String(exp.length), sub: exp.length ? `${exp[0]!.name} · ${exp[0]!.expires}` : "Nothing to renew", tone: exp.length ? "attention" : "positive" },
          { label: "CPD this year", value: String(v.cpd.hours), unit: "hours", sub: v.cpd.target !== null ? `Of the school’s ${v.cpd.target}` : "The school has not set an expectation" },
          { label: "On your staff record", value: "All", sub: "Valid certificates are seen by the school office", tone: "positive" },
        ],
      }]),
      exp.length ? row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: `${exp[0]!.name} ${exp[0]!.state === "Expired" ? "has expired" : `expires on ${exp[0]!.expires}`}`, body: "Renew it before it lapses and the new certificate replaces this one on your record." }]) : null,
      row("1fr", [{ type: "table", title: "Your certificates", sub: "Open one for its code, which anyone can check.", noun: "certificate", nounPlural: "certificates", search: v.certificates.length > 4 ? "Find a certificate" : undefined, head: ["Certificate", "Issued by", "Issued", "Expires", "Code", "State", ""], rows, per: 10, noRowOpen: true, empty: "You have no certificate yet. Finish a course, or add one you earned elsewhere.", foot: "Certificates are yours — they stay with you if you leave." }]),
    ].filter(Boolean) as PanelRow[]),
  };
}

/* ───────────────────────── a course, and a lesson in it ───────────────────────── */

export function coursePage(c: CoursePage): TabContent & { crumb: { label: string; href: string } } {
  const nextLesson = c.lessons.find((lesson) => !lesson.done);
  const rows: TableRow[] = c.lessons.map((lesson) => ({
    keywords: lesson.title,
    cells: [cell(String(lesson.position), { mono: true }), { kind: "name", name: lesson.title, sub: lesson.summary, avatar: false }, cell(`${lesson.minutes} min`), pill(lesson.done ? "Done" : lesson === nextLesson ? "Next" : "Not started", lesson.done ? "positive" : lesson === nextLesson ? "progress" : "neutral"), lesson.done || lesson === nextLesson ? { kind: "action", label: lesson.done ? "Review" : "Open", href: lessonHref(c.id, lesson.position) } : cell("")] as TableCellKind[],
  }));
  return {
    crumb: { label: "Back to Training", href: "/training/for-you" },
    title: c.title, desc: `${c.provider} · ${length(c.hours)} · ${c.format} · ${c.lessons.length} lessons, each with a short check`,
    primary: c.completed && c.certificate ? { label: "View the certificate", icon: EYE, href: "/training/certificates" } : nextLesson ? { label: `${c.done ? "Continue" : "Start"} · lesson ${nextLesson.position}`, icon: ARROW, href: lessonHref(c.id, nextLesson.position) } : undefined,
    rows: ([
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "Progress", value: `${c.done} of ${c.lessons.length}`, unit: "lessons", sub: c.completed ? "Finished" : nextLesson ? `Next: ${nextLesson.title}` : "", tone: c.completed ? "positive" : "progress" },
          { label: "Time", value: length(c.hours), sub: c.format === "Self-paced" ? "At your own pace, on any device" : c.format },
          { label: "Earns", value: c.certificateName, sub: `${c.validMonths ? `Valid ${c.validMonths} months` : "Does not expire"} · ${length(c.hours)} of CPD`, tone: "positive" },
          c.required ? { label: "Required by", value: c.required.by ? day(c.required.by) : "Your school", sub: c.required.note ?? "Set by your school", tone: c.completed ? "positive" : "attention" } : { label: "Offered by", value: c.provider, sub: "Written by your school" },
        ],
      }]),
      c.completed && c.certificate ? row("1fr", [{ type: "note", tone: "positive", icon: CHECK, title: `Certificate issued · ${c.certificate.code}`, body: `${c.certificate.name}, issued ${c.certificate.issued}. It is on your staff record and in Certificates.` }]) : null,
      row("1.4fr 1fr", [
        { type: "table", title: "Lessons", sub: "Each ends with one question. Answer it correctly to finish the lesson — as many tries as you like.", noun: "lesson", nounPlural: "lessons", head: ["#", "Lesson", "Time", "State", ""], rows, per: 0, noRowOpen: true },
        { type: "facts", title: "You will be able to", per: 1, facts: (c.outcomes.length ? c.outcomes : ["The school has not listed outcomes for this course."]).map((outcome, index): PanelFact => [`Outcome ${index + 1}`, outcome, ""]) },
      ]),
      c.task ? row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "Try it in your own classroom", body: c.task }]) : null,
    ].filter(Boolean) as PanelRow[]),
  };
}

export function lessonPage(p: LessonPage): TabContent & { crumb: { label: string; href: string } } {
  const { course, lesson, outline } = p;
  const answer: DrawerSpec = {
    mode: "form", kicker: `Lesson ${lesson.position} of ${course.lessonsTotal}`, title: "Check your understanding", sub: lesson.question,
    commitLabel: "Check my answer", commitDone: lesson.position === course.lessonsTotal ? "Correct — course complete" : "Correct", commitDoneBody: lesson.position === course.lessonsTotal ? "Your certificate is on your staff record and in Certificates." : "The lesson is marked done. Carry on to the next one.",
    fields: [choice("Your answer", lesson.options, { span: 2, required: true, value: "" })] as FormField[],
    submit: { endpoint: `${API}/learning/courses/${course.id}/lessons/${lesson.position}/answer`, method: "POST", map: { "Your answer": "choice" }, encode: { "Your answer": Object.fromEntries(lesson.options.map((option, index) => [option, String(index)])) } },
  };
  const next = outline.find((entry) => !entry.done && entry.position !== lesson.position);
  return {
    crumb: { label: "Back to the course", href: courseHref(course.id) },
    title: `Lesson ${lesson.position} · ${lesson.title}`, desc: `${course.title} · ${lesson.minutes} minutes`,
    primary: lesson.done ? (lesson.position < course.lessonsTotal ? { label: "Next lesson", icon: ARROW, href: lessonHref(course.id, lesson.position + 1) } : { label: "Back to the course", icon: ARROW, href: courseHref(course.id) }) : { label: "Check my answer", icon: CHECK, drawer: answer },
    launchers: lesson.done ? [] : next ? [{ label: "Save and leave", href: courseHref(course.id) }] : [{ label: "Save and leave", href: courseHref(course.id) }],
    rows: [
      row("1fr", [{ type: "note", tone: lesson.done ? "positive" : "neutral", icon: lesson.done ? CHECK : EYE, title: lesson.title, body: lesson.body }]),
      row("1.3fr 1fr", [
        { type: "facts", title: "The question", per: 1, sub: lesson.done ? "You have answered this correctly." : "Answer it correctly to finish the lesson — as many tries as you like.", facts: [["Question", lesson.question, ""], ...lesson.options.map((option, index): PanelFact => [String.fromCharCode(65 + index), option, ""])] },
        { type: "list", title: "In this course", sub: `${course.done} of ${course.lessonsTotal} lessons · ${length(course.hours * course.done / Math.max(1, course.lessonsTotal))} of CPD so far`, items: outline.map((entry) => ({ label: `${entry.position}. ${entry.title}`, sub: `${entry.minutes} min`, pill: entry.done ? "Done" : entry.position === lesson.position ? "Now" : "", tone: (entry.done ? "positive" : "progress") as PanelTone, ...(entry.done || entry.position === lesson.position ? { href: lessonHref(course.id, entry.position), viewLabel: "Open" } : {}) })) },
      ]),
      row("1fr", [{ type: "facts", title: "About this course", per: 3, facts: [["Earns", course.certificateName, `${course.provider}`], ["Required by", course.required ? (course.required.by ? day(course.required.by) : "Your school") : "Not required", ""], ["Your school sees", "That you finished", "Not your answers"]] as PanelFact[] }]),
    ],
  };
}
