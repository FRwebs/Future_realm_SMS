import { apiGet } from "@/lib/api/server";
import { dayLabel, dayLong, plural } from "@/lib/modules/live/m7-format";
import { addApplicationDrawer, addSessionDrawer, advanceDrawer, applicantContactDrawer, bulkDeclineDrawer, bulkOfferDrawer, declineDrawer, reopenDrawer, requestDocumentsDrawer, scheduleDrawer, SR } from "@/lib/modules/live/m8-forms";
import type { AdmissionOptions, AdmissionsBoard, Applicant, ApplicantRow, DiarySession, Stage } from "@/lib/modules/live/m8-types";
import { name as nameCell, pill, text, type KpiCard, type PanelTone, type StepItem, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Admissions: every applicant, where they are, and what moves them on. Each stage is a group of
 * real states in the admissions workflow, and every action goes through that workflow — so a
 * stage cannot be skipped from here any more than from anywhere else.
 */

export const STAGES: Stage[] = ["Enquiry", "Applied", "Assessed", "Offered", "Accepted", "Enrolled"];
const STAGE_SUB = ["Not yet applied", "Form and fee in", "Screening scored", "Letter issued", "Deposit received", "On the registry"];
const STAGE_TONE: Record<string, PanelTone> = { Enquiry: "neutral", Applied: "progress", Assessed: "progress", Offered: "submitted", Accepted: "positive", Enrolled: "positive", Declined: "negative", Waitlisted: "attention" };

export const loadBoard = () => apiGet<AdmissionsBoard>(`${SR}/admissions`);
export const loadAdmissionOptions = () => apiGet<AdmissionOptions>(`${SR}/admissions/options`);
export const loadApplicant = (id: string) => apiGet<Applicant>(`${SR}/admissions/${encodeURIComponent(id)}`);
export const loadPipeline = (state: string) => apiGet<{ state: string; rows: ApplicantRow[]; cycles: AdmissionsBoard["cycles"]; cycle: string }>(`${SR}/admissions/pipeline/${encodeURIComponent(state)}`);

export const applicantHref = (id: string) => `/student-records/admissions/${encodeURIComponent(id)}`;
export const pipelineHref = (state: string) => `/student-records/admissions/pipeline/${encodeURIComponent(state)}`;

const born = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const NEXT_WORD: Record<string, string> = {
  Enquiry: "Send the application form",
  Applied: "Book a screening seat",
  Assessed: "Decide on the offer",
  Offered: "Chase acceptance and deposit",
  Accepted: "Convert to a student record",
  Enrolled: "Nothing — already on the registry",
};

/** Where an applicant stands with the entrance assessment, as the Screening filter reads it. */
function screenState(row: ApplicantRow): string {
  if (row.score !== null) return "sat";
  if (row.needsScreening || !row.screening) return "notscheduled";
  return new Date(row.screening.at).getTime() < Date.now() ? "notsat" : "scheduled";
}

function applicantRow(row: ApplicantRow): TableRow {
  return {
    id: row.id,
    href: applicantHref(row.id),
    keywords: `${row.name} ${row.ref} ${row.guardian} ${row.phone} ${row.forClass} screen:${screenState(row)}`,
    cells: [
      nameCell(row.name, `${row.gender} · born ${born(row.dob)}`),
      text(row.ref, { mono: true }),
      text(row.forClass),
      nameCell(row.guardian, row.phone, { avatar: false }),
      row.needsScreening ? text("Not scheduled", { tone: "negative", strong: true }) : row.screening ? text(`${when(row.screening.at)} · ${clock(row.screening.at)}`) : text("—"),
      row.score === null ? text("—") : text(String(row.score), { mono: true }),
      pill(row.stage, STAGE_TONE[row.stage] ?? "neutral"),
      text(row.stage === "Enrolled" ? "—" : plural(row.days, "day")),
      { kind: "action" as const, label: "Open", href: applicantHref(row.id) },
    ],
  };
}

const HEAD = ["Applicant", "Reference", "For", "Guardian", "Screening", "Score", "State", "In state", ""];

export function admissionsTab(data: AdmissionsBoard, o: AdmissionOptions): TabContent {
  const counts = new Map(data.stages.map((entry) => [entry.stage, entry.count]));
  const last = Math.max(...STAGES.map((stage, index) => ((counts.get(stage) ?? 0) > 0 ? index : -1)));
  const waitingDate = data.rows.filter((row) => row.needsScreening);
  const applicants = data.rows.map((row) => ({ id: row.id, name: row.name, ref: row.ref, forClass: row.forClass }));
  const add = { label: "Add application", primary: true, drawer: addApplicationDrawer(o) };
  const schedule = { label: "Schedule screening", drawer: scheduleDrawer(o, applicants) };
  const levels = Array.from(new Set(data.rows.map((row) => row.forClass))).sort();

  const cards: KpiCard[] = STAGES.map((stage, index) => ({
    label: stage,
    value: String(counts.get(stage) ?? 0),
    sub: STAGE_SUB[index],
    tone: STAGE_TONE[stage],
    link: "Open the list",
    href: pipelineHref(stage),
  }));
  const steps: StepItem[] = STAGES.map((stage, index) => ({ label: `${stage} · ${counts.get(stage) ?? 0}`, state: index < last ? "done" : index === last ? "current" : "todo", href: pipelineHref(stage) }));

  const diary: TableRow[] = data.sessions.map((session: DiarySession) => ({
    cells: [
      text(new Date(`${session.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }), { strong: true }),
      text(session.end ? `${session.start}–${session.end}` : session.start),
      text(session.forLabel),
      text(session.seats ? String(session.seats) : "—", { mono: true }),
      text(String(session.booked), { mono: true }),
      text(session.invigilator || "—"),
      {
        kind: "action" as const,
        label: "Open",
        drawer: { mode: "view" as const, kicker: "Admissions · diary", title: `Screening · ${session.date} ${session.start}`, sub: session.type, facts: [["Date", dayLong(session.date)], ["Time", session.end ? `${session.start}–${session.end}` : session.start], ["For", session.forLabel], ["Seats", session.seats ? `${session.booked} of ${session.seats} booked` : `${session.booked} booked (not a scheduled session)`], ["Invigilator", session.invigilator || "Not named"], ["Venue", session.venue || "—"]], readOnly: true, readOnlyNote: "Booking a seat sends the family the date, the time, what to bring and how to get here." },
      },
    ],
  }));

  const holding = [
    { label: `${plural(data.holding.needDate, "applicant")} ${data.holding.needDate === 1 ? "has" : "have"} no screening date`, sub: "They cannot be assessed, so they cannot be offered.", pill: "Schedule", tone: "negative" as PanelTone, viewLabel: "Schedule", drawer: scheduleDrawer(o, applicants) },
    { label: `${plural(data.holding.expiring, "offer")} ${data.holding.expiring === 1 ? "expires" : "expire"} this week`, sub: "Issued, with no acceptance and no deposit.", pill: "Chase", tone: "attention" as PanelTone, viewLabel: "Open", href: pipelineHref("Offered") },
    { label: `${plural(data.holding.noPhone, "applicant")} with no guardian phone number`, sub: "Nothing about the offer can reach them.", pill: data.holding.noPhone ? "Fix" : "None", tone: (data.holding.noPhone ? "negative" : "positive") as PanelTone, viewLabel: data.holding.noPhone ? "Fix" : undefined, href: data.holding.noPhone ? pipelineHref("Applied") : undefined },
    { label: `${data.holding.toConvert} accepted, not yet converted`, sub: "Deposit received — they are not on the registry until you convert them.", pill: "Convert", tone: "submitted" as PanelTone, viewLabel: "Convert", href: pipelineHref("Accepted") },
  ];

  return {
    title: "Admissions",
    desc: "Every applicant, where they are, and what moves them on.",
    primary: { label: "Add application", icon: "M12 5.5v13M5.5 12h13", drawer: addApplicationDrawer(o) },
    launchers: [{ label: "Schedule a screening session", drawer: addSessionDrawer(o) }, { label: "Past admission cycles", href: pipelineHref("History") }],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: `This cycle · ${data.cycle} intake`, per: 6, cards }] },
      { cols: "1fr", panels: [{ type: "steps", steps }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Applicants in this cycle",
            tag: `${data.rows.length} live`,
            tagTone: "neutral",
            sub: "Open an applicant for their progress, their family and their screening.",
            meta: `Conversion ${data.conversion}% enquiry to enrolled · ${waitingDate.length} awaiting a screening date`,
            search: "Find by name, reference or guardian",
            filters: [
              { label: "State", value: "All", options: ["All", ...STAGES, "Declined", "Waitlisted"], column: 6 },
              { label: "Applying for", value: "All", options: ["All", ...levels], column: 2 },
              { label: "Screening", value: "All", options: ["All", "Not scheduled", "Scheduled", "Sat", "Not sat"], match: { "Not scheduled": "screen:notscheduled", Scheduled: "screen:scheduled", Sat: "screen:sat", "Not sat": "screen:notsat" } },
            ],
            acts: [{ label: "Export the pipeline", export: true }, schedule, add],
            head: HEAD,
            noun: "application",
            nounPlural: "applicants",
            per: 10,
            selectable: true,
            bulkActs: [
              { label: "Schedule a screening date", drawer: { ...scheduleDrawer(o, applicants), title: "Schedule a screening date" }, selection: { key: "applicants", noun: "applicant" } },
              { label: "Issue offer letters", drawer: bulkOfferDrawer(), selection: { key: "applicants", noun: "applicant" } },
              { label: "Message the guardians", href: "/communication-center/compose" },
              { label: "Decline with a reason", drawer: bulkDeclineDrawer(), selection: { key: "applicants", noun: "applicant" } },
              { label: "Export selected", primary: true, export: true },
            ],
            rows: data.rows.map(applicantRow),
            foot: "An applicant with no screening date cannot be assessed, offered or enrolled — that is the queue to clear first.",
          },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          { type: "table", title: "Screening and entrance assessment diary", sub: "Sessions this school has scheduled, and how full each one is.", meta: `${plural(data.sessions.length, "session")} · ${plural(waitingDate.length, "applicant")} still to be placed in one`, acts: [{ label: "Schedule a session", primary: true, drawer: addSessionDrawer(o) }], head: ["Date", "Time", "For", "Seats", "Booked", "Invigilator", ""], noun: "session", nounPlural: "sessions", noRowOpen: true, rows: diary, emptyTitle: "No session is scheduled", emptyBody: "Schedule one, then book applicants into it.", foot: "Booking a seat sends the family the date, the time, what to bring and how to get here." },
          { type: "list", tuck: "See who is holding this up", tuckIcon: "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z", title: "What is holding this cycle up", sub: "Each one names who it is waiting on.", items: holding },
        ],
      },
      {
        cols: "1fr 1fr",
        panels: [
          { type: "bars", title: "Conversion by class applied for", sub: "Application through to enrolled, this cycle.", rows: data.byClass.map((entry) => ({ label: entry.name, value: entry.total ? Math.round((entry.enrolled / entry.total) * 100) : 0, display: `${entry.enrolled} of ${entry.total} enrolled`, tone: (entry.total && entry.enrolled / entry.total >= 0.45 ? "positive" : "attention") as PanelTone })) },
          { type: "table", title: "Every cycle since the school opened", sub: "Applications, offers and enrolments by admission year.", meta: `${plural(data.cycles.length, "cycle")} on record · open one for its full pipeline`, acts: [{ label: "Open the history", href: pipelineHref("History") }], head: ["Cycle", "Enquiries", "Applied", "Offered", "Enrolled", "Conversion", ""], noun: "cycle", nounPlural: "cycles", noRowOpen: true, rows: data.cycles.map((cycle) => ({ cells: [text(`${cycle.name}${cycle.open ? " · open" : ""}`, { strong: true }), text(String(cycle.enquiries), { mono: true }), text(String(cycle.applied), { mono: true }), text(String(cycle.offered), { mono: true }), text(String(cycle.enrolled), { mono: true }), pill(`${cycle.rate}%${cycle.open ? " · running" : ""}`, cycle.open ? "progress" : "positive"), { kind: "action" as const, label: "Open", href: pipelineHref("History") }] })) },
        ],
      },
    ],
  };
}

export type AdmissionPage = { content: TabContent & { crumb: { label: string; href: string } } };

export function pipelinePage(state: string, data: { rows: ApplicantRow[]; cycles: AdmissionsBoard["cycles"]; cycle: string }, o: AdmissionOptions): AdmissionPage {
  const crumb = { label: "Back to Admissions", href: "/student-records/admissions" };
  const rows = data.rows;
  if (state === "History") {
    const enrolled = rows.filter((row) => row.stage === "Enrolled").length;
    const total = data.cycles.reduce((sum, cycle) => sum + cycle.enquiries, 0);
    const best = data.cycles.slice().sort((a, b) => b.rate - a.rate)[0];
    return {
      content: {
        crumb,
        title: "Admission history",
        desc: "Every cycle the school has run, and every applicant in each one.",
        primary: { label: "Export the history", icon: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15", href: "/student-records/admissions/export" },
        rows: [
          { cols: "1fr", panels: [{ type: "kpi", title: `${plural(data.cycles.length, "cycle")} on record`, per: 5, cards: [{ label: "Applications, all time", value: String(total), sub: data.cycles.length ? `Since ${data.cycles[data.cycles.length - 1].name}` : "None yet", tone: "neutral" }, { label: "Enrolled, all time", value: String(enrolled), sub: total ? `${Math.round((enrolled / total) * 100)}% conversion` : "—", tone: "positive" }, { label: "Best cycle", value: best?.name ?? "—", sub: best ? `${best.rate}% · ${best.enrolled} enrolled` : "", tone: "positive" }, { label: "Declined", value: String(rows.filter((row) => row.stage === "Declined").length), sub: "Each with a recorded reason", tone: "neutral" }, { label: "Waitlisted", value: String(rows.filter((row) => row.stage === "Waitlisted").length), sub: "Contacted if a place opens", tone: "attention" }] }] },
          { cols: "1fr", panels: [{ type: "table", title: "Applicants across every cycle", sub: "The full historic list, searchable by name, reference or cycle.", meta: `${plural(rows.length, "application")} · ${enrolled} enrolled`, search: "Find by name, reference or guardian", filters: [{ label: "Cycle", value: "All", options: ["All", ...data.cycles.map((cycle) => cycle.name)] }, { label: "State", value: "All", options: ["All", ...STAGES, "Declined", "Waitlisted"], column: 7 }, { label: "Applying for", value: "All", options: ["All", ...Array.from(new Set(rows.map((row) => row.forClass))).sort()], column: 3 }], acts: [{ label: "Export to Excel", primary: true, export: true }], head: ["Applicant", "Reference", "Cycle", "For", "Guardian", "Score", "Outcome", ""], noun: "application", nounPlural: "applicants", per: 10, rows: rows.map((row) => ({ id: row.id, href: applicantHref(row.id), keywords: `${row.name} ${row.ref} ${row.guardian} ${row.cycle}`, cells: [nameCell(row.name, `${row.gender} · born ${born(row.dob)}`), text(row.ref, { mono: true }), text(row.cycle), text(row.forClass), nameCell(row.guardian, row.phone, { avatar: false }), row.score === null ? text("—") : text(String(row.score), { mono: true }), pill(row.stage, STAGE_TONE[row.stage] ?? "neutral"), { kind: "action" as const, label: "Open", href: applicantHref(row.id) }] })) }] },
          { cols: "1fr", panels: [{ type: "line", title: "Enrolment by cycle", sub: "How many applications became students.", points: data.cycles.map((cycle) => ({ label: cycle.name, v: cycle.rate, tip: `${cycle.name} · ${cycle.enrolled} of ${cycle.enquiries}${cycle.open ? " so far" : ""}`, tone: (cycle.open ? "progress" : "positive") as PanelTone, on: cycle.open })) }] },
        ],
      },
    };
  }
  const DESC: Record<string, string> = {
    Enquiry: "Families who have asked about the school and not yet applied. They need a form.",
    Applied: "Form received. They need reviewing, a fee check and a screening date.",
    Assessed: "Screening sat and scored. They need a decision.",
    Offered: "Offer letter issued. The school is waiting on the family.",
    Accepted: "Accepted. They need clearing and converting to a student record.",
    Enrolled: "Converted. They are on the registry and in a class arm.",
    Declined: "Closed by the school or the family. Each carries its reason.",
    Waitlisted: "Contacted if a place opens.",
  };
  const needing = rows.filter((row) => row.needsScreening);
  const applicants = rows.map((row) => ({ id: row.id, name: row.name, ref: row.ref, forClass: row.forClass }));
  return {
    content: {
      crumb,
      title: state,
      desc: DESC[state] ?? "Applicants in this state.",
      primary: { label: "Add application", icon: "M12 5.5v13M5.5 12h13", drawer: addApplicationDrawer(o) },
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: `${state} · this cycle`, per: 4, cards: [{ label: "In this state", value: String(rows.length), sub: data.cycle, tone: "neutral" }, { label: "Oldest", value: rows.length ? plural(Math.max(...rows.map((row) => row.days)), "day") : "—", sub: "In this state without moving", tone: "attention" }, { label: "No screening date", value: String(needing.length), sub: "Blocks assessment", tone: needing.length ? "negative" : "positive" }, { label: "No phone number", value: String(rows.filter((row) => !row.phone?.trim()).length), sub: "Unreachable", tone: rows.some((row) => !row.phone?.trim()) ? "negative" : "positive" }] }] },
        { cols: "1fr", panels: [{ type: "table", title: `Applicants · ${state}`, sub: "Open one for their progress, family and documents.", meta: `${rows.length} in this state · ${needing.length} still need a screening date`, search: "Find by name, reference or guardian", filters: [{ label: "Applying for", value: "All", options: ["All", ...Array.from(new Set(rows.map((row) => row.forClass))).sort()], column: 2 }], acts: [{ label: "Message these guardians", href: "/communication-center/compose" }, { label: "Schedule screening", primary: true, drawer: scheduleDrawer(o, applicants) }], head: HEAD, noun: "application", nounPlural: "applicants", per: 10, rows: rows.map(applicantRow), emptyTitle: "Nobody is in this state", emptyBody: `Every applicant has moved past ${state}.` }] },
      ],
    },
  };
}

export function applicantPage(a: Applicant, o: AdmissionOptions, arms: Array<{ name: string }>): AdmissionPage {
  const crumb = { label: "Back to Admissions", href: "/student-records/admissions" };
  const closed = a.declined || a.waitlisted;
  const advance = advanceDrawer(a, arms);
  const needsDate = !closed && a.stageIndex < 2 && !a.screening;
  const primary = closed
    ? { label: "Reopen this application", icon: "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3", drawer: reopenDrawer(a) }
    : a.student
      ? { label: "Open the student record", icon: "M5 12.5l4.5 4.5 9-10", href: `/student-records/registry/${a.student.id}` }
      : advance
        ? { label: a.next?.label ?? "Move it on", icon: "M5 12h13M13 6.5 18.5 12 13 17.5", drawer: advance }
        : undefined;
  const cards: KpiCard[] = [
    { label: "State", value: a.stage, sub: `For ${plural(a.days, "day")}`, tone: STAGE_TONE[a.stage] ?? "neutral" },
    { label: "Applying for", value: a.forClass, sub: /Nursery|Primary/.test(a.forClass) ? "Interview only" : "Entrance assessment" },
    { label: "Screening", value: a.screening ? when(a.screening.at) : "Not booked", sub: a.screening ? (a.screening.completed ? "Sat and scored" : "Seat confirmed") : "Blocks everything after it", tone: a.screening ? "positive" : needsDate ? "negative" : "neutral" },
    { label: "Assessment score", value: a.screening?.score === null || !a.screening ? "—" : String(Math.round((a.screening.score / (a.screening.max || 100)) * 100)), sub: !a.screening || a.screening.score === null ? "Not sat yet" : (a.screening.score / (a.screening.max || 100)) * 100 >= 50 ? "Above the threshold" : "Below the 50 threshold", tone: !a.screening || a.screening.score === null ? "neutral" : (a.screening.score / (a.screening.max || 100)) * 100 >= 50 ? "positive" : "negative" },
    { label: "Next step", value: closed ? "Closed" : a.student ? "Done" : "Open", sub: closed ? "This application is closed" : a.next?.label ?? NEXT_WORD[a.stage], tone: closed ? "negative" : "attention" },
  ];
  const steps: StepItem[] = STAGES.map((stage, index) => ({ label: stage, state: closed ? (index <= Math.max(0, a.stageIndex) ? "done" : "todo") : index < a.stageIndex ? "done" : index === a.stageIndex ? "current" : "todo" }));
  const progress: TableRow[] = a.stages.map((stage) => ({ cells: [text(stage.name, { strong: stage.done }), text(stage.done && stage.when ? dayLabel(stage.when) : "—"), text(stage.done ? stage.by ?? "—" : "—"), text(stage.done ? stage.note ?? "Reached" : "Not reached"), text("")] }));
  const docs: TableRow[] = a.documents.map((doc) => ({ cells: [text(doc.label, { strong: true }), text(doc.source), text(doc.received ? dayLabel(doc.received) : "Not received"), doc.received ? pill(doc.verified ? "Verified" : "Received", doc.verified ? "positive" : "neutral") : { kind: "action" as const, label: "Request", drawer: requestDocumentsDrawer(a) }] }));
  return {
    content: {
      crumb,
      title: a.name,
      desc: `${a.ref} · applying for ${a.forClass} · born ${born(a.dob)}.`,
      primary,
      launchers: [
        { label: "Message the guardian", href: "/communication-center/compose" },
        ...(a.screening || closed || a.student ? [] : [{ label: "Schedule the screening", drawer: scheduleDrawer(o, [{ id: a.id, name: a.name, ref: a.ref, forClass: a.forClass }], a.id) }]),
        ...(closed || a.student ? [] : [{ label: "Decline with a reason", drawer: declineDrawer(a) }]),
      ],
      rows: [
        ...(needsDate ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: "No screening date has been booked for this child", body: a.feeCleared ? "They cannot be assessed, offered or enrolled until they sit the entrance assessment." : "Before a seat can be held the application fee must be verified or waived — start with “Verify the application fee”.", acts: [{ label: a.next?.label ?? "Book a seat", drawer: advance ?? scheduleDrawer(o, [{ id: a.id, name: a.name, ref: a.ref, forClass: a.forClass }], a.id) }] }] }] : []),
        ...(a.duplicate ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: "Possible duplicate", body: a.duplicate }] }] : []),
        { cols: "1fr", panels: [{ type: "kpi", title: "Where this application stands", per: 5, cards }] },
        { cols: "1fr", panels: [{ type: "steps", steps }] },
        {
          cols: "1.2fr 1fr",
          panels: [
            { type: "facts", title: "Guardian and contact", tag: a.guardian.phone ? "Reachable" : "No phone", tagTone: a.guardian.phone ? "positive" : "negative", sub: "Who the school writes to about this application, and who will be the guardian if it converts.", meta: "Captured at enquiry · carried onto the student record on conversion", acts: [{ label: "Message them", href: "/communication-center/compose" }, { label: "Edit the contact", primary: true, drawer: applicantContactDrawer(a) }], per: 2, facts: [["Primary guardian", a.guardian.name, ""], ["Mobile number", a.guardian.phone, "Every message about this application goes here"], ["Email", a.guardian.email ?? "Not given", ""], ["Second contact", a.guardian.secondName ?? "None on file", a.guardian.secondPhone ?? ""], ["Home address", a.guardian.address ?? "Not given", ""], ["Sibling in the school", a.siblingInSchool ? "Yes" : "No", "Decides the sibling discount on conversion"]] },
            { type: "facts", title: "The child", sub: "What has been given so far. The rest is collected on conversion.", per: 2, facts: [["Full name", a.name, ""], ["Reference", a.ref, ""], ["Date of birth", dayLong(a.dob), ""], ["Gender", a.gender, ""], ["Applying for", a.forClass, a.placesLeft === null ? "" : `Places left: ${a.placesLeft}`], ["Previous school", a.child.previousSchool ?? "Not given", ""], ["Medical notes", a.child.medical ?? "None declared", ""], ["Cycle", a.cycle, ""]] },
          ],
        },
        {
          cols: "1.1fr 1fr",
          panels: [
            { type: "table", title: "Progress, step by step", sub: "Every stage, when it happened, and who did it.", meta: `Opened ${dayLong(a.opened)} · ${plural(a.days, "day")} in the current state`, head: ["Stage", "When", "By", "What happened", ""], noun: "stage", nounPlural: "stages", noRowOpen: true, rows: progress, foot: "A stage cannot be skipped. Moving an applicant backwards is recorded with a reason." },
            { type: "table", title: "Documents", sub: "What the family has uploaded, and what is still owed.", meta: `${a.documents.filter((doc) => doc.received).length} of ${a.documents.length} received`, acts: [{ label: "Request the missing ones", primary: true, drawer: requestDocumentsDrawer(a) }], head: ["Document", "Source", "Received", ""], noun: "document", nounPlural: "documents", noRowOpen: true, rows: docs },
          ],
        },
        { cols: "1fr", panels: [{ type: "list", title: "Everything said to this family", sub: "Every message about this application, in order.", items: a.said.length ? a.said.map((entry) => ({ label: entry.label, sub: entry.sub, pill: "Logged", tone: "positive" as PanelTone })) : [{ label: "Nothing has been recorded yet", sub: "Messages and decisions appear here in order.", pill: "None", tone: "neutral" as PanelTone }] }] },
      ],
    },
  };
}
