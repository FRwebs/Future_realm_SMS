import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { CreateWizard } from "@/components/modules/create-wizard";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { TabBar } from "@/components/modules/tab-bar";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { applicantPage, loadAdmissionOptions, loadApplicant, loadPipeline, pipelinePage, type AdmissionPage } from "@/lib/modules/live/m8-admissions";
import { enrolDrawer } from "@/lib/modules/live/m8-forms";
import { loadEnrolOptions, loadMoveOptions } from "@/lib/modules/live/m8-registry";
import { SECTIONS, studentRecordPage, type RecordSection } from "@/lib/modules/live/m8-record";
import { apiGet } from "@/lib/api/server";

/**
 * The pages Student Records opens from its tabs. Each is a server view: it checks the module is
 * open to the person asking, reads the page from the API, and hands it to the workspace.
 */

const EYEBROW = "Student Records";

async function allowed() {
  const session = await getServerSession();
  if (!session) return null;
  return await canOpenModule(session, "M08");
}

function Shell({ content, children }: { content: AdmissionPage["content"]; children?: React.ReactNode }) {
  return (
    <ModuleWorkspace eyebrow={EYEBROW} title={content.title ?? "Student Records"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb}>
      {children}
    </ModuleWorkspace>
  );
}

export async function StudentRecordView({ id, section, termId, from, arm }: { id: string; section?: string; termId?: string; from?: string; arm?: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const known = SECTIONS.find((entry) => entry.path === (section ? `/${section}` : ""));
  if (!known) notFound();
  let crumb: { label: string; href: string } | undefined;
  if (from === "arm" && arm) {
    const found = await apiGet<{ name: string }>(`/api/v1/class-structure/arms/${encodeURIComponent(arm)}`).catch(() => null);
    crumb = { label: `Back to ${found?.name ?? "the arm"}`, href: `/class-timetable/classes/${arm}` };
  }
  const page = await studentRecordPage(id, known.section as RecordSection, { termId, from: crumb });
  if (!page) notFound();
  return (
    <Shell content={page.content as AdmissionPage["content"]}>
      <TabBar items={page.tabs} ariaLabel={`${page.name}'s record`} />
    </Shell>
  );
}

export async function ApplicantView({ id }: { id: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const [applicant, options, rooms] = await Promise.all([loadApplicant(id).catch(() => null), loadAdmissionOptions(), loadMoveOptions().catch(() => [])]);
  if (!applicant) notFound();
  return <Shell content={applicantPage(applicant, options, rooms).content} />;
}

export async function PipelineView({ state }: { state: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const known = ["Enquiry", "Applied", "Assessed", "Offered", "Accepted", "Enrolled", "Declined", "Waitlisted", "History"];
  const name = decodeURIComponent(state);
  if (!known.includes(name)) notFound();
  const [data, options] = await Promise.all([loadPipeline(name), loadAdmissionOptions()]);
  return <Shell content={pipelinePage(name, data, options).content} />;
}

/** Enrolling a student is a page of its own, as the mockup has it: the stages named, and every one read back before the write. */
export async function EnrolStudentView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const spec = enrolDrawer(await loadEnrolOptions());
  return (
    <ModuleWorkspace eyebrow={EYEBROW} title={spec.title} description={spec.sub ?? ""} rows={[]} back={spec.page?.back}>
      <CreateWizard spec={spec} />
    </ModuleWorkspace>
  );
}
