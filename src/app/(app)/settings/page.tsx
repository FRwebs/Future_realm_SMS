import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/settings"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const cards = [
    {
      title: "School configuration",
      detail:
        "Configure academic sessions, terms, class structures, and branding for each tenant school or campus."
    },
    {
      title: "Nigerian grading rules",
      detail:
        "Supports WAEC/NECO-style grading while keeping score weights, positions, and comments configurable."
    },
    {
      title: "Finance integrations",
      detail:
        "Paystack and Flutterwave are abstracted behind gateway interfaces for staged rollout and sandbox testing."
    },
    {
      title: "Security and governance",
      detail:
        "Environment variables, audit trails, RBAC, validation, and tenant-safe row ownership are wired into the architecture."
    }
  ];

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Settings</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
          Tenant and workflow configuration
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          This area is prepared for school branding, permissions, grading schemas, notification
          templates, and term/session configuration. The schema and service layer already support
          these configurations for future expansion.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.title} className="surface-card p-6">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{card.title}</h2>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">{card.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
