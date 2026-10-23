import { NextResponse } from "next/server";

import { canOpenModule, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { getTabContent } from "@/lib/modules/content";
import { getLiveTabContent } from "@/lib/modules/live";
import { isSchoolStaffRole } from "@/lib/modules/school-access";
import { getSchoolModule, getSchoolModuleTab, schoolPermissionKey } from "@/lib/modules/school-modules";
import { drawerAt } from "@/lib/modules/slim";

export const dynamic = "force-dynamic";

/**
 * One row's drawer, for a long table that left it out of the page (see lib/modules/slim). Built by the very code that built the page —
 * same module, same tab, same query, same person — and handed back only if it is still the drawer the stub stood for.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const get = (key: string) => url.searchParams.get(key) ?? "";
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Sign in again to open this." }, { status: 401 });

  const module = getSchoolModule(get("m"));
  const tab = module ? getSchoolModuleTab(module, get("t")) : undefined;
  if (!module || !tab) return NextResponse.json({ error: "That page is not one this school has." }, { status: 404 });

  // The same door the page itself uses: a module or tab that is not theirs is refused here too, not only on the page.
  const held = isSchoolStaffRole(session.role) ? new Set(await getServerPermissions(session)) : null;
  if ((held && !held.has(schoolPermissionKey(module.slug, tab.slug, "View"))) || !(await canOpenModule(session, module.code))) {
    return NextResponse.json({ error: "That is not yours to open." }, { status: 403 });
  }

  let query: Record<string, string | undefined> = {};
  try {
    query = get("q") ? (JSON.parse(get("q")) as Record<string, string | undefined>) : {};
  } catch {
    return NextResponse.json({ error: "That link is not one this page made." }, { status: 400 });
  }
  const address = { r: Number(get("r")), p: Number(get("p")), i: Number(get("i")), c: Number(get("c")) };
  if (Object.values(address).some((part) => !Number.isInteger(part))) return NextResponse.json({ error: "That link is not one this page made." }, { status: 400 });

  const content = (await getLiveTabContent(module.code, tab.slug, query)) ?? getTabContent(module.code, tab.slug);
  const spec = content?.rows ? drawerAt(content.rows, address, get("e")) : null;
  if (!spec) return NextResponse.json({ error: "This list has changed since the page was drawn. Refresh the page and open it again." }, { status: 409 });
  return NextResponse.json(spec, { headers: { "Cache-Control": "no-store" } });
}
