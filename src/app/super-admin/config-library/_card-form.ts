import type { ResourceField } from "@/components/forms/resource-form";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";

/** The steps a report card layout goes through before it can reach a school. */
export const CARD_STEPS = [
  { name: "Identity", sub: "What it is for, and who may be given it." },
  { name: "Sections", sub: "What appears, and in what order. Anything switched off here simply does not print." },
  { name: "Rules", sub: "The behaviours that make this layout different from the others." },
  { name: "Review", sub: "Nobody publishes their own layout." }
];

export const CARD_SECTION_LIST = [
  { key: "header", label: "School header with logo", sub: "Name, address, term, session", on: true },
  { key: "identity", label: "Pupil identity and attendance", sub: "Name, class, admission number, days present of days open", on: true },
  { key: "subjectTable", label: "Subject table with component scores", sub: "Each assessment component shown, not just the total", on: true },
  { key: "average", label: "Class or arm average per subject", sub: "Off on a no-ranking layout", on: true },
  { key: "position", label: "Subject position", sub: "Off on a no-ranking layout", on: true },
  { key: "cumulative", label: "Cumulative column from Term 2", sub: "Carries earlier terms forward on the same sheet", on: true },
  { key: "domains", label: "Behavioural domains", sub: "Five-point scale across the school’s chosen domains", on: true },
  { key: "comments", label: "Teacher and principal comments", sub: "Drawn from the school’s editable comment bank", on: true },
  { key: "feeBalance", label: "Fee balance", sub: "Only where the school chooses to show it — never on by default", on: false },
  { key: "signatures", label: "Signature blocks", sub: "Class teacher and principal", on: true }
] as const;

const TIERS = [
  { label: "All tiers", value: "STANDARD,PREMIUM,ELITE" },
  { label: "Premium and Elite", value: "PREMIUM,ELITE" },
  { label: "Elite only", value: "ELITE" }
];

type Card = SuperAdminConfigLibrary["reportCards"][number];

/** The four-step form for a layout — blank for a new one, filled in for a draft being edited. */
export function cardFields(layouts: Card[], item?: Card): ResourceField[] {
  const spec = item?.spec;
  const tiers = item?.availableToTiers.length ? item.availableToTiers.join(",") : "STANDARD,PREMIUM,ELITE";
  const step = (name: string, fields: ResourceField[]): ResourceField[] => fields.map((field) => ({ ...field, wizardStep: name }));
  return [
    ...step("Identity", [
      { name: "name", label: "Layout name", required: true, defaultValue: item?.name ?? "", placeholder: "e.g. Competency-based layout", section: "The layout", full: true },
      { name: "bestFor", label: "Best for", required: true, defaultValue: item?.bestFor ?? "", placeholder: "e.g. Descriptive-band systems where children are not ranked", section: "The layout", full: true },
      { name: "availableToTiers", label: "Available to", type: "select", defaultValue: TIERS.some((tier) => tier.value === tiers) ? tiers : "STANDARD,PREMIUM,ELITE", options: TIERS, note: "Branded layouts are Elite only, because they need an approved logo", section: "The layout" },
      { name: "baseOnId", label: "Base on", type: "select", defaultValue: "", options: [{ label: "A blank sheet", value: "" }, ...layouts.filter((layout) => layout.id !== item?.id).map((layout) => ({ label: layout.name, value: layout.id }))], note: "Copies that layout’s sections and rules when you leave the sections as they are", section: "The layout" },
      { name: "paper", label: "Paper", type: "select", defaultValue: spec?.paper ?? "A4 portrait", options: [{ label: "A4 portrait", value: "A4 portrait" }, { label: "A4 landscape", value: "A4 landscape" }, { label: "A5 portrait", value: "A5 portrait" }], section: "The layout" },
      { name: "sides", label: "Sides", type: "select", defaultValue: spec?.sides ?? "One", options: [{ label: "One", value: "One" }, { label: "Two", value: "Two" }], section: "The layout" }
    ]),
    ...step("Sections", CARD_SECTION_LIST.map((section) => ({ name: section.key, label: section.label, type: "switch" as const, on: spec ? spec.sections[section.key] === true : section.on, note: section.sub, object: "sections", section: "Include" }))),
    ...step("Rules", [
      { name: "positionRule", label: "Position rule", type: "select", defaultValue: spec?.positionRule ?? "SHOWN", options: [{ label: "Position shown", value: "SHOWN" }, { label: "Position from a chosen level", value: "FROM_LEVEL" }, { label: "No position anywhere on the sheet", value: "NONE" }], note: "Position shown, position from a chosen level, or no position at all", section: "Ranking and averaging" },
      { name: "averaging", label: "Averaging", type: "select", defaultValue: spec?.averaging ?? "ARM", options: [{ label: "Arm average", value: "ARM" }, { label: "Class average", value: "CLASS" }, { label: "None — descriptive bands cannot be averaged", value: "NONE" }], section: "Ranking and averaging" },
      { name: "gradingDisplay", label: "Grading display", type: "select", defaultValue: spec?.gradingDisplay ?? "GRADE", options: [{ label: "Grade", value: "GRADE" }, { label: "Descriptive band only", value: "DESCRIPTIVE" }], section: "Ranking and averaging" },
      { name: "reissue", label: "Reissue behaviour", type: "select", defaultValue: spec?.reissue ?? "VERSIONED", options: [{ label: "Versioned per issue date", value: "VERSIONED" }, { label: "Always the latest layout", value: "LATEST" }], note: "A card reissued next year still prints exactly as the parent first received it", section: "Ranking and averaging" },
      { name: "p1", label: "Must render with 6 subjects and with 24", type: "locked", note: "A layout that breaks at high subject counts is not portable", section: "Portability" },
      { name: "p2", label: "Must render with no behavioural domains configured", type: "locked", note: "Not every system uses them", section: "Portability" },
      { name: "p3", label: "Must render in a system with no position and no averaging", type: "locked", note: "A layout whose rules say no ranking cannot also print a position or an average", section: "Portability" }
    ]),
    ...step("Review", [
      { name: "r1", label: "Run the Layer 6 portability tests", type: "locked", note: "Run automatically when it is sent for review — a failure blocks publication", section: "Before it is offered to a school" },
      { name: "r2", label: "Preview with sample data", type: "locked", note: "Available on the layout once it is saved as a draft", section: "Before it is offered to a school" },
      { name: "r3", label: "Reviewed by a second person", type: "locked", note: "Enforced — the author cannot approve their own layout", section: "Before it is offered to a school" },
      { name: "targetRelease", label: "Target release", defaultValue: item?.targetRelease ?? "", placeholder: "e.g. Before Term 2 2026/27", section: "Route it" }
    ])
  ];
}
