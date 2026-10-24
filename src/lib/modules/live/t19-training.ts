import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, text } from "@/lib/modules/live/m7-forms";
import type { CourseCard, DocumentSpec, DrawerSpec, FormField, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow, TrayItem } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * M19 for a teaching person: Training. Courses written by their school, fitted to the work they do — some free, some bought from an outside
 * provider by the teacher or the school. Each lesson ends in one question; the certificate at the end is theirs, with a code anyone can
 * check. The school sees that a course was finished, never the answers.
 */

const API = "/api/v1/teacher-workspace";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const PLUS = "M12 5.5v13M5.5 12h13";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const CHECK = "m4.5 12.5 4.5 4.5 9-10";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const CART = "M4 5h2l1.6 9.5h9.8L19.5 8H7M10 19.2h.01M16 19.2h.01";
/** The icon each section carries on its card. */
const SECTION_CARD_ICON: Record<string, string> = {
  All: "tiles", "School courses": "building", "Safeguarding and welfare": "shield", "Teaching practice": "book", "Subject knowledge": "bulb", Assessment: "doc", "Digital skills": "device", Leadership: "crown",
};
const SECTION_NOTE: Record<string, string> = {
  "School courses": "Written by your school, free, and set as required where it needs everyone to have done them",
  "Safeguarding and welfare": "Keeping children safe, and what to do when something is wrong",
  "Teaching practice": "Planning, delivery and managing a class day to day",
  "Subject knowledge": "Deeper knowledge of the subjects you teach",
  Assessment: "Setting, marking and moderating work, and what the results tell you",
  "Digital skills": "Tools and habits for teaching with technology",
  Leadership: "For heads of department and others who lead colleagues",
};
const SECTION_ICON: Record<string, string> = {
  "School courses": "M3.5 19.5h17M6 19.5v-8h12v8M9 11.5V8a3 3 0 0 1 6 0v3.5",
  "Safeguarding and welfare": "M12 3.5 5 6.5v5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9v-5z",
  "Teaching practice": "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5",
  "Subject knowledge": "M9 3.5v6L4.5 18a1.8 1.8 0 0 0 1.6 2.5h11.8a1.8 1.8 0 0 0 1.6-2.5L15 9.5v-6M8 3.5h8",
  Assessment: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3",
  "Digital skills": "M4 5.5h16v10H4zM9 19.5h6M12 15.5v4",
  Leadership: "M12 4 3.5 8 12 12l8.5-4zM6 10.5v4.8c0 1.7 2.7 3.2 6 3.2s6-1.5 6-3.2v-4.8",
};

export type Course = { id: string; title: string; summary: string | null; section: string; provider: string; hours: number; format: string; certificateName: string; validMonths: number | null; pathway: string | null; lessons: number; done: number; completed: boolean; state: string; price?: number | null; priceLabel?: string; free?: boolean; owned?: boolean; purchase?: { state: string; payer: string; decision: string | null } | null; required: boolean; requiredBy: string | null; requiredNote: string | null; dueDays: number | null; outcomes: string[] };
type Cert = { id: string; name: string; by: string; issued: string; issuedAt: string; expires: string; expiresAt: string | null; days: number | null; hours: number; code: string; state: string; external: boolean; courseId: string | null; note: string | null };
type Home = { persona: string; cpd: { hours: number; target: number | null }; required: Course[]; inProgress: Course[]; recommended: Array<{ course: Course; why: string }>; pathways: Array<{ name: string; total: number; done: number; titles: string[] }>; certificates: number; expiring: Cert | null; total: number; completed: number };
type Catalogue = { sections: string[]; courses: Course[] };
export type Basket = {
  basket: Array<{ id: string; courseId: string; title: string; provider: string; hours: number; price: number; priceLabel: string }>;
  total: number; totalLabel: string;
  history: Array<{ id: string; courseId: string; title: string; provider: string; state: string; payer: string; priceLabel: string; decision: string | null; requestedAt: string | null; decidedAt: string | null }>;
};
type Certificates = { cpd: { hours: number; target: number | null }; holder: string; holderRole: string; school: string; letterhead: { name: string; place?: string; contact?: string }; signatory: { name: string; role: string } | null; certificates: Cert[] };
export type CoursePage = {
  id: string; title: string; summary: string | null; provider: string; hours: number; format: string; certificateName: string; validMonths: number | null; outcomes: string[]; task: string | null;
  owned: boolean; price: number | null; priceLabel: string; purchase: { state: string; payer: string; decision: string | null } | null; why: string | null;
  required: { by: string | null; note: string | null } | null; lessons: Array<{ position: number; title: string; minutes: number; summary: string; done: boolean }>; done: number; completed: boolean; certificate: Cert | null;
};
export type LessonPage = { preview?: boolean; course: { id: string; title: string; task: string | null; hours: number; certificateName: string; provider: string; required: { by: string | null; note: string | null } | null; lessonsTotal: number; done: number }; outline: Array<{ position: number; title: string; minutes: number; done: boolean }>; lesson: { position: number; title: string; minutes: number; body: string; question: string; options: string[]; done: boolean } };

const length = (hours: number) => (hours < 1 ? `${Math.round(hours * 60)} min` : Number.isInteger(hours) ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `${Math.floor(hours)} h ${Math.round((hours % 1) * 60)} min`);
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "");
const stateTone = (state: string, required: boolean): PanelTone => (state === "Completed" ? "positive" : required || state === "Required" ? "attention" : state === "In progress" ? "progress" : "neutral");
/** Prices arrive in kobo; nothing here ever holds money as a float. */
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const embed = (component: string, props: Record<string, unknown>): PanelRow => row("1fr", [{ type: "embed", component, props }]);

export const courseHref = (id: string) => `/training/catalogue/${id}`;
export const lessonHref = (id: string, position: number) => `/training/catalogue/${id}/lessons/${position}`;
export const checkoutHref = "/training/catalogue/checkout";
export const loadCourse = (id: string) => apiGet<CoursePage>(`${API}/learning/courses/${id}`);
export const loadLesson = (id: string, position: string) => apiGet<LessonPage>(`${API}/learning/courses/${id}/lessons/${position}`);
export const loadBasket = () => apiGet<Basket>(`${API}/learning/basket`);

export async function teacherTrainingTab(tabSlug: string, query: Record<string, string | undefined>, me?: TeacherWorkspaceView): Promise<TabContent | null | undefined> {
  void me;
  if (tabSlug === "for-you") return forYouTab(await apiGet<Home>(`${API}/learning/home`));
  if (tabSlug === "catalogue") {
    const [cat, basket] = await Promise.all([
      apiGet<Catalogue>(`${API}/learning/catalogue`),
      loadBasket().catch(() => ({ basket: [], total: 0, totalLabel: "₦0", history: [] } as Basket)),
    ]);
    return catalogueTab(cat, basket, query);
  }
  if (tabSlug === "certificates") return certificatesTab(await apiGet<Certificates>(`${API}/learning/certificates`));
  return undefined;
}

/* ───────────────────────── drawers ───────────────────────── */

/** Putting a paid course in the basket: the price is what the person is agreeing to, so it is shown back before anything is recorded. */
const addToBasket = (course: { id: string; title: string; certificateName: string; provider: string; hours: number; priceLabel?: string }): DrawerSpec => ({
  mode: "commit", kicker: "Catalogue", title: `Add ${course.title} to your basket`,
  sub: "Nothing is bought yet. You settle the basket in one go, either by asking the school to fund it or by recording a payment you made to the provider yourself.",
  facts: [
    ["Course", course.title, course.certificateName],
    ["Provider", course.provider, length(course.hours)],
    ["Price", course.priceLabel ?? "—", "Held at this figure even if the provider changes it later"],
  ],
  commitLabel: "Add to basket", commitDone: "In your basket", commitDoneBody: "Settle it from the basket when you are ready.",
  next: { label: "Go to the basket", href: checkoutHref },
  submit: { endpoint: `${API}/learning/basket/${course.id}`, method: "POST" },
});

const addManyToBasket: DrawerSpec = {
  mode: "commit", kicker: "Catalogue", title: "Add the selected courses to your basket",
  sub: "Free courses in the selection are left out — they open straight from the catalogue. Nothing is bought yet.",
  commitLabel: "Add to basket", commitDone: "In your basket", commitDoneBody: "Settle it from the basket when you are ready.",
  next: { label: "Go to the basket", href: checkoutHref },
  submit: { endpoint: `${API}/learning/basket`, method: "POST" },
};

const suggest: DrawerSpec = {
  mode: "form", kicker: "Training", title: "Suggest a course", sub: "It goes to the staff development lead. If enough colleagues ask for the same thing, it is commissioned.",
  commitLabel: "Send the suggestion", commitDone: "Suggestion sent", commitDoneBody: "Thank you — it is on the list the school reads when it plans training.",
  fields: [text("What you want to learn", { required: true, span: 2, placeholder: "e.g. Teaching phonics to older readers" }), area("Why it would help your teaching", { span: 2, optional: true })] as FormField[],
  submit: { endpoint: `${API}/learning/suggestions`, method: "POST", map: { "What you want to learn": "topic", "Why it would help your teaching": "why" } },
};

function noCourses(title: string, desc: string): TabContent {
  return { title, desc, launchers: [{ label: "Suggest a course", drawer: suggest }], rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "Your school has not published a course for your work yet", body: "Courses are written by the school and fitted to the work its staff do. When one is published for you, it appears here with what it earns. You can suggest one now." }])] };
}

/* ───────────────────────── For you ───────────────────────── */

const cardOf = (course: Course, why?: string): CourseCard => {
  const owned = course.owned !== false;
  const total = course.lessons;
  const pct = owned && total ? Math.round((course.done / total) * 100) : undefined;
  return {
    title: course.title, meta: `${course.provider} · ${length(course.hours)} · ${course.format}${course.required && !course.completed && course.requiredBy ? ` · due ${day(course.requiredBy)}` : ""}`,
    icon: SECTION_ICON[course.section], pill: course.required && !course.completed ? "Required" : course.state, tone: owned ? stateTone(course.state, course.required) : course.purchase?.state === "DECLINED" ? "negative" : course.purchase ? "progress" : "neutral",
    why, pct, progress: owned ? (course.completed ? "Certificate issued" : `${course.done} of ${total} lessons`) : course.free === false ? `${course.priceLabel ?? ""} · opens once it is paid for` : undefined,
    cta: !owned ? "Open" : course.completed ? "Review" : course.done ? "Continue" : "Start", href: courseHref(course.id),
  };
};

function forYouTab(v: Home): TabContent {
  if (!v.total) return noCourses("Training", "Courses that fit the work you already do, and certificates your school recognises.");
  const next = v.required[0] ?? v.inProgress[0] ?? v.recommended[0]?.course ?? null;
  const due = v.required[0] ?? null;
  const L = v.cpd.target;
  const going = [...v.required, ...v.inProgress.filter((course) => !v.required.some((entry) => entry.id === course.id))];
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
          { label: "Certificates", value: String(v.certificates), sub: v.expiring ? `${v.expiring.name} ${v.expiring.state === "Expired" ? "has expired" : `expires ${v.expiring.expires}`}` : "All current", tone: v.expiring ? "attention" : "positive", link: "View them", href: "/training/certificates" },
        ],
      }]),
      due ? row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: `${due.title} is required${due.requiredBy ? ` by ${day(due.requiredBy)}` : ""}${due.dueDays !== null ? ` · ${due.dueDays < 0 ? `${-due.dueDays} days overdue` : `${due.dueDays} days`}` : ""}`, body: `${due.requiredNote ? `${due.requiredNote} ` : "Set by your school. "}${length(due.hours)}, ${due.format.toLowerCase()} — stop whenever you like and carry on from the same lesson. The school sees that you finished, not your answers.`, acts: [{ label: due.done ? "Continue it" : "Start it", href: courseHref(due.id) }] }]) : null,
      going.length ? row("1fr", [{ type: "courses", title: "Continue where you left off", sub: "Required first, then what you started.", cards: going.map((course) => cardOf(course)) }]) : null,
      v.recommended.length ? row("1fr", [{ type: "courses", title: "Recommended for you", sub: "Chosen from your own classes, results and deadlines — each one says why.", cards: v.recommended.map((entry) => cardOf(entry.course, entry.why)) }]) : null,
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

/* ───────────────────────── Catalogue ───────────────────────── */

const bandOf = (hours: number) => (hours < 2 ? "Under 2 hours" : hours <= 3 ? "2 – 3 hours" : "4 hours or more");

function catalogueTab(v: Catalogue, b: Basket, query: Record<string, string | undefined>): TabContent {
  if (!v.courses.length) return noCourses("Catalogue", "Pick a section, then a course.");
  const sec = v.sections.includes(query.sec ?? "") ? (query.sec as string) : "All";
  const list = v.courses.filter((course) => sec === "All" || course.section === sec);
  const isFree = (course: Course) => course.free !== false;
  const owns = (course: Course) => course.owned !== false;
  const from = (members: Course[]) => {
    const paid = members.filter((course) => !isFree(course) && typeof course.price === "number").map((course) => course.price as number);
    if (!members.length) return "None for your role yet";
    if (!paid.length) return "Free";
    return paid.length === members.length ? `From ${naira(Math.min(...paid))}` : `Free, or from ${naira(Math.min(...paid))}`;
  };
  const sections = [{ name: "All", sub: "Every course open to you", members: v.courses }, ...v.sections.map((name) => ({ name, sub: "", members: v.courses.filter((course) => course.section === name) }))]
    .filter((card) => card.name === "All" || card.members.length > 0);
  const sectionIcon = (name: string) => SECTION_CARD_ICON[name] ?? "tiles";
  const cards = sections.map((card) => ({
    label: card.name, value: String(card.members.length), unit: card.members.length === 1 ? "course" : "courses", sub: card.name === "All" ? card.sub : from(card.members),
    tone: card.name === sec ? ("progress" as PanelTone) : undefined, icon: sectionIcon(card.name),
  }));
  const inBasket = new Set(b.basket.map((entry) => entry.courseId));
  const tray = sections.map((card): TrayItem => {
    const members = card.members;
    const due = members.filter((course) => course.required && !course.completed);
    const prices = members.filter((course) => !isFree(course) && typeof course.price === "number").map((course) => course.price as number).sort((x, y) => x - y);
    const providers = [...new Set(members.map((course) => course.provider).filter(Boolean))];
    const range = !prices.length ? "Free" : `${prices.length < members.length ? "Free – " : ""}${naira(prices[0]!)}${prices.length > 1 && prices[0] !== prices[prices.length - 1] ? ` – ${naira(prices[prices.length - 1]!)}` : ""}`;
    const buyable = members.filter((course) => !owns(course) && !isFree(course) && !inBasket.has(course.id) && !course.purchase);
    const queued = members.filter((course) => inBasket.has(course.id));
    const total = buyable.reduce((sum, course) => sum + (course.price ?? 0), 0);
    const one = buyable.length === 1 ? buyable[0]! : null;
    return {
      label: card.name === "All" ? "All courses" : card.name, desc: card.name === "All" ? card.sub : SECTION_NOTE[card.name], count: members.length, on: card.name === sec,
      flag: due.length > 0, flagTone: "due", href: `/training/catalogue?sec=${encodeURIComponent(card.name)}`,
      facts: !members.length ? [["", "Nothing for your role yet"]] : [
        ...(due.length ? [["Due", `${due.length} required${due[0]!.requiredBy ? ` · by ${day(due[0]!.requiredBy)}` : ""}`, "due"] as [string, string, "due"]] : []),
        ["Price", range], ["Awarded by", providers.length > 2 ? `${providers.length} providers` : providers.join(", ") || "Your school"],
      ],
      cta: card.name === "All" ? undefined
        : one ? { label: `Add to basket · ${naira(total)}`, drawer: addToBasket({ id: one.id, title: one.title, certificateName: one.certificateName, provider: one.provider, hours: one.hours, priceLabel: one.priceLabel }) }
        : buyable.length ? { label: `Add all ${buyable.length} · ${naira(total)}`, drawer: { ...addManyToBasket, submit: { ...addManyToBasket.submit!, body: { courseIds: buyable.map((course) => course.id) } } } }
        : queued.length ? { label: `Checkout · ${queued.length} in basket`, href: checkoutHref } : undefined,
    };
  });
  const priceBand = (course: Course) => (isFree(course) ? "Free" : "Paid");
  const rows: TableRow[] = list.map((course) => ({
    id: course.id, keywords: `${course.title} ${course.provider} ${course.section} len:${bandOf(course.hours)}| fmt:${course.format}| price:${priceBand(course)}| st:${course.state}|`, href: courseHref(course.id),
    cells: [
      { kind: "name", name: course.title, sub: `${course.certificateName}${course.required && !course.completed ? ` · required${course.requiredBy ? ` by ${day(course.requiredBy)}` : ""}` : ""}`, avatar: false },
      cell(course.provider), cell(length(course.hours)), cell(course.format),
      isFree(course) ? pill("Free", "positive") : cell(course.priceLabel ?? "—", { mono: true }),
      pill(course.state, owns(course) ? stateTone(course.state, course.required) : course.purchase?.state === "DECLINED" ? "negative" : course.purchase ? "progress" : "neutral"),
      owns(course)
        ? { kind: "action", label: course.completed ? "Review" : course.done ? "Continue" : "Start", href: courseHref(course.id) }
        : course.purchase?.state === "BASKET"
          ? { kind: "action", label: "In your basket", href: checkoutHref }
          : course.purchase?.state === "REQUESTED"
            ? cell("Waiting on the school", { tone: "neutral" })
            : { kind: "action", label: "Add to basket", drawer: addToBasket({ id: course.id, title: course.title, certificateName: course.certificateName, provider: course.provider, hours: course.hours, priceLabel: course.priceLabel }) },
    ] as TableCellKind[],
  }));
  const states = [...new Set(list.map((course) => course.state))];
  const formats = [...new Set(list.map((course) => course.format))];
  const settled = query.settled === "SCHOOL" ? { tone: "positive" as PanelTone, title: "Sent to the school", body: "Whoever manages staff development will decide it, and you will be told either way. The courses open if it is approved." } : query.settled === "SELF" ? { tone: "positive" as PanelTone, title: "Payment recorded", body: "The courses are open, and the reference is on your record for the office to check." } : null;
  return {
    title: "Catalogue", desc: "Pick a section, then a course. Your school’s own courses are free; the rest are paid by you or by the school.",
    primary: b.basket.length ? { label: `Checkout · ${b.basket.length} ${b.basket.length === 1 ? "course" : "courses"}`, icon: CART, href: checkoutHref } : undefined,
    launchers: [{ label: "Suggest a course", drawer: suggest }],
    rows: [
      ...(settled ? [row("1fr", [{ type: "note" as const, tone: settled.tone, icon: CHECK, title: settled.title, body: settled.body }])] : []),
      row("1fr", [{ type: "kpi", title: "Sections", per: 6, cards }]),
      row("1fr", [{ type: "tray", items: tray }]),
      row("1fr", [{
        type: "table", title: sec === "All" ? "Every course" : sec, tag: `${list.length} ${list.length === 1 ? "course" : "courses"}`, tagTone: "neutral", sub: "Required first, then the ones that fit your work.", meta: `${list.length} course${list.length === 1 ? "" : "s"}`,
        noun: "course", nounPlural: "courses", search: "Find a course, a provider or a topic",
        filters: [
          { label: "Length", value: "All", options: ["All", "Under 2 hours", "2 – 3 hours", "4 hours or more"], match: Object.fromEntries(["Under 2 hours", "2 – 3 hours", "4 hours or more"].map((value) => [value, `len:${value}|`])) },
          { label: "Format", value: "All", options: ["All", ...formats], match: Object.fromEntries(formats.map((value) => [value, `fmt:${value}|`])) },
          { label: "Price", value: "All", options: ["All", "Free", "Paid"], match: { Free: "price:Free|", Paid: "price:Paid|" } },
          { label: "State", value: "All", options: ["All", ...states], match: Object.fromEntries(states.map((value) => [value, `st:${value}|`])) },
        ],
        selectable: true, bulkActs: [{ label: "Add to basket", primary: true, drawer: addManyToBasket, selection: { key: "courseIds", noun: "course" } }],
        head: ["Course", "Provider", "Length", "Format", "Price", "State", ""], rows, per: 12, noRowOpen: false, empty: "Nothing in this section.",
        foot: "Your school’s own courses are free. A course from an outside provider is paid for by you or by the school, and opens once it is settled.",
      }]),
      ...(b.history.length
        ? [row("1fr", [{
            type: "table" as const, title: "What you have asked for", sub: "Every request and purchase, and where each one got to.", meta: `${b.history.length}`, noun: "request", nounPlural: "requests",
            head: ["Course", "Provider", "Who pays", "Price", "State", "What was said"],
            rows: b.history.map((entry) => ({
              cells: [
                { kind: "name", name: entry.title, sub: entry.requestedAt ? day(entry.requestedAt) : "", avatar: false },
                cell(entry.provider), cell(entry.payer === "SELF" ? "You" : "The school"), cell(entry.priceLabel, { mono: true }),
                pill(entry.state === "REQUESTED" ? "Waiting" : entry.state === "APPROVED" ? "Approved" : entry.state === "DECLINED" ? "Not approved" : "Paid", entry.state === "DECLINED" ? "negative" : entry.state === "REQUESTED" ? "progress" : "positive"),
                cell(entry.decision ?? "—", { tone: "neutral" }),
              ] as TableCellKind[],
            })),
            per: 0, noRowOpen: true,
          }])]
        : []),
    ],
  };
}

/** The basket, settled: what is in it, and who pays. */
export function checkoutPage(b: Basket, email: string): TabContent & { crumb: { label: string; href: string } } {
  return {
    crumb: { label: "Back to the catalogue", href: "/training/catalogue" },
    title: "Checkout", desc: b.basket.length ? `${b.basket.length} ${b.basket.length === 1 ? "course" : "courses"} · ask the school to pay from its training budget, or record a payment you made yourself.` : "Your basket is empty.",
    rows: [embed("training-checkout", {
      basket: b.basket.map((entry) => ({ courseId: entry.courseId, title: entry.title, provider: entry.provider, hours: length(entry.hours), priceLabel: entry.priceLabel })),
      totalLabel: b.totalLabel, email, base: `${API}/learning`, back: "/training/catalogue",
    })],
  };
}

/* ───────────────────────── Certificates ───────────────────────── */

const certTone = (state: string): PanelTone => (state === "Valid" ? "positive" : state === "Pending" ? "progress" : "attention");

function certificatesTab(v: Certificates): TabContent {
  const exp = v.certificates.filter((cert) => cert.state === "Expiring" || cert.state === "Expired");
  const addExt: DrawerSpec = {
    mode: "form", kicker: "Training", title: "Add a certificate from elsewhere", sub: "A qualification you earned outside this school. The office verifies it before it counts.",
    commitLabel: "Send for verification", commitDone: "Sent for verification", commitDoneBody: "The office checks it, usually within two working days. It appears here as Pending until then.", reviewNote: "This goes to the school office to verify against the photo you attach.",
    fields: [
      text("Certificate", { required: true, span: 2, placeholder: "e.g. Postgraduate Diploma in Education" }), text("Issued by", { required: true, placeholder: "The awarding body" }), text("Issued on", { type: "date", required: true }),
      text("Expires", { type: "date", optional: true, hint: "Leave blank if it does not expire." }), text("CPD hours", { optional: true, placeholder: "e.g. 12" }),
      { label: "Photo of the certificate", kind: "asset", options: ["No photo", "Attach a photo", "Remove it"], span: 2 } as FormField,
    ],
    submit: { endpoint: `${API}/learning/certificates`, method: "POST", map: { Certificate: "name", "Issued by": "issuedBy", "Issued on": "issuedOn", Expires: "expiresOn", "CPD hours": "hours", "Photo of the certificate": "evidence" } },
  };
  /** The certificate as a paper — the one a person prints, or shows. */
  const paper = (cert: Certificate): DrawerSpec => ({
    mode: "document", kicker: "Certificate", title: cert.name,
    doc: {
      heading: "Certificate", state: { label: cert.state, tone: certTone(cert.state) }, meta: `${v.holder} · ${cert.name}`, letterhead: v.letterhead, kicker: "CERTIFICATE", title: cert.name, ref: `Certificate ${cert.code}`,
      idents: [["Awarded to", v.holder], ["Role", `${v.holderRole}, ${v.school}`], ["Awarded by", cert.by], ["Issued", cert.issued], ["Valid until", cert.expires], ["CPD", length(cert.hours)]],
      blocks: [{ label: "This certifies that", body: `${v.holder} has completed ${cert.name}, ${length(cert.hours)} of professional development${cert.external ? ", awarded by " + cert.by + " and verified by " + v.school : ""}.`, by: v.signatory ? `${v.signatory.name}, ${v.signatory.role}` : undefined }],
      footNote: `Verify at /verify/${cert.code} — anyone with the code can confirm it is genuine.`, footRef: cert.code,
      acts: [{ label: "Print", print: true, primary: true }],
    } satisfies DocumentSpec,
  });
  const renew = (cert: Certificate): DrawerSpec | null => cert.courseId
    ? {
        mode: "commit", kicker: "Training", title: `Renew ${cert.name}`, sub: "You take the course again. The new certificate replaces this one on your record the moment you finish it; this one stays valid until then.",
        facts: [["Certificate", cert.name, cert.by], ["Now", cert.state === "Expired" ? "Expired" : `Expires ${cert.expires}`, ""], ["What it takes", "The course again, lesson by lesson", "Your earlier answers are not carried over"]],
        commitLabel: "Start the renewal", commitDone: "Renewal started", commitDoneBody: "The course is open from lesson 1.", next: { label: "Open the course", href: courseHref(cert.courseId) },
        submit: { endpoint: `${API}/learning/courses/${cert.courseId}/renew`, method: "POST" },
      }
    : null;
  const rows: TableRow[] = v.certificates.map((cert) => ({
    keywords: `${cert.name} ${cert.by} st:${cert.state}| by:${cert.by}|`,
    cells: [
      { kind: "name", name: cert.name, sub: `${length(cert.hours)} of CPD${cert.external ? " · from elsewhere" : ""}`, avatar: false }, cell(cert.by), cell(cert.issued), cell(cert.expires), cell(cert.code, { mono: true }), pill(cert.state, certTone(cert.state)),
      cert.state === "Pending"
        ? { kind: "action", label: "Details", drawer: { mode: "view", readOnly: true, kicker: "Certificate", title: cert.name, facts: [["Issued by", cert.by, cert.issued], ["State", "Waiting for the office to verify", "It counts towards your CPD once it is verified"]] } as DrawerSpec }
        : cert.state === "Not accepted"
          ? { kind: "action", label: "Why not?", drawer: { mode: "view", readOnly: true, kicker: "Certificate", title: cert.name, facts: [["State", "Not accepted by the office", cert.note ?? "No reason was recorded."]] } as DrawerSpec }
          : { kind: "action", label: "View", drawer: paper(cert) },
    ] as TableCellKind[],
  }));
  const first = exp[0];
  const firstRenew = first ? renew(first) : null;
  return {
    title: "Certificates", desc: "Everything you have earned, with a code anyone can verify. Each one is on your staff record and stays yours.",
    primary: { label: "Add a certificate from elsewhere", icon: PLUS, drawer: addExt },
    rows: ([
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "Certificates", value: String(v.certificates.length), sub: `${v.certificates.filter((cert) => !cert.external).length} from your school · ${v.certificates.filter((cert) => cert.external).length} from elsewhere` },
          { label: "Expiring soon", value: String(exp.length), sub: exp.length ? `${first!.name} · ${first!.expires}` : "Nothing to renew", tone: exp.length ? "attention" : "positive" },
          { label: "CPD this year", value: String(v.cpd.hours), unit: "hours", sub: v.cpd.target !== null ? `Of the school’s ${v.cpd.target}` : "The school has not set an expectation" },
          { label: "On your staff record", value: "All", sub: "Valid certificates are seen by the school office", tone: "positive" },
        ],
      }]),
      first ? row("1fr", [{
        type: "note", tone: "attention", icon: WARN, title: `${first.name} ${first.state === "Expired" ? "has expired" : `expires on ${first.expires}`}`,
        body: firstRenew ? "Renew it before it lapses and the new certificate replaces this one on your record." : "Renew it with the awarding body, then add the new certificate here — it replaces this one once the office has verified it.",
        acts: firstRenew ? [{ label: "Renew it", drawer: firstRenew }] : [{ label: "Add the new certificate", drawer: addExt }],
      }]) : null,
      row("1fr", [{
        type: "table", title: "Your certificates", sub: "Open one to print it, or to share its code, which anyone can check.", noun: "certificate", nounPlural: "certificates", search: v.certificates.length > 4 ? "Find a certificate" : undefined,
        filters: v.certificates.length > 2 ? [{ label: "State", value: "All", options: ["All", ...new Set(v.certificates.map((cert) => cert.state))], match: Object.fromEntries([...new Set(v.certificates.map((cert) => cert.state))].map((state) => [state, `st:${state}|`])) }, { label: "Issued by", value: "All", options: ["All", ...new Set(v.certificates.map((cert) => cert.by))], match: Object.fromEntries([...new Set(v.certificates.map((cert) => cert.by))].map((by) => [by, `by:${by}|`])) }] : undefined,
        head: ["Certificate", "Issued by", "Issued", "Expires", "Code", "State", ""], rows, per: 10, noRowOpen: true, empty: "You have no certificate yet. Finish a course and it appears here, with a code anyone can verify.", foot: "Certificates are yours. They stay with you if you leave.",
      }]),
    ].filter(Boolean) as PanelRow[]),
  };
}

type Certificate = Cert;

/* ───────────────────────── a course, and a lesson in it ───────────────────────── */

export function coursePage(c: CoursePage): TabContent & { crumb: { label: string; href: string } } {
  const nextLesson = c.owned ? c.lessons.find((lesson) => !lesson.done) : undefined;
  const rows: TableRow[] = c.lessons.map((lesson) => ({
    keywords: lesson.title,
    cells: [
      cell(String(lesson.position), { mono: true }), { kind: "name", name: lesson.title, sub: lesson.summary, avatar: false }, cell(`${lesson.minutes} min`),
      pill(!c.owned ? (lesson.position === 1 ? "Free to try" : "Locked") : lesson.done ? "Done" : lesson === nextLesson ? "Next" : "Not started", !c.owned ? (lesson.position === 1 ? "positive" : "neutral") : lesson.done ? "positive" : lesson === nextLesson ? "progress" : "neutral"),
      (c.owned && (lesson.done || lesson === nextLesson)) || (!c.owned && lesson.position === 1 && c.purchase?.state !== "DECLINED") ? { kind: "action", label: lesson.done ? "Review" : !c.owned ? "Try it" : "Open", href: lessonHref(c.id, lesson.position) } : cell(""),
    ] as TableCellKind[],
  }));
  const cert = c.certificate;
  const renewable = cert && c.completed && (cert.state === "Expiring" || cert.state === "Expired");
  const buy: DrawerSpec = addToBasket({ id: c.id, title: c.title, certificateName: c.certificateName, provider: c.provider, hours: c.hours, priceLabel: c.priceLabel });
  const renew: DrawerSpec | null = renewable ? {
    mode: "commit", kicker: "Training", title: `Renew ${cert!.name}`, sub: "You take the course again. The new certificate replaces this one on your record the moment you finish it.",
    commitLabel: "Start the renewal", commitDone: "Renewal started", commitDoneBody: "The course is open from lesson 1.", next: { label: "Open the course", href: courseHref(c.id) },
    submit: { endpoint: `${API}/learning/courses/${c.id}/renew`, method: "POST" },
  } : null;
  const primary = !c.owned
    ? c.purchase?.state === "BASKET" ? { label: "Go to the basket", icon: CART, href: checkoutHref } : c.purchase?.state === "REQUESTED" ? undefined : { label: `Add to basket · ${c.priceLabel}`, icon: CART, drawer: buy }
    : renew ? { label: "Renew this certificate", icon: ARROW, drawer: renew }
    : c.completed && c.certificate ? { label: "View the certificate", icon: EYE, href: "/training/certificates" }
    : nextLesson ? { label: `${c.done ? "Continue" : "Start"} · lesson ${nextLesson.position}`, icon: ARROW, href: lessonHref(c.id, nextLesson.position) } : undefined;
  return {
    crumb: { label: "Back to Training", href: "/training/for-you" },
    title: c.title, desc: `${c.provider} · ${length(c.hours)} · ${c.format} · ${c.lessons.length} lessons, each with a short check`, primary,
    launchers: !c.owned && c.lessons.length && c.purchase?.state !== "DECLINED" ? [{ label: "Try lesson 1 free", href: lessonHref(c.id, 1) }] : undefined,
    rows: ([
      row("1fr", [{
        type: "kpi", per: 5, title: c.title.split(" · ")[0],
        cards: [
          { label: "Progress", value: `${c.done} of ${c.lessons.length}`, unit: "lessons", sub: c.completed ? "Finished" : c.owned && nextLesson ? `Next: ${nextLesson.title}` : c.owned ? "" : "Opens once it is paid for", tone: c.completed ? "positive" : "progress" },
          { label: "Time", value: length(c.hours), sub: c.format === "Self-paced" ? "At your own pace, on any device" : c.format },
          c.owned
            ? { label: "Price", value: c.price ? c.priceLabel : "Free", sub: c.price ? "Paid · unlocked for you" : "No charge", tone: "positive" as PanelTone, icon: "bag" }
            : { label: "Price", value: c.priceLabel, sub: c.purchase?.state === "REQUESTED" ? "Waiting on the school’s decision" : c.purchase?.state === "DECLINED" ? "The school did not approve it" : c.purchase?.state === "BASKET" ? "In your basket" : "Lesson 1 is free to try", tone: c.purchase?.state === "DECLINED" ? "negative" as PanelTone : c.purchase?.state === "BASKET" ? "progress" as PanelTone : "attention" as PanelTone, icon: "bag" },
          { label: "Certificate", value: c.certificateName ? (c.completed ? "Issued" : "Included") : "None", sub: c.certificateName ? `${c.certificateName} · ${c.validMonths ? `valid ${c.validMonths} months` : "does not expire"}` : "Counts as CPD hours only", tone: c.certificateName ? "positive" : undefined, ...(c.completed && c.certificate ? { link: "View it", href: "/training/certificates" } : {}) },
          c.required ? { label: "Required by", value: c.required.by ? day(c.required.by) : "Your school", sub: c.required.note ?? "Set by your school", tone: c.completed ? "positive" : "attention" } : { label: "Offered by", value: c.provider, sub: c.provider ? "Open to staff whose work it is written for" : "Written by your school" },
        ],
      }]),
      !c.owned && c.purchase?.state === "DECLINED" ? row("1fr", [{ type: "note", tone: "negative", icon: WARN, title: "The school did not approve this one", body: c.purchase.decision ?? "No reason was recorded.", acts: [{ label: "Ask again", drawer: buy }] }]) : null,
      c.certificateName && !(c.completed && cert) ? row("1fr", [{ type: "note", tone: "progress", icon: CHECK, title: `You earn a certificate · ${c.certificateName}`, body: `Finish all ${c.lessons.length} lessons and answer each check correctly. It is awarded by ${c.provider || "your school"}, ${c.validMonths ? `stays valid for ${c.validMonths} months` : "never expires"}, adds ${length(c.hours)} of CPD to your staff record, and carries a code anyone can verify.${c.owned ? "" : " Buying the course unlocks it."}` }]) : null,
      c.why ? row("1fr", [{ type: "note", tone: "progress", icon: EYE, title: "Why this is recommended for you", body: c.why }]) : null,
      c.summary ? row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "What it is about", body: c.summary }]) : null,
      renewable ? row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: `${cert!.name} ${cert!.state === "Expired" ? "has expired" : `expires on ${cert!.expires}`}`, body: "Renew it before it lapses and the new certificate replaces this one on your record.", acts: [{ label: "Renew it", drawer: renew! }] }]) : null,
      c.completed && cert && !renewable ? row("1fr", [{ type: "note", tone: "positive", icon: CHECK, title: `Certificate issued · ${cert.code}`, body: `${cert.name}, issued ${cert.issued}. It is on your staff record and in Certificates.` }]) : null,
      row("1.4fr 1fr", [
        { type: "table", title: "Lessons", tag: c.owned ? (c.price ? "Paid" : "Free") : c.purchase?.state === "BASKET" ? "In your basket" : c.purchase?.state === "REQUESTED" ? "Asked for" : "Not bought yet", tagTone: c.owned ? ("positive" as PanelTone) : c.purchase?.state === "BASKET" ? ("progress" as PanelTone) : ("neutral" as PanelTone),
          acts: !c.owned && !c.purchase ? [{ label: `Buy course · ${c.priceLabel}`, primary: true, drawer: buy }] : !c.owned && c.purchase?.state === "BASKET" ? [{ label: "Checkout · in your basket", primary: true, href: checkoutHref }] : undefined,
          sub: c.owned ? "Each ends with one question. Answer it correctly to finish the lesson — as many tries as you like." : "Lesson 1 is free to try. The rest open once the course is paid for.", noun: "lesson", nounPlural: "lessons", head: ["#", "Lesson", "Time", "State", ""], rows, per: 0, noRowOpen: true, dense: true },
        { type: "facts", title: "You will be able to", per: 1, facts: (c.outcomes.length ? c.outcomes : ["The school has not listed outcomes for this course."]).map((outcome, index): PanelFact => [`Outcome ${index + 1}`, outcome, ""]) },
      ]),
    ].filter(Boolean) as PanelRow[]),
  };
}

export function lessonPage(p: LessonPage): TabContent & { crumb: { label: string; href: string } } {
  const { course, lesson, outline } = p;
  const required = course.required ? `${course.required.by ? day(course.required.by) : "Your school"}${course.required.note ? ` · ${course.required.note}` : ""}` : "Not required";
  return {
    crumb: { label: "Back to the course", href: courseHref(course.id) },
    title: `Lesson ${lesson.position} · ${lesson.title}`, desc: `${course.title} · ${lesson.minutes} minutes`,
    rows: [embed("lesson-player", {
      preview: p.preview ?? false, course, outline, lesson, progressLabel: `${length((course.hours * course.done) / Math.max(1, course.lessonsTotal))} of CPD so far`, requiredLabel: required,
      endpoint: `${API}/learning/courses/${course.id}/lessons/${lesson.position}/answer`,
      hrefs: { course: courseHref(course.id), lessons: `/training/catalogue/${course.id}/lessons`, certificates: "/training/certificates" },
    })],
  };
}
