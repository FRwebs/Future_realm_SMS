import { Check, Clock, Database, School, TriangleAlert } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ReferenceList } from "@/components/data-display/reference-list";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
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
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 14"
        title="Onboarding & Migration"
        description="Move a school’s entire history across, and prove nothing was lost."
        action={<NewMigrationJobAction />}
      />

      <DetailTabs tabs={tabs} />

      {tab === "jobs" ? <JobsTab jobs={jobs} /> : null}
      {tab === "setup" ? <SetupProgressTab progress={setupProgress} /> : null}
      {tab === "invitations" ? <InvitationsTab params={params} /> : null}
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
  const active = jobs.filter((job) => job.status === "IN_PROGRESS" || job.status === "PREVIEW_READY");
  const sources = new Set(active.map((job) => job.sourceSystem.toLowerCase())).size;
  const term = Date.now() - 120 * 86_400_000;
  const signedOff = jobs.filter((job) => job.signedOffAt && new Date(job.signedOffAt).getTime() >= term);
  const blockedOver48h = jobs.filter((job) => {
    if (job.status !== "FILES_AWAITED" && job.status !== "IN_PROGRESS") return false;
    return (Date.now() - new Date(job.updatedAt).getTime()) / 3_600_000 > 48;
  }).length;
  const recordsMigrated = jobs.reduce((sum, job) => sum + (job.studentsImported ?? 0) + (job.resultsImported ?? 0), 0);
  const days = jobs.filter((job) => job.signedOffAt && job.filesReceivedAt).map((job) => (new Date(job.signedOffAt as string).getTime() - new Date(job.filesReceivedAt as string).getTime()) / 86_400_000);
  const medianDays = median(days);
  const open = jobs.filter((job) => !["COMPLETED", "ROLLED_BACK", "SIGNED_OFF"].includes(job.status)).length;

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Jobs in progress" value={active.length} detail={`Across ${sources} source system${sources === 1 ? "" : "s"}`} tone="dark" icon={Database} />
        <StatCard label="Blocked over 48 hours" value={blockedOver48h} detail="Waiting 48 hours with no movement · raises churn risk" tone={blockedOver48h > 0 ? "danger" : "success"} icon={TriangleAlert} />
        <StatCard label="Completed this term" value={signedOff.length} detail="Signed off by the school · last 120 days" tone="success" icon={Check} />
        <StatCard label="Records migrated" value={recordsMigrated.toLocaleString()} detail="Students and results, as recorded by the specialist" icon={Database} />
        <StatCard label="Median time to sign-off" value={medianDays === null ? "—" : medianDays < 1 ? `${Math.round(medianDays * 24 * 10) / 10} hours` : `${Math.round(medianDays * 10) / 10} days`} detail={medianDays === null ? "No sign-offs yet" : "From source file received"} tone="info" icon={Clock} />
      </section>

      <JobsTable jobs={jobs} openCount={open} />

      <RetentionTable />
    </div>
  );
}

type Retention = {
  rows: Array<{ id: string; ref: string; schoolId: string; school: string; signedOffAt: string | null; filesCount: number | null; deletesOn: string; daysLeft: number; extended: boolean; state: "OVERDUE" | "DUE_SOON" | "HELD" }>;
  holding: number;
  overdue: number;
};

async function RetentionTable() {
  const [retention, admins] = await Promise.all([
    apiGet<Retention>("/api/super-admin/migration/retention"),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team")
  ]);
  const approvers = admins.filter((member) => member.status === "ACTIVE" && ["SUPER_ADMIN", "PLATFORM_OWNER"].includes(member.role)).map((member) => ({ label: member.name, value: member.id }));
  const tones = {
    OVERDUE: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Past due — delete now" },
    DUE_SOON: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Due soon" },
    HELD: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Held" }
  } as const;

  return (
    <TableCard
      title="Source files pending deletion"
      description="A saved view. Source exports are children’s data. They are deleted 90 days after sign-off, and the clock is visible on every job."
      items={retention.rows}
      pageSize={false}
      emptyState="No signed-off job is holding source files."
      getRowKey={(job) => job.id}
      footnote="The platform does not store these files itself, so deletion is evidenced by the person who destroyed them. A job past its date alerts the Super Admins and its specialist. Extending retention needs a reason and a named approver, and the school is told."
      columns={[
        { key: "ref", header: "Job", render: (job) => <span className="font-[var(--font-mono)] text-[11px] font-bold">{job.ref}</span> },
        { key: "school", header: "School", render: (job) => <span className="font-semibold text-[var(--color-text-primary)]">{job.school}</span> },
        { key: "signedOff", header: "Signed off", render: (job) => (job.signedOffAt ? formatDate(job.signedOffAt) : "—") },
        { key: "files", header: "Files held", render: (job) => (job.filesCount === null ? <span className="text-[var(--color-text-muted)]">Not recorded</span> : job.filesCount) },
        { key: "deletesOn", header: "Deletes on", render: (job) => <span>{formatDate(job.deletesOn)}{job.extended ? <span className="ml-1 text-[9.5px] text-[var(--color-text-muted)]">extended</span> : null}</span>, sortValue: (job) => job.deletesOn },
        {
          key: "state",
          header: "State",
          render: (job) => {
            const tone = tones[job.state];
            return (
              <div className="grid gap-1.5">
                <span className="inline-flex w-fit items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}{job.state === "HELD" ? ` · ${job.daysLeft}d` : ""}</span>
                <div className="flex gap-3">
                  <ResourceActionDialog triggerLabel="Confirm deleted" title={`Confirm the files are deleted — ${job.school}`} description="Record how and where the source files were destroyed. This is the evidence." endpoint={`/api/super-admin/migration/jobs/${job.id}/retention/deleted`} method="POST" variant="textAction" submitLabel="Record deletion" fields={[{ name: "evidence", label: "Evidence", type: "textarea", required: true, placeholder: "e.g. Removed from the shared drive and the specialist’s laptop on 21 Oct; checked by Ife S." }]} />
                  <ResourceActionDialog triggerLabel="Extend" title={`Extend retention — ${job.school}`} description="The school is told, with your reason." endpoint={`/api/super-admin/migration/jobs/${job.id}/retention/extend`} method="POST" variant="textAction" submitLabel="Extend and tell the school" fields={[
                    { name: "days", label: "Extend by (days)", type: "number", min: 1, max: 365, defaultValue: 30, required: true },
                    { name: "reason", label: "Reason", type: "textarea", required: true },
                    { name: "approverId", label: "Approved by", type: "select", options: approvers, required: true }
                  ]} />
                </div>
              </div>
            );
          }
        }
      ]}
    />
  );
}

async function SetupProgressTab({ progress }: { progress: SuperAdminSetupProgress }) {
  const team = await apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team");
  const managerOptions = team.filter((member) => member.status === "ACTIVE").map((member) => ({ label: `${member.name} (${member.role.replaceAll("_", " ")})`, value: member.email }));
  const totalSchools = progress.steps[0]?.reached ?? 0;
  const fullyComplete = progress.steps.length > 0 ? Math.min(...progress.steps.map((s) => s.completed)) : 0;
  const mostAbandoned = progress.steps.reduce<{ label: string; completionRatePct: number } | null>((worst, step) => {
    if (!worst || step.completionRatePct < worst.completionRatePct) return { label: step.label, completionRatePct: step.completionRatePct };
    return worst;
  }, null);

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Schools in setup" value={totalSchools} detail="Provisioned or in trial." tone="dark" icon={School} />
        <StatCard label="Setup complete" value={fullyComplete} detail={totalSchools > 0 ? `${Math.round((fullyComplete / totalSchools) * 100)}% of the cohort` : "No schools yet"} tone="success" icon={Check} />
        <StatCard label="Incomplete past 5 days" value={progress.stalled.length} detail="Account Manager alerted." tone={progress.stalled.length > 0 ? "danger" : "success"} icon={Clock} />
        <StatCard label="Most abandoned step" value={mostAbandoned?.label ?? "—"} detail="Highest drop-off." tone="warning" icon={TriangleAlert} />
        <StatCard label="Median time to complete" value={progress.medianHoursToComplete === null || progress.medianHoursToComplete === undefined ? "No finishers yet" : progress.medianHoursToComplete >= 48 ? `${Math.round((progress.medianHoursToComplete / 24) * 10) / 10} days` : `${progress.medianHoursToComplete} h`} detail={progress.schoolsFinished ? `Signup to the last step, across ${progress.schoolsFinished} school${progress.schoolsFinished === 1 ? "" : "s"} that finished all six` : "No school has finished all six steps yet"} icon={Clock} />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="Setup progress by step"
          description="The aggregate view showing where schools most often abandon — the highest-value onboarding metric available. Bulk outreach uses a template from Communications."
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
                  <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">{step.completed}</span>
                </div>
              )
            },
            { key: "abandoned", header: "Abandoned here", render: (step) => <span className="font-semibold text-[var(--color-text-primary)]">{step.reached - step.completed}</span> }
          ]}
        />

        <ReferenceList
          title="Stalled schools — outreach queue"
          sub="Incomplete setup after 5 days alerts the assigned Account Manager"
          emptyText="No school has been stalled past 5 days."
          items={progress.stalled.map((item) => ({
            label: item.schoolName,
            detail: `Stalled at step ${item.stalledStep ?? "?"} · ${item.daysSinceSignup} day${item.daysSinceSignup === 1 ? "" : "s"} · ${item.accountManager ?? "Unassigned"}`,
            tone: item.daysSinceSignup >= 8 ? ("bad" as const) : ("warn" as const),
            action: item.schoolId ? (
              item.accountManager ? (
                <ResourceActionDialog triggerLabel="Contact" title={`Contact ${item.schoolName}`} description={`Emails the school’s owner about step ${item.stalledStep}: ${item.stalledLabel}. Leave the message empty to send the standard prompt.`} endpoint="/api/super-admin/migration/setup-progress/nudge" method="POST" variant="textAction" submitLabel="Send" fields={[
                                          { name: "schoolId", label: "School", type: "select", defaultValue: item.schoolId, options: [{ label: item.schoolName, value: item.schoolId }] },
                                          { name: "message", label: "Message", type: "textarea", placeholder: "Optional — a personal note instead of the standard prompt" }
                                        ]} />
              ) : (
                <ResourceActionDialog triggerLabel="Assign" title={`Assign an Account Manager — ${item.schoolName}`} description="Someone has to own this school’s setup." endpoint={`/api/super-admin/schools/${item.schoolId}/account-manager`} method="POST" variant="textAction" submitLabel="Assign" fields={[{ name: "accountManagerEmail", label: "Account Manager", type: "select", options: managerOptions, required: true }]} />
              )
            ) : undefined
          }))}
        />
      </section>
    </div>
  );
}

type Invitations = {
  rows: Array<{ userId: string; name: string; email: string; schoolId: string; school: string; role: string; roleLabel: string; resends: number; sentToday: number; issuedAt: string; ageDays: number; state: "PENDING" | "EXPIRED" | "DELIVERED" | "CANCELLED" }>;
  total: number;
  waiting: number;
  roles: Array<{ value: string; label: string }>;
  limit: number;
};

const invitationState = {
  PENDING: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Link live" },
  EXPIRED: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Link expired" },
  DELIVERED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Delivered by hand" },
  CANCELLED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Cancelled" }
} as const;

async function InvitationsTab({ params }: { params: Record<string, string | undefined> }) {
  const query = new URLSearchParams();
  for (const key of ["schoolId", "role", "state", "age"]) if (params[key]) query.set(key, params[key] as string);
  const [data, schools] = await Promise.all([
    apiGet<Invitations>(`/api/super-admin/migration/invitations?${query.toString()}`),
    apiGet<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const reasonChoice = (field: string, label: string, reasons: string[]) => ({ field, label, options: reasons.map((reason) => ({ label: reason, value: reason })) });

  return (
    <div className="grid gap-[14px]">
      <TableCard
        title="Invitation operations"
        description="Back-office controls for accounts FutureRealm creates after a closed deal — resend limits are enforced by the system at five per account per 24 hours."
        items={data.rows}
        getRowKey={(row) => row.userId}
        emptyState="No invitation matches this view. Every invited account has signed in."
        footnote="Resending issues a new link and kills every previous link immediately. Correcting an email address records the reason and the previous address."
        selection={{
          noun: "invitation",
          nounPlural: "invitations",
          actions: [
            { label: "Resend the selected invitations", kind: "primary", endpoint: "/api/super-admin/migration/invitations/resend", idsField: "userIds" },
            { label: "Mark as delivered by hand", endpoint: "/api/super-admin/migration/invitations/delivered", idsField: "userIds", choice: reasonChoice("reason", "Why", ["Handed over in person", "Confirmed on a phone call", "Sent on WhatsApp by the Account Manager"]) },
            { label: "Cancel the selected", endpoint: "/api/super-admin/migration/invitations/cancel", idsField: "userIds", confirm: "Cancel these invitations? The links die and the accounts stop holding a seat.", choice: reasonChoice("reason", "Why", ["Invited by mistake", "Duplicate account", "The school withdrew"]) }
          ]
        }}
        filterBar={
          <FilterToolbar
            action="/super-admin/migration"
            hidden={{ tab: "invitations" }}
            resultCount={data.rows.length}
            controls={[
              { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: [{ label: "All", value: "" }, ...schools.map((school) => ({ label: school.name, value: school.id }))] },
              { name: "role", label: "Role", type: "select", defaultValue: params.role ?? "", options: [{ label: "All", value: "" }, ...data.roles] },
              { name: "state", label: "State", type: "select", defaultValue: params.state ?? "", options: [{ label: "Not yet activated", value: "" }, { label: "Link live", value: "pending" }, { label: "Link expired", value: "expired" }, { label: "Delivered by hand", value: "delivered" }, { label: "Cancelled", value: "cancelled" }, { label: "All", value: "all" }] },
              { name: "age", label: "Age", type: "select", defaultValue: params.age ?? "", options: [{ label: "Any", value: "" }, { label: "A week or more", value: "week" }, { label: "Two weeks or more", value: "fortnight" }, { label: "A month or more", value: "month" }] }
            ]}
          />
        }
        columns={[
          { key: "invitee", header: "Invitee", render: (row) => <div><p className="font-bold text-[var(--color-text-primary)]">{row.name}</p><p className="text-[10px] text-[var(--color-text-muted)]">{row.email}</p></div> },
          { key: "school", header: "School", render: (row) => row.school },
          { key: "role", header: "Role", render: (row) => row.roleLabel },
          { key: "resends", header: "Resends", render: (row) => <span title={`${row.sentToday} of ${data.limit} links used in the last 24 hours`}>{row.resends}</span> },
          { key: "issued", header: "Issued", render: (row) => <span>{formatDate(row.issuedAt)}<span className="block text-[10px] text-[var(--color-text-muted)]">{row.ageDays} day{row.ageDays === 1 ? "" : "s"} ago</span></span>, sortValue: (row) => row.issuedAt },
          { key: "state", header: "State", render: (row) => { const tone = invitationState[row.state]; return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>; } },
          {
            key: "action",
            header: "Action",
            sortable: false,
            render: (row) =>
              row.state === "CANCELLED" ? (
                <span className="text-[var(--color-text-muted)]">—</span>
              ) : (
                <div className="flex gap-3">
                  <ResourceActionDialog triggerLabel="Resend" title={`Resend the invitation — ${row.name}`} description={`A new link goes to ${row.email} and every earlier link stops working. ${row.sentToday} of ${data.limit} sends used in the last 24 hours.`} endpoint="/api/super-admin/migration/invitations/resend" method="POST" variant="textAction" submitLabel="Resend" fields={[{ name: "userIds", label: "Account", type: "select", defaultValue: row.userId, options: [{ label: `${row.name} — ${row.email}`, value: row.userId }] }]} />
                  <ResourceActionDialog triggerLabel="Correct email" title={`Correct the email address — ${row.name}`} description={`The address on file is ${row.email}. The previous address is kept in the audit log and a new link goes to the corrected one.`} endpoint="/api/super-admin/migration/invitations/correct" method="POST" variant="textAction" submitLabel="Correct and resend" fields={[
                    { name: "userId", label: "Account", type: "select", defaultValue: row.userId, options: [{ label: row.name, value: row.userId }] },
                    { name: "email", label: "Correct email address", type: "email", required: true },
                    { name: "reason", label: "Reason", type: "textarea", required: true, placeholder: "e.g. The bursar gave us her personal address by mistake" }
                  ]} />
                </div>
              )
          }
        ]}
      />

      <ReferenceList
        title="Available operations"
        sub="Each writes to the audit log with the acting agent and a reason"
        items={[
          { label: "Resend an invitation", detail: "A new link is issued and every previous link dies immediately", tone: "teal" },
          { label: "Correct an email address and resend", detail: "Reason recorded, previous address retained", tone: "teal" },
          { label: "Mark as delivered manually", detail: "Where delivery was confirmed by another means", tone: "warn" },
          { label: "Cancel a pending invitation", detail: "Link dies; the seat is released", tone: "warn" },
          { label: "Never-activated register", detail: `Every invited account that has not activated, by school and role, with age — ${data.waiting} waiting now`, tone: "bad" }
        ]}
      />

    </div>
  );
}

async function SourceAdaptersTab() {
  const adapters = await apiGet<MigrationSourceAdapterRow[]>("/api/super-admin/migration/source-adapters");
  const fields = (adapter?: MigrationSourceAdapterRow) => [
    { name: "name", label: "Source system", required: true, defaultValue: adapter?.name ?? "", placeholder: "e.g. Edves, a spreadsheet register" },
    { name: "formats", label: "Accepted formats", defaultValue: adapter?.formats ?? "", placeholder: "e.g. CSV, XLSX, SQL dump" },
    { name: "quirks", label: "Known quirks", type: "textarea" as const, defaultValue: adapter?.quirks ?? "", placeholder: "What a specialist must know before running it" },
    { name: "status", label: "Status", type: "select" as const, defaultValue: adapter?.status ?? "available", options: [{ label: "Available", value: "available" }, { label: "Beta", value: "beta" }, { label: "In development", value: "in development" }, { label: "Unsupported", value: "unsupported" }] },
    { name: "notes", label: "Notes", type: "textarea" as const, defaultValue: adapter?.notes ?? "" }
  ];

  return (
    <TableCard
      title="Source system adapters"
      description="Each adapter is a configuration record describing how to read one source, not bespoke code per school. Create or edit an adapter: CTO and Product Lead."
      items={adapters}
      emptyState="No source adapters recorded yet."
      getRowKey={(adapter) => adapter.id}
      pageSize={false}
      footnote="Adapter coverage is a competitive metric, tracked in Analytics. Jobs run are matched to an adapter by the source system’s name."
      actions={<ResourceActionDialog triggerLabel="New adapter" title="New source adapter" description="Describe how one source system is read, so a specialist can pick it up without asking." endpoint="/api/super-admin/migration/source-adapters" method="POST" variant="secondary" submitLabel="Create adapter" fields={fields()} />}
      columns={[
        { key: "name", header: "Source system", render: (adapter) => <span className="font-semibold text-[var(--color-text-primary)]">{adapter.name}</span> },
        { key: "formats", header: "Accepted formats", render: (adapter) => adapter.formats ?? <span className="text-[var(--color-text-muted)]">Not described</span> },
        { key: "jobsRun", header: "Jobs run", render: (adapter) => adapter.jobsRun },
        { key: "quirks", header: "Known quirks", render: (adapter) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{adapter.quirks ?? adapter.notes ?? "—"}</span> },
        { key: "completion", header: "Completion rate", render: (adapter) => (adapter.completionRatePct === null ? "—" : `${adapter.completionRatePct}%`) },
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
              <div className="grid gap-1">
                <span className="inline-flex w-fit items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{adapter.status}</span>
                <ResourceActionDialog triggerLabel="Edit" title={`Edit ${adapter.name}`} description="Update how this source is read." endpoint={`/api/super-admin/migration/source-adapters/${adapter.id}`} method="PATCH" variant="textAction" submitLabel="Save" fields={fields(adapter)} />
              </div>
            );
          }
        }
      ]}
    />
  );
}
