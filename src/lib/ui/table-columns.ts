import type { TableCellKind } from "@/lib/modules/panels";

/**
 * How wide each column of a table is, by one rule for every table in the product.
 *
 * Ported from the mockup's own sizing pass. Columns that are shaped by what they hold — a number,
 * a chip, a tick, a typed box, a row's action — are given their own content and nothing more.
 * Every column left over shares the slack in proportion to what is actually in it, so a table
 * cannot read crammed down one side with a hand's width of dead space down the other.
 *
 * The widths are measured from the text, not from the rendered page, because the table is drawn on
 * the server: an estimate every table agrees on beats a perfect measurement half of them never get.
 * The constants are the mockup's, and they are per-character widths at the table's own font size.
 */

/** Below this a column is unreadable; above it, no single column may swallow the table. */
const MIN_WIDTH = 44;
const MAX_WIDTH = 300;
/** A flexible column never reserves more than this before the share takes over. */
const FLEX_FLOOR = 132;
const GAP = 14;

/** What a cell reads as, for the purpose of measuring it. */
export function cellText(cell: TableCellKind | undefined): string {
  if (!cell) return "";
  switch (cell.kind) {
    case "text": return cell.text;
    case "name": return cell.name;
    case "pill": return cell.label;
    case "bar": return cell.label;
    case "action": return cell.label;
    case "mark": return "";
    case "node": return cell.plain ?? "";
    default: return "";
  }
}

/** The width one column wants, from its heading and everything under it. */
export function estimateWidth(head: string, cells: Array<TableCellKind | undefined>): number {
  let widest = head.length * 6.4 + 4;
  for (const cell of cells) {
    if (!cell) continue;
    const text = cellText(cell);
    let want = text.length * 6.2;
    if (cell.kind === "pill") want = text.length * 6.1 + 28;
    else if (cell.kind === "name") want = Math.max(text.length * 6.6, (cell.sub ?? "").length * 5.4) + (cell.avatar === false ? 0 : 33);
    else if (cell.kind === "bar") want = Math.max(want, 108);
    else if (cell.kind === "mark") want = 22;
    else if (cell.kind === "text" && cell.strong) want = text.length * 6.8;
    if (want > widest) widest = want;
  }
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widest)));
}

export type ColumnPlan = {
  /** One entry per column: a fixed pixel width, or a share of what is left over. */
  tracks: Array<{ kind: "fixed"; px: number } | { kind: "flex"; floor: number; share: number }>;
  /** The narrowest the table can be drawn before it has to scroll sideways. */
  minWidth: number;
};

/**
 * Plan a table's columns.
 *
 * `authored` is the panel's own `cols` when it has one — a hand-written weight per column, which is
 * taken as a starting opinion and averaged with what the column actually holds. A column of pure
 * chips, ticks or typed boxes, or one laid right or centre, is never given slack: it is content
 * that does not grow.
 */
export function planColumns(
  head: string[],
  rows: Array<{ cells: Array<TableCellKind | undefined> }>,
  options: { authored?: string; align?: Array<"left" | "right" | "center" | undefined>; selectable?: boolean } = {},
): ColumnPlan {
  /*
   * A table is as wide as its widest row, not as its headings.
   *
   * A panel whose rows carry one more cell than it has headings used to be invisible: the browser
   * sized the extra column itself. Under a fixed layout it would be given no width at all and the
   * cell would vanish, so the plan covers whichever is longer and the table still reads.
   */
  const count = Math.max(head.length, ...rows.map((row) => row.cells.length), 0);
  const authored = (options.authored ?? "").split(/\s+/).filter(Boolean);
  const weights = authored.length === count ? authored : null;
  const columns = Array.from({ length: count }, (_, index) => head[index] ?? "");
  const width = columns.map((heading, index) => estimateWidth(heading, rows.map((row) => row.cells[index])));

  const flexible = columns.map((_, index) => {
    const track = weights ? weights[index]! : "1fr";
    if (!/fr$/.test(track)) return false;
    const kinds = rows.map((row) => row.cells[index]).filter(Boolean).map((cell) => cell!.kind);
    if (kinds.length && kinds.every((kind) => kind === "pill" || kind === "mark" || kind === "node")) return false;
    const align = options.align?.[index];
    return align !== "right" && align !== "center";
  });

  const tracks = columns.map((_, index) => {
    if (!flexible[index]) return { kind: "fixed" as const, px: width[index]! };
    const weight = weights ? Number.parseFloat(weights[index]!) || 1 : 1;
    // The authored weight and the measured content agree on the share, so neither a stale
    // hand-written template nor one unusually long row decides the table on its own.
    const share = Math.max(0.6, Math.min(3, (weight + width[index]! / 130) / 2));
    return { kind: "flex" as const, floor: Math.min(width[index]!, FLEX_FLOOR), share };
  });

  const minWidth = Math.round(
    (options.selectable ? 28 + GAP : 0)
    + tracks.reduce((sum, track) => sum + (track.kind === "fixed" ? track.px : track.floor) + GAP, 0),
  );
  return { tracks, minWidth };
}

/**
 * The plan as widths a `<colgroup>` can carry.
 *
 * A table cannot hold `fr` units, so the flexible columns divide what is left after the fixed ones
 * in proportion to their shares. With `table-layout: fixed` above it, this is what makes every row
 * line up — and because the widths came from the content, a column of long names is still the wide
 * one.
 */
export function columnWidths(plan: ColumnPlan): string[] {
  const fixedPx = plan.tracks.reduce((sum, track) => sum + (track.kind === "fixed" ? track.px : 0), 0);
  const shares = plan.tracks.reduce((sum, track) => sum + (track.kind === "flex" ? track.share : 0), 0);
  return plan.tracks.map((track) => {
    if (track.kind === "fixed") return `${track.px}px`;
    const part = shares > 0 ? track.share / shares : 0;
    return `calc((100% - ${fixedPx}px) * ${part.toFixed(4)})`;
  });
}
