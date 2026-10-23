import "server-only";

import { NextResponse } from "next/server";

import { canOpenModule, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { getTabContent } from "@/lib/modules/content";
import { getLiveTabContent } from "@/lib/modules/live";
import type { PanelRow } from "@/lib/modules/panels";
import { isSchoolStaffRole } from "@/lib/modules/school-access";
import { getSchoolModule, getSchoolModuleTab, schoolPermissionKey } from "@/lib/modules/school-modules";

/**
 * What a request that asks for one piece of a module tab — a row's drawer, a long table's export — has to get past, and what it is given:
 * the same door the page itself uses (signed in, the module and the tab theirs), and the tab's content built by the same code, for the
 * same person, with the same query.
 */
export async function openTab(request: Request): Promise<{ response: NextResponse } | { module: { slug: string; code: string }; tab: { slug: string }; query: Record<string, string | undefined>; rows: PanelRow[]; get: (key: string) => string }> {
  const url = new URL(request.url);
  const get = (key: string) => url.searchParams.get(key) ?? "";
  const fail = (error: string, status: number) => ({ response: NextResponse.json({ error }, { status }) });

  const session = await getServerSession();
  if (!session) return fail("Sign in again to open this.", 401);

  const module = getSchoolModule(get("m"));
  const tab = module ? getSchoolModuleTab(module, get("t")) : undefined;
  if (!module || !tab) return fail("That page is not one this school has.", 404);

  const held = isSchoolStaffRole(session.role) ? new Set(await getServerPermissions(session)) : null;
  if ((held && !held.has(schoolPermissionKey(module.slug, tab.slug, "View"))) || !(await canOpenModule(session, module.code))) return fail("That is not yours to open.", 403);

  let query: Record<string, string | undefined> = {};
  try {
    query = get("q") ? (JSON.parse(get("q")) as Record<string, string | undefined>) : {};
  } catch {
    return fail("That link is not one this page made.", 400);
  }
  const content = (await getLiveTabContent(module.code, tab.slug, query)) ?? getTabContent(module.code, tab.slug);
  return { module, tab, query, rows: content?.rows ?? [], get };
}
