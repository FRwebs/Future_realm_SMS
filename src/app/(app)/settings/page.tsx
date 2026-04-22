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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Settings</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">
          Tenant and workflow configuration
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
          This area is prepared for school branding, permissions, grading schemas, notification
          templates, and term/session configuration. The schema and service layer already support
          these configurations for future expansion.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.title} className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">{card.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
