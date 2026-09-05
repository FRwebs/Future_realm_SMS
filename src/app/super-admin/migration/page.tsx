import { CheckCircle2, FileClock, FileWarning, RotateCcw } from "lucide-react";

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
  SuperAdminSchoolRow,
  SuperAdminSetupProgress
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

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

const toneStyle = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
} as const;
type Tone = keyof typeof toneStyle;

function FlowSteps({ title, sub, steps }: { title: string; sub?: string; steps: Array<{ label: string; note: string; tone?: Tone }> }) {
  return (
    <section className="surface-card p-6">
      <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</p>
      {sub ? <p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      <div className="mt-5 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = toneStyle[step.tone ?? "mute"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bg }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-[var(--color-text-secondary)]">{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10 : sorted[mid];
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

  const [jobs, setupProgress] = await Promise.all([
    loadJobs(),
    apiGet<SuperAdminSetupProgress>("/api/super-admin/migration/setup-progress")
  ]);
  const invitations = jobs.filter((job) => job.status === "INVITED");

  const tabs = [
    { label: "Migration Jobs", href: tabHref("jobs"), active: tab === "jobs", badge: jobs.length },
    { label: "Setup Progress", href: tabHref("setup"), active: tab === "setup", badge: setupProgress.stalled.length },
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
      {tab === "setup" ? <SetupProgressTab progress={setupProgress} /> : null}
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
  const signedOffOrComplete = jobs.filter((job) => job.status === "SIGNED_OFF" || job.status === "COMPLETED");
  const rolledBack = jobs.filter((job) => job.status === "ROLLED_BACK").length;

  const recordsMigrated = signedOffOrComplete.reduce((sum, job) => sum + (job.studentsExpected ?? 0) + (job.resultsExpected ?? 0), 0);
  const daysToSignOff = jobs
    .filter((job) => job.signedOffAt)
    .map((job) => (new Date(job.signedOffAt as string).getTime() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const medianDays = median(daysToSignOff);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total jobs" value={jobs.length} detail="Every migration job ever created." icon={FileClock} />
        <StatCard label="In progress" value={inProgress} detail="Files received, actively being migrated." tone="info" icon={RotateCcw} />
        <StatCard label="Signed off" value={signedOffOrComplete.length} detail="School has accepted the migrated data." tone="success" icon={CheckCircle2} />
        <StatCard label="Rolled back" value={rolledBack} detail="Migration was reverted." tone="danger" icon={FileWarning} />
        <StatCard
          label="Records migrated"
          value={recordsMigrated.toLocaleString()}
          detail="Expected students + results, summed across signed-off jobs."
          icon={FileClock}
        />
        <StatCard
          label="Median time to sign-off"
          value={medianDays === null ? "—" : `${medianDays}d`}
          detail={medianDays === null ? "No job has been signed off yet." : "From job creation to school sign-off."}
          tone="info"
          icon={RotateCcw}
        />
      </section>

      <FlowSteps
        title="Migration pipeline"
        sub="What a job actually moves through on this platform, start to exception path. Steps described here match the real status transitions enforced by the migration service — there is no automated staging or reconciliation system behind them yet."
        steps={[
          { label: "Invited", note: "Job created with source system + expected counts. Status starts at INVITED.", tone: "mute" },
          { label: "Adapter matched", note: "Source system is cross-checked against the Source Adapters list — informational only, nothing blocks on it.", tone: "mute" },
          { label: "Files awaited", note: "Status sits at FILES_AWAITED until a specialist manually marks files received.", tone: "mute" },
          { label: "In progress", note: "Status IN_PROGRESS. The actual import work happens off-platform — there is no staged-import step here.", tone: "mute" },
          { label: "Preview shared", note: "Status PREVIEW_READY; previewSharedAt is stamped once.", tone: "mute" },
          { label: "School approves", note: "Status SIGNED_OFF; signedOffAt and the approving user are recorded.", tone: "good" },
          { label: "Retention clock starts", note: "retentionClockStartsAt is stamped at sign-off — nothing currently reads it.", tone: "good" },
          { label: "Completed", note: "Status can be advanced to COMPLETED once the school has confirmed everything is in place.", tone: "good" },
          { label: "Rolled back", note: "Exception path from any stage. Requires a rollback reason; status moves to ROLLED_BACK.", tone: "bad" }
        ]}
      />

      <TableCard
        title="Migration data handling"
        description="What actually happens to a school's data during a migration, stated plainly — not all of this is automated yet."
        items={[
          { topic: "Storage", detail: "Files aren't uploaded through the platform. \"Files received\" is a manual marker a specialist ticks after getting the data through an outside channel — nothing is stored here." },
          { topic: "Retention", detail: "retentionClockStartsAt is stamped at sign-off, but no duration is attached to it and no job purges anything automatically." },
          { topic: "Access logging", detail: "Not written yet. Migration job changes don't create an AuditLog entry, unlike most other mutating actions on this platform." },
          { topic: "Agreement precondition", detail: "Not enforced. Any platform team member can open a migration job for any school — there's no check for a signed data-migration agreement first." },
          { topic: "Trial schools", detail: "Not restricted. A school still on its trial can have a migration job opened the same as a paying school." }
        ]}
        emptyState="—"
        getRowKey={(row) => row.topic}
        columns={[
          { key: "topic", header: "Topic", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.topic}</span> },
          { key: "detail", header: "What actually happens", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.detail}</span> }
        ]}
      />

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

function SetupProgressTab({ progress }: { progress: SuperAdminSetupProgress }) {
  const totalSchools = progress.steps[0]?.reached ?? 0;
  const fullyComplete = progress.steps.length > 0 ? Math.min(...progress.steps.map((s) => s.completed)) : 0;
  const mostAbandoned = progress.steps.reduce<{ label: string; completionRatePct: number } | null>((worst, step) => {
    if (!worst || step.completionRatePct < worst.completionRatePct) return { label: step.label, completionRatePct: step.completionRatePct };
    return worst;
  }, null);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Schools in setup" value={totalSchools} detail="Every school with an onboarding checklist." icon={FileClock} />
        <StatCard label="Fully complete" value={fullyComplete} detail={totalSchools > 0 ? `${Math.round((fullyComplete / totalSchools) * 100)}% of the cohort` : "No schools yet"} tone="success" icon={CheckCircle2} />
        <StatCard label="Stalled past 5 days" value={progress.stalled.length} detail="At least one step still incomplete." tone={progress.stalled.length > 0 ? "danger" : "success"} icon={FileWarning} />
        <StatCard label="Most abandoned step" value={mostAbandoned?.label ?? "—"} detail="Where schools most often stop." tone="warning" icon={RotateCcw} />
      </section>

      <TableCard
        title="Setup progress by step"
        description="The real completion state of every school's own onboarding checklist, in the order a school completes it."
        items={progress.steps}
        emptyState="No onboarding checklists recorded yet."
        pageSize={false}
        getRowKey={(step) => step.key}
        columns={[
          { key: "step", header: "Step", render: (step) => <span className="font-bold text-[var(--color-text-primary)]">{step.label}</span> },
          { key: "reached", header: "Schools with this step", render: (step) => step.reached },
          { key: "completed", header: "Completed", render: (step) => step.completed },
          {
            key: "rate",
            header: "Completion",
            render: (step) => (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full" style={{ width: `${step.completionRatePct}%`, background: step.completionRatePct >= 70 ? "var(--color-success)" : step.completionRatePct >= 40 ? "var(--color-warning)" : "var(--color-danger)" }} />
                </div>
                <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{step.completionRatePct}%</span>
              </div>
            )
          }
        ]}
      />

      <TableCard
        title="Stalled schools"
        description="Onboarding checklist still incomplete more than 5 days after signup."
        items={progress.stalled}
        emptyState="No school has been stalled past 5 days."
        pageSize={false}
        getRowKey={(item) => item.schoolName}
        columns={[
          { key: "school", header: "School", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.schoolName}</span> },
          { key: "days", header: "Days since signup", render: (item) => item.daysSinceSignup },
          { key: "incomplete", header: "Steps remaining", render: (item) => item.incompleteCount }
        ]}
      />
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
        { key: "jobsRun", header: "Jobs run", render: (adapter) => adapter.jobsRun },
        { key: "completion", header: "Completion rate", render: (adapter) => (adapter.completionRatePct === null ? "—" : `${adapter.completionRatePct}%`) },
        { key: "notes", header: "Notes", render: (adapter) => adapter.notes ?? "—" }
      ]}
    />
  );
}
