import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/utils/formatters";

type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  enabledGlobally: boolean;
  rolloutPercent: number;
  overrides: number;
  createdAt: string;
};

export default async function SuperAdminFeatureFlagsPage() {
  const flags = await apiGet<FeatureFlag[]>("/api/super-admin/feature-flags");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Release controls</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">Feature Flags</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Manage global rollout switches and per-school feature overrides for controlled SaaS releases.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Create Flag"
            title="Create feature flag"
            description="Use a stable key such as results.new-broadsheet or fees.paystack-v2."
            endpoint="/api/super-admin/feature-flags"
            fields={[
              { name: "key", label: "Flag Key", required: true, placeholder: "module.feature-name" },
              { name: "name", label: "Display Name", required: true },
              { name: "description", label: "Description", type: "textarea" },
              { name: "enabledGlobally", label: "Enabled Globally", type: "select", defaultValue: "false", options: [
                { label: "No", value: "false" },
                { label: "Yes", value: "true" }
              ] },
              { name: "rolloutPercent", label: "Rollout Percent", type: "number", defaultValue: 0, min: 0, max: 100 }
            ]}
            submitLabel="Create Flag"
            confirmLabel="Confirm Flag"
          />
        </div>
      </section>

      <TableCard
        title="Flags"
        description="Global and gradual rollout controls."
        items={flags ?? []}
        emptyState="No feature flags have been configured."
        columns={[
          { key: "name", header: "Flag", render: (item) => <div><p className="font-semibold text-ink">{item.name}</p><p className="text-xs text-ink/50">{item.key}</p></div> },
          { key: "status", header: "Global Status", render: (item) => item.enabledGlobally ? "Enabled" : "Disabled" },
          { key: "rollout", header: "Rollout", render: (item) => `${item.rolloutPercent}%` },
          { key: "overrides", header: "School Overrides", render: (item) => item.overrides },
          { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
