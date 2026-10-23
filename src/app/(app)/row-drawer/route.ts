import { NextResponse } from "next/server";

import { drawerAt } from "@/lib/modules/slim";
import { openTab } from "@/lib/modules/tab-access";
import { windowRows } from "@/lib/modules/window";

export const dynamic = "force-dynamic";

/**
 * One row's drawer, for a long table that left it out of the page (see lib/modules/slim). Built by the very code that built the page —
 * same module, same tab, same query, same person — and handed back only if it is still the drawer the stub stood for.
 */
export async function GET(request: Request) {
  const opened = await openTab(request);
  if ("response" in opened) return opened.response;
  const address = { r: Number(opened.get("r")), p: Number(opened.get("p")), i: Number(opened.get("i")), c: Number(opened.get("c")) };
  if (Object.values(address).some((part) => !Number.isInteger(part))) return NextResponse.json({ error: "That link is not one this page made." }, { status: 400 });

  const rows = windowRows(opened.rows, { module: opened.module.slug, tab: opened.tab.slug, query: opened.query });
  const spec = drawerAt(rows, address, opened.get("e"));
  if (!spec) return NextResponse.json({ error: "This list has changed since the page was drawn. Refresh the page and open it again." }, { status: 409 });
  return NextResponse.json(spec, { headers: { "Cache-Control": "no-store" } });
}
