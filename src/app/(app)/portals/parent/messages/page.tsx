import Link from "next/link";
import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { FamilyMessages, type FamilyMessage } from "@/components/portals/family-messages";
import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function ParentMessagesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const inbox = await apiGet("/api/v1/parent-portal/messages", observe<{ school: string; unread: number; messages: FamilyMessage[] }>(localContracts["src/app/(app)/portals/parent/messages/page.tsx#dc5e2d56"]));

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent" as Route} className="text-[13px] font-semibold text-(--color-text-accent)">Back to parent portal</Link>
        <h1 className="mt-3 font-(--font-heading) text-[26px] font-black text-(--color-text-primary)">Messages from the school</h1>
        <p className="mt-1 text-[13px] text-(--color-text-secondary)">{inbox.unread ? `${inbox.unread} unread. ` : ""}What the school writes to you, from your child’s teacher or the office. Your replies go to the school office.</p>
        <Link href={"/portals/parent/tell-the-school" as Route} className="mt-3 inline-flex text-[13px] font-semibold text-(--color-text-accent)">Tell the school something →</Link>
      </section>
      <FamilyMessages school={inbox.school} messages={inbox.messages} />
    </div>
  );
}
