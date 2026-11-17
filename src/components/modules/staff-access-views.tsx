import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { CreateWizard } from "@/components/modules/create-wizard";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { TabBar } from "@/components/modules/tab-bar";
import { getServerSession } from "@/lib/auth/session";
import { addStaffFor, loadDirectory, loadDirectoryContext, loadOverview } from "@/lib/modules/live/m7-staff-access";
import { groupsPage, templatesPage } from "@/lib/modules/live/m7-permissions";
import { appraisalOnePage, appraisalSetsPage, loadAppraisal, loadAppraisalOne, roleKpiPage } from "@/lib/modules/live/m7-appraisal";
import { leaveBalancesPage, leavePolicyPage, loadLeave } from "@/lib/modules/live/m7-leave";
import { bandPage, bandsPage, loadBand, loadPayroll, runPage } from "@/lib/modules/live/m7-payroll";
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
      description={content.desc ?? ""} tag={content.tag} tagTone={content.tagTone}
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

/** Every role template, lifted off the Permissions tab so the map of people opens first. */
export async function RoleTemplatesView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={templatesPage(await loadOverview())} back={{ label: "Back to Permissions", href: "/staff-access/permissions" }} />;
}

/** The sensitive groups, likewise: reference, reached from the tab rather than sitting on it. */
export async function SensitiveGroupsView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={groupsPage(await loadOverview())} back={{ label: "Back to Permissions", href: "/staff-access/permissions" }} />;
}

/* ─── what used to crowd a tab, now reached by name from its head ───
 *
 * Each of these was a full-width table or a sequence below the tab's own queue. They are
 * reference — read when something is being set up, not worked from every day.
 */

/** The leave types and the sequence that decides a request. */
export async function LeavePolicyView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={leavePolicyPage(await loadLeave())} back={{ label: "Back to Leave", href: "/staff-access/leave" }} />;
}

/** What each person has taken this session, and what is left. */
export async function LeaveBalancesView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={leaveBalancesPage(await loadLeave())} back={{ label: "Back to Leave", href: "/staff-access/leave" }} />;
}

/** What each role is measured on, and the order the cycle runs in. */
export async function AppraisalSetsView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={appraisalSetsPage(await loadAppraisal())} back={{ label: "Back to Appraisal", href: "/staff-access/appraisal" }} />;
}

/** The pay structure: every band, and who sits on each. */
export async function PayrollBandsView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={bandsPage(await loadPayroll())} back={{ label: "Back to Payroll", href: "/staff-access/payroll" }} />;
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

/** Onboarding a member of staff is a page of its own, as the mockup has it: the stages named, and every one read back before the write. */
export async function AddStaffView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const [directory, context] = await Promise.all([loadDirectory(), loadDirectoryContext()]);
  const spec = addStaffFor(directory, context);
  return (
    <ModuleWorkspace eyebrow={EYEBROW} title={spec.title} description={spec.sub ?? ""} rows={[]} back={spec.page?.back}>
      <CreateWizard spec={spec} />
    </ModuleWorkspace>
  );
}
