import type { TableCellKind, TableFilter, TableRow } from "@/lib/modules/panels";

/**
 * What a table does to its rows when somebody searches or filters — in one place, so the browser narrowing a short table and the server
 * narrowing a long one mean exactly the same thing by "matches".
 */

/** Text a row exposes to the search box and the column filters. */
export function rowText(tableRow: TableRow): string[] {
  const cells = tableRow.cells.map((cell) => {
    if (cell.kind === "name") return `${cell.name} ${cell.sub ?? ""}`;
    if (cell.kind === "pill") return cell.label;
    if (cell.kind === "bar") return cell.label;
    if (cell.kind === "action") return "";
    // A tick is searchable as the word, so "included" narrows a comparison table.
    if (cell.kind === "mark") return cell.ok ? "Included" : "Not included";
    if (cell.kind === "node") return cell.plain ?? "";
    return cell.text;
  });
  return [...cells, tableRow.keywords ?? ""];
}

export function narrowRows(rows: TableRow[], filters: TableFilter[] | undefined, needleText: string, values: Record<string, string>): TableRow[] {
  const needle = needleText.trim().toLowerCase();
  return rows.filter((tableRow) => {
    const texts = rowText(tableRow);
    if (needle && !texts.some((value) => value.toLowerCase().includes(needle))) return false;
    for (const filter of filters ?? []) {
      const chosen = values[filter.label];
      // The first option is the "all" one and never narrows anything; a switcher between pages never narrows this one.
      if (!chosen || chosen === filter.options[0] || filter.go) continue;
      const haystack = filter.column !== undefined ? [texts[filter.column] ?? ""] : texts;
      const wanted = (filter.match?.[chosen] ?? chosen).toLowerCase();
      if (!haystack.some((value) => value.toLowerCase().includes(wanted))) return false;
    }
    return true;
  });
}

const csvCell = (value: TableCellKind | undefined) => {
  if (!value) return "";
  if (value.kind === "name") return value.sub ? `${value.name} (${value.sub})` : value.name;
  if (value.kind === "pill") return value.label;
  if (value.kind === "bar") return value.label;
  if (value.kind === "mark") return value.ok ? "Yes" : "No";
  if (value.kind === "action") return "";
  if (value.kind === "node") return value.plain ?? "";
  return value.text;
};

/** The rows as a CSV: every column with a heading, none of the action buttons. */
export function tableCsv(head: string[], rows: TableRow[]): string {
  const keep = head.map((heading, index) => (heading.trim() ? index : -1)).filter((index) => index >= 0);
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [keep.map((index) => escape(head[index]!)).join(","), ...rows.map((row) => keep.map((index) => escape(csvCell(row.cells[index]))).join(","))].join("\n");
}

export const csvFileName = (title: string) => `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export"}.csv`;
