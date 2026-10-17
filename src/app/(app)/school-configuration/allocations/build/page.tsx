import type { Metadata } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { AllocationBuilder } from "@/components/modules/allocation-builder";
import { allocationBuilderData } from "@/lib/modules/live/m2-school-configuration";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "School Configuration · Create an allocation",
  description: "Name it, pick categories, fill each one, then publish.",
};

/**
 * The allocation builder.
 *
 * Like the curriculum builder, this is a sub-page rather than a modal: it holds
 * its own state across a form and a list that grows as you type, and nothing in
 * it is a single decision to confirm and dismiss.
 */
export default async function BuildAllocationPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M02"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const { classes, terms, catalogue } = await allocationBuilderData();

  return (
    <AllocationBuilder
      backHref="/school-configuration/allocations"
      classes={classes}
      terms={terms}
      catalogue={catalogue}
    />
  );
}
