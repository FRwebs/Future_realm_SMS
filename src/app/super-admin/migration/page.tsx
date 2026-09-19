import { Check, CheckCircle2, Clock, Database, FileClock, RotateCcw, School, TriangleAlert } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
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

import { JobsTable } from "./_jobs-table";

const yesNoOptions = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" }
];

const toneStyle = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
} as const;
type Tone = keyof typeof toneStyle;

const migrationStatuses: Array<{ status: MigrationJobRow["status"]; label: string; tone: Tone }> = [
  { status: "INVITED", label: "Invited", tone: "mute" },
  { status: "FILES_AWAITED", label: "Files awaited", tone: "warn" },
  { status: "IN_PROGRESS", label: "In progress", tone: "warn" },
  { status: "PREVIEW_READY", label: "Preview ready", tone: "good" },
  { status: "SIGNED_OFF", label: "Signed off", tone: "good" },
  { status: "COMPLETED", label: "Completed", tone: "good" },
  { status: "ROLLED_BACK", label: "Rolled back", tone: "bad" }
];

function FlowSteps({ title, sub, steps }: { title: string; sub?: string; steps: Array<{ label: string; note: string; tone?: Tone }> }) {
  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-5">
      <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">{title}</p>
      {sub ? <p className="sr-only">{sub}</p> : null}
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
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

function StatusBuckets({ jobs }: { jobs: MigrationJobRow[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
      {migrationStatuses.map((item) => {
        const style = toneStyle[item.tone];
        const count = jobs.filter((job) => job.status === item.status).length;
        return (
          <article key={item.status} className="rounded-[14px] border border-[#DEE8E2] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="h-2 w-2 rounded-full" style={{ background: style.fg }} />
              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: style.bg, color: style.fg }}>
                {count}
              </span>
            </div>
            <p className="mt-3 text-[12.5px] font-bold text-[#0D2315]">{item.label}</p>
          </article>
        );
      })}
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
        eyebrow="Schools & Revenue"
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
        { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "School and source" },
        { name: "sourceSystem", label: "Source system", type: "text", required: true, placeholder: "e.g. Spreadsheet register, another SIS", section: "School and source" },
        { name: "specialistId", label: "Assigned specialist", type: "select", options: specialistOptions, section: "School and source" },
        { name: "studentsExpected", label: "Students expected", type: "number", min: 0, section: "School and source" },
        { name: "resultsExpected", label: "Result records expected", type: "number", min: 0, section: "School and source" },
        { name: "includeStudentsGuardians", label: "Include students & guardians", type: "select", defaultValue: "true", options: yesNoOptions, section: "Scope of the move" },
        { name: "includeStaffAccounts", label: "Include staff accounts", type: "select", defaultValue: "true", options: yesNoOptions, section: "Scope of the move" },
        { name: "includeHistoricalResults", label: "Include historical results", type: "select", defaultValue: "true", options: yesNoOptions, section: "Scope of the move" },
        { name: "includeFeesBalances", label: "Include fees & balances", type: "select", defaultValue: "true", options: yesNoOptions, section: "Scope of the move" },
        { name: "includeAttendanceHistory", label: "Include attendance history", type: "select", defaultValue: "false", options: yesNoOptions, section: "Scope of the move" },
        { name: "includeBehaviouralRecords", label: "Include behavioural records", type: "select", defaultValue: "false", options: yesNoOptions, section: "Scope of the move" },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "Context for the specialist handling this migration", section: "Notes" }
      ]}
    />
  );
}

function JobsTab({ jobs }: { jobs: MigrationJobRow[] }) {
  const inProgress = jobs.filter((job) => job.status === "IN_PROGRESS").length;
  const signedOffOrComplete = jobs.filter((job) => job.status === "SIGNED_OFF" || job.status === "COMPLETED");
  const blockedOver48h = jobs.filter((job) => {
    if (job.status !== "FILES_AWAITED" && job.status !== "IN_PROGRESS") return false;
    const ageHours = (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60);
    return ageHours > 48;
  }).length;

  const openJobs = jobs.filter((job) => !["COMPLETED", "ROLLED_BACK"].includes(job.status)).length;
  const pendingFiles = jobs.filter((job) => job.status === "INVITED" || job.status === "FILES_AWAITED").length;
  const recordsMigrated = signedOffOrComplete.reduce((sum, job) => sum + (job.studentsExpected ?? 0) + (job.resultsExpected ?? 0), 0);
  const daysToSignOff = jobs
    .filter((job) => job.signedOffAt)
    .map((job) => (new Date(job.signedOffAt as string).getTime() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const medianDays = median(daysToSignOff);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Jobs in progress" value={inProgress} detail="Files received, active work." tone="dark" icon={Database} />
        <StatCard label="Blocked over 48 hours" value={blockedOver48h} detail="Raises the school's churn risk." tone={blockedOver48h > 0 ? "danger" : "success"} icon={TriangleAlert} />
        <StatCard label="Completed" value={signedOffOrComplete.length} detail="Signed off by the school." tone="success" icon={Check} />
        <StatCard
          label="Records migrated"
          value={recordsMigrated.toLocaleString()}
          detail="Students + results, signed-off jobs."
          icon={Database}
        />
        <StatCard
          label="Median time to sign-off"
          value={medianDays === null ? "—" : `${medianDays}d`}
          detail={medianDays === null ? "No sign-offs yet." : "From source file received."}
          tone="info"
          icon={Clock}
        />
      </section>

      <StatusBuckets jobs={jobs} />

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
        title="Migration workload"
        items={[
          { metric: "Open jobs", value: openJobs.toLocaleString(), detail: "Not completed or rolled back" },
          { metric: "Awaiting files", value: pendingFiles.toLocaleString(), detail: "Invited or files awaited" },
          { metric: "Expected students", value: jobs.reduce((sum, job) => sum + (job.studentsExpected ?? 0), 0).toLocaleString(), detail: "Across every job" },
          { metric: "Expected results", value: jobs.reduce((sum, job) => sum + (job.resultsExpected ?? 0), 0).toLocaleString(), detail: "Across every job" },
          { metric: "Retention clocks", value: jobs.filter((job) => job.retentionClockStartsAt).length.toLocaleString(), detail: "Started after sign-off" }
        ]}
        emptyState="—"
        pageSize={false}
        getRowKey={(row) => row.metric}
        columns={[
          { key: "metric", header: "Metric", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.metric}</span> },
          { key: "value", header: "Value", render: (row) => <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{row.value}</span> },
          { key: "detail", header: "Detail", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.detail}</span> }
        ]}
      />

      <JobsTable jobs={jobs} />

      <RetentionTable jobs={jobs} />
    </div>
  );
}

const RETENTION_DAYS = 90;

function RetentionTable({ jobs }: { jobs: MigrationJobRow[] }) {
  const holding = jobs
    .filter((job) => job.retentionClockStartsAt)
    .map((job) => {
      const startedAt = new Date(job.retentionClockStartsAt as string);
      const deletesOn = new Date(startedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const daysLeft = Math.ceil((deletesOn.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      return { ...job, deletesOn, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <TableCard
      title="Source files pending deletion"
      items={holding}
      pageSize={false}
      emptyState="No job has a retention clock running."
      getRowKey={(job) => job.id}
      columns={[
        {
          key: "school",
          header: "School",
          render: (job) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{job.schoolName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{job.sourceSystem}</p>
            </div>
          )
        },
        { key: "signedOff", header: "Signed off", render: (job) => (job.signedOffAt ? formatDate(job.signedOffAt) : "—") },
        { key: "deletesOn", header: "Deletes on", render: (job) => formatDate(job.deletesOn.toISOString()) },
        {
          key: "state",
          header: "State",
          render: (job) => {
            const tone = job.daysLeft < 0 ? { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Past due — not purged" } : job.daysLeft <= 7 ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: `${job.daysLeft} days left` } : { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: `${job.daysLeft} days left` };
            return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
          }
        }
      ]}
    />
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
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Schools in setup" value={totalSchools} detail="Provisioned or in trial." tone="dark" icon={School} />
        <StatCard label="Setup complete" value={fullyComplete} detail={totalSchools > 0 ? `${Math.round((fullyComplete / totalSchools) * 100)}% of the cohort` : "No schools yet"} tone="success" icon={Check} />
        <StatCard label="Incomplete past 5 days" value={progress.stalled.length} detail="Account Manager alerted." tone={progress.stalled.length > 0 ? "danger" : "success"} icon={Clock} />
        <StatCard label="Most abandoned step" value={mostAbandoned?.label ?? "—"} detail="Highest drop-off." tone="warning" icon={TriangleAlert} />
        <StatCard label="Median time to complete" value="N/A" detail="Not tracked — no per-step completion timestamp exists yet." icon={Clock} />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="Setup progress by step"
          description="The aggregate view showing where schools most often abandon — the highest-value onboarding metric available."
          items={progress.steps.map((step, index) => ({ ...step, stepNumber: index + 1 }))}
          emptyState="No onboarding checklists recorded yet."
          pageSize={false}
          getRowKey={(step) => step.key}
          columns={[
            { key: "index", header: "#", render: (step) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-muted)]">{step.stepNumber}</span> },
            { key: "step", header: "Step", render: (step) => <span className="font-bold text-[var(--color-text-primary)]">{step.label}</span> },
            { key: "reached", header: "Reached", render: (step) => step.reached },
            {
              key: "completed",
              header: "Completed",
              render: (step) => (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full" style={{ width: `${step.completionRatePct}%`, background: step.completionRatePct >= 70 ? "var(--color-success)" : step.completionRatePct >= 40 ? "var(--color-warning)" : "var(--color-danger)" }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{step.completed}</span>
                </div>
              )
            },
            { key: "abandoned", header: "Abandoned here", render: (step) => <span className="font-semibold text-[var(--color-text-primary)]">{step.reached - step.completed}</span> }
          ]}
        />

        <section className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="border-b border-[var(--color-border-muted)] px-5 py-4">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Stalled schools — outreach queue</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">Incomplete setup after 5 days alerts the assigned Account Manager.</p>
          </div>
          {progress.stalled.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">No school has been stalled past 5 days.</p>
          ) : (
            <div className="grid gap-0">
              {progress.stalled.map((item) => {
                const urgent = item.daysSinceSignup >= 8;
                const tone = urgent
                  ? { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" }
                  : { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
                return (
                  <div key={item.schoolName} className="flex items-start gap-2.5 border-b border-[var(--color-border-muted)] px-5 py-3.5 last:border-b-0">
                    <span className="mt-[5px] h-2 w-2 shrink-0 rounded-[3px]" style={{ background: tone.fg }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.schoolName}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {item.daysSinceSignup} day{item.daysSinceSignup === 1 ? "" : "s"} since signup · {item.incompleteCount} step{item.incompleteCount === 1 ? "" : "s"} remaining
                      </p>
                    </div>
                    <a
                      href={`/super-admin/schools?search=${encodeURIComponent(item.schoolName)}`}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      Review
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function InvitationsTab({ jobs }: { jobs: MigrationJobRow[] }) {
  const assigned = jobs.filter((job) => job.specialistId).length;
  const expectedRecords = jobs.reduce((sum, job) => sum + (job.studentsExpected ?? 0) + (job.resultsExpected ?? 0), 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Pending invitations" value={jobs.length} detail="Awaiting files." icon={FileClock} tone="dark" />
        <StatCard label="Assigned" value={assigned} detail="Specialist selected." icon={CheckCircle2} tone="success" />
        <StatCard label="Expected records" value={expectedRecords.toLocaleString()} detail="Students + results." icon={RotateCcw} tone="info" />
      </section>

      <TableCard
        title="Invitation operations"
        description="This is a migration-job invitation, not a per-person user-account invitation — this platform has no resend limit, email-correction flow, or never-activated register for individual staff invites yet. What's shown here is every migration job still sitting at the Invited stage."
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
          { key: "expected", header: "Expected records", render: (job) => ((job.studentsExpected ?? 0) + (job.resultsExpected ?? 0)).toLocaleString() },
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
                method="POST"
                variant="secondary"
                submitLabel="Confirm receipt"
                fields={[]}
              />
            )
          }
        ]}
      />
    </div>
  );
}

async function SourceAdaptersTab() {
  const adapters = await apiGet<MigrationSourceAdapterRow[]>("/api/super-admin/migration/source-adapters");
  const available = adapters.filter((adapter) => adapter.status.toLowerCase() === "available").length;
  const jobsRun = adapters.reduce((sum, adapter) => sum + adapter.jobsRun, 0);
  const completionRates = adapters.map((adapter) => adapter.completionRatePct).filter((rate): rate is number => rate !== null);
  const averageCompletion = completionRates.length > 0 ? Math.round((completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length) * 10) / 10 : null;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Adapters" value={adapters.length} detail={`${available} available.`} icon={FileClock} tone="dark" />
        <StatCard label="Jobs run" value={jobsRun} detail="Matched by source name." icon={RotateCcw} tone="info" />
        <StatCard label="Avg completion" value={averageCompletion === null ? "—" : `${averageCompletion}%`} detail="Signed off or completed." icon={CheckCircle2} tone="success" />
      </section>

      <TableCard
        title="Source adapters"
        items={adapters}
        emptyState="No source adapters recorded yet."
        columns={[
          { key: "name", header: "Name", render: (adapter) => <span className="font-semibold text-[var(--color-text-primary)]">{adapter.name}</span> },
          {
            key: "status",
            header: "Status",
            render: (adapter) => {
              const normalized = adapter.status.toLowerCase();
              const tone = normalized.includes("available") || normalized.includes("live")
                ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
                : normalized.includes("beta")
                  ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }
                  : normalized.includes("development") || normalized.includes("progress")
                    ? { bg: "var(--color-info-dim)", fg: "var(--color-info)" }
                    : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
              return (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                  {adapter.status}
                </span>
              );
            }
          },
          { key: "jobsRun", header: "Jobs run", render: (adapter) => adapter.jobsRun },
          { key: "completion", header: "Completion rate", render: (adapter) => (adapter.completionRatePct === null ? "—" : `${adapter.completionRatePct}%`) },
          { key: "notes", header: "Notes", render: (adapter) => adapter.notes ?? "—" }
        ]}
      />
    </div>
  );
}
