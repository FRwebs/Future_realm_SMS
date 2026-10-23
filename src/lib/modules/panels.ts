import type { ReactNode } from "react";

/**
 * The panel vocabulary the School Admin mockup builds every tab from.
 *
 * The mockup composes each tab as rows of panels, where a row declares its
 * column widths and holds one or more panels. These types mirror that exactly so
 * module content stays data rather than bespoke markup.
 */

/**
 * The mockup's status vocabulary. A state is never typed free-hand: every
 * figure, pill and chip in the product picks one of these.
 * ("negative" is the mockup's "critical".)
 */
export type PanelTone =
  | "neutral"
  | "positive"
  | "attention"
  | "negative"
  | "progress"
  | "submitted"
  | "withheld"
  | "sensitive"
  | "offline"
  | "vendor";

/** A label/value pair with an optional explanatory third line. */
export type PanelFact = [label: string, value: string, hint?: string];

/**
 * What opens when a trigger is pulled.
 *
 * The mockup's drawer is either a record you are reading — a list of facts — or
 * a decision you are about to commit, which states plainly what it will do
 * before it does it, and what it changed afterwards.
 *
 * Triggers are data rather than callbacks so module content stays serializable
 * and can be authored on the server.
 */
/**
 * What a commit drawer actually sends.
 *
 * Authored as data for the same reason every other trigger is: content is
 * written on the server, and a callback cannot cross that boundary. Without
 * this a commit drawer only *looked* like it did something — it flipped a local
 * flag and showed "Done" while the record behind it never moved.
 */
export type DrawerSubmit = {
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  /** Sent as-is, so the drawer never has to know what the record is. */
  body?: Record<string, unknown>;
  /**
   * Field label → payload key, for a drawer that edits rather than confirms.
   * A field not listed here is shown and never sent, exactly as in a form
   * panel — which is what lets a drawer display a value the endpoint would
   * reject alongside the ones it accepts.
   */
  map?: Record<string, string>;
  /**
   * Field label → (what the person picked → what the endpoint stores).
   *
   * A select reads "Senior Secondary" and the column holds SENIOR_SECONDARY.
   * Putting the enum on screen to keep the payload honest is the wrong trade,
   * and a callback cannot travel in server-authored content — so the pairing
   * is carried as data beside the field it belongs to.
   */
  encode?: Record<string, Record<string, string>>;
  /**
   * Field label → [record key, entry key]: gathers many fields into one object, for an endpoint that
   * takes "who covers each of these" as a record. `encode` still applies to each value.
   */
  nest?: Record<string, [key: string, entry: string]>;
  /** Set this and the drawer asks for a reason, sent under this key. */
  reasonKey?: string;
  reasonLabel?: string;
  /** A refusal that carries no reason cannot be acted on, so require it. */
  reasonRequired?: boolean;
};

export type DrawerStep = {
  title: string;
  /** One line on what this stage is for, shown under its title. */
  hint?: string;
  fields: FormField[];
};

/**
 * A document — a report card, a receipt, a fee schedule, an invoice — as data.
 *
 * The mockup shows these in a modal over the page they were opened from, with the page behind still
 * there, and prints the same paper. One spec draws both: the modal reads it, and so does the print page.
 */
export type DocCell = string | { text: string; tone?: PanelTone; bold?: boolean; mono?: boolean };
export type DocAct = { label: string; href?: string; drawer?: DrawerSpec; /** Prints the paper itself. */ print?: boolean; primary?: boolean };
export type DocumentSpec = {
  /** What the modal's bar calls it: "Report card preview". */
  heading: string;
  state?: { label: string; tone: PanelTone };
  meta?: string;
  letterhead: { name: string; place?: string; contact?: string };
  kicker: string;
  title: string;
  ref?: string;
  /** Stamped across the paper, so it can never pass for something it is not: DRAFT, DUPLICATE, PAID. */
  stamp?: { text: string; tone: PanelTone };
  idents: Array<[string, string]>;
  tables?: Array<{ title?: string; heads: Array<{ label: string; align?: "left" | "center" | "right" }>; rows: DocCell[][] }>;
  totals?: Array<{ label: string; value: string; sub?: string; tone?: PanelTone }>;
  /** Lines that sum something up, right-aligned under the table: subtotal, VAT, total. */
  summary?: Array<{ label: string; value: string; strong?: boolean }>;
  groups?: Array<{ title: string; items: Array<[string, string]> }>;
  blocks?: Array<{ label: string; body: string; by?: string }>;
  /** A short list under the blocks: the payments against an invoice. */
  list?: { title: string; empty: string; items: Array<{ left: string; right: string }> };
  footNote?: string;
  footRef?: string;
  /** Said in the modal's footer, beside the actions. */
  note?: string;
  /** Others like this one, to move between without closing: the rest of the arm. */
  peers?: { label: string; items: Array<{ label: string; load: string; active?: boolean }> };
  acts?: DocAct[];
};

export type DrawerSpec = {
  kicker?: string;
  title: string;
  sub?: string;
  facts?: PanelFact[];
  /**
   * What kind of decision the modal is, in the mockup's own vocabulary.
   *
   * The mode is not decoration: it picks the chip at the top of the modal —
   * a tone, an icon and a plain label ("Full record", "Confirm before it
   * runs") — so a person knows what is about to happen before they read the
   * title. "edit" additionally takes the change in two stages.
   *
   * "read" is kept as the older name for "view".
   */
  mode?: "read" | "view" | "edit" | "form" | "decide" | "output" | "commit" | "info" | "document";
  /** Set, and the overlay is the paper itself rather than a drawer: a report card, a receipt, an invoice. */
  doc?: DocumentSpec;
  commitLabel?: string;
  commitNote?: string;
  commitDone?: string;
  commitDoneBody?: string;
  /** Omit and the drawer confirms without sending — a dry run, not a decision. */
  submit?: DrawerSubmit;
  /**
   * A form taken in stages.
   *
   * Some edits ask for more than fits in one honest glance — an address, then
   * the authority that registered it, then who answers for it. Splitting those
   * is not decoration: a single wall of boxes makes somebody skim, and the
   * fields people skim are the ones that end up wrong.
   *
   * Steps and `fields` are alternatives. A drawer with steps collects across
   * all of them and sends one payload at the end.
   */
  steps?: DrawerStep[];
  /**
   * Set on a staged form that the mockup takes as a page rather than a modal — enrolling a student,
   * onboarding a member of staff. The page walks the same steps with the stages named, shows what has been
   * entered so far, and reads each stage back before anything is written.
   */
  page?: {
    /** What the person is making, for the review page's header. */
    reviewDesc?: string;
    /** Said in the confirmation that stands between the last stage and the write. */
    confirmBody: string;
    railTitle: string;
    rail: Array<[string, string]>;
    /** Said under the last stage's form. */
    footNote?: string;
    back: { label: string; href: string };
  };
  /**
   * Inputs, for an "Edit …" drawer.
   *
   * The mockup opens editing in a drawer rather than an inline form, so the
   * drawer has to be able to collect values — without this every "Edit X"
   * trigger could only describe a change and then confirm it, which is the
   * same hollow gesture the commit button used to be.
   */
  fields?: FormField[];
  /**
   * A URL that answers with the rest of this drawer as JSON, read when it is opened. For a record that
   * would cost a query per row to prepare for a list nobody opens — the drawer shows what it knows
   * (title, kicker) while the rest arrives, and is replaced by it.
   */
  load?: string;
  /** Offered once it has gone through, for the page that follows from it — "Back to the register". */
  next?: { label: string; href: string };
  /** A record that can be read but never edited — an audit entry, say. */
  readOnly?: boolean;
  readOnlyNote?: string;
  tone?: PanelTone;
  /**
   * Said above the values on the review stage of a form, e.g. "School days are
   * counted from the dates and the weekly pattern". The mockup gives every form
   * one, because the review is where a person decides whether to trust the save.
   */
  reviewNote?: string;
  /**
   * What opens when a record that was only being read is taken into editing —
   * the mockup's "Edit this record". A record is read first and changed on
   * purpose, so nobody lands in a form they did not ask for.
   */
  edit?: DrawerSpec;
  /** What the button into `edit` says, where "Edit this record" would be the wrong verb — "Notify them". */
  editLabel?: string;
  /**
   * Deleting the record this drawer shows. It always asks first, and says what
   * is being deleted and what it takes with it.
   */
  remove?: {
    endpoint: string;
    /** "event", "term" — used in "Delete this event?" */
    noun: string;
    warn?: string;
    done?: string;
    doneBody?: string;
  };
};

/** Where a trigger goes: another page, or a drawer over this one. */
export type Trigger = {
  href?: string;
  drawer?: DrawerSpec;
  /** Runs in the browser — for a surface that is built on the client and holds its own state. Never authored on the server. */
  run?: () => void;
};

export type KpiCard = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: PanelTone;
  /** Text of the card's link through to the list or record behind the figure. */
  link?: string;
} & Trigger;

export type TableCellKind =
  | { kind: "text"; text: string; tone?: PanelTone; strong?: boolean; mono?: boolean }
  | {
      kind: "name";
      name: string;
      sub?: string;
      /** The mockup shows a 24px initials avatar unless a cell opts out. */
      avatar?: false;
      avatarTone?: PanelTone;
    }
  | ({ kind: "pill"; label: string; tone?: PanelTone } & Trigger)
  /** How full something is: a bar with the figure beside it, e.g. "34 / 32". */
  | { kind: "bar"; pct: number; label: string; tone?: PanelTone }
  /** A capability a tier either has or does not: a tick, or a muted dash. */
  | { kind: "mark"; ok: boolean }
  /** A cell drawn by the client that holds it — a score being typed. `plain` is what search and filters read. */
  | { kind: "node"; node: ReactNode; plain?: string }
  | ({ kind: "action"; label: string } & Trigger);

export type TableRow = {
  /** What a bulk action sends for this row. */
  id?: string;
  cells: TableCellKind[];
  /** Opened when the row itself is clicked. */
  drawer?: DrawerSpec;
  href?: string;
  /** Free text the table's search box matches against, beyond the visible cells. */
  keywords?: string;
};

/**
 * A long table is sent one page at a time. The page the server drew, how many rows matched what was searched and chosen, and the address
 * that downloads all of them — so the table asks the server for the next page instead of holding every row.
 */
export type TableWindow = {
  /** What this table's controls are called in the address: `t0_1` is the second panel of the first row. */
  key: string;
  page: number;
  size: number;
  matched: number;
  total: number;
  q: string;
  /** The choice made on each filter, by its label. */
  filters: Record<string, string>;
  exportUrl: string;
};

/** A named dropdown over one column, e.g. ["State", "All", ["All","Marked","Unmarked"]]. */
export type TableFilter = {
  label: string;
  /** The option selected to begin with — usually the "all" one. */
  value: string;
  options: string[];
  /** Which column the filter narrows, by head index. Omit to match any cell. */
  column?: number;
  /**
   * What an option is looked for as, where the words on screen would match too much —
   * "Assigned" is inside "Unassigned". The row's `keywords` carry the token.
   */
  match?: Record<string, string>;
  /** Option → page. Choosing one goes there instead of narrowing the rows: a switcher between arms or subjects. */
  go?: Record<string, string>;
};

export type PanelAction = {
  label: string;
  primary?: boolean;
  /** SVG path for the header's primary button. Defaults to a plus. */
  icon?: string;
  /** On a table: download the rows as they are (or only the ticked ones, from the bulk bar) as a CSV. */
  export?: boolean;
  /**
   * On a table's bulk bar: the drawer acts on the ticked rows. Their `id`s are sent
   * under `key`, and the drawer says how many rows it applies to. On an action that
   * goes to a page (`href`) the ids travel on its query, comma-separated, under `key`.
   */
  selection?: { key: string; noun: string };
} & Trigger;

export type ListItem = {
  label: string;
  sub?: string;
  pill?: string;
  tone?: PanelTone;
  viewLabel?: string;
  /** Opened in a drawer, so a record reads the same wherever it is reached from. */
  facts?: PanelFact[];
  drawer?: DrawerSpec;
  href?: string;
  /** Runs in the browser, for a list built by a client surface (see `Trigger.run`). */
  run?: () => void;
};

export type BarRow = {
  label: string;
  value: number;
  /** Rendered at the end of the bar, e.g. "94.2%" or "₦1.2m". */
  display: string;
  sub?: string;
  tone?: PanelTone;
};

export type TileItem = {
  label: string;
  sub?: string;
  tone?: PanelTone;
  /** SVG path for the tile's icon chip. Defaults to the mockup's arrow. */
  icon?: string;
} & Trigger;

export type PickerOption = { value: string; label: string; sub?: string; group?: string };
export type MatrixRow = {
  key: string;
  label: string;
  sub?: string;
  /** Columns that can never be ticked on this row. */
  lock?: string[];
  /** The module this row belongs to; hidden unless `groupFrom` ticks it. */
  group?: string;
};
export type LineColumn = {
  key: string;
  label: string;
  kind?: "text" | "select";
  options?: string[];
  num?: boolean;
  w?: string;
  placeholder?: string;
};

/**
 * One field of a form panel.
 *
 * These are the mockup's own field kinds. A form is the only panel a person
 * types into, so it is the one place the product shows a control rather than a
 * value — a settings page rendered as a list of facts reads as a report.
 */
export type FormField = {
  label: string;
  hint?: string;
  /** Fills the whole row rather than one column. */
  span?: 2;
  required?: boolean;
  optional?: boolean;
  /** Shown to the right of a text field, e.g. "characters". */
  unit?: string;
  /** Shown only while another field holds (or includes) a value, e.g. a duty question for a non-teaching role. */
  when?: { field: string; equals?: string | string[]; includes?: string; excludes?: string };
} & (
  | { kind: "text"; value?: string; placeholder?: string; readOnly?: boolean; type?: "text" | "password" | "date" }
  | { kind: "area"; value?: string; placeholder?: string }
  | { kind: "select"; value?: string; options: string[] }
  | { kind: "toggle"; on?: boolean; onLabel?: string; offLabel?: string }
  | { kind: "choice"; value?: string; options: string[] }
  | {
      kind: "checks";
      checked?: string[];
      options: string[];
      /** Lay short options out as one wrapping line. */
      row?: boolean;
      /** Lets the person type an option the list does not hold; it becomes a real, ticked one. */
      addable?: boolean;
      addPlaceholder?: string;
      addLabel?: string;
      /** Starts again from the set for another field's value whenever that field changes. */
      seeds?: { field: string; sets: Record<string, string[]> };
    }
  | {
      kind: "static";
      value: string;
      /** What it says depends on another field: the case for that field's current value, else `value`. */
      by?: { field: string; cases: Record<string, { value: string; hint?: string }> };
    }
  /** Many people (or things) picked from a searchable list, with the chosen ones shown beside it. */
  | { kind: "picker"; options: PickerOption[]; checked?: string[]; placeholder?: string; noun?: string; nounPlural?: string; groupAll?: string }
  /**
   * Rows down, actions across: a tick for each. A row may belong to a group (a module), and a
   * group's rows are only offered while another field ticks that group. `seeds` replaces the
   * ticks when the field it names changes, so a role chosen as a starting point arrives set.
   */
  | {
      kind: "matrix";
      cols: string[];
      rows: MatrixRow[];
      checked?: string[];
      rowHead?: string;
      quick?: Array<{ label: string; set: "view" | "all" | "none" }>;
      groupFrom?: string;
      seeds?: { field: string; sets: Record<string, string[]> };
    }
  /** Rows a person writes: each column a text, a number or a choice. */
  | {
      kind: "lines";
      cols: LineColumn[];
      rows?: Array<Record<string, string>>;
      blank: Record<string, string>;
      addLabel?: string;
      presets?: Array<{ label: string; rows: Array<Record<string, string>> }>;
    }
  /**
   * A file the school keeps on record — a logo, a signature, a stamp. Three
   * choices, in this order: keep what is there, upload a new one, remove it.
   * Choosing the second opens a file picker; the image is shrunk in the browser
   * and kept on the record as it is, so nothing depends on a file store.
   */
  | { kind: "asset"; options: [keep: string, upload: string, remove: string] }
);

/**
 * What a form does when it is saved.
 *
 * `map` names which fields travel and under what key, so a form can show a
 * field the endpoint does not accept (a name the school sets) without silently
 * dropping it into a payload that would be rejected.
 */
export type FormSubmit = {
  endpoint: string;
  method?: "PATCH" | "POST";
  /** Field label → payload key. A field not listed here is never sent. */
  map: Record<string, string>;
  /** What to say once it has saved. */
  done: string;
  /** Clear these fields after a successful save, e.g. password boxes. */
  clearOnSuccess?: string[];
};

export type CourseCard = {
  title: string;
  meta: string;
  /** SVG path for the icon chip. */
  icon?: string;
  pill: string;
  tone: PanelTone;
  /** "Why this is for you" — said in a green strip under the title. */
  why?: string;
  /** 0–100. Omit for a course that has not been opened. */
  pct?: number;
  progress?: string;
  cta: string;
  href: string;
};

export type StepItem = {
  label: string;
  sub?: string;
  /** The number in the step's dot, where the steps are a window onto a longer run (the 9th child of 30). */
  n?: number;
  state: "done" | "current" | "todo" | "blocked";
  /** Where the stage opens — the applicants behind a pipeline count, say. */
  href?: string;
};

/**
 * One thing standing between the school and a deadline. Each names the record
 * that clears it and the person who owns it — never a bare count.
 */

/**
 * A register: the class's roll, taken as one action.
 *
 * This is the first panel whose interaction the vocabulary cannot express as
 * triggers — a status per child, submitted together. The panel carries the
 * roll and the endpoint; the renderer owns the grid, exactly as `form` does.
 */
export type RosterStudent = {
  id: string;
  name: string;
  admissionNumber: string | null;
  /** What is already marked for this day, if anything. */
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
};

export type RosterPanel = {
  type: "roster";
  title: string;
  sub?: string;
  meta?: string;
  date: string;
  classId: string;
  classes: Array<{ id: string; name: string; students: number }>;
  students: RosterStudent[];
  /** Where the whole register is posted, in one request. */
  endpoint: string;
  done: string;
  /** Shown instead of the grid when there is nobody to mark. */
  emptyNote?: string;
};


/**
 * A score sheet: a class's marks for one subject, entered together.
 *
 * Sibling of RosterPanel. Both are "a value per child, submitted as one
 * action", which is the shape triggers cannot express — but the values differ
 * enough (a choice of four versus two bounded numbers) that one panel trying
 * to be both would be worse than two that are each clear.
 */
export type ScoreStudent = {
  id: string;
  name: string;
  admissionNumber: string | null;
  continuousAssessment: number | null;
  exam: number | null;
  /** A published or approved sheet cannot be typed into, and says so. */
  locked: boolean;
  sheetStatus: string | null;
};

export type ScoreSheetPanel = {
  type: "scores";
  title: string;
  sub?: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  students: ScoreStudent[];
  /** Highest mark each column accepts, from the school's components. */
  maxCa: number;
  maxExam: number;
  endpoint: string;
  done: string;
  emptyNote?: string;
};

/**
 * A register being taken: a status for every child of an arm on one day, kept as a draft until it
 * is submitted whole. The component owns the grid; the panel carries the roll and what the server
 * says about it.
 */
export type MarkerStudent = {
  id: string;
  roll: number;
  name: string;
  adm: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
  reason: string;
  reasonCode: string;
  termRate: number | null;
};

export type MarkerPanel = {
  type: "marker";
  classId: string;
  arm: string;
  date: string;
  label: string;
  students: MarkerStudent[];
  reasons: string[];
  /** new, draft or submitted. */
  mode: string;
  /** Null when the person can edit; otherwise the reason they cannot. */
  whyNot: string | null;
  backdated: boolean;
  cutoff: string;
  startedAt: string | null;
  markedAt: string | null;
  draftEndpoint: string;
  submitEndpoint: string;
  overviewHref: string;
};

/** One column of a score sheet, pinned to the sheet when it was begun. */
export type SheetColumn = { key: string; id: string | null; code: string; name: string; short: string; max: number; weight: number };

export type SheetRowData = {
  id: string;
  name: string;
  adm: string;
  /** Column key → what is entered: a mark, "ABS" for absent, or null for nothing yet. */
  cells: Record<string, number | "ABS" | null>;
  /** What the other sheets of this child say, for the anomaly check. */
  others: number | null;
};

/**
 * A score sheet being entered: every child of an arm against the components of one subject.
 * Blank is not zero and absent is not zero, so the three states stay distinct all the way down.
 */
export type SheetEntryPanel = {
  type: "sheet";
  classId: string;
  subjectId: string;
  arm: string;
  subject: string;
  columns: SheetColumn[];
  rows: SheetRowData[];
  /** Grade bands in force, highest first. */
  bands: Array<{ label: string; min: number }>;
  passMark: number;
  /** Null when it can be typed into; otherwise why not. */
  whyNot: string | null;
  frameworkLabel: string;
  saveEndpoint: string;
  /** Deleting the whole entry: asks why, and says what goes with it. */
  remove?: DrawerSpec;
  previewHref: string;
  backHref: string;
  status: string;
};

/** A strip of days (or weeks) that can be walked: each is a link to the same page on another date. */
export type DayStripPanel = {
  type: "days";
  title: string;
  sub?: string;
  days: Array<{ label: string; sub?: string; href: string; state: "now" | "done" | "missing" | "plain" }>;
};

export type BlockerItem = {
  title: string;
  detail: string;
  action: string;
  tone?: PanelTone;
} & Trigger;

/**
 * One unit of outstanding work, with the person it sits with.
 * The mockup's trackers always name an owner and an age — never a bare count.
 */
export type TrackerRow = {
  unit: string;
  sub?: string;
  owner: string;
  role: string;
  state: string;
  age: string;
  overdue?: boolean;
  /** Where the work that clears it is done. */
  href?: string;
  /** How many records are behind the row; zero reads as clear. */
  count?: number;
  /** Opened by the row's own action, for work done in place rather than elsewhere. */
  drawer?: DrawerSpec;
  /** What that action says. */
  act?: string;
};

/** One cell of an editable grid: a figure or a sentence a person may type over. */
export type GridCell = {
  value: string;
  /** Not typed into. */
  static?: boolean;
  num?: boolean;
  bold?: boolean;
  /** Draws it as wrong (a rung that pays less than the one below it). */
  bad?: boolean;
  placeholder?: string;
  /** Shown in full naira, grouped, instead of as typed. */
  naira?: boolean;
  /** Worked out from other cells of the row: "c2 + c3", "(c2 + c3) * 12". Cells count from 0. */
  calc?: string;
};

export type GridRow = {
  /** What a save sends this row back as. */
  id?: string;
  cells: GridCell[];
  /** Offers to remove the row, which calls this endpoint. */
  remove?: { endpoint: string; method?: "DELETE" | "POST"; warn: string };
};

/**
 * A table whose cells are typed over in place — the pay ladder, the allowances, the KPI set.
 * Nothing is written until Save; the meter says whether what is typed is acceptable.
 */
export type GridPanel = {
  type: "grid";
  title: string;
  sub?: string;
  meta?: string;
  tag?: string;
  tagTone?: PanelTone;
  head: string[];
  /** Grid columns template, e.g. "0.4fr 1.05fr 0.85fr". */
  cols?: string;
  /** Column indexes laid right-aligned. */
  right?: number[];
  rows: GridRow[];
  /** Buttons that reshape a column: "grow" compounds `rate` % a row from the first, "flat" copies the first, "reset" restores. */
  presets?: Array<{ label: string; column: number; apply: "grow" | "flat" | "reset"; rate?: number; on?: boolean }>;
  presetLabel?: string;
  /** A last row the person fills in and adds. */
  draft?: { label: string; cells: GridCell[]; add: { endpoint: string; method?: "POST"; keys: string[]; body?: Record<string, unknown> } };
  /** A reading of a column's total against a target. */
  meter?: { label: string; column: number; target: number; unit?: string; note: string; okNote: string };
  /** Where Save sends the typed values: one object per row, by `keys`. */
  save?: { endpoint: string; method?: "PATCH" | "POST" | "PUT"; keys: string[]; label?: string; body?: Record<string, unknown>; done: string };
  acts?: PanelAction[];
  foot?: string;
};

/** One stage of a process: who acts, what they may do, how long they have, what happens if they do nothing. */
export type FlowStage = {
  name: string;
  who: string;
  does: string;
  scope: string;
  win: string;
  silence: string;
  notify: string[];
};

/** A process shown as its stages in order, each editable, movable and removable. */
export type FlowPanel = {
  type: "flow";
  flow: string;
  title: string;
  sub?: string;
  tag?: string;
  tagTone?: PanelTone;
  stages: FlowStage[];
  /** The stage the live item is at, if one is. */
  nowIndex?: number;
  /** A line generated from the stages. */
  plain?: string;
  presets?: Array<{ label: string }>;
  rules?: string[];
  /** Drawers for each stage's edit form, same order as `stages`, then one for adding. */
  editDrawers: DrawerSpec[];
  addDrawer: DrawerSpec;
  endpoint: string;
  acts?: PanelAction[];
};

export type Quote = { label: string; by: string; role?: string; when?: string; pill?: string; tone?: PanelTone; text?: string; emptyText?: string; act?: string; trigger?: Trigger; /** Pictures that go with it — addresses the browser can fetch with the reader's own sign-in. */ photos?: string[] };
export type QuotesPanel = { type: "quotes"; title: string; sub?: string; quotes: Quote[] };

export type Panel =
  | {
      type: "kpi";
      /** Names what the row counts. Left out, the tab's own heading is used. */
      title?: string;
      /** The line under it: the term the figures are for, or how to read them. */
      sub?: string;
      per?: number;
      cards: KpiCard[];
    }
  | {
      type: "tracker";
      title: string;
      sub?: string;
      meta?: string;
      rows: TrackerRow[];
      /** What the count of rows with nothing outstanding is called, e.g. "checks clear". */
      noun?: string;
      /** Ways the rows can be grouped, e.g. ["By issue type", "By owner"]. */
      groups?: string[];
      /** Rows for a group that is a different reading of the findings, not a re-sort of `rows`. */
      groupRows?: Record<string, TrackerRow[]>;
      /** Shown when nothing is outstanding. */
      clear?: { title: string; body: string };
    }
  | {
      type: "table";
      /** Lifted off the page: offered as one line at its foot, which opens it. The rule behind a page without making the page half rules. */
      tuck?: string;
      tuckIcon?: string;
      tuckKicker?: string;
      tuckNote?: string;
      title: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      head: string[];
      rows: TableRow[];
      acts?: PanelAction[];
      foot?: string;
      /** Actions laid in the foot bar, to the right of `foot` — where a long sheet ends and what to do with it begins. */
      footActs?: PanelAction[];
      /** Shown instead of rows when there are none. */
      empty?: string;
      /** The cells are themselves the controls, so a row does not also open a record behind them. */
      noRowOpen?: boolean;
      /** Placeholder for the table's own search box. */
      search?: string;
      filters?: TableFilter[];
      /** Set by the server on a long table: `rows` is one page of a longer list. */
      window?: TableWindow;
      /** Rows can be ticked, which reveals the bulk actions. */
      selectable?: boolean;
      bulkActs?: PanelAction[];
      /** Rows per page. Omit to show every row. */
      per?: number;
      /** Totals laid under the last page, e.g. a leave table's days taken. */
      summaryRows?: TableCellKind[][];
      emptyTitle?: string;
      emptyBody?: string;
      /** What one row is, for counts: "3 arms", "no teachers match". */
      noun?: string;
      nounPlural?: string;
      /** A wide table that fits its panel instead of sliding: tighter cells and headings that wrap, for tables of many small figures. */
      dense?: boolean;
    }
  | {
      type: "list";
      /** Lifted off the page: offered as one line at its foot, which opens it. The rule behind a page without making the page half rules. */
      tuck?: string;
      tuckIcon?: string;
      tuckKicker?: string;
      tuckNote?: string;
      title: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      items: ListItem[];
      acts?: PanelAction[];
      readOnly?: boolean;
      foot?: string;
    }
  | {
      type: "facts";
      /** Lifted off the page: offered as one line at its foot, which opens it. The rule behind a page without making the page half rules. */
      tuck?: string;
      tuckIcon?: string;
      tuckKicker?: string;
      tuckNote?: string;
      title: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      facts: PanelFact[];
      acts?: PanelAction[];
      foot?: string;
      /**
       * Facts per row. The mockup lays them out as an auto-fit grid, so `per`
       * only widens the minimum column: 1 gives one wide column of prose.
       */
      per?: number;
    }
  | {
      type: "note";
      /** Lifted off the page: offered as one line at its foot, which opens it. The rule behind a page without making the page half rules. */
      tuck?: string;
      tuckIcon?: string;
      tuckKicker?: string;
      tuckNote?: string;
      title?: string;
      body: string;
      tone?: PanelTone;
      /** SVG path for the note's icon chip. Defaults to the mockup's warning triangle. */
      icon?: string;
      acts?: PanelAction[];
    }
  | RosterPanel
  | ScoreSheetPanel
  | MarkerPanel
  | DayStripPanel
  | SheetEntryPanel
  | { type: "bars"; title: string; sub?: string; rows: BarRow[]; foot?: string }
  | {
      type: "tiles";
      title: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      per?: number;
      tiles: TileItem[];
    }
  /**
   * What this device itself knows and the server cannot: whether it is online, what it has queued, and how much
   * of the browser's storage it holds. Drawn on the device, so it is always about the device being used.
   */
  | { type: "device"; title?: string; sub?: string }
  | {
      type: "steps";
      title?: string;
      sub?: string;
      steps: StepItem[];
      foot?: string;
      /** Arrows either side, for steps that are a window onto a longer run. */
      prevHref?: string;
      nextHref?: string;
      prevTitle?: string;
      nextTitle?: string;
      /** Said at the right of the bar: "8 of 9 · Business Studies JSS 2 Gold". */
      note?: string;
    }
  | {
      type: "form";
      title?: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      /** 1 widens the minimum column, for fields whose value is a sentence. */
      per?: number;
      fields: FormField[];
      /** Wires the primary action to a real endpoint. */
      submit?: FormSubmit;
      formNote?: string;
      formNoteTone?: "critical";
      actions?: PanelAction[];
    }
  | { type: "quote"; body: string; attribution?: string }
  /**
   * A purpose-built surface that the panel vocabulary cannot draw — a scheme of work with its week ribbon, a note being written.
   * The server names the component and hands it its data; the component is looked up in the embed registry on the client.
   */
  | { type: "embed"; component: string; props: Record<string, unknown> }
  /** Courses as cards: what it is, where it stands, how far through, and — for a recommendation — why it was chosen. */
  | { type: "courses"; title: string; sub?: string; cards: CourseCard[] }
  | GridPanel
  | FlowPanel
  | QuotesPanel
  | {
      type: "blockers";
      title: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      items: BlockerItem[];
      acts?: PanelAction[];
    }
  | {
      /**
       * A tab whose content is not built yet. It states what the mockup puts
       * here rather than pretending the surface is finished.
       */
      type: "pending";
      title: string;
      body: string;
      contains: string[];
    };

/** A row of panels with its column template, e.g. "1.55fr 1fr". */
export type PanelRow = {
  cols: string;
  panels: Panel[];
};

export type TabContent = {
  /** Overrides the module heading for this tab, as the mockup does on Today. */
  title?: string;
  desc?: string;
  /** The tab's single most important action, shown in the header. */
  primary?: PanelAction;
  /** Secondary jumps out of this tab, beside the primary action. */
  launchers?: PanelAction[];
  rows: PanelRow[];
};

/** One module's content, keyed by tab slug. */
export type ModuleContent = Record<string, TabContent>;

export function row(cols: string, panels: Panel[]): PanelRow {
  return { cols, panels };
}

/** Shorthands mirroring the mockup's own cell helpers. */
export function text(
  value: string,
  options: { tone?: PanelTone; strong?: boolean; mono?: boolean } = {},
): TableCellKind {
  return { kind: "text", text: value, ...options };
}

export function name(
  value: string,
  sub?: string,
  options: { avatar?: false; avatarTone?: PanelTone } = {},
): TableCellKind {
  return { kind: "name", name: value, sub, ...options };
}

export function pill(label: string, tone: PanelTone = "neutral"): TableCellKind {
  return { kind: "pill", label, tone };
}

export function bar(pct: number, label: string, tone: PanelTone = "positive"): TableCellKind {
  return { kind: "bar", pct, label, tone };
}

export function action(label: string, href?: string): TableCellKind {
  return { kind: "action", label, href };
}

export function mark(ok: boolean): TableCellKind {
  return { kind: "mark", ok };
}
