import { DetailTabs } from "@/components/data-display/detail-tabs";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { safeApiGet } from "@/lib/principal/portal";
import type { StudentRecordView, TeacherRecordView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type SubscriptionPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

type SchoolRecord = {
  plan: "BASIC" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE" | "CUSTOM";
  status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "GRACE_PERIOD" | "ARCHIVED" | "DELETED";
  billingStatus: "TRIAL" | "ACTIVE" | "OVERDUE" | "SUSPENDED" | "CANCELLED";
  trialEndsAt?: string | null;
  nextBillingAt?: string | null;
  lastPaymentAt?: string | null;
  healthScore: number;
  storageUsedGb: number;
  storageLimitGb?: number | null;
  studentLimit?: number | null;
  staffLimit?: number | null;
  smsLimitPerMonth?: number | null;
  emailLimitPerMonth?: number | null;
  apiUsageCount: number;
};

function tabHref(tab: string) {
  return tab === "overview" ? "/subscription" : `/subscription?tab=${tab}`;
}

function toneFor(value: number, warnAt: number) {
  if (value >= 100) return "var(--color-danger)";
  if (value >= warnAt) return "var(--color-warning)";
  return "var(--color-success)";
}

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/subscription"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [configResponse, students, teachers] = await Promise.all([
    apiGet<{ mode: string; record: SchoolRecord }>("/api/v1/configuration/school-information"),
    safeApiGet<StudentRecordView[]>("/api/v1/students", []),
    safeApiGet<TeacherRecordView[]>("/api/v1/teachers", [])
  ]);
  const school = configResponse.record;

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "overview";

  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Wallet", href: tabHref("wallet"), active: tab === "wallet" },
    { label: "Usage", href: tabHref("usage"), active: tab === "usage" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Subscription</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Subscription, Billing & Account Settings</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Your plan, billing status, and how much of your plan&apos;s allowance the school is currently using.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? <OverviewTab school={school} /> : null}
      {tab === "wallet" ? <WalletTab school={school} /> : null}
      {tab === "usage" ? <UsageTab school={school} studentCount={students.length} staffCount={teachers.length} /> : null}
    </div>
  );
}

function OverviewTab({ school }: { school: SchoolRecord }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Plan</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.plan}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Account status</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.status}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Health score</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.healthScore}/100</p>
        </article>
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">Billing</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Billing status: {school.billingStatus}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Last payment</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">{school.lastPaymentAt ? formatDate(school.lastPaymentAt) : "No payment on file"}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Next billing date</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">{school.nextBillingAt ? formatDate(school.nextBillingAt) : "Not scheduled"}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Trial ends</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">{school.trialEndsAt ? formatDate(school.trialEndsAt) : "Not on trial"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function WalletTab({ school }: { school: SchoolRecord }) {
  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">No school wallet or ledger yet</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">There is no prepaid wallet feature in this build</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          The platform does not currently track a wallet balance or transaction ledger for your school&apos;s
          subscription — this is not the same as the Fees module, which handles money your school collects from
          students. Billing status and payment dates are shown below from your live account record.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Billing status</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.billingStatus}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Last payment recorded</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.lastPaymentAt ? formatDate(school.lastPaymentAt) : "None on file"}</p>
        </article>
      </section>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null | undefined }) {
  const hasLimit = typeof limit === "number" && limit > 0;
  const pct = hasLimit ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-[var(--color-text-primary)]">{label}</span>
        <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">
          {used.toLocaleString()} {hasLimit ? `/ ${limit.toLocaleString()}` : "(no limit set)"}
        </span>
      </div>
      {hasLimit ? (
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: toneFor(pct, 80) }} />
        </div>
      ) : null}
    </div>
  );
}

function UsageTab({ school, studentCount, staffCount }: { school: SchoolRecord; studentCount: number; staffCount: number }) {
  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Live usage</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">How much of your plan&apos;s allowance is in use</h2>
        <div className="mt-5 grid gap-4">
          <UsageBar label="Students" used={studentCount} limit={school.studentLimit} />
          <UsageBar label="Staff" used={staffCount} limit={school.staffLimit} />
          <UsageBar label="Storage (GB)" used={Math.round(school.storageUsedGb * 10) / 10} limit={school.storageLimitGb} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">SMS allowance / month</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.smsLimitPerMonth ?? "No limit set"}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Email allowance / month</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.emailLimitPerMonth ?? "No limit set"}</p>
        </article>
      </section>

      <section className="surface-card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">API calls recorded</p>
        <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{school.apiUsageCount.toLocaleString()}</p>
      </section>
    </div>
  );
}
