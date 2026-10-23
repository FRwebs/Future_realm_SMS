import { NextResponse } from "next/server";

import { csvFileName, tableCsv } from "@/lib/modules/table-query";
import { openTab } from "@/lib/modules/tab-access";
import { narrowTable, windowKey } from "@/lib/modules/window";

export const dynamic = "force-dynamic";

/**
 * Every row of a long table that passes what was searched and chosen — not just the page on screen. A long table is sent a page at a time,
 * so "export" has to ask the server for the rest; this builds the tab for the same person with the same query and narrows it the same way.
 */
export async function GET(request: Request) {
  const opened = await openTab(request);
  if ("response" in opened) return opened.response;
  const address = { r: Number(opened.get("r")), p: Number(opened.get("p")) };
  if (Object.values(address).some((part) => !Number.isInteger(part))) return NextResponse.json({ error: "That link is not one this page made." }, { status: 400 });

  const panel = opened.rows[address.r]?.panels[address.p];
  if (!panel || panel.type !== "table") return NextResponse.json({ error: "This list has changed since the page was drawn. Refresh the page and export it again." }, { status: 409 });
  const { rows } = narrowTable(panel, windowKey(address.r, address.p), { module: opened.module.slug, tab: opened.tab.slug, query: opened.query }, address, true);
  return new NextResponse(`\uFEFF${tableCsv(panel.head, rows)}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${csvFileName(panel.title)}"`, "Cache-Control": "no-store" },
  });
}
