import { cardDrawer } from "@/lib/modules/live/m6-forms";
import { receiptDrawer } from "@/lib/modules/live/documents";
import { apiGet } from "@/lib/api/server";
import { dayLabel, dayLong, plural } from "@/lib/modules/live/m7-format";
import { attendanceSessionDrawer, collectorDrawer, documentDrawer, endSupportPlanDrawer, mapGuardianDrawer, noteDrawer, requestChangeDrawer, sensitiveDrawer, SR, supportPlanDrawer } from "@/lib/modules/live/m8-forms";
import { FEE_TONE, STATE_TONE, attTone, gradeTone, loadRegistry, studentHref } from "@/lib/modules/live/m8-registry";
import type { Dossier, DossierSubject, Registry, TermResult } from "@/lib/modules/live/m8-types";
import { name as nameCell, pill, text, type KpiCard, type PanelFact, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * One child, in full. Eight sections, one record, reached identically from a class roster and from
 * the registry. Every figure comes from the dossier, so the arm list, this page and a printed
 * card can never disagree.
 */

export type RecordSection = "overview" | "academic" | "report-cards" | "attendance" | "wellbeing" | "family" | "fees" | "records";
export const SECTIONS: Array<{ section: RecordSection; label: string; path: string }> = [
  { section: "overview", label: "Overview", path: "" },
  { section: "academic", label: "Academic", path: "/academic" },
  { section: "report-cards", label: "Report cards", path: "/report-cards" },
  { section: "attendance", label: "Attendance", path: "/attendance" },
  { section: "wellbeing", label: "Wellbeing", path: "/wellbeing" },
  { section: "family", label: "Family", path: "/family" },
  { section: "fees", label: "Fees", path: "/fees" },
  { section: "records", label: "Records", path: "/records" },
];

export type RecordPage = { content: TabContent & { crumb?: { label: string; href: string } }; tabs: Array<{ href: string; label: string }>; name: string };

export const loadDossier = (id: string) => apiGet<Dossier>(`${SR}/students/${encodeURIComponent(id)}`);
export const loadTermResult = (id: string, termId: string) => apiGet<TermResult>(`${SR}/students/${encodeURIComponent(id)}/results/${encodeURIComponent(termId)}`);
export const loadGuardianPool = () => apiGet<{ guardians: Array<{ id: string; name: string; phone: string; children: number }> }>("/api/v1/parents-guardians/guardians/options").then((options) => options.guardians);

const naira = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `₦${Math.round(value).toLocaleString("en-NG")}`);
const stateTone = (state: string): PanelTone => (/Published|Approved|Verified|Complete|Paid|Active|Closed|Resolved|Delivered/.test(state) ? "positive" : /Blocked|Missing|Overdue|Not activated|Failing/.test(state) ? "negative" : /Draft|Submitted|Generated|Part|Awaiting|Monitoring|Not generated|Not started|Invited/.test(state) ? "attention" : "neutral");
const standingTone = (standing: string): PanelTone | undefined => (standing.startsWith("Well above") || standing.startsWith("Above") ? "positive" : standing.startsWith("Below") ? "negative" : undefined);
const gradeOf = (grade: string, total: number | null): PanelTone => (total === null ? "negative" : /^[AB]/i.test(grade) ? "positive" : /^C/i.test(grade) ? "submitted" : /^D/i.test(grade) ? "attention" : "negative");

export const recordTabs = (id: string) => SECTIONS.map((entry) => ({ href: studentHref(id, entry.path), label: entry.label }));

export async function studentRecordPage(id: string, section: RecordSection, o: { termId?: string; from?: { label: string; href: string } } = {}): Promise<RecordPage | null> {
  const [d, registry, pool] = await Promise.all([loadDossier(id).catch(() => null), loadRegistry().catch(() => null as Registry | null), loadGuardianPool().catch(() => [])]);
  if (!d) return null;
  const termResult = section === "academic" && o.termId ? await loadTermResult(id, o.termId).catch(() => null) : null;
  const fm = d.formMaster?.name ?? "not named";
  const base = {
    title: d.name,
    desc: `${d.arm?.name ?? "No arm"} · ${d.adm} · age ${d.age} · form master ${fm}.`,
    primary: d.term ? { label: "Preview the report card", icon: "M6.5 3.5h8L18.5 8v12.5h-12zM9 12.5h6M9 16h4", drawer: cardDrawer(d.id, d.term.id, d.name) } : undefined,
    launchers: [
      { label: "Message the guardian", href: "/communication-center/compose" },
      { label: "Request a record change", drawer: requestChangeDrawer(["Given name", "Surname", "Date of birth", "Gender", "Status", "Arm", "Home address", "Nationality", "Previous school", "Languages at home", "House"], registry?.rows ?? [], { id: d.id, name: d.name }) },
      ...(d.arm ? [{ label: `Open ${d.arm.name}`, href: `/class-timetable/classes/${d.arm.id}` }] : []),
    ],
    crumb: o.from ?? { label: "Back to the Registry", href: "/student-records/registry" },
  };
  const wrap = (content: Partial<TabContent> & { rows: TabContent["rows"]; crumb?: { label: string; href: string } }) => ({ content: { ...base, ...content }, tabs: recordTabs(id), name: d.name });
  const body = { d, registry, pool, termResult, wrap, base };
  switch (section) {
    case "academic":
      return academic(body);
    case "report-cards":
      return reportCards(body);
    case "attendance":
      return attendance(body);
    case "wellbeing":
      return wellbeing(body);
    case "family":
      return family(body);
    case "fees":
      return fees(body);
    case "records":
      return records(body);
    default:
      return overview(body);
  }
}

type Body = { d: Dossier; registry: Registry | null; pool: Array<{ id: string; name: string; phone: string; children: number }>; termResult: TermResult | null; wrap: (content: Partial<TabContent> & { rows: TabContent["rows"]; crumb?: { label: string; href: string } }) => RecordPage; base: { crumb: { label: string; href: string } } };

const sectionHref = (d: Dossier, section: RecordSection) => studentHref(d.id, SECTIONS.find((entry) => entry.section === section)?.path ?? "");

/* what is not finished on this record, each naming what it blocks */
function unfinished(d: Dossier): Array<{ label: string; sub: string; pill: string; tone: PanelTone; viewLabel: string; href?: string }> {
  const items: Array<{ label: string; sub: string; pill: string; tone: PanelTone; viewLabel: string; href?: string }> = [];
  if (!d.family.guardians.length) items.push({ label: "No guardian is mapped to this child", sub: "Nothing can be published to a family that does not exist on the record.", pill: "Missing", tone: "negative", viewLabel: "Map one", href: sectionHref(d, "family") });
  if (d.academic.sheet && d.academic.sheet.status !== "PUBLISHED" && d.academic.sheet.status !== "APPROVED") items.push({ label: "The score sheets are not approved", sub: "The report card cannot be generated until every sheet is.", pill: "Waiting", tone: "attention", viewLabel: "Open", href: "/score-entry-results/review" });
  if (d.fees.owing > 0) items.push({ label: `${naira(d.fees.owing)} outstanding`, sub: `${plural(d.fees.days, "day")} · does not withhold the card under this school's policy.`, pill: "Outstanding", tone: "attention", viewLabel: "Open", href: sectionHref(d, "fees") });
  for (const guardian of d.family.guardians.filter((entry) => entry.portal !== "Active")) items.push({ label: "A guardian has never activated the portal", sub: `${guardian.name} · will not see a published card.`, pill: "Not activated", tone: "negative", viewLabel: "Open", href: `/parents-guardians/guardians/${guardian.id}` });
  if (d.records.missing.length) items.push({ label: `${d.records.missing[0]}${d.records.missing.length > 1 ? ` and ${d.records.missing.length - 1} more` : ""} missing`, sub: "Blocks the transcript and the examination entry file.", pill: "Missing", tone: "attention", viewLabel: "Open", href: sectionHref(d, "records") });
  if (!d.hasPhoto) items.push({ label: "No photograph on file", sub: "The identity card prints without one.", pill: "Missing", tone: "attention", viewLabel: "Open", href: sectionHref(d, "records") });
  return items;
}

/* ───────────────────────── overview ───────────────────────── */

function overview({ d, wrap }: Body): RecordPage {
  const portals = d.family.guardians.filter((guardian) => guardian.portal === "Active").length;
  const sheet = d.academic.sheet;
  const cards: KpiCard[] = [
    { label: "Class and arm", value: d.arm?.name ?? "No arm", sub: d.arm ? `${d.arm.level} · ${plural(d.roll, "student")} in the arm` : "In no register", tone: d.arm ? "neutral" : "negative", link: d.arm ? `Open ${d.arm.name}` : undefined, href: d.arm ? `/class-timetable/classes/${d.arm.id}` : undefined },
    { label: "Attendance", value: d.attendance.pct === null ? "—" : `${d.attendance.pct}%`, sub: d.attendance.days ? `${d.attendance.present} of ${d.attendance.days} days` : "No register marked yet", tone: attTone(d.attendance.pct), link: "Open attendance", href: sectionHref(d, "attendance") },
    { label: "Term average", value: sheet ? String(sheet.avg) : "—", sub: sheet ? `Position ${sheet.position ?? "—"} of ${sheet.outOf}` : "No result sheet yet", tone: sheet ? gradeTone(sheet.avg) : "neutral", link: "Open academic", href: sectionHref(d, "academic") },
    { label: "Report card", value: d.cards.find((card) => card.termId === d.term?.id)?.state ?? "Not generated", sub: sheet ? `Sheet ${sheet.status.toLowerCase()}` : "Waiting on score sheets", tone: stateTone(d.cards.find((card) => card.termId === d.term?.id)?.state ?? "Not generated"), link: "Open report cards", href: sectionHref(d, "report-cards") },
    { label: "Fee balance", value: d.fees.owing ? naira(d.fees.owing) : d.fees.billed ? "Settled" : "Not billed", sub: d.fees.owing ? `${plural(d.fees.days, "day")} old` : d.fees.billed ? "Nothing outstanding" : "No invoice this term", tone: d.fees.owing ? "attention" : d.fees.billed ? "positive" : "neutral", link: "Open fees", href: sectionHref(d, "fees") },
    { label: "Guardian portal", value: `${portals} of ${d.family.guardians.length}`, sub: d.family.guardians.length ? (portals === d.family.guardians.length ? "All active" : "One has never activated") : "No guardian mapped", tone: !d.family.guardians.length ? "negative" : portals === d.family.guardians.length ? "positive" : "attention", link: "Open family", href: sectionHref(d, "family") },
  ];
  const identity: PanelFact[] = [
    ["Full name", d.fullName, ""],
    ["Admission number", d.adm, ""],
    ["Date of birth", dayLong(d.dob), `Age ${d.age}`],
    ["Gender", d.gender, ""],
    ["Nationality", d.nationality, d.stateOfOrigin ?? ""],
    ["Languages at home", d.language, ""],
    ["Enrolment", d.boarding.is ? "Boarding" : "Day student", d.boarding.where ?? d.house ?? ""],
    ["Status", d.state, ""],
    ["Photograph", d.hasPhoto ? "On file" : "Not on file", "Required for the transcript"],
  ];
  const fm = d.formMaster;
  const subjectRows: TableRow[] = d.academic.subjects.map((subject) => ({
    id: subject.id,
    href: sectionHref(d, "academic"),
    cells: [
      text(subject.name, { strong: true }),
      subject.teacher ? nameCell(subject.teacher, subject.dept, { avatar: false }) : text("Nobody mapped", { tone: "negative", strong: true }),
      text(subject.total === null ? "—" : String(subject.total), { mono: true }),
      pill(subject.grade, gradeOf(subject.grade, subject.total)),
      text(subject.pos === null ? "—" : String(subject.pos), { mono: true }),
      text(subject.classAvg === null ? "—" : String(subject.classAvg), { mono: true }),
      text(subject.standing, { tone: standingTone(subject.standing) }),
      pill(subject.state, stateTone(subject.state)),
      { kind: "action" as const, label: "Open", href: sectionHref(d, "academic") },
    ],
    keywords: `${subject.name} ${subject.standing}`,
  }));
  const todo = unfinished(d);
  return wrap({
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Where this child stands", sub: `${d.term?.label ?? "This term"}. Every card opens the tab behind it.`, per: 6, cards }] },
      {
        cols: "1.3fr 1fr",
        panels: [
          { type: "facts", title: "Identity", tag: d.adm, tagTone: "neutral", sub: "The record as the registry holds it.", meta: `Admitted ${dayLong(d.admitted)}${d.previousSchool ? ` · ${d.previousSchool}` : ""}`, acts: [{ label: "Open the full record", primary: true, href: sectionHref(d, "records") }], per: 3, facts: identity },
          {
            type: "facts",
            title: "Who is responsible for this child",
            tag: fm?.portal,
            tagTone: fm ? stateTone(fm.portal) : "negative",
            sub: `The form master of ${d.arm?.name ?? "their arm"} — the register, the remarks and every guardian conversation.`,
            meta: fm ? `At this school since ${fm.since}` : "Nobody is named",
            acts: [{ label: "Message them", href: "/communication-center/compose" }],
            per: 1,
            facts: [
              ["Form master", fm?.name ?? "Nobody named", fm ? fm.role : "This register has nobody marking it"],
              ["Phone", fm?.phone ?? "—", "Their login and their SMS number"],
              ["Email", fm?.email ?? "—", ""],
              ["Primary guardian", d.family.guardians.find((guardian) => guardian.primary)?.name ?? "None on file", d.family.guardians.find((guardian) => guardian.primary)?.phone ?? ""],
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "This term, subject by subject",
            tag: `${d.academic.scored} of ${d.academic.subjects.length} scored`,
            tagTone: d.academic.scored === d.academic.subjects.length && d.academic.subjects.length ? "positive" : "attention",
            sub: "The headline for each subject. The Academic tab carries every component.",
            meta: sheet ? `Average ${sheet.avg} · position ${sheet.position ?? "—"} · ${plural(sheet.passed, "subject")} at credit or above` : "No result sheet yet",
            search: "Find a subject",
            filters: [
              { label: "Standing", value: "All", options: ["All", "Above the class", "Around the class", "Below the class"], column: 6 },
              { label: "Scores", value: "All", options: ["All", "Published", "Approved", "Submitted", "Blocked", "Draft", "Not started"], column: 7 },
            ],
            acts: [{ label: "Open the broadsheet", href: sectionHref(d, "academic") }, ...(d.term ? [{ label: "Preview the report card", primary: true, drawer: cardDrawer(d.id, d.term.id, d.name) }] : [])],
            head: ["Subject", "Teacher", "Total", "Grade", "Pos", "Class avg", "Standing", "Scores", ""],
            noun: "subject",
            nounPlural: "subjects",
            per: 10,
            rows: subjectRows,
            empty: "No subject is offered to this child's arm yet.",
            foot: `Pass mark ${d.academic.passMark}. A dash is a component nobody has entered yet.`,
          },
        ],
      },
      {
        cols: "1.05fr 1fr",
        panels: [
          {
            type: "list",
            title: "Activity",
            sub: "Drawn from the audit log, scoped to this child.",
            items: d.records.audit.length ? d.records.audit.slice(0, 6).map((entry) => ({ label: entry.label, sub: `${dayLong(entry.at)} · ${entry.by}`, pill: "Complete", tone: "positive" as PanelTone })) : [{ label: "Nothing has been recorded against this child yet", sub: "Every change from here on is logged here with a name.", pill: "None", tone: "neutral" as PanelTone }],
          },
          { type: "list", tuck: "What is not finished on this record", title: "What is not finished", sub: "Each one names what it blocks.", items: todo.length ? todo.map((item) => ({ label: item.label, sub: item.sub, pill: item.pill, tone: item.tone, viewLabel: item.viewLabel, href: item.href })) : [{ label: "Nothing is outstanding", sub: "This record is complete.", pill: "Complete", tone: "positive" as PanelTone }] },
        ],
      },
    ],
  });
}

/* ───────────────────────── academic ───────────────────────── */

function academic({ d, termResult, wrap }: Body): RecordPage {
  if (termResult) {
    const t = termResult;
    const rows: TableRow[] = t.subjects.map((subject) => ({
      cells: [
        text(subject.name, { strong: true }),
        text(subject.category),
        ...t.components.map((component) => {
          const hit = subject.components.find((entry) => entry.name === component);
          return text(hit ? String(hit.score) : "—", { mono: true });
        }),
        text(String(subject.total), { mono: true, strong: true }),
        pill(subject.grade, gradeOf(subject.grade, subject.total)),
        text(subject.classAvg === null ? "—" : String(subject.classAvg), { mono: true }),
        text(subject.standing, { tone: standingTone(subject.standing) }),
      ],
    }));
    const history = d.academic.history;
    const at = history.findIndex((entry) => entry.termId === t.term.id);
    return wrap({
      title: `${d.name} · ${t.term.name}`,
      desc: `${t.term.session} · ${t.arm} · average ${t.avg} · position ${t.position ?? "—"}.`,
      primary: { label: "Print this result", icon: "M7 8.5V3.5h10v5M7 18.5v3h10v-3M4.5 8.5h15v10h-15z", drawer: cardDrawer(d.id, t.term.id, d.name) },
      launchers: [
        ...(at > 0 ? [{ label: `Previous · ${history[at - 1].term}`, href: `${sectionHref(d, "academic")}?term=${history[at - 1].termId}` }] : []),
        ...(at >= 0 && at < history.length - 1 ? [{ label: `Next · ${history[at + 1].term}`, href: `${sectionHref(d, "academic")}?term=${history[at + 1].termId}` }] : []),
      ],
      crumb: { label: "Back to all terms", href: sectionHref(d, "academic") },
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: `${t.term.name} ${t.term.session}`, per: 5, cards: [{ label: "Term average", value: String(t.avg), unit: "/ 100", sub: `Total ${t.total}`, tone: gradeTone(t.avg) }, { label: "Position", value: t.position === null ? "—" : String(t.position), sub: `Of ${t.outOf}` }, { label: "Grade", value: t.grade, sub: "On the school's own bands" }, { label: "Subjects scored", value: String(t.subjects.length), sub: "Every sheet in", tone: "positive" }, { label: "Card", value: t.state, sub: t.published ? `Published ${dayLabel(t.published)}` : "Not with the family yet", tone: stateTone(t.state) }] }] },
        {
          cols: "1fr",
          panels: [
            {
              type: "table",
              title: `Every subject in ${t.term.name}`,
              sub: "Each component as the teacher entered it, out of its own maximum.",
              meta: `${plural(t.subjects.length, "subject")} · average ${t.avg}`,
              acts: [{ label: "Print this result", primary: true, drawer: cardDrawer(d.id, t.term.id, d.name) }],
              head: ["Subject", "Category", ...t.components, "Total", "Grade", "Class avg", "Standing"],
              noun: "subject",
              nounPlural: "subjects",
              noRowOpen: true,
              rows,
              foot: "A dash is a component the teacher never entered. It is not a zero, and it is not averaged in.",
            },
          ],
        },
        {
          cols: "1fr",
          panels: [
            {
              type: "quotes",
              title: "What the family was told",
              sub: t.state === "Published" ? "Exactly as it was printed on the card." : "No remark has been published for this term.",
              quotes: [
                { label: "Form master", by: d.formMaster?.name ?? "The form master", role: `Form master · ${t.arm}`, text: t.teacherComment ?? undefined, pill: t.teacherComment ? t.state : "Not written", tone: t.teacherComment ? stateTone(t.state) : "attention", emptyText: "Nothing was written for this term." },
                { label: "Principal", by: "The principal", role: "Principal", text: t.principalComment ?? undefined, pill: t.principalComment ? t.state : "Not written", tone: t.principalComment ? stateTone(t.state) : "attention", emptyText: "Nothing was written for this term." },
              ],
            },
          ],
        },
      ],
    });
  }
  const { subjects, history, registration, sheet } = d.academic;
  const rows: TableRow[] = history
    .slice()
    .reverse()
    .map((entry) => ({
      href: `${sectionHref(d, "academic")}?term=${entry.termId}`,
      cells: [text(entry.term, { strong: true }), text(`${entry.session}${entry.current ? " · this term" : ""}`), text(String(entry.avg), { mono: true }), text(entry.pos === null ? "—" : String(entry.pos), { mono: true }), pill(entry.grade, gradeTone(entry.avg)), pill(entry.state, stateTone(entry.state)), { kind: "action" as const, label: "View result", href: `${sectionHref(d, "academic")}?term=${entry.termId}` }],
    }));
  return wrap({
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: `This term, ${d.arm?.name ?? "no arm"}`,
            sub: `${d.term?.label ?? "No current term"}.`,
            per: 5,
            cards: [
              { label: "Term average", value: sheet ? String(sheet.avg) : "—", unit: sheet ? "/ 100" : undefined, sub: sheet ? `Total ${sheet.total}` : "No result sheet yet", tone: sheet ? gradeTone(sheet.avg) : "neutral" },
              { label: "Position", value: sheet?.position ? String(sheet.position) : "—", sub: `In a class of ${d.roll}` },
              { label: "Subjects scored", value: String(d.academic.scored), unit: `of ${subjects.length}`, sub: `${sheet?.passed ?? 0} at credit or above`, tone: d.academic.scored === subjects.length && subjects.length ? "positive" : "attention" },
              { label: "Strongest", value: d.academic.strongest?.total === null || !d.academic.strongest ? "—" : String(d.academic.strongest.total), sub: d.academic.strongest?.name ?? "", tone: "positive" },
              { label: "Weakest", value: d.academic.weakest?.total === null || !d.academic.weakest ? "—" : String(d.academic.weakest.total), sub: d.academic.weakest?.name ?? "", tone: d.academic.weakest && (d.academic.weakest.total ?? 100) < 50 ? "negative" : "attention" },
            ],
          },
        ],
      },
      { cols: "1fr", panels: [{ type: "table", title: "Results by term", sub: "Open a term to see every subject in it, and print it.", meta: `${plural(history.length, "term")} on record`, head: ["Term", "Session", "Average", "Position", "Grade", "State", ""], noun: "term", nounPlural: "terms", rows, empty: "No result has been recorded for this child yet." }] },
      {
        cols: "1fr 1fr",
        panels: [
          { type: "bars", title: "Term by term", sub: "Term average, oldest first.", rows: history.map((entry) => ({ label: `${entry.term} ${entry.session}`, value: Math.round(entry.avg), display: String(entry.avg), tone: entry.current ? ("progress" as PanelTone) : ("positive" as PanelTone) })) },
          { type: "facts", title: "Subject registration", tag: registration.fixed ? "Registered" : "With the arm", tagTone: registration.fixed ? "positive" : "neutral", sub: `Against this school's own rules for ${d.arm?.level ?? "the arm"}.`, per: 2, facts: [["Subjects registered", `${registration.count}`], ["Track", registration.track], ["In arm", d.arm?.name ?? "No arm"], ["Pass mark", String(d.academic.passMark)]] },
        ],
      },
    ],
  });
}

/* ───────────────────────── report cards ───────────────────────── */

function reportCards({ d, wrap }: Body): RecordPage {
  const published = d.cards.filter((card) => card.state === "Published").length;
  const current = d.cards.find((card) => card.termId === d.term?.id);
  const rows: TableRow[] = d.cards.map((card) => ({
    cells: [text(card.session, { strong: true }), text(card.term), text(card.avg === null ? "—" : String(card.avg), { mono: true }), text(card.pos === null ? "—" : String(card.pos), { mono: true }), pill(card.grade, gradeTone(card.avg)), pill(card.state, stateTone(card.state)), text(card.published ? dayLabel(card.published) : "—"), { kind: "action" as const, label: card.state === "Published" ? "Preview · print" : "Preview draft", href: `/print/result/${d.id}/${card.termId}` }],
  }));
  return wrap({
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "What this family has been given", sub: "Every card ever issued for this child.", per: 4, cards: [{ label: "Cards published", value: String(published), unit: `of ${d.cards.length}`, sub: d.cards.length ? `Since ${d.cards[d.cards.length - 1].session}` : "None yet", tone: published ? "positive" : "neutral" }, { label: "This term", value: current?.state ?? "Not generated", sub: d.academic.sheet ? `Sheet ${d.academic.sheet.status.toLowerCase()}` : "Waits on the score sheets", tone: stateTone(current?.state ?? "Not generated"), link: "Open completion", href: "/report-cards/completion" }, { label: "Remark for this term", value: "Open", sub: `Owed by ${d.formMaster?.name ?? "the form master"}`, tone: "attention", link: "Write it now", href: "/report-cards/remarks" }, { label: "Portal", value: `${d.family.guardians.filter((guardian) => guardian.portal === "Active").length} of ${d.family.guardians.length}`, sub: "Guardians who can open a published card", tone: d.family.guardians.every((guardian) => guardian.portal === "Active") && d.family.guardians.length ? "positive" : "attention" }] }] },
      { cols: "1fr", panels: [{ type: "table", title: "Report card history", sub: "Preview any card exactly as the family sees it.", meta: `${plural(d.cards.length, "term")} · ${published} published`, head: ["Session", "Term", "Average", "Position", "Grade", "State", "Published", ""], noun: "card", nounPlural: "cards", noRowOpen: true, rows, empty: "No report card has been generated for this child yet.", foot: "A published card is never silently restated. A correction reissues it and tells the family why." }] },
      {
        cols: "1.1fr 1fr",
        panels: [
          { type: "list", title: "Delivery of each card", sub: "Which channel reached the family.", items: d.cards.filter((card) => card.state === "Published").map((card) => ({ label: `${card.term} ${card.session} · ${card.avg ?? "—"} average`, sub: `Published ${dayLong(card.published)}`, pill: "Delivered", tone: "positive" as PanelTone, viewLabel: "Preview", href: `/print/result/${d.id}/${card.termId}` })).concat(current && current.state !== "Published" ? [{ label: d.term?.label ?? "This term", sub: "Nothing has been sent", pill: current.state, tone: "attention" as PanelTone, viewLabel: "", href: undefined as unknown as string }] : []) },
          { type: "facts", title: "What the family sees on it", sub: "The shape of the card, not the rules behind it.", per: 1, facts: [["Subjects listed", `${d.academic.subjects.length} · total, grade and class average each`], ["Term average", d.academic.sheet ? `${d.academic.sheet.avg} out of 100` : "Held until the sheets are in"], ["Position", d.academic.sheet?.position ? `${d.academic.sheet.position} in ${d.arm?.name ?? "the arm"}` : "Not ranked yet"], ["Attendance", d.attendance.days ? `${d.attendance.pct}% · ${d.attendance.present} of ${d.attendance.days} days` : "No register marked"], ["Remarks", "Form master and principal, in their own words"]] },
        ],
      },
    ],
  });
}

/* ───────────────────────── attendance ───────────────────────── */

function attendance({ d, wrap }: Body): RecordPage {
  const a = d.attendance;
  const TARGET = 92;
  const sessions: TableRow[] = a.sessions.map((s) => ({
    drawer: attendanceSessionDrawer({ name: d.name, arm: d.arm?.name ?? "No arm" }, s),
    cells: [text(s.session, { strong: true }), text(`${s.marked} of 3`), text(String(s.days), { mono: true }), text(String(s.present), { mono: true }), text(String(s.absent), { mono: true }), text(String(s.late), { mono: true }), text(String(s.excused), { mono: true }), pill(s.pct === null ? "—" : `${s.pct}%`, s.pct === null ? "neutral" : s.pct >= TARGET ? "positive" : s.pct >= 75 ? "attention" : "negative"), text(s.pct === null ? "Nothing marked yet" : s.pct >= TARGET ? "At or above the school target" : s.pct >= 75 ? `${(TARGET - s.pct).toFixed(1)} below the target` : "Below the 75% chronic threshold"), { kind: "action" as const, label: "Open the terms", drawer: attendanceSessionDrawer({ name: d.name, arm: d.arm?.name ?? "No arm" }, s) }],
  }));
  const marks: TableRow[] = a.entries.map((entry) => ({ cells: [text(dayLabel(entry.date), { mono: true }), pill(entry.mark, entry.mark === "Excused" ? "positive" : entry.mark === "Late" ? "attention" : "negative"), text(entry.reason || "No reason given yet"), text(entry.accepted), text(entry.source)] }));
  const lastSession = a.sessions[1];
  return wrap({
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Attendance", sub: `${d.term?.label ?? "This term"} · ${plural(a.days, "register")} marked so far.`, per: 5, cards: [{ label: "This term", value: a.pct === null ? "—" : `${a.pct}%`, sub: a.days ? `${a.present} of ${a.days} days` : "Nothing marked", tone: attTone(a.pct) }, { label: "Absent", value: String(a.absent), unit: "days", sub: `${a.excused} excused · ${Math.max(0, a.absent - a.excused)} unexplained`, tone: a.absent > 4 ? "negative" : "neutral" }, { label: "Late", value: String(a.late), unit: "days", sub: "Arrived after the bell", tone: a.late ? "attention" : "positive" }, { label: "Chronic threshold", value: "75%", sub: a.pct !== null && a.pct < 75 ? "Below it — flagged to the form master" : "Above it", tone: a.pct !== null && a.pct < 75 ? "negative" : "positive" }, { label: "Last session", value: lastSession?.pct === null || !lastSession ? "—" : `${lastSession.pct}%`, sub: lastSession ? lastSession.session : "No earlier session", tone: lastSession?.pct ? attTone(lastSession.pct) : "neutral" }] }] },
      { cols: "1fr", panels: [{ type: "table", title: "Attendance by session", tag: plural(a.sessions.length, "session"), tagTone: "neutral", sub: "Open a session for every term in it.", meta: `Target ${TARGET}% · chronic threshold 75%`, head: ["Session", "Terms marked", "Days", "Present", "Absent", "Late", "Excused", "Attendance", "Where it stands", ""], noun: "session", nounPlural: "sessions", noRowOpen: true, rows: sessions, empty: "No register has ever been marked for this child.", foot: "A session is three terms. Opening one shows each term." }] },
      { cols: "1fr", panels: [{ type: "table", title: "Every mark that is not “present”", sub: "With the reason, and whether it was accepted.", meta: `${plural(a.entries.length, "entry", "entries")} this term`, head: ["Date", "Mark", "Reason given", "Accepted", "Source"], noun: "entry", nounPlural: "entries", noRowOpen: true, rows: marks, emptyTitle: "Nothing but present marks", emptyBody: "Every register this term has this child present.", foot: a.pct !== null && a.pct < 75 ? "Below the 75% chronic threshold. The school's policy is to meet the guardian." : "Excusing an absence changes the term percentage, so it is logged with a name." }] },
    ],
  });
}

/* ───────────────────────── wellbeing ───────────────────────── */

function wellbeing({ d, wrap }: Body): RecordPage {
  const w = d.wellbeing;
  const incidents = w.log.filter((entry) => entry.kind === "Conduct").length;
  const rows: TableRow[] = w.log.map((entry) => ({ cells: [text(dayLabel(entry.date), { mono: true }), pill(entry.kind, entry.kind === "Commendation" ? "positive" : entry.kind === "Conduct" || entry.kind === "Safeguarding concern" ? "attention" : "neutral"), text(entry.entry), text(entry.by), pill(entry.outcome, stateTone(entry.outcome))], keywords: `${entry.kind} ${entry.entry}` }));
  const health = w.health;
  return wrap({
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Wellbeing", sub: "Recorded by the form master, the counsellor and the school nurse.", per: 3, cards: [{ label: "Conduct", value: incidents ? "Occasional" : "Clean", sub: incidents ? plural(incidents, "incident") : "No incidents on record", tone: incidents ? "attention" : "positive" }, { label: "Guidance and counselling", value: String(w.counselling), unit: w.counselling === 1 ? "session" : "sessions", sub: `${w.visits} sick-bay ${w.visits === 1 ? "visit" : "visits"}`, tone: "neutral" }, { label: "Health", value: health ? "On file" : "Nothing on file", sub: health?.conditions ?? "No known conditions recorded", tone: "sensitive", link: "Reveal the record", drawer: sensitiveDrawer(d) }] }] },
      ...(d.support && (d.support.plan || d.support.canManage)
        ? [{
            cols: "1fr",
            panels: [
              d.support.plan
                ? {
                    type: "facts" as const, title: "Learning support plan", tag: d.support.plan.overdue ? "Review overdue" : "Current", tagTone: (d.support.plan.overdue ? "attention" : "positive") as PanelTone,
                    sub: `Every teacher of ${d.name.split(" ")[0]} reads the strategies. ${d.support.canManage ? "The background below is yours and the leadership’s — a teacher never sees it." : ""}`.trim(), per: 1,
                    acts: d.support.canManage ? [{ label: "Revise the plan", primary: true, drawer: supportPlanDrawer(d) }, { label: "End the plan", drawer: endSupportPlanDrawer(d) }] : undefined,
                    facts: [...d.support.plan.strategies.map((entry): PanelFact => [entry.area, entry.strategy, ""]), ["Reviewed", dayLong(d.support.plan.reviewedOn), `Next review ${dayLong(d.support.plan.nextReviewOn)}`] as PanelFact, ...(d.support.canManage ? [["Background", d.support.plan.confidentialNote || "None written", "Held by the writers of the plan; never sent to a teacher"] as PanelFact] : [])],
                  }
                : { type: "note" as const, tone: "neutral" as PanelTone, title: "No learning support plan for this child", body: "If a child needs their teachers to work differently, write a plan: the strategies go to every teacher, the reasons stay with you.", acts: [{ label: "Write a plan", drawer: supportPlanDrawer(d) }] },
            ],
          }]
        : []),
      {
        cols: "1.15fr 1fr",
        panels: [
          {
            type: "table",
            title: "Conduct and guidance log",
            sub: "Every entry names who recorded it and how it was closed.",
            meta: `${plural(w.log.length, "entry", "entries")}`,
            search: "Find an entry",
            filters: [{ label: "Kind", value: "All", options: ["All", "Guidance", "Conduct", "Commendation", "Health", "Safeguarding concern"], column: 1 }],
            acts: [{ label: "Record a guidance note", primary: true, drawer: noteDrawer(d) }],
            head: ["Date", "Kind", "Entry", "Recorded by", "Outcome"],
            noun: "entry",
            nounPlural: "entries",
            noRowOpen: true,
            per: 8,
            rows,
            emptyTitle: "Nothing has been recorded",
            emptyBody: "A guidance note, a commendation or a conduct entry will appear here.",
            foot: "A guidance note is visible to the form master, the counsellor and school leadership — never to a subject teacher.",
          },
          {
            type: "facts",
            title: "Health and welfare",
            tag: "Sensitive",
            tagTone: "sensitive",
            sub: "Summary only. Opening the full record writes your name and the time to the audit log — at the moment you continue.",
            per: 1,
            acts: [{ label: "Reveal the full record", primary: true, drawer: sensitiveDrawer(d) }],
            facts: [["Known conditions", health?.conditions ?? "None recorded"], ["Allergies", health?.allergies ?? "None recorded"], ["Emergency contact", d.family.guardians[0] ? `${d.family.guardians[0].name} · ${d.family.guardians[0].phone}` : "No guardian on file"], ["Second emergency contact", d.family.guardians[1] ? `${d.family.guardians[1].name} · ${d.family.guardians[1].phone}` : "None on file"], ["Behind the reveal", "Blood group, genotype, counselling notes, disciplinary file"]],
          },
        ],
      },
    ],
  });
}

/* ───────────────────────── family ───────────────────────── */

function family({ d, registry, pool, wrap }: Body): RecordPage {
  void registry;
  const f = d.family;
  const guardianRows: TableRow[] = f.guardians.map((guardian) => ({
    cells: [nameCell(guardian.name, guardian.occupation ?? guardian.relation), text(guardian.relation), text(guardian.phone, { mono: true }), text(guardian.email ?? "—"), pill(guardian.primary ? "Primary" : "Secondary", guardian.primary ? "positive" : "neutral"), pill(guardian.portal, guardian.portal === "Active" ? "positive" : "attention"), pill(guardian.delivery, stateTone(guardian.delivery)), { kind: "action" as const, label: "Open", href: `/parents-guardians/guardians/${guardian.id}` }],
  }));
  const given = f.consent.filter((entry) => entry.status === "GIVEN").length;
  return wrap({
    rows: [
      ...(!f.guardians.length ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: "No guardian is mapped to this child", body: "Nothing can be published to a family that does not exist on the record — no report card, no invoice, no attendance message. Map one now, or link an existing guardian who already has other children here.", acts: [{ label: "Map a guardian to this child", drawer: mapGuardianDrawer(d, false, pool) }, { label: "Link an existing guardian", drawer: mapGuardianDrawer(d, true, pool) }] }] }] : []),
      { cols: "1fr", panels: [{ type: "table", title: "Guardians", tag: `${f.guardians.length} on file`, tagTone: "neutral", sub: "Who the school writes to, and what each of them can see.", meta: `${f.guardians.filter((guardian) => guardian.portal === "Active").length} of ${f.guardians.length} have activated the portal`, acts: [{ label: "Map another guardian", primary: true, drawer: mapGuardianDrawer(d, false, pool) }, { label: "Link an existing guardian", drawer: mapGuardianDrawer(d, true, pool) }], head: ["Guardian", "Relation", "Phone", "Email", "Contact", "Portal", "Delivery", ""], noun: "guardian", nounPlural: "guardians", noRowOpen: true, rows: guardianRows, emptyTitle: "Nobody is mapped", emptyBody: "Map a guardian so the family can be reached.", foot: "One guardian, one login — even with four children in the school." }] },
      {
        cols: "1.05fr 1fr",
        panels: [
          { type: "facts", title: "Consent", tag: given === f.consent.length && f.consent.length ? "Complete" : given ? "Gaps" : "None recorded", tagTone: given === f.consent.length && f.consent.length ? "positive" : "attention", sub: "Each records who gave it, when, and by what means.", per: 2, acts: [{ label: "Request the missing consent", href: "/parents-guardians/consent" }], facts: f.consent.map((entry) => [entry.name, entry.status === "GIVEN" ? `Given${entry.on ? ` ${dayLong(entry.on)}` : ""}${entry.means ? `, ${entry.means === "PORTAL" ? "in the portal" : entry.means === "PAPER" ? "on paper" : "in person"}` : ""}` : entry.status === "WITHDRAWN" ? "Withdrawn" : "Not recorded"] as PanelFact) },
          { type: "list", title: "What reached this family", sub: "Every send against this child, newest first.", items: f.sent.length ? f.sent.map((entry) => ({ label: entry.label, sub: entry.sub, pill: entry.pill, tone: "positive" as PanelTone })) : [{ label: "Nothing has been sent yet", sub: "Messages, reminders and invitations appear here.", pill: "None", tone: "neutral" as PanelTone }] },
        ],
      },
      { cols: "1fr", panels: [{ type: "list", title: "Authorised collectors", sub: "Who may collect this child from school.", items: [...f.collectors.map((collector) => ({ label: `${collector.name} · ${collector.relation}`, sub: collector.note, pill: collector.note.startsWith("No photograph") ? "No photograph" : "Authorised", tone: (collector.note.startsWith("No photograph") ? "negative" : "positive") as PanelTone })), { label: "Add a collector", sub: "A name with no photograph on file cannot collect.", pill: "Add", tone: "neutral" as PanelTone, viewLabel: "Add", drawer: collectorDrawer(d) }] }] },
    ],
  });
}

/* ───────────────────────── fees ───────────────────────── */

function fees({ d, wrap }: Body): RecordPage {
  const f = d.fees;
  const items: TableRow[] = f.items.map((item) => ({ cells: [text(item.name, { strong: true }), text(item.structure), text(naira(item.amount), { mono: true }), pill(f.owing === 0 ? "Paid" : f.paid ? "Part paid" : "Unpaid", f.owing === 0 ? "positive" : f.paid ? "attention" : "negative")] }));
  const receipts: TableRow[] = f.receipts.map((receipt) => ({ cells: [text(receipt.ref, { mono: true, strong: true }), text(receipt.at ? dayLabel(receipt.at) : "—", { mono: true }), text(receipt.term), text(receipt.mode), text(naira(receipt.amount), { mono: true, strong: true }), text(receipt.reference, { mono: true }), text(receipt.by), { kind: "action" as const, label: "Print receipt", drawer: receiptDrawer(receipt.id, receipt.ref) }] }));
  return wrap({
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "This term", per: 5, cards: [{ label: "Billed", value: naira(f.billed), sub: `${plural(f.items.length, "fee item")} billed`, tone: "neutral" }, { label: "Paid", value: naira(f.paid), sub: f.paid ? `${plural(f.receipts.length, "receipt")} on record` : "Nothing received", tone: f.paid ? "positive" : f.billed ? "negative" : "neutral" }, { label: "Outstanding", value: naira(f.owing), sub: f.owing ? `${plural(f.days, "day")} old` : f.billed ? "Settled in full" : "Not billed", tone: f.owing ? "attention" : "positive" }, { label: "Family", value: d.family.siblings ? `${d.family.siblings + 1} children` : "One child", sub: d.family.siblings ? "A family pays once" : "Only child on the roll", tone: "neutral" }, { label: "State", value: f.state, sub: "Read from the invoices", tone: FEE_TONE[f.state], link: "Open the family", href: `/fee-management/collections/families/${encodeURIComponent(f.familyId)}` }] }] },
      {
        cols: "1.05fr 1fr",
        panels: [
          { type: "table", title: "What was billed", tag: f.structures.length > 1 ? `${f.structures.length} structures` : undefined, tagTone: "neutral", sub: "The fee items this child carries, exactly as the structure lists them.", meta: f.structures.length ? `Structure: ${f.structures.join(" + ")} · ${d.term?.label ?? ""}` : "No invoice this term", acts: [{ label: "Open the structure", href: "/fee-management/structures" }], head: ["Fee item", "Structure", "Amount", "Status"], noun: "item", nounPlural: "items", noRowOpen: true, rows: items, emptyTitle: "Nothing has been billed", emptyBody: "No invoice has been raised for this child this term.", foot: "Every item on the invoice is listed, so the rows add up to the total billed." },
          { type: "table", title: "Invoices", sub: "Every invoice raised for this child.", meta: `${plural(f.invoices.length, "invoice")}`, head: ["Invoice", "Term", "Total", "Balance", "State"], noun: "invoice", nounPlural: "invoices", noRowOpen: true, rows: f.invoices.map((invoice) => ({ cells: [text(invoice.number, { mono: true, strong: true }), text(invoice.term), text(naira(invoice.total), { mono: true }), text(naira(invoice.balance), { mono: true, tone: invoice.balance ? "attention" : undefined }), pill(invoice.status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), invoice.status === "PAID" ? "positive" : invoice.status === "OVERDUE" ? "negative" : "attention")] })), empty: "No invoice has been raised." },
        ],
      },
      { cols: "1fr", panels: [{ type: "table", title: "Payment history · every payment ever made", tag: plural(receipts.length, "receipt"), tagTone: receipts.length ? "positive" : "neutral", sub: "Every receipt this child has ever been issued by this school, newest first. Reprint any of them.", meta: `${plural(receipts.length, "receipt")} · ${naira(f.receipts.reduce((sum, receipt) => sum + receipt.amount, 0))} received`, search: "Find a receipt by number or reference", head: ["Receipt", "Date", "Term", "Method", "Amount", "Reference", "Recorded by", ""], noun: "receipt", nounPlural: "receipts", noRowOpen: true, per: 10, rows: receipts, emptyTitle: "Nothing has ever been received", emptyBody: `The full ${naira(f.billed)} is outstanding.`, foot: "A receipt number is sequential and is never reissued. A reprint carries the same number, stamped DUPLICATE." }] },
    ],
  });
}

/* ───────────────────────── records ───────────────────────── */

function records({ d, registry, wrap }: Body): RecordPage {
  const r = d.records;
  const have = r.documents.filter((document) => document.state !== "Missing").length;
  const docs: TableRow[] = r.documents.map((document) => ({
    cells: [text(document.label, { strong: true }), text(document.source), text(document.on ? dayLabel(document.on) : "—"), pill(document.state, stateTone(document.state)), document.state === "Missing" ? { kind: "action" as const, label: "Record it", drawer: documentDrawer(d, document.label) } : text(document.file || "Recorded")],
  }));
  const stateWord = (value: string) => value;
  return wrap({
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Record completeness", sub: "What is missing blocks something specific later.", per: 4, cards: [{ label: "Documents on file", value: String(have), unit: `of ${r.required}`, sub: r.missing.length ? `${r.missing[0]} not recorded` : "Everything required is on file", tone: r.missing.length ? "attention" : "positive" }, { label: "Photograph", value: d.hasPhoto ? "On file" : "Not on file", sub: d.hasPhoto ? "Uploaded" : "The identity card prints without one", tone: d.hasPhoto ? "positive" : "attention" }, { label: "Change requests", value: String(r.pending), sub: r.pending ? "Awaiting a decision" : "None waiting", tone: r.pending ? "attention" : "neutral", link: r.pending ? "Open changes" : undefined, href: r.pending ? "/student-records/changes" : undefined }, { label: "Audit entries", value: String(r.audit.length), sub: "Every touch on this record", tone: "neutral" }] }] },
      {
        cols: "1.05fr 1fr",
        panels: [
          { type: "table", title: "Documents", sub: "Uploaded by the school or submitted by the family.", meta: `${have} on file · ${r.missing.length} missing`, acts: [{ label: "Upload a document", primary: true, drawer: documentDrawer(d) }], head: ["Document", "Source", "Recorded", "State", ""], noun: "document", nounPlural: "documents", noRowOpen: true, rows: docs, foot: r.missing.includes("Transfer certificate") ? "A missing transfer certificate blocks the WAEC entry file, not today's register." : "A missing document blocks the transcript or the examination entry file." },
          { type: "facts", title: "Identity and enrolment", sub: "The record itself. Any change here is routed for approval.", per: 2, acts: [{ label: "Request a change", drawer: requestChangeDrawer(["Given name", "Surname", "Date of birth", "Gender", "Status", "Arm", "Home address", "Nationality", "Previous school", "Languages at home", "House"], registry?.rows ?? [], { id: d.id, name: d.name }) }], facts: [["Full name", d.fullName], ["Admission number", d.adm], ["Date of birth", `${dayLong(d.dob)} · age ${d.age}`], ["Gender", d.gender], ["Nationality", d.nationality], ["Languages at home", d.language], ["Home address", d.address ?? "Not recorded"], ["House", d.house ?? "Not recorded"], ["Admitted", dayLong(d.admitted)], ["Previous school", d.previousSchool ?? "Not recorded"], ["Enrolment type", d.boarding.is ? "Boarding" : "Day"], ["Status", stateWord(d.state)]] },
        ],
      },
      {
        cols: "1fr",
        panels: [
          { type: "list", title: "Everything that has happened to this record", sub: "Change requests and the audit log, scoped to this child.", items: [...r.changes.map((change) => ({ label: `${change.field} change · ${change.before ?? "—"} → ${change.after}`, sub: `${dayLong(change.at)}`, pill: change.status === "PENDING" ? "Awaiting" : change.status === "APPROVED" ? "Approved" : "Declined", tone: (change.status === "PENDING" ? "attention" : change.status === "APPROVED" ? "positive" : "neutral") as PanelTone, viewLabel: change.status === "PENDING" ? "Decide" : undefined, href: change.status === "PENDING" ? "/student-records/changes" : undefined })), ...r.audit.map((entry) => ({ label: entry.label, sub: `${dayLong(entry.at)} · ${entry.by}`, pill: "Logged", tone: "positive" as PanelTone }))].slice(0, 12) },
        ],
      },
    ],
  });
}

export type { DossierSubject };
export { STATE_TONE };
