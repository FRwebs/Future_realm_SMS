const BOM = String.fromCharCode(0xfeff);

/** Rows as a CSV a spreadsheet opens correctly: quoted, escaped, with the byte-order mark Excel wants. */
export function toCsv(head: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${BOM}${[head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

export function csvResponse(name: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
