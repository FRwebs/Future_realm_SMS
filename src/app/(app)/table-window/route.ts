import { NextResponse } from "next/server";

import { openTab } from "@/lib/modules/tab-access";
import { narrowTable, windowKey } from "@/lib/modules/window";

export const dynamic = "force-dynamic";

/**
 * One page of a long table, for the browser to swap in without redrawing the page around it. A long table is sent a page at a time; this is
 * how the next one is asked for. It builds the tab for the same person with the query the browser sends (the page's own, plus the search,
 * filters and page wanted) and narrows the table with the same rules the page used, so a page fetched here is the page the address would show.
 */
export async function GET(request: Request) {
  const opened = await openTab(request);
  if ("response" in opened) return opened.response;
  const address = { r: Number(opened.get("r")), p: Number(opened.get("p")) };
  if (Object.values(address).some((part) => !Number.isInteger(part))) return NextResponse.json({ error: "That link is not one this page made." }, { status: 400 });

  const panel = opened.rows[address.r]?.panels[address.p];
  if (!panel || panel.type !== "table") return NextResponse.json({ error: "This list has changed since the page was drawn. Refresh the page and try again." }, { status: 409 });
  const { rows, window } = narrowTable(panel, windowKey(address.r, address.p), { module: opened.module.slug, tab: opened.tab.slug, query: opened.query }, address);
  return NextResponse.json({ ok: true, data: { rows, window } }, { headers: { "Cache-Control": "no-store" } });
}
