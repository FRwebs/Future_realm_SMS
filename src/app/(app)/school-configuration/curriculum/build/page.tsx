import type { Metadata } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { CurriculumBuilder } from "@/components/modules/curriculum-builder";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "School Configuration · Build a curriculum",
  description: "Seven sections, one at a time. Nothing is in force until you say so.",
};

/**
 * The curriculum builder.
 *
 * A static route beside the module's own `[module]/[tab]` pages, because this
 * is the one surface in School Configuration that is not a tab: the mockup
 * opens it over the Curriculum tab as a sub-page, and it keeps its own state
 * across seven sections rather than reading a tab's worth of figures.
 */
export default async function BuildCurriculumPage() {
  const session = await getServerSession();
  if (!session) return null;

  // Same gate the module's tabs use: a module the holder cannot reach is not
  // reachable by URL either.
  if (!(await canOpenModule(session, "M02"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  return <CurriculumBuilder backHref="/school-configuration/curriculum" />;
}
