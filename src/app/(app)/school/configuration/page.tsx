import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ConfigurationResourceClient } from "@/components/configuration/configuration-resource-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

const otherSettings = [
  { key: "admissions", label: "Admissions" },
  { key: "class-levels", label: "Class Levels" },
  { key: "class-arms", label: "Class Arms" },
  { key: "subjects", label: "Subjects" },
  { key: "attendance", label: "Attendance" },
  { key: "finance", label: "Finance" },
  { key: "payment-settings", label: "Payment Settings" },
  { key: "fees", label: "Fees Configuration" },
  { key: "chart-of-accounts", label: "Chart of Accounts" },
  { key: "expense-items", label: "Expense Items" },
  { key: "inventory-settings", label: "Inventory Settings" },
  { key: "payroll-settings", label: "Payroll Settings" },
  { key: "id-card", label: "ID Card" },
  { key: "messaging", label: "Messaging" },
  { key: "login-history", label: "Login History" }
];

function tabHref(tab: string) {
  return tab === "profile" ? "/school/configuration" : `/school/configuration?tab=${tab}`;
}

export default async function ConfigurationPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/configuration"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }
  const { tab = "profile" } = searchParams ? await searchParams : {};

  const tabs = [
    { label: "Profile", href: tabHref("profile"), active: tab === "profile" },
    { label: "Calendar & Terms", href: tabHref("calendar"), active: tab === "calendar" },
    { label: "Grading & Weighting", href: tabHref("grading"), active: tab === "grading" },
    { label: "Policies & Report Card Setup", href: tabHref("policy"), active: tab === "policy" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">School administration</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">School Configuration & Academic Setup</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Your school&apos;s identity, calendar, grading scale, and academic policies — every other module builds on
          what&apos;s set here.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "profile" ? (
        <section className="surface-card p-6">
          <ConfigurationResourceClient resource="school-information" embedded title="School profile" />
        </section>
      ) : null}

      {tab === "calendar" ? (
        <div className="grid gap-5">
          <section className="surface-card p-6">
            <ConfigurationResourceClient resource="sessions-terms" embedded title="Sessions & terms" />
          </section>
          <section className="surface-card p-6">
            <ConfigurationResourceClient resource="school-calendar" embedded title="School calendar" />
          </section>
        </div>
      ) : null}

      {tab === "grading" ? (
        <section className="surface-card p-6">
          <ConfigurationResourceClient resource="performance-configuration" embedded title="Grading & assessment weighting" />
        </section>
      ) : null}

      {tab === "policy" ? (
        <div className="grid gap-5">
          <section className="surface-card p-6">
            <ConfigurationResourceClient resource="report-templates" embedded title="Report card templates" />
          </section>
          <section className="surface-card p-6">
            <ConfigurationResourceClient resource="promotions" embedded title="Promotion policy" />
          </section>
          <section className="surface-card p-6">
            <ConfigurationResourceClient resource="exam" embedded title="Exam policy" />
          </section>
        </div>
      ) : null}

      <section className="surface-card p-6">
        <p className="section-eyebrow">More settings</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Other configuration areas</h2>
        <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
          These belong to other modules and will move there as each is rebuilt — accessible here in the meantime.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {otherSettings.map((item) => (
            <a
              key={item.key}
              href={`/school/configuration/${item.key}`}
              className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
