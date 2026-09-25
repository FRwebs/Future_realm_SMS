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
  | { kind: "pill"; label: string; tone?: PanelTone }
  /** A capability a tier either has or does not: a tick, or a muted dash. */
  | { kind: "mark"; ok: boolean }
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
  /** SVG path for the header's primary button. Defaults to a plus. */
  icon?: string;
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
} & (
  | { kind: "text"; value?: string; placeholder?: string; readOnly?: boolean; type?: "text" | "password" | "date" }
  | { kind: "area"; value?: string; placeholder?: string }
  | { kind: "select"; value?: string; options: string[] }
  | { kind: "toggle"; on?: boolean; onLabel?: string; offLabel?: string }
  | { kind: "choice"; value?: string; options: string[] }
  | { kind: "checks"; checked?: string[]; options: string[]; /** Lay short options out as one wrapping line. */ row?: boolean }
  | { kind: "static"; value: string }
);

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
  | {
      type: "kpi";
      /** Names what the row counts. Left out, the tab's own heading is used. */
      title?: string;
      per?: number;
      cards: KpiCard[];
    }
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
  | {
      type: "facts";
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
      title?: string;
      body: string;
      tone?: PanelTone;
      /** SVG path for the note's icon chip. Defaults to the mockup's warning triangle. */
      icon?: string;
      acts?: PanelAction[];
    }
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
  | { type: "steps"; title: string; sub?: string; steps: StepItem[]; foot?: string }
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
      formNote?: string;
      formNoteTone?: "critical";
      actions?: PanelAction[];
    }
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

export function mark(ok: boolean): TableCellKind {
  return { kind: "mark", ok };
}
