import type { FormField } from "@/lib/modules/panels";

/**
 * The curriculum builder's seven sections, as data.
 *
 * The mockup builds a curriculum in seven sections and nothing else: the forms
 * that describe it, two grids that check themselves as you type, and a rail
 * that says how far you have got. Keeping the sections here rather than inside
 * the component means the wording is authored the same way every other panel in
 * the product is authored — and the builder stays a renderer.
 */

export type ComponentRow = { name: string; max: number; weight: number };
export type BandRow = { grade: string; lo: number; hi: number; label: string; points: number };

/** Weight patterns a school actually uses, offered as a starting point. */
export const COMPONENT_PRESETS: Record<string, ComponentRow[]> = {
  "CA + examination": [
    { name: "First CA", max: 15, weight: 15 },
    { name: "Second CA", max: 15, weight: 15 },
    { name: "Project", max: 10, weight: 10 },
    { name: "Examination", max: 60, weight: 60 },
  ],
  "Two CAs + examination": [
    { name: "First CA", max: 20, weight: 20 },
    { name: "Second CA", max: 20, weight: 20 },
    { name: "Examination", max: 60, weight: 60 },
  ],
  "Coursework + examination": [
    { name: "Coursework", max: 40, weight: 40 },
    { name: "Examination", max: 60, weight: 60 },
  ],
  "Examination only": [{ name: "Examination", max: 100, weight: 100 }],
  "Continuous only": [
    { name: "Test 1", max: 25, weight: 25 },
    { name: "Test 2", max: 25, weight: 25 },
    { name: "Test 3", max: 25, weight: 25 },
    { name: "Project", max: 25, weight: 25 },
  ],
};

export const BAND_PRESETS: Record<string, BandRow[]> = {
  "A1–F9 · nine point": [
    { grade: "A1", lo: 75, hi: 100, label: "Excellent", points: 1 },
    { grade: "B2", lo: 70, hi: 74, label: "Very good", points: 2 },
    { grade: "B3", lo: 65, hi: 69, label: "Good", points: 3 },
    { grade: "C4", lo: 60, hi: 64, label: "Credit", points: 4 },
    { grade: "C5", lo: 55, hi: 59, label: "Credit", points: 5 },
    { grade: "C6", lo: 50, hi: 54, label: "Credit", points: 6 },
    { grade: "D7", lo: 45, hi: 49, label: "Pass", points: 7 },
    { grade: "E8", lo: 40, hi: 44, label: "Pass", points: 8 },
    { grade: "F9", lo: 0, hi: 39, label: "Fail", points: 9 },
  ],
  "A*–U · Cambridge": [
    { grade: "A*", lo: 90, hi: 100, label: "Outstanding", points: 1 },
    { grade: "A", lo: 80, hi: 89, label: "Excellent", points: 2 },
    { grade: "B", lo: 70, hi: 79, label: "Very good", points: 3 },
    { grade: "C", lo: 60, hi: 69, label: "Good", points: 4 },
    { grade: "D", lo: 50, hi: 59, label: "Satisfactory", points: 5 },
    { grade: "E", lo: 40, hi: 49, label: "Pass", points: 6 },
    { grade: "U", lo: 0, hi: 39, label: "Ungraded", points: 7 },
  ],
  "A–F · four point": [
    { grade: "A", lo: 70, hi: 100, label: "Excellent", points: 4 },
    { grade: "B", lo: 60, hi: 69, label: "Very good", points: 3 },
    { grade: "C", lo: 50, hi: 59, label: "Credit", points: 2 },
    { grade: "D", lo: 45, hi: 49, label: "Pass", points: 1 },
    { grade: "E", lo: 40, hi: 44, label: "Weak pass", points: 1 },
    { grade: "F", lo: 0, hi: 39, label: "Fail", points: 0 },
  ],
  "Pass / Merit / Distinction": [
    { grade: "Distinction", lo: 70, hi: 100, label: "Distinction", points: 1 },
    { grade: "Merit", lo: 55, hi: 69, label: "Merit", points: 2 },
    { grade: "Pass", lo: 40, hi: 54, label: "Pass", points: 3 },
    { grade: "Fail", lo: 0, hi: 39, label: "Fail", points: 4 },
  ],
};

export const DEFAULT_COMPONENTS = COMPONENT_PRESETS["CA + examination"];
export const DEFAULT_BANDS = BAND_PRESETS["A1–F9 · nine point"];

/**
 * Whether a set of bands covers every mark from 0 to 100 exactly once.
 *
 * A gap leaves a score with no grade at all and an overlap leaves it with two,
 * so this is checked as the person types rather than at the end — the mockup
 * refuses to call a scale valid until it is contiguous.
 */
export function checkBands(bands: BandRow[]): { ok: boolean; why: string } {
  if (!bands.length) return { ok: false, why: "No bands yet. A mark has nothing to be called." };

  const sorted = bands.slice().sort((a, b) => a.lo - b.lo);
  const bottom = sorted[0];
  const top = sorted[sorted.length - 1];

  if (bottom.lo !== 0) return { ok: false, why: `Nothing covers 0 to ${bottom.lo - 1}.` };
  if (top.hi !== 100) return { ok: false, why: `Nothing covers ${top.hi + 1} to 100.` };

  for (const band of sorted) {
    if (band.hi < band.lo) return { ok: false, why: `${band.grade} ends before it starts.` };
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (next.lo > current.hi + 1) {
      return { ok: false, why: `Nothing covers ${current.hi + 1} to ${next.lo - 1}.` };
    }
    if (next.lo <= current.hi) {
      return { ok: false, why: `${current.grade} and ${next.grade} overlap.` };
    }
  }

  return { ok: true, why: "Contiguous from 0 to 100, with no gaps and no overlaps." };
}

export type BuilderSection = {
  key: string;
  /** The rail's label for this section. */
  label: string;
  /** The heading on the section itself, numbered as the mockup numbers it. */
  title: string;
  sub: string;
} & (
  | { kind: "form"; fields: FormField[] }
  | { kind: "components" }
  | { kind: "bands" }
);

export const BUILDER_SECTIONS: BuilderSection[] = [
  {
    key: "identity",
    label: "Name and basis",
    title: "1 · Name and basis",
    sub: "The name families, teachers and every report card will see.",
    kind: "form",
    fields: [
      {
        kind: "text",
        label: "Curriculum name",
        required: true,
        span: 2,
        placeholder: "e.g. Grace International · Senior & Junior",
        hint: "Must be unique in this school",
      },
      {
        kind: "select",
        label: "Region or awarding basis",
        required: true,
        options: [
          "National · Nigeria (WAEC / NECO)",
          "National · Ghana (WASSCE)",
          "National · Kenya (CBC)",
          "National · South Africa (NSC)",
          "National · India (CBSE)",
          "International · Cambridge",
          "International · IB",
          "International · American (AP)",
          "International · British (National Curriculum)",
          "Own framework",
        ],
        hint: "Decides which presets the later sections offer",
      },
      {
        kind: "select",
        label: "Language of instruction",
        value: "English",
        options: ["English", "French", "Arabic", "Portuguese", "Spanish", "Kiswahili", "Bilingual — two languages"],
      },
      {
        kind: "text",
        label: "Short description",
        span: 2,
        optional: true,
        placeholder: "One line for whoever reads this curriculum next",
      },
    ],
  },
  {
    key: "levels",
    label: "Levels and classes",
    title: "2 · Levels and classes",
    sub: "The stages this school runs and how a student moves up them.",
    kind: "form",
    fields: [
      {
        kind: "select",
        label: "Stage naming",
        required: true,
        value: "Nursery / Primary / Junior / Senior",
        options: [
          "Nursery / Primary / Junior / Senior",
          "Grade 1–12",
          "Year 1–13",
          "Kindergarten / Elementary / Middle / High",
          "Cycle 1–4",
          "Custom",
        ],
        hint: "Pick the vocabulary your country uses",
      },
      {
        kind: "text",
        label: "Stages operated",
        required: true,
        placeholder: "Nursery, Primary, Junior Secondary, Senior Secondary",
      },
      {
        kind: "text",
        label: "Classes in each stage",
        span: 2,
        required: true,
        placeholder: "Nursery 1–3, Primary 1–6, JSS 1–3, SSS 1–3",
        hint: "Comma separated — ranges are expanded for you",
      },
      { kind: "choice", label: "Arms are named", value: "A, B, C", options: ["A, B, C", "1, 2, 3", "Gold, Silver", "Custom"] },
      {
        kind: "select",
        label: "Streaming starts at",
        value: "No streaming",
        options: ["No streaming", "From the first senior class", "From the first junior class", "School decides per class"],
      },
      {
        kind: "select",
        label: "Promotion rule",
        required: true,
        value: "By term average",
        options: [
          "By term average",
          "By average with a minimum in core subjects",
          "By subject credits earned",
          "Automatic — age based",
          "Manual — decided per student",
        ],
      },
      { kind: "text", label: "Pass mark", unit: "out of 100", value: "40" },
    ],
  },
  {
    key: "subjects",
    label: "Subjects",
    title: "3 · Subjects",
    sub: "What this curriculum offers, and the limits on what a student may carry.",
    kind: "form",
    fields: [
      {
        kind: "area",
        label: "Subject catalogue",
        span: 2,
        required: true,
        placeholder: "One per line, name then code — Mathematics, MTH\nEnglish Language, ENG\nBiology, BIO",
        hint: "Paste a list — one subject per line. Codes are optional.",
      },
      { kind: "text", label: "Minimum a student must take", unit: "subjects", value: "8" },
      { kind: "text", label: "Maximum a student may take", unit: "subjects", value: "11" },
      {
        kind: "text",
        label: "Compulsory for everyone",
        span: 2,
        optional: true,
        placeholder: "Mathematics, English Language",
      },
      {
        kind: "area",
        label: "Choice groups",
        span: 2,
        optional: true,
        placeholder: "Pick 1 of: Technical Drawing, Food & Nutrition, Visual Arts\nAt least 1 of: French, Arabic",
        hint: "One rule per line. Leave blank if a student picks freely.",
      },
    ],
  },
  {
    key: "assessment",
    label: "Assessment",
    title: "4 · Assessment",
    sub: "How the marks a teacher enters add up to one number for the term.",
    kind: "components",
  },
  {
    key: "grading",
    label: "Grading",
    title: "5 · Grading",
    sub: "What a mark is called on a report card, and where the lines fall.",
    kind: "bands",
  },
  {
    key: "report",
    label: "Report card",
    title: "6 · Report card",
    sub: "The only section a parent ever sees.",
    kind: "form",
    fields: [
      {
        kind: "select",
        label: "Template",
        required: true,
        value: "Standard · subjects and remarks",
        options: [
          "Standard · subjects and remarks",
          "Compact · one page",
          "Detailed · components shown",
          "Narrative · comments only",
          "Transcript style",
        ],
      },
      {
        kind: "select",
        label: "Position is shown",
        value: "Within the arm",
        options: ["Within the arm", "Within the class", "Both", "Not shown — no ranking"],
      },
      {
        kind: "text",
        label: "Behavioural domains",
        span: 2,
        optional: true,
        placeholder: "Punctuality, Neatness, Cooperation",
        hint: "Comma separated — each is rated by the form master.",
      },
      { kind: "text", label: "Form master remark limit", unit: "characters", value: "240" },
      { kind: "text", label: "Principal remark limit", unit: "characters", value: "160" },
      {
        kind: "checks",
        label: "Also print on the card",
        span: 2,
        options: [
          "Attendance summary",
          "Class average beside the student average",
          "Grade key",
          "Next term resumption date",
          "School stamp area",
          "Guardian signature line",
        ],
        checked: ["Attendance summary", "Grade key", "Next term resumption date"],
      },
    ],
  },
  {
    key: "rollout",
    label: "Rollout",
    title: "7 · Rollout",
    sub: "When this curriculum starts, and what it is called in the record.",
    kind: "form",
    fields: [
      {
        kind: "text",
        label: "Version label",
        value: "Version 1",
        hint: "Every result issued records the version it was issued under",
      },
      {
        kind: "select",
        label: "Put it in force",
        value: "Not yet — save as a draft",
        options: ["Not yet — save as a draft", "From the next term", "From the next session"],
        hint: "A curriculum in force can never be swapped mid-term",
      },
      {
        kind: "select",
        label: "Applies to",
        value: "Every arm",
        span: 2,
        options: ["Every arm", "Junior classes only", "Senior classes only", "Selected arms — I will pick them"],
      },
      {
        kind: "static",
        label: "Results already issued",
        value: "Keep the curriculum they were issued under",
        hint: "A family's report card is never restated behind them",
      },
    ],
  },
];
