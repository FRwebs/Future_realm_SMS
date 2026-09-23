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
export type DrawerSpec = {
  kicker?: string;
  title: string;
  sub?: string;
  facts?: PanelFact[];
  /** A "commit" drawer asks for confirmation and reports what happened. */
  mode?: "read" | "commit";
  commitLabel?: string;
  commitNote?: string;
  commitDone?: string;
  commitDoneBody?: string;
  /** A record that can be read but never edited — an audit entry, say. */
  readOnly?: boolean;
  readOnlyNote?: string;
  tone?: PanelTone;
};

/** Where a trigger goes: another page, or a drawer over this one. */
export type Trigger = {
  href?: string;
  drawer?: DrawerSpec;
};

export type KpiCard = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: PanelTone;
  /** Text of the card's link through to another module. */
  link?: string;
  href?: string;
};

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
  | { kind: "pill"; label: string; tone?: PanelTone }
  | ({ kind: "action"; label: string } & Trigger);

export type TableRow = {
  cells: TableCellKind[];
  /** Opened when the row itself is clicked. */
  drawer?: DrawerSpec;
  href?: string;
  /** Free text the table's search box matches against, beyond the visible cells. */
  keywords?: string;
};

/** A named dropdown over one column, e.g. ["State", "All", ["All","Marked","Unmarked"]]. */
export type TableFilter = {
  label: string;
  /** The option selected to begin with — usually the "all" one. */
  value: string;
  options: string[];
  /** Which column the filter narrows, by head index. Omit to match any cell. */
  column?: number;
};

export type PanelAction = {
  label: string;
  primary?: boolean;
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

export type StepItem = {
  label: string;
  sub?: string;
  state: "done" | "current" | "todo" | "blocked";
};

/**
 * One thing standing between the school and a deadline. Each names the record
 * that clears it and the person who owns it — never a bare count.
 */
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
};

export type Panel =
  | { type: "kpi"; per?: number; cards: KpiCard[] }
  | {
      type: "tracker";
      title: string;
      sub?: string;
      meta?: string;
      rows: TrackerRow[];
      /** Shown when nothing is outstanding. */
      clear?: { title: string; body: string };
    }
  | {
      type: "table";
      title: string;
      sub?: string;
      meta?: string;
      tag?: string;
      tagTone?: PanelTone;
      head: string[];
      rows: TableRow[];
      acts?: PanelAction[];
      foot?: string;
      /** Shown instead of rows when there are none. */
      empty?: string;
      /** Placeholder for the table's own search box. */
      search?: string;
      filters?: TableFilter[];
      /** Rows can be ticked, which reveals the bulk actions. */
      selectable?: boolean;
      bulkActs?: PanelAction[];
      /** Rows per page. Omit to show every row. */
      per?: number;
      /** What one row is, for counts: "3 arms", "no teachers match". */
      noun?: string;
      nounPlural?: string;
    }
  | {
      type: "list";
      title: string;
      sub?: string;
      items: ListItem[];
      acts?: PanelAction[];
      readOnly?: boolean;
      foot?: string;
    }
  | { type: "facts"; title: string; sub?: string; facts: PanelFact[]; foot?: string }
  | { type: "note"; title?: string; body: string; tone?: PanelTone }
  | { type: "bars"; title: string; sub?: string; rows: BarRow[]; foot?: string }
  | { type: "tiles"; title: string; sub?: string; per?: number; tiles: TileItem[] }
  | { type: "steps"; title: string; sub?: string; steps: StepItem[]; foot?: string }
  | { type: "quote"; body: string; attribution?: string }
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

export function action(label: string, href?: string): TableCellKind {
  return { kind: "action", label, href };
}
