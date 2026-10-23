/**
 * The master library every school draws a copy from — curricula (with their layers 2, 4 and 6), grading scales, report card
 * layouts, country records and the subject mappings between versions — as set out in the Back Office "Curriculum & Academics" module.
 *
 * Platform data, not school data: it is safe to run against any database and it only ever adds. A row that already exists under the
 * same name and version is left exactly as it is, so nothing a Product Lead has edited is overwritten.
 *
 *   npx tsx prisma/seed-config-library.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TERM_DATES = { start: "September", terms: 3 };
const NERDC = "Nigerian National (NERDC 2025)";
const PRE_2025 = "Nigerian National (pre-2025)";
const BRITISH = "Nigerian British";
const AMERICAN = "Nigerian American";

/* ───────────────────────── layers of the Nigerian template ───────────────────────── */

const nerdcLayers = {
  default: true,
  levels: [
    { stage: "Early Years", classes: "Creche, Pre-Nursery, Nursery 1–3", exam: "—", notes: "Naming varies widely; the template ships a common default and expects schools to rename" },
    { stage: "Primary", classes: "Primary 1 – Primary 6", exam: "—", notes: "Lower primary (1–3) and upper primary (4–6) carry different subject sets" },
    { stage: "Junior Secondary", classes: "JSS 1 – JSS 3", exam: "BECE", notes: "End of the basic education cycle; performance determines progression" },
    { stage: "Senior Secondary", classes: "SSS 1 – SSS 3", exam: "WASSCE / NECO", notes: "Streaming into Science, Humanities or Business begins at SSS 1" }
  ],
  levelsFootnote: "Arms are enabled at every class. Progression is threshold-based on the session average, with the pass mark set by the school.",
  junior: {
    range: "JSS 1 to JSS 3 · minimum 12, maximum 14 subjects",
    subjects: [
      { name: "English Studies", category: "Core" },
      { name: "Mathematics", category: "Core" },
      { name: "Nigerian Language — one of Hausa, Igbo, Yoruba", category: "Compulsory choice" },
      { name: "Intermediate Science", category: "Core", note: "Core — merges former Basic Science and Basic Technology" },
      { name: "Physical and Health Education", category: "Core" },
      { name: "Digital Technologies", category: "Core", note: "Core — formerly Computer Studies" },
      { name: "Christian or Islamic Religious Studies", category: "Compulsory choice" },
      { name: "Nigerian History", category: "Core", note: "Core — compulsory Primary 1 to JSS 3" },
      { name: "Social and Citizenship Studies", category: "Core", note: "Core — merges Social Studies and Civic Education" },
      { name: "Cultural and Creative Arts", category: "Core" },
      { name: "Business Studies", category: "Core" },
      { name: "Trade subject — one required", category: "Compulsory choice" },
      { name: "French · Arabic", category: "Optional" }
    ]
  },
  senior: {
    sub: "Five compulsory core subjects plus stream electives — schools typically present 8 to 9 in total",
    core: [
      { name: "English Language", applies: "All streams" },
      { name: "General Mathematics", applies: "All streams" },
      { name: "Citizenship and Heritage Studies", applies: "All streams — formerly Civic Education" },
      { name: "Digital Technologies", applies: "All streams — now compulsory" },
      { name: "One trade subject", applies: "Carried forward from junior secondary" }
    ],
    streams: [
      { stream: "Science stream", subjects: "Biology, Chemistry, Physics, Agriculture, Further Mathematics, Physical Education, Health Education, Foods and Nutrition, Geography, Technical Drawing" },
      { stream: "Humanities stream", subjects: "Nigerian History, Government, CRS, IRS, Nigerian Language, French, Arabic, Visual Arts, Music, Literature-in-English, Home Management, Catering Craft" },
      { stream: "Business stream", subjects: "Accounting, Commerce, Marketing, Economics" }
    ],
    footnote: "Stream restriction is enforced at subject assignment — Economics and Marketing are restricted to commercial students."
  },
  trade: {
    sub: "Chosen at junior secondary and carried forward as a core subject through senior secondary",
    subjects: [
      "Solar Photovoltaic Installation and Maintenance", "Beauty and Cosmetology",
      "Fashion Design and Garment Making", "Computer Hardware and GSM Repairs",
      "Livestock Farming", "Horticulture and Crop Production"
    ],
    footnote: "Technical colleges follow a separate and much wider set administered by the technical examinations board — supported as a variant selected at school setup, not as a different curriculum."
  },
  primary: {
    lower: ["English Studies", "Mathematics", "Nigerian Language (choice)", "Basic Science", "Physical and Health Education", "CRS or Islamic Studies (choice)", "Nigerian History", "Social and Citizenship Studies", "Cultural and Creative Arts", "Arabic (optional)"],
    upper: ["English Studies", "Mathematics", "Nigerian Language (choice)", "Basic Science and Technology", "Physical and Health Education", "Basic Digital Literacy", "CRS or Islamic Studies (choice)", "Nigerian History", "Social and Citizenship Studies", "Cultural and Creative Arts", "Pre-Vocational Studies", "French · Arabic (optional)"]
  },
  assessment: {
    components: [
      { code: "CA1", name: "First CA", max: 20, weight: 10 },
      { code: "CA2", name: "Second CA", max: 20, weight: 30 },
      { code: "EXAM", name: "Examination", max: 100, weight: 60 }
    ],
    termAggregation: "Weighted sum to a score out of 100",
    sessionAggregation: "Average of three terms, with a running cumulative on second and third term reports",
    position: "Computed within arm and class; arm position displayed by default",
    ties: "Equal position, next position skipped",
    absent: "Recorded as absent, never as zero — excluded from the component average, shown explicitly on the report card",
    frameworks: [
      { name: "Balanced (40:60)", components: "First CA, Second CA, Examination", weights: "10 / 30 / 60", typicalUser: "The most common configuration among mid-sized private schools" },
      { name: "Examination-weighted (30:70)", components: "First CA, Second CA, Examination", weights: "10 / 20 / 70", typicalUser: "Schools oriented tightly around external examination preparation" },
      { name: "Examination-dominant (20:80)", components: "Continuous Assessment, Examination", weights: "20 / 80", typicalUser: "More traditional schools, and some senior secondary streams" },
      { name: "Custom", components: "Any components the school defines", weights: "Must total 100", typicalUser: "Schools with project work, practical marks or homework as separate components" }
    ]
  },
  reportCard: { layout: "Standard portrait A4" }
};

const subjectList = [
  "English Studies", "Mathematics", "Nigerian Language", "Intermediate Science", "Physical and Health Education", "Digital Technologies",
  "Christian Religious Studies", "Islamic Religious Studies", "Nigerian History", "Social and Citizenship Studies", "Cultural and Creative Arts", "Business Studies",
  "Pre-Vocational Studies", "French", "Arabic", "English Language", "General Mathematics", "Citizenship and Heritage Studies"
];

type CurriculumSeed = { name: string; version: string; country: string; lifecycle: "ACTIVE" | "SUPERSEDED" | "DRAFT"; calendarType: "THREE_TERM" | "TWO_SEMESTER"; subjects: string[]; language?: string; layers?: object; effectiveFrom?: string };

const curricula: CurriculumSeed[] = [
  { name: NERDC, version: "1.2", country: "Nigeria", lifecycle: "ACTIVE", calendarType: "THREE_TERM", subjects: subjectList, language: "English", layers: nerdcLayers, effectiveFrom: "2025-09-01" },
  { name: PRE_2025, version: "3.4", country: "Nigeria", lifecycle: "SUPERSEDED", calendarType: "THREE_TERM", language: "English", effectiveFrom: "2024-09-01",
    subjects: ["English Studies", "Mathematics", "Basic Science", "Basic Technology", "Social Studies", "Civic Education", "Computer Studies", "Home Economics", "Physical and Health Education", "Christian Religious Studies", "Islamic Religious Studies", "Cultural and Creative Arts", "Business Studies"] },
  { name: BRITISH, version: "1.0", country: "Nigeria", lifecycle: "ACTIVE", calendarType: "THREE_TERM", language: "English", subjects: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics", "Geography", "History", "Information and Communication Technology"] },
  { name: AMERICAN, version: "1.0", country: "Nigeria", lifecycle: "ACTIVE", calendarType: "TWO_SEMESTER", language: "English", subjects: ["English Language Arts", "Mathematics", "Science", "Social Studies", "Physical Education", "Art"] },
  { name: "International Baccalaureate", version: "1.0", country: "Nigeria", lifecycle: "DRAFT", calendarType: "TWO_SEMESTER", language: "English", subjects: ["Language and Literature", "Language Acquisition", "Individuals and Societies", "Sciences", "Mathematics", "Arts"] },
  { name: "Ghanaian National", version: "1.0", country: "Ghana", lifecycle: "DRAFT", calendarType: "THREE_TERM", language: "English", subjects: ["English Language", "Mathematics", "Integrated Science", "Social Studies", "Ghanaian Language", "Religious and Moral Education"] },
  { name: "Kenyan Competency-Based", version: "1.0", country: "Kenya", lifecycle: "DRAFT", calendarType: "THREE_TERM", language: "English", subjects: ["English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies", "Creative Arts"] },
  { name: "South African National", version: "1.0", country: "South Africa", lifecycle: "DRAFT", calendarType: "THREE_TERM", language: "English", subjects: ["Home Language", "First Additional Language", "Mathematics", "Natural Sciences", "Social Sciences", "Life Orientation"] }
];

/* ───────────────────────── grading scales ───────────────────────── */

type Band = { grade: string; min: number; max: number; remark?: string };
const scales: Array<{ name: string; version: string; passMark: number; lifecycle: "ACTIVE" | "DRAFT"; applicableCurricula: string[]; gradeBands: Band[] }> = [
  { name: "Nigerian examination (9-band)", version: "1.0", passMark: 40, lifecycle: "ACTIVE", applicableCurricula: [NERDC, PRE_2025], gradeBands: [
    { grade: "A1", min: 75, max: 100, remark: "Excellent" }, { grade: "B2", min: 70, max: 74, remark: "Very good" }, { grade: "B3", min: 65, max: 69, remark: "Good" },
    { grade: "C4", min: 60, max: 64, remark: "Credit" }, { grade: "C5", min: 55, max: 59, remark: "Credit" }, { grade: "C6", min: 50, max: 54, remark: "Credit" },
    { grade: "D7", min: 45, max: 49, remark: "Pass" }, { grade: "E8", min: 40, max: 44, remark: "Pass" }, { grade: "F9", min: 0, max: 39, remark: "Fail" }] },
  { name: "Primary / JSS (5-band)", version: "1.0", passMark: 40, lifecycle: "ACTIVE", applicableCurricula: [], gradeBands: [
    { grade: "A", min: 70, max: 100, remark: "Excellent" }, { grade: "B", min: 60, max: 69, remark: "Very Good" }, { grade: "C", min: 50, max: 59, remark: "Good" },
    { grade: "D", min: 40, max: 49, remark: "Fair" }, { grade: "F", min: 0, max: 39, remark: "Needs improvement" }] },
  // IGCSE boundaries are set per subject by the board; these are the indicative percentages a school starts from.
  { name: "IGCSE", version: "1.0", passMark: 40, lifecycle: "ACTIVE", applicableCurricula: [BRITISH], gradeBands: [
    { grade: "A*", min: 90, max: 100, remark: "Indicative boundary — set per subject" }, { grade: "A", min: 80, max: 89 }, { grade: "B", min: 70, max: 79 }, { grade: "C", min: 60, max: 69 },
    { grade: "D", min: 50, max: 59 }, { grade: "E", min: 40, max: 49 }, { grade: "F", min: 30, max: 39 }, { grade: "G", min: 20, max: 29 }, { grade: "U", min: 0, max: 19, remark: "Ungraded" }] },
  { name: "Grade point (4.0)", version: "1.0", passMark: 60, lifecycle: "ACTIVE", applicableCurricula: [AMERICAN], gradeBands: [
    { grade: "A", min: 90, max: 100, remark: "4.0" }, { grade: "B", min: 80, max: 89, remark: "3.0" }, { grade: "C", min: 70, max: 79, remark: "2.0" },
    { grade: "D", min: 60, max: 69, remark: "1.0" }, { grade: "F", min: 0, max: 59, remark: "0" }] },
  // Descriptive only: no numeric score is shown or averaged. The ranges exist so the band validator can tell the bands are contiguous.
  { name: "Descriptive bands only", version: "1.0", passMark: 25, lifecycle: "DRAFT", applicableCurricula: ["Kenyan Competency-Based"], gradeBands: [
    { grade: "Exceeding", min: 75, max: 100 }, { grade: "Meeting", min: 50, max: 74 }, { grade: "Approaching", min: 25, max: 49 }, { grade: "Below", min: 0, max: 24 }] }
];

/* ───────────────────────── report card layouts ───────────────────────── */

const ALL_TIERS = ["STANDARD", "PREMIUM", "ELITE"];
const layouts: Array<{ name: string; bestFor: string; tiers: string[]; active: boolean; summary: string }> = [
  { name: "Standard portrait A4", bestFor: "Most Nigerian private schools — the great majority", tiers: ALL_TIERS, active: true, summary: "Position shown · cumulative column from Term 2 · behavioural domains · fee balance optional" },
  { name: "Combined primary + secondary", bestFor: "Nursery-to-SSS schools on one template", tiers: ALL_TIERS, active: true, summary: "One layout across all levels · subject table adapts per level · position shown from Primary 4" },
  { name: "British curriculum layout", bestFor: "International schools in Nigeria", tiers: ALL_TIERS, active: true, summary: "Effort and attainment separate · no class position · tutor comment per subject" },
  { name: "Compact layout", bestFor: "Schools with high subject counts", tiers: ALL_TIERS, active: true, summary: "Fits 18 subjects on one side · remarks shortened to one line · position shown" },
  { name: "No-ranking layout", bestFor: "Systems and schools that deliberately do not rank children", tiers: ALL_TIERS, active: true, summary: "No position, no class average, no cumulative ranking anywhere on the sheet" },
  { name: "Branded layout", bestFor: "Elite schools with approved logo and colours", tiers: ["ELITE"], active: true, summary: "School logo and two brand colours · versioned per issue date so a reissued card matches the original" },
  { name: "Competency-based layout", bestFor: "Descriptive-band systems — Kenya from Phase 3", tiers: ALL_TIERS, active: false, summary: "Descriptive bands only · no numeric score, no averaging, no position · awaiting review" }
];

/* ───────────────────────── country records ───────────────────────── */

const countries = [
  { country: "Ghana", currency: "GHS", defaultChannel: "WHATSAPP", dataProtectionRegime: "Data Protection Act 2012", consentAge: 18 },
  { country: "Kenya", currency: "KES", defaultChannel: "SMS", dataProtectionRegime: "Data Protection Act 2019", consentAge: 18 },
  { country: "United Kingdom", currency: "GBP", defaultChannel: "EMAIL", dataProtectionRegime: "UK GDPR", consentAge: 13 }
];

/* ───────────────────────── subject mappings, 2024 structure → NERDC 2025 ───────────────────────── */

const mappings: Array<[string, string, "RENAMED" | "MERGED"]> = [
  ["Basic Science", "Intermediate Science", "MERGED"],
  ["Basic Technology", "Intermediate Science", "MERGED"],
  ["Social Studies", "Social and Citizenship Studies", "MERGED"],
  ["Civic Education", "Social and Citizenship Studies", "MERGED"],
  ["Computer Studies", "Digital Technologies", "RENAMED"],
  ["Civic Education (SSS)", "Citizenship and Heritage Studies", "RENAMED"],
  ["Home Economics", "Pre-Vocational Studies", "MERGED"]
];


/* ───────────────────────── what the library table and the structure sheet say about each template ───────────────────────── */

const SIX = (rows: Array<[string, string, string]>) => rows.map(([layer, holds, detail]) => ({ layer, holds, detail }));
const PORTABILITY = "All eight portability tests are checked before a template is published";
const descriptors: Record<string, { characteristics: string; phase?: string; market: string; structure?: ReturnType<typeof SIX>; portability?: string }> = {
  [NERDC]: { market: "Nigeria", characteristics: "Three terms, September start, JSS and SSS structure, nine-band examination scale, compulsory trade subject, streaming from SSS 1", portability: PORTABILITY,
    structure: SIX([
      ["1 · Calendar", "Three terms · September start", "Term 1 Sep–Dec, Term 2 Jan–Apr, Term 3 Apr–Jul"],
      ["2 · Levels and classes", "Nursery 1–3, Primary 1–6, JSS 1–3, SSS 1–3", "Arms per class, named by the school (A, B, Gold, Silver)"],
      ["3 · Subjects", "JSS and SSS frameworks · one trade subject compulsory", "Streaming from SSS 1 — Science, Humanities, Business"],
      ["4 · Assessment", "First CA 10% · Second CA 30% · Examination 60%", "Weights must total 100 or results cannot be computed"],
      ["5 · Grading", "Nigerian examination 9-band · A1 to F9", "Pass at 40, credit at C6 (50)"],
      ["6 · Report card", "Standard portrait A4 · position shown", "Behavioural domains, class teacher and principal signature blocks"]]) },
  [PRE_2025]: { market: "Nigeria", characteristics: "The superseded structure, retained for cohorts completing under it — required for the transition" },
  [BRITISH]: { market: "Nigeria · international", characteristics: "IGCSE grading, British subject naming, three terms retained to match the local calendar", portability: PORTABILITY,
    structure: SIX([
      ["1 · Calendar", "Three terms · September start", "Kept local so the school year matches Nigerian schools around it"],
      ["2 · Levels and classes", "Early Years, Year 1–11, Sixth Form", "British year naming throughout"],
      ["3 · Subjects", "IGCSE option groups", "Choice groups at Year 10"],
      ["4 · Assessment", "Coursework 20% · Mock 20% · Examination 60%", "Per-subject override allowed"],
      ["5 · Grading", "IGCSE · A* to U", "Pass at Grade E, credit at Grade C"],
      ["6 · Report card", "British layout · no class position", "Effort and attainment shown separately"]]) },
  [AMERICAN]: { market: "Nigeria · international", characteristics: "Grade levels, grade-point scale, semester option" },
  "International Baccalaureate": { market: "Nigeria · international", phase: "Phase 2", characteristics: "Seven-point scale, IB subject groups, two-semester structure" },
  "Ghanaian National": { market: "Ghana", phase: "Phase 2", characteristics: "Three terms, Ghanaian subject list, national examination alignment — a configuration record, not a build" },
  "Kenyan Competency-Based": { market: "Kenya", phase: "Phase 3", characteristics: "Competency-based assessment, descriptive bands, three terms" },
  "South African National": { market: "South Africa", phase: "Phase 3", characteristics: "January session start, seven-level achievement scale, four terms" }
};

/** The order the library lists them in. */
const ORDER = [NERDC, PRE_2025, BRITISH, AMERICAN, "International Baccalaureate", "Ghanaian National", "Kenyan Competency-Based", "South African National"];

/** Adds the descriptive fields to a template that is already in the library, without touching anything else on it. */
async function describeTemplates() {
  let patched = 0;
  for (const [name, d] of Object.entries(descriptors)) {
    const row = await prisma.curriculumTemplate.findFirst({ where: { name } });
    if (!row) continue;
    const layers = (row.layers ?? {}) as Record<string, unknown>;
    if (layers.characteristics && layers.order) continue;
    await prisma.curriculumTemplate.update({ where: { id: row.id }, data: { layers: { ...layers, order: ORDER.indexOf(name) + 1, characteristics: d.characteristics, market: d.market, ...(d.phase ? { phase: d.phase } : {}), ...(d.structure ? { structure: d.structure } : {}), ...(d.portability ? { portability: d.portability } : {}) } } });
    patched += 1;
  }
  return patched;
}


/* ───────────────────────── what the library tracks beyond the rows themselves ───────────────────────── */

const frameworkRows = [
  { name: "Balanced (40:60)", typicalUser: "The most common configuration among mid-sized private schools", components: [{ code: "CA1", name: "First CA", max: 20, weight: 10 }, { code: "CA2", name: "Second CA", max: 20, weight: 30 }, { code: "EXAM", name: "Examination", max: 100, weight: 60 }] },
  { name: "Examination-weighted (30:70)", typicalUser: "Schools oriented tightly around external examination preparation", components: [{ code: "CA1", name: "First CA", max: 20, weight: 10 }, { code: "CA2", name: "Second CA", max: 20, weight: 20 }, { code: "EXAM", name: "Examination", max: 100, weight: 70 }] },
  { name: "Examination-dominant (20:80)", typicalUser: "More traditional schools, and some senior secondary streams", components: [{ code: "CA", name: "Continuous Assessment", max: 40, weight: 20 }, { code: "EXAM", name: "Examination", max: 100, weight: 80 }] },
  { name: "Custom", typicalUser: "Schools with project work, practical marks or homework as separate components", isCustom: true, components: [] as Array<{ code: string; name: string; max: number; weight: number }> }
];

const scaleFacts: Record<string, { scaleType: string; isDefault?: boolean; creditGrade?: string; distinctionGrade?: string; failingGrade?: string }> = {
  "Nigerian examination (9-band)": { scaleType: "PERCENTAGE", isDefault: true, creditGrade: "C6", distinctionGrade: "B3", failingGrade: "F9" },
  "Primary / JSS (5-band)": { scaleType: "PERCENTAGE", failingGrade: "F" },
  IGCSE: { scaleType: "LETTER", creditGrade: "C", failingGrade: "U" },
  "Grade point (4.0)": { scaleType: "POINTS", failingGrade: "F" },
  "Descriptive bands only": { scaleType: "DESCRIPTIVE", failingGrade: "Below" }
};

const ALL_ON = { header: true, identity: true, subjectTable: true, average: true, position: true, cumulative: true, domains: true, comments: true, feeBalance: false, signatures: true };
const cardSpecs: Record<string, { status: "LIVE" | "DRAFT"; spec: object }> = {
  "Standard portrait A4": { status: "LIVE", spec: { sections: ALL_ON, positionRule: "SHOWN", averaging: "ARM", gradingDisplay: "GRADE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } },
  "Combined primary + secondary": { status: "LIVE", spec: { sections: ALL_ON, positionRule: "FROM_LEVEL", averaging: "ARM", gradingDisplay: "GRADE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } },
  "British curriculum layout": { status: "LIVE", spec: { sections: { ...ALL_ON, average: false, position: false, cumulative: false, domains: false }, positionRule: "NONE", averaging: "NONE", gradingDisplay: "GRADE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } },
  "Compact layout": { status: "LIVE", spec: { sections: ALL_ON, positionRule: "SHOWN", averaging: "ARM", gradingDisplay: "GRADE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } },
  "No-ranking layout": { status: "LIVE", spec: { sections: { ...ALL_ON, average: false, position: false, cumulative: false }, positionRule: "NONE", averaging: "NONE", gradingDisplay: "GRADE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } },
  "Branded layout": { status: "LIVE", spec: { sections: ALL_ON, positionRule: "SHOWN", averaging: "ARM", gradingDisplay: "GRADE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } },
  "Competency-based layout": { status: "DRAFT", spec: { sections: { ...ALL_ON, average: false, position: false, cumulative: false }, positionRule: "NONE", averaging: "NONE", gradingDisplay: "DESCRIPTIVE", reissue: "VERSIONED", paper: "A4 portrait", sides: "One" } }
};

async function trackLibrary() {
  let frameworks = 0, scalesPatched = 0, cardsPatched = 0, supersededDated = 0;
  for (const [index, row] of frameworkRows.entries()) {
    if (await prisma.assessmentFrameworkTemplate.findUnique({ where: { name: row.name } })) continue;
    await prisma.assessmentFrameworkTemplate.create({ data: { name: row.name, typicalUser: row.typicalUser, components: row.components, isCustom: row.isCustom ?? false, position: index + 1 } });
    frameworks += 1;
  }
  for (const [name, facts] of Object.entries(scaleFacts)) {
    const rows = await prisma.gradingScaleTemplate.findMany({ where: { name, creditGrade: null, failingGrade: null } });
    for (const row of rows) {
      await prisma.gradingScaleTemplate.update({ where: { id: row.id }, data: { scaleType: facts.scaleType, isDefault: facts.isDefault ?? false, creditGrade: facts.creditGrade ?? null, distinctionGrade: facts.distinctionGrade ?? null, failingGrade: facts.failingGrade ?? null } });
      scalesPatched += 1;
    }
  }
  for (const [name, card] of Object.entries(cardSpecs)) {
    const row = await prisma.reportCardTemplate.findUnique({ where: { name } });
    if (!row || row.spec) continue;
    await prisma.reportCardTemplate.update({ where: { id: row.id }, data: { spec: card.spec, status: card.status, isActive: card.status === "LIVE" } });
    cardsPatched += 1;
  }
  const old = await prisma.curriculumTemplate.findFirst({ where: { name: PRE_2025, effectiveTo: null, lifecycle: "SUPERSEDED" } });
  if (old) { await prisma.curriculumTemplate.update({ where: { id: old.id }, data: { effectiveTo: new Date("2025-09-01") } }); supersededDated += 1; }
  return { frameworks, scalesPatched, cardsPatched, supersededDated };
}

async function main() {
  const made = { curricula: 0, scales: 0, layouts: 0, countries: 0, mappings: 0 };

  for (const c of curricula) {
    const exists = await prisma.curriculumTemplate.findUnique({ where: { name_version: { name: c.name, version: c.version } } });
    if (exists) continue;
    await prisma.curriculumTemplate.create({
      data: {
        name: c.name, version: c.version, country: c.country, subjects: c.subjects, calendarType: c.calendarType, language: c.language ?? null, owner: "FutureRealm",
        lifecycle: c.lifecycle, isActive: c.lifecycle === "ACTIVE" || c.lifecycle === "SUPERSEDED",
        effectiveFrom: c.effectiveFrom ? new Date(c.effectiveFrom) : null, validatedAt: c.lifecycle === "DRAFT" ? null : new Date(),
        supersededAt: c.lifecycle === "SUPERSEDED" ? new Date("2025-09-01") : null, layers: c.layers ?? undefined,
        classStructure: c.layers ? { terms: TERM_DATES.terms, start: TERM_DATES.start } : undefined
      }
    });
    made.curricula += 1;
  }

  for (const s of scales) {
    const exists = await prisma.gradingScaleTemplate.findUnique({ where: { name_version: { name: s.name, version: s.version } } });
    if (exists) continue;
    await prisma.gradingScaleTemplate.create({
      data: { name: s.name, version: s.version, passMark: s.passMark, gradeBands: s.gradeBands, applicableCurricula: s.applicableCurricula, lifecycle: s.lifecycle, isActive: s.lifecycle === "ACTIVE", validatedAt: s.lifecycle === "ACTIVE" ? new Date() : null }
    });
    made.scales += 1;
  }

  for (const l of layouts) {
    const exists = await prisma.reportCardTemplate.findUnique({ where: { name: l.name } });
    if (exists) continue;
    await prisma.reportCardTemplate.create({
      data: { name: l.name, availableToTiers: l.tiers, isActive: l.active, applicableCurricula: [], layoutConfig: { layout: l.summary, bestFor: l.bestFor } }
    });
    made.layouts += 1;
  }

  for (const c of countries) {
    const exists = await prisma.countryProfile.findUnique({ where: { country: c.country } });
    if (exists) continue;
    await prisma.countryProfile.create({ data: { ...c, isLive: false, verificationSources: [] } });
    made.countries += 1;
  }

  const from = await prisma.curriculumTemplate.findUnique({ where: { name_version: { name: PRE_2025, version: "3.4" } } });
  const to = await prisma.curriculumTemplate.findUnique({ where: { name_version: { name: NERDC, version: "1.2" } } });
  if (from && to) {
    for (const [fromSubject, toSubject, relationship] of mappings) {
      const exists = await prisma.templateSubjectMapping.findFirst({ where: { fromTemplateId: from.id, toTemplateId: to.id, fromSubject, toSubject } });
      if (exists) continue;
      await prisma.templateSubjectMapping.create({ data: { fromTemplateId: from.id, toTemplateId: to.id, fromSubject, toSubject, relationship } });
      made.mappings += 1;
    }
  }

  const described = await describeTemplates();
  const tracked = await trackLibrary();
  console.log("Config library seeded:", made, { described }, tracked);
}

main().finally(() => prisma.$disconnect());
