import { CheckCircle2, Circle, FileClock, FileWarning, RotateCcw } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type {
  MigrationJobRow,
  MigrationSourceAdapterRow,
  SuperAdminInternalMember,
  SuperAdminSchoolRow
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const scopeFields: Array<{ key: keyof MigrationJobRow; label: string }> = [
  { key: "includeStudentsGuardians", label: "Students & guardians" },
  { key: "includeStaffAccounts", label: "Staff accounts" },
  { key: "includeHistoricalResults", label: "Historical results" },
  { key: "includeFeesBalances", label: "Fees & balances" },
  { key: "includeAttendanceHistory", label: "Attendance history" },
  { key: "includeBehaviouralRecords", label: "Behavioural records" }
];

const yesNoOptions = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" }
];

function statusTone(status: string): Parameters<typeof StatusBadge>[0]["tone"] {
  if (status === "SIGNED_OFF" || status === "COMPLETED") return "success";
  if (status === "ROLLED_BACK") return "danger";
  if (status === "INVITED" || status === "FILES_AWAITED") return "warning";
  return "brand";
}

function tabHref(tab: string) {
  return tab === "jobs" ? "/super-admin/migration" : `/super-admin/migration?tab=${tab}`;
}

async function loadJobs() {
  return apiGet<MigrationJobRow[]>("/api/super-admin/migration/jobs");
}

export default async function MigrationPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab =
    params.tab === "setup" ? "setup" :
    params.tab === "invitations" ? "invitations" :
    params.tab === "adapters" ? "adapters" : "jobs";

  const jobs = await loadJobs();
  const invitations = jobs.filter((job) => job.status === "INVITED");
  const inSetup = jobs.filter((job) => !["SIGNED_OFF", "COMPLETED", "ROLLED_BACK"].includes(job.status));

  const tabs = [
    { label: "Migration Jobs", href: tabHref("jobs"), active: tab === "jobs", badge: jobs.length },
    { label: "Setup Progress", href: tabHref("setup"), active: tab === "setup", badge: inSetup.length },
    { label: "Invitations", href: tabHref("invitations"), active: tab === "invitations", badge: invitations.length },
    { label: "Source Adapters", href: tabHref("adapters"), active: tab === "adapters" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Tenant onboarding"
        title="Onboarding & Migration"
        description="Track a school's historical data migration from invitation through sign-off — who's assigned, what's in scope, and when the retention clock starts."
        action={<NewMigrationJobAction />}
      />

      <DetailTabs tabs={tabs} />

      {tab === "jobs" ? <JobsTab jobs={jobs} /> : null}
      {tab === "setup" ? <SetupProgressTab jobs={inSetup} /> : null}
      {tab === "invitations" ? <InvitationsTab jobs={invitations} /> : null}
      {tab === "adapters" ? <SourceAdaptersTab /> : null}
    </div>
  );
}

async function NewMigrationJobAction() {
  const [schools, specialists] = await Promise.all([
    apiGet<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team")
  ]);

  const schoolOptions = [
    { label: "Select school", value: "" },
    ...schools
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => ({ label: school.name, value: school.id }))
  ];

  const specialistOptions = [
    { label: "Unassigned", value: "" },
    ...specialists
      .filter((member) => member.status === "ACTIVE")
      .map((member) => ({ label: `${member.name} (${member.role.replaceAll("_", " ")})`, value: member.id }))
  ];

  return (
    <ResourceActionDialog
      triggerLabel="New migration job"
      title="Start a migration job"
      description="Invite a school onto the migration track and set the scope of data that will be brought over."
      endpoint="/api/super-admin/migration/jobs"
      submitLabel="Create job"
      variant="heroWhite"
      fields={[
        { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
        { name: "sourceSystem", label: "Source system", type: "text", required: true, placeholder: "e.g. Spreadsheet register, another SIS" },
        { name: "specialistId", label: "Assigned specialist", type: "select", options: specialistOptions },
        { name: "studentsExpected", label: "Students expected", type: "number", min: 0 },
        { name: "resultsExpected", label: "Result records expected", type: "number", min: 0 },
        { name: "includeStudentsGuardians", label: "Include students & guardians", type: "select", defaultValue: "true", options: yesNoOptions },
        { name: "includeStaffAccounts", label: "Include staff accounts", type: "select", defaultValue: "true", options: yesNoOptions },
        { name: "includeHistoricalResults", label: "Include historical results", type: "select", defaultValue: "true", options: yesNoOptions },
        { name: "includeFeesBalances", label: "Include fees & balances", type: "select", defaultValue: "true", options: yesNoOptions },
        { name: "includeAttendanceHistory", label: "Include attendance history", type: "select", defaultValue: "false", options: yesNoOptions },
        { name: "includeBehaviouralRecords", label: "Include behavioural records", type: "select", defaultValue: "false", options: yesNoOptions },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "Context for the specialist handling this migration" }
      ]}
    />
  );
}

function JobsTab({ jobs }: { jobs: MigrationJobRow[] }) {
  const inProgress = jobs.filter((job) => job.status === "IN_PROGRESS").length;
  const signedOffOrComplete = jobs.filter((job) => job.status === "SIGNED_OFF" || job.status === "COMPLETED").length;
  const rolledBack = jobs.filter((job) => job.status === "ROLLED_BACK").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total jobs" value={jobs.length} detail="Every migration job ever created." icon={FileClock} />
        <StatCard label="In progress" value={inProgress} detail="Files received, actively being migrated." tone="info" icon={RotateCcw} />
        <StatCard label="Signed off" value={signedOffOrComplete} detail="School has accepted the migrated data." tone="success" icon={CheckCircle2} />
        <StatCard label="Rolled back" value={rolledBack} detail="Migration was reverted." tone="danger" icon={FileWarning} />
      </section>

      <TableCard
        title="All migration jobs"
        description="Every school migration tracked on the platform, most recent first."
        items={jobs}
        emptyState="No migration jobs yet. Start one from the action above."
        columns={[
          {
            key: "schoolName",
            header: "School",
            render: (job) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{job.schoolName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{job.sourceSystem}</p>
              </div>
            )
          },
          { key: "status", header: "Status", render: (job) => <StatusBadge status={job.status} tone={statusTone(job.status)} /> },
          { key: "specialist", header: "Specialist", render: (job) => job.specialistName ?? "Unassigned" },
          { key: "createdAt", header: "Created", render: (job) => formatDate(job.createdAt) },
          { key: "filesReceivedAt", header: "Files received", render: (job) => (job.filesReceivedAt ? formatDate(job.filesReceivedAt) : "Awaiting") },
          { key: "signedOffAt", header: "Signed off", render: (job) => (job.signedOffAt ? formatDate(job.signedOffAt) : "—") }
        ]}
      />
    </div>
  );
}

function ScopeChecklist({ job }: { job: MigrationJobRow }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {scopeFields.map((field) => {
        const included = Boolean(job[field.key]);
        return (
          <div
            key={String(field.key)}
            className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[11px] font-semibold"
            style={
              included
                ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                : { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }
            }
          >
            {included ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{field.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SetupProgressTab({ jobs }: { jobs: MigrationJobRow[] }) {
  const inScopeCount = (job: MigrationJobRow) => scopeFields.filter((field) => Boolean(job[field.key])).length;

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Active setup</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
          Jobs still being set up
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every category shown below reflects the job&apos;s actual scope flags and file-receipt timestamp — nothing
          here is estimated.
        </p>
      </section>

      {jobs.length === 0 ? (
        <section className="surface-card p-6">
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            No jobs currently in setup. Everything is either awaiting an invitation response, signed off, or completed.
          </p>
        </section>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <article key={job.id} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{job.schoolName}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {job.sourceSystem} · {job.specialistName ?? "Unassigned specialist"}
                  </p>
                </div>
                <StatusBadge status={job.status} tone={statusTone(job.status)} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 font-semibold"
                  style={
                    job.filesReceivedAt
                      ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                      : { background: "var(--color-warning-dim)", color: "var(--color-warning)" }
                  }
                >
                  {job.filesReceivedAt ? `Files received ${formatDate(job.filesReceivedAt)}` : "Files not received yet"}
                </span>
                <span className="text-[var(--color-text-muted)]">{inScopeCount(job)} of {scopeFields.length} data categories in scope</span>
              </div>

              <ScopeChecklist job={job} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationsTab({ jobs }: { jobs: MigrationJobRow[] }) {
  return (
    <TableCard
      title="Pending invitations"
      description="Schools invited onto the migration track that haven't had their files received yet."
      items={jobs}
      emptyState="No pending invitations. Every job has already moved past the invitation stage."
      columns={[
        {
          key: "schoolName",
          header: "School",
          render: (job) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{job.schoolName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{job.sourceSystem}</p>
            </div>
          )
        },
        { key: "specialist", header: "Specialist", render: (job) => job.specialistName ?? "Unassigned" },
        { key: "createdAt", header: "Invited", render: (job) => formatDate(job.createdAt) },
        {
          key: "actions",
          header: "Actions",
          sortable: false,
          render: (job) => (
            <ResourceActionDialog
              triggerLabel="Mark files received"
              title={`Mark files received — ${job.schoolName}`}
              description="Confirms the school's historical data files have arrived and moves this job into active migration."
              endpoint={`/api/super-admin/migration/jobs/${job.id}/files-received`}
              variant="secondary"
              submitLabel="Confirm receipt"
              fields={[]}
            />
          )
        }
      ]}
    />
  );
}

async function SourceAdaptersTab() {
  const adapters = await apiGet<MigrationSourceAdapterRow[]>("/api/super-admin/migration/source-adapters");

  return (
    <TableCard
      title="Source adapters"
      description="Systems this platform can pull historical data from. Every school's export can always fall back to manual CSV/Excel import."
      items={adapters}
      emptyState="No source adapters recorded yet."
      columns={[
        { key: "name", header: "Name", render: (adapter) => <span className="font-semibold text-[var(--color-text-primary)]">{adapter.name}</span> },
        {
          key: "status",
          header: "Status",
          render: (adapter) => (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
            >
              {adapter.status}
            </span>
          )
        },
        { key: "notes", header: "Notes", render: (adapter) => adapter.notes ?? "—" }
      ]}
    />
  );
}
