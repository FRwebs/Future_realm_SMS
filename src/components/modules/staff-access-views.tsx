import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { TabBar } from "@/components/modules/tab-bar";
import { getServerSession } from "@/lib/auth/session";
import { appraisalOnePage, loadAppraisal, loadAppraisalOne, roleKpiPage } from "@/lib/modules/live/m7-appraisal";
import { bandPage, loadBand, loadPayroll, runPage } from "@/lib/modules/live/m7-payroll";
import {
  modulePage,
  offboardChooser,
  offboardingPage,
  personPage,
  rolePage,
  staffRecordPage,
  type PageContent,
  type RecordSection,
} from "@/lib/modules/live/m7-pages";
import { canOpenModule } from "@/lib/auth/server-access";

/**
 * The pages Staff & Access opens from its tabs. Each is a server view: it checks the module
 * is open to the person asking, reads the page from the API, and hands it to the workspace.
 */

const EYEBROW = "Staff & Access";

async function allowed() {
  const session = await getServerSession();
  if (!session) return null;
  return !(await canOpenModule(session, "M07")) ? false : true;
}

function Shell({ content, back, children }: { content: PageContent; back: { label: string; href: string }; children?: React.ReactNode }) {
  return (
    <ModuleWorkspace
      eyebrow={EYEBROW}
      title={content.title ?? "Staff & Access"}
      description={content.desc ?? ""}
      primary={content.primary}
      launchers={content.launchers}
      rows={content.rows}
      back={back}
    >
      {children}
    </ModuleWorkspace>
  );
}

export async function StaffRecordView({ id, section }: { id: string; section: RecordSection }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const page = await staffRecordPage(id, section);
  if (!page) notFound();
  return (
    <Shell content={page.content} back={{ label: "Back to the Directory", href: "/staff-access/directory" }}>
      <TabBar items={page.tabs} ariaLabel={`${page.name}’s record`} />
    </Shell>
  );
}

export async function PersonAccessView({ userId }: { userId: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const page = await personPage(userId);
  if (!page) notFound();
  return <Shell content={page.content} back={page.content.crumb ?? { label: "Back to Permissions", href: "/staff-access/permissions" }} />;
}

export async function ModuleAccessView({ userId, slug }: { userId: string; slug: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const page = await modulePage(userId, slug);
  if (!page) notFound();
  return <Shell content={page.content} back={page.content.crumb ?? { label: "Back to Permissions", href: "/staff-access/permissions" }} />;
}

export async function RoleTemplateView({ name }: { name: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const page = await rolePage(name);
  if (!page) notFound();
  return <Shell content={page.content} back={page.content.crumb ?? { label: "Back to Permissions", href: "/staff-access/permissions" }} />;
}

export async function OffboardChooserView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const content = await offboardChooser();
  return <Shell content={content} back={content.crumb ?? { label: "Back to the Directory", href: "/staff-access/directory" }} />;
}

export async function OffboardingView({ id }: { id: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const page = await offboardingPage(id);
  if (!page) notFound();
  return <Shell content={page.content} back={page.content.crumb ?? { label: "Back to the Directory", href: "/staff-access/directory" }} />;
}

export async function PayrollBandView({ id }: { id: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const detail = await loadBand(id).catch(() => null);
  if (!detail) notFound();
  const content = bandPage(detail);
  return <Shell content={content} back={content.crumb} />;
}

export async function PayrollRunView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const data = await loadPayroll();
  const content = runPage(data);
  return <Shell content={content} back={content.crumb} />;
}

export async function RoleKpiView({ role }: { role: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const data = await loadAppraisal();
  const content = roleKpiPage(data, role);
  if (!content) notFound();
  return <Shell content={content} back={content.crumb} />;
}

export async function AppraisalOneView({ id }: { id: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const one = await loadAppraisalOne(id).catch(() => null);
  if (!one) notFound();
  const content = appraisalOnePage(one);
  return <Shell content={content} back={content.crumb} />;
}
