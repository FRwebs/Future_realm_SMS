import type { PanelFact } from "@/lib/modules/panels";

/**
 * Curricula, and the six layers each one is made of.
 *
 * A curriculum is a thing a school owns, so the module lists them. Number 1 is
 * the one Nooria ships from the back office; the school can adopt it, copy it,
 * or build its own. The six layers are the inside of a curriculum — they belong
 * in the builder that opens when you create or edit one, never on the list.
 */

export type CurriculumState = "In force" | "Available" | "Draft" | "Archived";

export type Curriculum = {
  name: string;
  origin: "Nooria library" | "This school";
  sub: string;
  basis: string;
  state: CurriculumState;
  /** Arms using it, of the school's 42. */
  arms: string;
  layers: string;
};

export const curricula: Curriculum[] = [
  {
    name: "Nooria Standard · Nigerian Secondary",
    origin: "Nooria library",
    sub: "Shipped and maintained by Future Realm",
    basis: "Nigeria · WAEC / NECO",
    state: "Available",
    arms: "0",
    layers: "6",
  },
  {
    name: "Grace International · Senior & Junior",
    origin: "This school",
    sub: "Copied from the Nooria standard, then adjusted",
    basis: "Nigeria · WAEC-aligned",
    state: "In force",
    arms: "42",
    layers: "6",
  },
  {
    name: "Nooria Standard · Nigerian Primary",
    origin: "Nooria library",
    sub: "For Nursery and Primary stages",
    basis: "Nigeria · UBE",
    state: "Available",
    arms: "0",
    layers: "6",
  },
  {
    name: "Cambridge Lower Secondary",
    origin: "Nooria library",
    sub: "International curriculum",
    basis: "International · Cambridge",
    state: "Available",
    arms: "0",
    layers: "6",
  },
  {
    name: "Grace International · 2027 proposal",
    origin: "This school",
    sub: "Built ahead of the next session",
    basis: "Nigeria · WAEC-aligned",
    state: "Draft",
    arms: "0",
    layers: "4",
  },
];

export type CurriculumLayer = {
  label: string;
  facts: PanelFact[];
};

/**
 * The six layers, as the mockup states them. One list, read by the library
 * preview and by every layer drawer, so a layer never contradicts itself.
 */
export const curriculumLayers: CurriculumLayer[] = [
  {
    label: "Levels & Classes",
    facts: [
      ["Stages", "Nursery, Primary, Junior Secondary, Senior Secondary"],
      ["Classes", "Nursery 1–2 · Primary 1–6 · JSS 1–3 · SSS 1–3 · 14 in all"],
      ["Arms per class", "3 by default · named A, B, C"],
      ["Capacity per arm", "30 students"],
      ["Streaming", "From SSS 1 · Science, Commercial, Arts"],
      ["Promotion", "By average · pass mark 40 · reviewable per student"],
      ["Over-capacity", "Allowed but flagged, never silently refused"],
    ],
  },
  {
    label: "Subjects",
    facts: [
      ["Catalogue", "34 subjects"],
      ["Compulsory everywhere", "English Language, Mathematics, Civic Education"],
      ["Junior load", "Minimum 10 · maximum 13"],
      ["Senior load", "Minimum 8 · maximum 11"],
      ["Choice group 1", "Trade · pick exactly 1 · Garment Making, Catering, Book Keeping"],
      ["Choice group 2", "Language · pick at least 1 · French, Hausa, Igbo, Yoruba"],
      ["Choice group 3", "Science elective · pick 2 · Physics, Chemistry, Biology, Further Maths"],
      ["Registration", "The school registers on the student's behalf"],
      ["Registration closes", "End of week 2"],
      ["Changing after close", "Needs approval"],
    ],
  },
  {
    label: "Assessment",
    facts: [
      ["Components", "4 · First CA, Second CA, Project, Examination"],
      ["First CA", "Maximum 15 · weight 15%"],
      ["Second CA", "Maximum 15 · weight 15%"],
      ["Project", "Maximum 10 · weight 10%"],
      ["Examination", "Maximum 60 · weight 60%"],
      ["Total weight", "100 · must total exactly 100"],
      ["Aggregation", "Sum across the term"],
      ["Absent handling", "Excluded from the average — never scored zero"],
      ["Cumulative average", "Running across the session"],
      ["Locks", "On the first score entered against it"],
    ],
  },
  {
    label: "Grading",
    facts: [
      ["Scale", "WAEC 9-point · A1 to F9"],
      ["A1", "75–100 · Excellent · 1 point"],
      ["B2", "70–74 · Very good · 2 points"],
      ["B3", "65–69 · Good · 3 points"],
      ["C4", "60–64 · Credit · 4 points"],
      ["C6", "50–59 · Credit · 6 points"],
      ["D7", "40–49 · Pass · 7 points"],
      ["F9", "0–39 · Fail · 9 points"],
      ["Pass mark", "40 · credit 50 · distinction 75"],
      ["Position", "By arm and by class · ties share the position"],
    ],
  },
  {
    label: "Report Card",
    facts: [
      ["Template", "Standard · one page"],
      ["Behavioural domains", "Punctuality, Conduct, Participation · rated 1–5"],
      ["Sections printed", "Attendance summary, class average, position, grade key"],
      ["Remarks", "Form master 240 characters · principal 160"],
      ["Signatures", "Form master and Principal"],
      ["Release", "Portal and download"],
      ["Fee withholding", "Off · a card is never withheld for money by default"],
      ["Draft watermark", "On · unapproved cards print as DRAFT"],
    ],
  },
  {
    label: "Versions",
    facts: [
      ["New version takes effect", "From the next term"],
      ["Results already issued", "Keep the version they were issued under"],
      ["Reason required", "Yes · on every version"],
      ["Heads of Department", "Notified when a version is published"],
    ],
  },
];

export const curriculumLayerByLabel: Record<string, CurriculumLayer> = Object.fromEntries(
  curriculumLayers.map((layer) => [layer.label, layer]),
);
