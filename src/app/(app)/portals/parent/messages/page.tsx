import Link from "next/link";
import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { FamilyMessages, type FamilyMessage } from "@/components/portals/family-messages";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function ParentMessagesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const inbox = await apiGet<{ school: string; unread: number; messages: FamilyMessage[] }>("/api/v1/parent-portal/messages");

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
