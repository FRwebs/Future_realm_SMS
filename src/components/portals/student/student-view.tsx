import { notFound, redirect } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { StudentTabs } from "@/components/portals/student/student-tabs";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { getServerSession } from "@/lib/auth/session";
import { getPlatformSync } from "@/lib/api/platform-sync";
import { apiGet } from "@/lib/api/server";
import { SW } from "@/lib/api/student-workspace";
import { buildStudentPage } from "@/lib/modules/live/student";
import { PAGE_MODULE } from "@/lib/modules/live/student/shared";

/** One page of a student's own workspace. Only a student's account reaches it; everything on it is read from their own record. */
export async function StudentView({ page, query }: { page: string; query: Record<string, string | undefined> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (session.role !== "STUDENT") return <AccessDenied backHref="/" />;
  // A page whose module the Back Office has switched off — or the whole portal — says so, rather than showing what the school no longer runs.
  const off = (await getPlatformSync(session.schoolId))?.switchedOff ?? [];
  const closed = off.find((entry) => entry.slug === "student-portal") ?? off.find((entry) => entry.slug === PAGE_MODULE[page]);
  if (closed) {
    return (
      <ModuleWorkspace eyebrow="Your school" title={closed.slug === "student-portal" ? "The student portal is switched off" : "This page is switched off"} description={closed.reason} rows={[{ cols: "1fr", panels: [{ type: "note", tone: "neutral", title: "Nothing you recorded is lost", body: "It returns exactly as it was when your school has it back. If you need something now, ask your form master." }] }]} />
    );
  }
  // A password the office has just reset is a temporary one: nothing else opens until the student has chosen their own.
  const mine = await apiGet<{ mustChangePassword: boolean; hidden: string[] }>(`${SW}/badges`).catch(() => null);
  if (page !== "account" && mine?.mustChangePassword) redirect("/portals/student/account");
  // A page the school has chosen not to show its students says so, rather than showing nothing or showing it anyway.
  if (mine?.hidden.includes(page)) {
    return (
      <ModuleWorkspace eyebrow="Your school" title="Your school has not made this page visible to students" description="The school decides what its students see. Ask your form master if you need something from it." rows={[{ cols: "1fr", panels: [{ type: "note", tone: "neutral", title: "Not shown to students", body: "This is your school’s choice, not a fault. Your parent or guardian may still be able to see it in the Parent Portal." }] }]} />
    );
  }
  const built = buildStudentPage(page, query);
  if (!built) notFound();
  const content = await built;
  const active = content.tab ?? content.tabs?.[0]?.label ?? "";
  return (
    <ModuleWorkspace eyebrow={content.eyebrow ?? "Your school"} title={content.title ?? ""} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows ?? []} back={undefined}>
      {content.tabs?.length ? <StudentTabs tabs={content.tabs} active={active} ariaLabel={`${content.title} tabs`} /> : null}
    </ModuleWorkspace>
  );
}
