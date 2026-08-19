import { AccessDenied } from "@/components/feedback/access-denied";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { TrendCard } from "@/components/dashboard/trend-card";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { safeApiGet } from "@/lib/principal/portal";
import type {
  DashboardSummary,
  FinanceDashboardView,
  ResultAnalyticsView,
  StudentRecordView
} from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

type AnalyticsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function tabHref(tab: string) {
  return tab === "academic" ? "/analytics" : `/analytics?tab=${tab}`;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/analytics"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [overview, students, academicAnalytics, finance] = await Promise.all([
    apiGet<DashboardSummary>("/api/v1/dashboard/overview"),
    apiGet<StudentRecordView[]>("/api/v1/students"),
    safeApiGet<ResultAnalyticsView>("/api/v1/academics/analytics", {
      metrics: [],
      classSummaries: [],
      subjectSummaries: [],
      statusBreakdown: [],
      missingScores: []
    }),
    safeApiGet<FinanceDashboardView | null>("/api/v1/finance/dashboard", null)
  ]);

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "academic";

  const tabs = [
    { label: "Academic", href: tabHref("academic"), active: tab === "academic" },
    { label: "Financial", href: tabHref("financial"), active: tab === "financial" },
    { label: "More", href: tabHref("more"), active: tab === "more" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Analytics</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Analytics, Reports & Data Export</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          School-wide performance, finance exposure, and admissions signal drawn from live records.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "academic" ? <AcademicTab analytics={academicAnalytics} /> : null}
      {tab === "financial" ? <FinancialTab finance={finance} /> : null}
      {tab === "more" ? <MoreTab overview={overview} students={students} /> : null}
    </div>
  );
}

function AcademicTab({ analytics }: { analytics: ResultAnalyticsView }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analytics.metrics.map((metric) => (
          <article key={metric.label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{metric.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{metric.value}</p>
          </article>
        ))}
        {analytics.metrics.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-secondary)] md:col-span-2 xl:col-span-4">No academic analytics are available yet.</p>
        ) : null}
      </section>

      <TableCard
        title="Class performance"
        description="Average score, publication progress, and missing scores by class."
        items={analytics.classSummaries}
        emptyState="No class summaries are available yet."
        getRowKey={(item, index) => `${item.className}-${index}`}
        columns={[
          { key: "class", header: "Class", render: (item) => <p className="font-semibold text-[var(--color-text-primary)]">{formatNigeriaClassName(item.className)}</p> },
          { key: "average", header: "Average", render: (item) => `${item.average.toFixed(1)}%` },
          { key: "published", header: "Published", render: (item) => item.published },
          { key: "pending", header: "Pending", render: (item) => item.pending },
          { key: "missing", header: "Missing scores", render: (item) => item.missingScores }
        ]}
      />

      <TableCard
        title="Subject performance"
        description="Average score and pass rate by subject across the current term."
        items={analytics.subjectSummaries}
        emptyState="No subject summaries are available yet."
        getRowKey={(item, index) => `${item.subject}-${index}`}
        columns={[
          { key: "subject", header: "Subject", render: (item) => <p className="font-semibold text-[var(--color-text-primary)]">{item.subject}</p> },
          { key: "average", header: "Average", render: (item) => `${item.average.toFixed(1)}%` },
          { key: "passRate", header: "Pass rate", render: (item) => `${item.passRate.toFixed(1)}%` },
          { key: "entries", header: "Entries", render: (item) => item.entries }
        ]}
      />

      <TableCard
        title="Missing scores"
        description="Students with a subject score still unrecorded for the current term."
        items={analytics.missingScores}
        emptyState="No missing scores — every student has a recorded score for their subjects."
        getRowKey={(item) => `${item.studentName}-${item.subject}`}
        columns={[
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "subject", header: "Subject", render: (item) => item.subject }
        ]}
      />
    </div>
  );
}

function FinancialTab({ finance }: { finance: FinanceDashboardView | null }) {
  if (!finance) {
    return (
      <section className="surface-card p-6">
        <p className="section-eyebrow">Unavailable</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Finance analytics are unavailable</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Your role does not currently have visibility into finance data.</p>
      </section>
    );
  }

  const totalCollected = finance.payments.reduce((sum, item) => sum + item.amount, 0);
  const totalOutstanding = finance.invoices.reduce((sum, item) => sum + item.balance, 0);
  const topOutstanding = [...finance.invoices].filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 8);

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {finance.metrics.map((metric) => (
          <article key={metric.label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{metric.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Total collected</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: "var(--color-success)" }}>{formatCurrency(totalCollected)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Total outstanding</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: totalOutstanding > 0 ? "var(--color-danger)" : "var(--color-success)" }}>{formatCurrency(totalOutstanding)}</p>
        </article>
      </section>

      <TableCard
        title="Highest outstanding invoices"
        description="Invoices with the largest unpaid balance, across all classes."
        items={topOutstanding}
        emptyState="No invoices currently have an outstanding balance."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "total", header: "Total", render: (item) => formatCurrency(item.total) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "due", header: "Due", render: (item) => item.dueOn }
        ]}
      />
    </div>
  );
}

function MoreTab({ overview, students }: { overview: DashboardSummary; students: StudentRecordView[] }) {
  const riskStudents = students
    .filter((student) => student.attendanceRate < 90 || student.outstandingBalance > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">No data export yet</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Exporting to CSV/PDF is not wired up yet</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          There is no download/export pipeline in this build yet — the reports below are live, read-only views built
          from the same records as the Academic and Financial tabs.
        </p>
      </section>

      <TrendCard
        title="Admissions funnel"
        description="Pipeline view from submission through approval and waitlisting."
        items={overview.admissionsByStage.map((item) => ({
          label: item.stage.replaceAll("_", " "),
          value: item.count
        }))}
      />

      <TableCard
        title="Risk register"
        description="Students needing follow-up due to low attendance or unpaid balances."
        items={riskStudents}
        emptyState="No students currently show a risk signal."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.fullName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "attendance", header: "Attendance", render: (item) => formatPercentage(item.attendanceRate) },
          { key: "average", header: "Average", render: (item) => `${item.averageScore.toFixed(1)}%` },
          { key: "balance", header: "Outstanding", render: (item) => formatCurrency(item.outstandingBalance) }
        ]}
      />
    </div>
  );
}
