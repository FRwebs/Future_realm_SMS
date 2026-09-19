import type { ReactNode } from "react";

import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PlanEditDialog, type Entitlements } from "@/components/super-admin/plan-action-dialogs";
import type { SuperAdminPlanRow } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";

function parseEntitlements(value: unknown): Entitlements {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const modules = Array.isArray(record.modules) ? record.modules.filter((item): item is string => typeof item === "string") : [];
    const features = Array.isArray(record.features) ? record.features.filter((item): item is string => typeof item === "string") : [];
    return { modules, features };
  }
  return { modules: [], features: [] };
}

function planCode(plan: SuperAdminPlanRow) {
  return `${plan.plan} · ${plan.slug}`;
}

function planLimits(plan: SuperAdminPlanRow) {
  const students = plan.studentLimit ? `${plan.studentLimit.toLocaleString()} students` : "Unlimited students";
  const staff = plan.staffLimit ? `${plan.staffLimit.toLocaleString()} staff` : "Unlimited staff";
  return `${students} · ${staff}`;
}

function PlanCard({ plan }: { plan: SuperAdminPlanRow }) {
  const entitlements = parseEntitlements(plan.includedModules);
  const bullets = [...entitlements.modules, ...entitlements.features].slice(0, 3);
  const fallbackBullets = [`${plan.supportTier} support`, plan.apiAccess ? "API access" : null, plan.customBranding ? "Custom branding" : null].filter(
    (item): item is string => Boolean(item)
  );
  const shownBullets = bullets.length > 0 ? bullets : fallbackBullets.slice(0, 3);
  const revenue = plan.monthlyPrice * plan.subscriberCount;

  return (
    <article className="flex flex-col rounded-[14px] border border-[var(--color-border-default)] bg-white p-5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[var(--color-text-primary)]">{plan.name}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-text-muted)]">{planCode(plan)}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F1F4F2] px-[9px] py-[3px] text-[11px] font-bold text-[#5C6A62]">
          {plan.isActive ? "Active" : "Archived"}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[23px] font-bold text-[var(--color-text-primary)]">{formatCurrency(plan.monthlyPrice)}</span>
        <span className="text-[11.5px] text-[var(--color-text-muted)]">flat rate, per school, per semester</span>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{planLimits(plan)}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#EDF3EF] pt-3">
        <div>
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{plan.subscriberCount}</p>
          <p className="text-[10.5px] text-[var(--color-text-muted)]">Schools</p>
        </div>
        <div>
          <p className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">{formatCurrency(revenue)}</p>
          <p className="text-[10.5px] text-[var(--color-text-muted)]">Recorded revenue</p>
        </div>
        <div>
          <p className="truncate text-[14px] font-bold text-[var(--color-text-primary)]">{plan.supportTier}</p>
          <p className="text-[10.5px] text-[var(--color-text-muted)]">Support</p>
        </div>
      </div>

      {shownBullets.length > 0 ? (
        <div className="mt-1.5 grid gap-1.5">
          {shownBullets.map((line) => (
            <div key={line} className="flex items-start gap-2 pt-[5px]">
              <span className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-[2px] bg-[#9FC7B6]" />
              <span className="text-[11.5px] leading-snug text-[#435048]">{line}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap gap-[7px] border-t border-[#EDF3EF] pt-[13px]">
        <PlanEditDialog plan={plan} variant="cardPrimary" />
        <ResourceActionDialog
          triggerLabel={plan.isActive ? "Archive" : "Reactivate"}
          title={`${plan.isActive ? "Archive" : "Reactivate"} ${plan.name}`}
          description={
            plan.isActive
              ? "Archived plans stay on existing subscriptions but can no longer be selected for new signups or upgrades."
              : "Reactivating makes this plan selectable again for new signups and upgrades."
          }
          endpoint={`/api/super-admin/plans/${plan.id}/toggle`}
          method="PATCH"
          variant="cardCompact"
          submitLabel={plan.isActive ? "Archive plan" : "Reactivate plan"}
          confirmLabel="Confirm"
          fields={[]}
        />
      </div>
    </article>
  );
}

export function PlanCardGrid({ plans, actions }: { plans: SuperAdminPlanRow[]; actions: ReactNode }) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Subscription plans</p>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--color-text-muted)]">
            Priced and invoiced in Naira, flat rate per school per semester — not per student, not per currency. New subscriptions and upgrades use these terms.
          </p>
        </div>
        {actions}
      </div>
      {plans.length === 0 ? (
        <p className="rounded-[14px] border border-[var(--color-border-default)] bg-white p-6 text-[13px] text-[var(--color-text-muted)]">
          No subscription plans configured yet — build one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </section>
  );
}
