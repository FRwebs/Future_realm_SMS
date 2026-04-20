import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminSchoolDetail } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const moduleLabels: Record<string, string> = {
  transport: "Transport",
  library: "Library",
  hostel: "Hostel",
  fees: "Fees",
  "e-learning": "E-learning",
  messaging: "Messaging",
  report_cards: "Report cards"
};

export default async function SuperAdminSchoolDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const school = await apiGet<SuperAdminSchoolDetail>(`/api/super-admin/schools/${schoolId}`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/super-admin/schools" className="text-sm font-semibold text-brand-700">Back to schools</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Tenant profile</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{school.name}</h1>
            <p className="mt-2 text-sm text-ink/60">{school.slug} · Created {formatDate(school.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={school.status} />
            <StatusBadge status={school.billingStatus} />
            <span className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink">{school.plan}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {Object.entries(school.counts).map(([label, value]) => (
          <article key={label} className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">{label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Feature flags</h2>
            <p className="mt-2 text-sm text-ink/60">Toggle modules available to this school tenant.</p>
          </div>
          <ResourceActionDialog
            triggerLabel="Update features"
            title="School feature flags"
            description="Paste a JSON object to enable or disable modules for this tenant."
            endpoint={`/api/super-admin/schools/${school.id}/features`}
            method="PATCH"
            variant="secondary"
            submitLabel="Save features"
            fields={[
              { name: "features", label: "Feature JSON", type: "textarea", parse: "json", defaultValue: JSON.stringify(school.featureFlags, null, 2) }
            ]}
          />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Object.entries(school.featureFlags).map(([key, enabled]) => (
            <div key={key} className="flex items-center justify-between rounded-2xl bg-sand/60 p-4 text-sm">
              <span className="font-semibold text-ink">{moduleLabels[key] ?? key}</span>
              <span className={enabled ? "text-emerald-700" : "text-rose-700"}>{enabled ? "Enabled" : "Disabled"}</span>
            </div>
          ))}
        </div>
      </section>

      <TableCard
        title="School admins"
        description="Administrators and leaders attached to this tenant."
        items={school.admins}
        columns={[
          { key: "name", header: "Name", render: (item) => item.name },
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "joined", header: "Joined", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
