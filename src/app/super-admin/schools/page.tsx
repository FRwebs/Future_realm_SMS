import Link from "next/link";
import { ArrowRight, Building2, Clock3, FileWarning, Layers, Mail, MapPin, Phone, Users } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { AddSchoolWizard } from "@/components/super-admin/add-school-wizard";
import { SchoolBulkTable } from "@/components/super-admin/school-bulk-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminPendingVerificationSchool, SuperAdminPlanRow, SuperAdminSchoolGroup, SuperAdminSchoolRow } from "@/lib/domain/types";

const planOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Trial", value: "PROFESSIONAL" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];

const schoolTypeOptions = [
  { label: "Mixed / Combined", value: "MIXED" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Secondary", value: "SECONDARY" },
  { label: "College", value: "COLLEGE" }
];

const statusFilterOptions = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Trial", value: "TRIAL" },
  { label: "Grace period", value: "GRACE_PERIOD" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Archived", value: "ARCHIVED" }
];

const planFilterOptions = [{ label: "All tiers", value: "" }, ...planOptions];

const statusTone: Record<string, { bg: string; fg: string; label: string }> = {
  TRIAL: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Trial Active" },
  ACTIVE: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Active" },
  GRACE_PERIOD: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Grace Period" },
  SUSPENDED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Suspended" },
  ARCHIVED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Deactivated" },
  DELETED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Deleted" }
};

const RECENT_SIGNUP_WINDOW_HOURS = 48;

const lifecycleFlow = [
  { label: "Signup submitted", trigger: "Self-service — automatic" },
  { label: "Trial Active", trigger: "Granted immediately · 14-day trial" },
  { label: "Verified", trigger: "Reviewed in Review Queue · does not block access" },
  { label: "Active", trigger: "Payment confirmed", emphasize: true },
  { label: "Grace Period", trigger: "Payment overdue" },
  { label: "Suspended", trigger: "Verification rejected / grace period expired / policy violation" },
  { label: "Deactivated", trigger: "Data export completed · closure confirmed" }
];

const statusReference = [
  {
    status: "TRIAL",
    label: "Trial Active",
    meaning: "14-day free trial, granted automatically at signup.",
    trigger: "System — automatic on signup",
    who: "System (self-service)"
  },
  {
    status: "ACTIVE",
    label: "Active",
    meaning: "Paying subscription in good standing.",
    trigger: "Payment confirmed, or reactivated after suspension.",
    who: "System / Super Admin"
  },
  {
    status: "GRACE_PERIOD",
    label: "Grace Period",
    meaning: "Subscription lapsed — access continues on a short countdown.",
    trigger: "System — on payment overdue.",
    who: "System"
  },
  {
    status: "SUSPENDED",
    label: "Suspended",
    meaning: "Full access blocked.",
    trigger: "Grace period expired, or a logged policy violation.",
    who: "Super Admin — reason required"
  },
  {
    status: "ARCHIVED",
    label: "Deactivated",
    meaning: "School has formally left the platform.",
    trigger: "Closure requested — after a full data export.",
    who: "Super Admin only"
  },
  {
    status: "DELETED",
    label: "Deleted",
    meaning: "Soft-deleted — hidden from active views, retained for audit recovery.",
    trigger: "Explicit deletion action.",
    who: "Super Admin only"
  }
] as const;

function initials(name: string) {
  const letters = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "—";
}

function planLabel(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}

function categoryLabel(category?: string) {
  if (!category) return "—";
  return schoolTypeOptions.find((option) => option.value === category)?.label ?? category;
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Less than an hour ago";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function tabHref(tab: string) {
  return tab === "directory" ? "/super-admin/schools" : `/super-admin/schools?tab=${tab}`;
}

export default async function SuperAdminSchoolsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const activeTab =
    params.tab === "approval-queue" ? "approval-queue" :
    params.tab === "recent-signups" ? "recent-signups" :
    params.tab === "lifecycle" ? "lifecycle" :
    params.tab === "groups" ? "groups" : "directory";

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.plan) query.set("plan", params.plan);
  if (params.page) query.set("page", params.page);
  const envelope = await apiGetEnvelope<SuperAdminSchoolRow[]>(`/api/super-admin/schools?${query.toString()}`);
  const schools = envelope.data ?? [];
  const total = envelope.pagination?.total ?? schools.length;

  const trialEnvelope = await apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?status=TRIAL&limit=100");
  const windowStart = Date.now() - RECENT_SIGNUP_WINDOW_HOURS * 60 * 60 * 1000;
  const recentSignups = (trialEnvelope.data ?? [])
    .filter((school) => new Date(school.createdAt).getTime() >= windowStart)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const groupsEnvelope = await apiGetEnvelope<SuperAdminSchoolGroup[]>("/api/super-admin/schools/groups");
  const groups = groupsEnvelope.data ?? [];

  const pendingVerificationEnvelope = await apiGetEnvelope<SuperAdminPendingVerificationSchool[]>("/api/super-admin/schools-pending-verification");
  const pendingVerification = pendingVerificationEnvelope.data ?? [];
  const missingRegistrationCount = pendingVerification.filter((school) => !school.cacNumber && !school.ministryApprovalNumber).length;
  const missingContactCount = pendingVerification.filter((school) => !school.ownerEmail || !school.ownerPhone).length;

  const plansEnvelope = await apiGetEnvelope<SuperAdminPlanRow[]>("/api/super-admin/plans");
  const activePlans = (plansEnvelope.data ?? []).filter((plan) => plan.isActive).sort((a, b) => a.monthlyPrice - b.monthlyPrice);

  const tabs = [
    { label: "School Directory", href: tabHref("directory"), active: activeTab === "directory", badge: total },
    { label: "Review Queue", href: tabHref("approval-queue"), active: activeTab === "approval-queue", badge: pendingVerification.length },
    { label: "Recent Signups", href: tabHref("recent-signups"), active: activeTab === "recent-signups", badge: recentSignups.length },
    { label: "Lifecycle & Status", href: tabHref("lifecycle"), active: activeTab === "lifecycle" },
    { label: "School Groups", href: tabHref("groups"), active: activeTab === "groups", badge: groups.length }
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Tenant management</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Schools</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
              Create, update, suspend, activate, and soft-delete school tenants across the platform.
            </p>
          </div>
          <AddSchoolWizard plans={activePlans} />
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {activeTab === "directory" ? (
        <>
          <FilterToolbar
            action="/super-admin/schools"
            resultCount={total}
            controls={[
              { name: "search", label: "Search", type: "search", placeholder: "Search by school name", defaultValue: params.search },
              { name: "status", label: "Status", type: "select", defaultValue: params.status, options: statusFilterOptions },
              { name: "plan", label: "Tier", type: "select", defaultValue: params.plan, options: planFilterOptions }
            ]}
          />

          <SchoolBulkTable schools={schools} total={total} />
        </>
      ) : activeTab === "approval-queue" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard label="Pending review" value={pendingVerification.length} detail="Schools flagged during onboarding." icon={Clock3} tone="warning" />
            <StatCard label="Missing registration" value={missingRegistrationCount} detail="No CAC or ministry approval recorded." icon={FileWarning} tone="danger" />
            <StatCard label="Contact gaps" value={missingContactCount} detail="Owner email or phone needs completion." icon={Users} tone="info" />
          </section>

          <TableCard
            title="Review Queue"
            items={pendingVerification}
            emptyState="Queue is clear. Schools flagged at signup will appear here for a manual check."
            columns={[
              {
                key: "school",
                header: "School",
                render: (school) => (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">
                      {initials(school.name)}
                    </span>
                    <div>
                      <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                        {school.name}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{categoryLabel(school.curriculum)} · {timeAgo(school.createdAt)}</p>
                    </div>
                  </div>
                )
              },
              { key: "owner", header: "Owner", render: (school) => <div><p className="font-semibold text-[var(--color-text-primary)]">{school.ownerName ?? "Not recorded"}</p><p className="text-xs text-[var(--color-text-muted)]">{school.ownerEmail ?? "No email"}</p></div> },
              { key: "location", header: "Location", render: (school) => [school.city, school.state].filter(Boolean).join(", ") || "Not recorded" },
              { key: "registration", header: "Registration", render: (school) => <div><p className="text-[12px] text-[var(--color-text-secondary)]">CAC: <span className="font-semibold text-[var(--color-text-primary)]">{school.cacNumber ?? "Missing"}</span></p><p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Ministry: <span className="font-semibold text-[var(--color-text-primary)]">{school.ministryApprovalNumber ?? "Missing"}</span></p></div> },
              { key: "students", header: "Students", render: (school) => school.studentCount.toLocaleString() },
              {
                key: "actions",
                header: "Actions",
                render: (school) => (
                  <ActionMenu triggerLabel={`Review ${school.name}`}>
                    <ResourceActionDialog
                      triggerLabel="Approve & verify"
                      title={`Verify ${school.name}`}
                      description="Marks this school as verified. It already has full trial access — this only records that the details have been reviewed."
                      endpoint={`/api/super-admin/schools/${school.id}/verify`}
                      variant="menu"
                      submitLabel="Confirm verification"
                      fields={[]}
                    />
                    <ResourceActionDialog
                      triggerLabel="Reject with reason"
                      title={`Reject verification — ${school.name}`}
                      description="This suspends the school immediately and logs the reason. The tenant can be reactivated later from Lifecycle & Status if the issue is resolved."
                      endpoint={`/api/super-admin/schools/${school.id}/reject-verification`}
                      variant="menuDanger"
                      submitLabel="Reject and suspend"
                      confirmLabel="Confirm"
                      confirmMessage="This suspends the school and all its staff logins immediately."
                      fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
                    />
                    <Link href={`/super-admin/schools/${school.id}`} className="block px-3 py-2 text-[12px] font-semibold text-[var(--color-text-accent)] hover:bg-[var(--color-bg-subtle)]">
                      View full profile
                    </Link>
                  </ActionMenu>
                )
              }
            ]}
          />
        </section>
      ) : activeTab === "recent-signups" ? (
        <section className="surface-card p-6">
          <p className="section-eyebrow">Recent signups</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
            New trial schools — last {RECENT_SIGNUP_WINDOW_HOURS} hours
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Onboarding is automatic — every signup below is already live on a trial plan. Nothing here is waiting on
            approval; this is a visibility view so the team can spot-check new tenants and their declared details.
          </p>

          <div className="mt-6 grid gap-3">
            {recentSignups.length === 0 ? (
              <div className="empty-state">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">No new signups yet</p>
                <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">
                  No schools have self-onboarded in the last {RECENT_SIGNUP_WINDOW_HOURS} hours.
                </p>
              </div>
            ) : (
              recentSignups.map((school) => (
                <article key={school.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[14px] font-bold text-[var(--color-text-primary)]">
                        {initials(school.name)}
                      </span>
                      <div>
                        <Link href={`/super-admin/schools/${school.id}`} className="text-[14px] font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                          {school.name}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{categoryLabel(school.category)} · {planLabel(school.plan)} tier</p>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }}
                    >
                      Onboarded {timeAgo(school.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{[school.address, school.city, school.state].filter(Boolean).join(", ") || "No address on file"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <Users className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerName ?? "Owner not recorded"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerPhone ?? "No phone on file"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerEmail ?? "No email on file"}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      {school.totalStudents.toLocaleString()} student(s) declared at signup
                    </p>
                    <Link href={`/super-admin/schools/${school.id}`} className="btn-link text-[12.5px]">
                      View school
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : activeTab === "lifecycle" ? (
        <>
          <section className="surface-card p-6">
            <p className="section-eyebrow">Lifecycle flow</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
              How a school moves through the platform
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Onboarding is fully automatic — trial access is never gated on approval. Verification in the Approval
              Queue is a compliance check that happens afterward; every other transition below is either
              system-driven or a logged Super Admin action.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {lifecycleFlow.map((stage, index) => (
                <div key={stage.label} className="flex items-center gap-2">
                  <div
                    className="min-w-[9rem] rounded-[11px] border px-4 py-3"
                    style={
                      stage.emphasize
                        ? { background: "var(--color-text-primary)", borderColor: "var(--color-text-primary)", color: "var(--color-bg-surface)" }
                        : { background: "var(--color-bg-surface)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }
                    }
                  >
                    <p className="text-[13px] font-bold">{stage.label}</p>
                    <p className={`mt-1 text-[11px] ${stage.emphasize ? "opacity-75" : "text-[var(--color-text-muted)]"}`}>{stage.trigger}</p>
                  </div>
                  {index < lifecycleFlow.length - 1 ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="section-eyebrow">Status reference</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
              What each status means
            </h2>
            <div className="mt-5 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
              {statusReference.map((row, index) => {
                const tone = statusTone[row.status] ?? statusTone.ARCHIVED;
                return (
                  <div
                    key={row.status}
                    className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[9rem_1.6fr_1.4fr_1fr] sm:items-center ${index % 2 === 1 ? "bg-[var(--color-bg-subtle)]" : "bg-[var(--color-bg-surface)]"}`}
                  >
                    <span
                      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {row.label}
                    </span>
                    <p className="text-[12.5px] text-[var(--color-text-primary)]">{row.meaning}</p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{row.trigger}</p>
                    <p className="text-[12px] font-semibold text-[var(--color-text-muted)]">{row.who}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="surface-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-eyebrow">Multi-branch</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
                  School groups
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  Multiple campuses under one billing account. A branch keeps its own configuration, staff, and
                  student records — only billing and account management roll up to the group. Schools are linked to a
                  group from their profile page.
                </p>
              </div>
              <ResourceActionDialog
                triggerLabel="Create group"
                title="Create school group"
                description="Set up a group before linking branch schools to it from each school's profile."
                endpoint="/api/super-admin/schools/groups"
                submitLabel="Create group"
                fields={[
                  { name: "name", label: "Group name", required: true },
                  { name: "ownerName", label: "Owner / trustee name" },
                  { name: "ownerEmail", label: "Owner email", type: "email" },
                  { name: "billingMode", label: "Billing mode", type: "select", defaultValue: "GROUP", options: [
                    { label: "Consolidated at group", value: "GROUP" },
                    { label: "Per branch", value: "BRANCH" }
                  ] }
                ]}
              />
            </div>
          </section>

          {groups.length === 0 ? (
            <section className="surface-card p-6">
              <div className="empty-state">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                  <Layers className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">No school groups yet</p>
                <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">
                  Create a group above, then link branch schools to it from each school&apos;s profile page.
                </p>
              </div>
            </section>
          ) : (
            <TableCard
              title="All groups"
              description={`${groups.length} group(s) found.`}
              items={groups}
              columns={[
                {
                  key: "name",
                  header: "Group",
                  render: (group) => (
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{group.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{group.ownerName ?? "No owner on file"}</p>
                    </div>
                  )
                },
                {
                  key: "branches",
                  header: "Branches",
                  render: (group) =>
                    group.branchCount === 0 ? (
                      <span className="text-[var(--color-text-muted)]">No branches linked</span>
                    ) : (
                      <span className="truncate">{group.branches.map((branch) => branch.name).join(", ")}</span>
                    )
                },
                { key: "count", header: "#", render: (group) => group.branchCount },
                { key: "students", header: "Students", render: (group) => group.totalStudents.toLocaleString() },
                {
                  key: "billing",
                  header: "Billing",
                  render: (group) => (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={
                        group.billingMode === "GROUP"
                          ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                          : { background: "var(--color-info-dim)", color: "var(--color-info)" }
                      }
                    >
                      {group.billingMode === "GROUP" ? "Consolidated at group" : "Per branch"}
                    </span>
                  )
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (group) => (
                    <ActionMenu triggerLabel={`Actions for ${group.name}`}>
                      <ResourceActionDialog
                        triggerLabel="Edit"
                        title={`Edit ${group.name}`}
                        description="Update the group's owner details or billing mode."
                        endpoint={`/api/super-admin/schools/groups/${group.id}`}
                        method="PATCH"
                        variant="menu"
                        submitLabel="Save changes"
                        fields={[
                          { name: "name", label: "Group name", defaultValue: group.name },
                          { name: "ownerName", label: "Owner / trustee name", defaultValue: group.ownerName ?? "" },
                          { name: "ownerEmail", label: "Owner email", type: "email", defaultValue: group.ownerEmail ?? "" },
                          { name: "billingMode", label: "Billing mode", type: "select", defaultValue: group.billingMode, options: [
                            { label: "Consolidated at group", value: "GROUP" },
                            { label: "Per branch", value: "BRANCH" }
                          ] }
                        ]}
                      />
                      <ResourceActionDialog
                        triggerLabel="Delete"
                        title={`Delete ${group.name}`}
                        description={
                          group.branchCount > 0
                            ? "Unlink every branch from this group before deleting it."
                            : "This permanently removes the group. It has no branches linked, so this is safe."
                        }
                        endpoint={`/api/super-admin/schools/groups/${group.id}`}
                        method="DELETE"
                        variant="menuDanger"
                        submitLabel="Delete group"
                        confirmLabel="Confirm delete"
                        confirmMessage="This permanently removes the school group."
                        fields={[]}
                      />
                    </ActionMenu>
                  )
                }
              ]}
              emptyState="No school groups match the current filters."
            />
          )}
        </>
      )}
    </div>
  );
}
