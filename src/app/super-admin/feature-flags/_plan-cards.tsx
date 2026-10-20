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

function lifecycleOf(plan: SuperAdminPlanRow) {
  return plan.lifecycle ?? (plan.isActive ? "ACTIVE" : "ARCHIVED");
}

function PlanCard({ plan, others }: { plan: SuperAdminPlanRow; others: SuperAdminPlanRow[] }) {
  const lifecycle = lifecycleOf(plan);
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
          <p className="truncate text-[14.5px] font-bold text-[var(--color-text-primary)]">{plan.name}</p>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--color-text-muted)]">{planCode(plan)}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F1F4F2] px-[9px] py-[3px] text-[10px] font-bold text-[#5C6A62]">
          {lifecycle.charAt(0) + lifecycle.slice(1).toLowerCase()}{plan.version && plan.version > 1 ? ` · v${plan.version}` : ""}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[20.5px] font-bold text-[var(--color-text-primary)]">{formatCurrency(plan.monthlyPrice)}</span>
        <span className="text-[10.5px] text-[var(--color-text-muted)]">flat rate, per school, per semester</span>
      </div>
      <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">{planLimits(plan)}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#EDF3EF] pt-3">
        <div>
          <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{plan.subscriberCount}</p>
          <p className="text-[9.5px] text-[var(--color-text-muted)]">Schools</p>
        </div>
        <div>
          <p className="truncate text-[12.5px] font-bold text-[var(--color-text-primary)]">{formatCurrency(revenue)}</p>
          <p className="text-[9.5px] text-[var(--color-text-muted)]">Recorded revenue</p>
        </div>
        <div>
          <p className="truncate text-[12.5px] font-bold text-[var(--color-text-primary)]">{plan.supportTier}</p>
          <p className="text-[9.5px] text-[var(--color-text-muted)]">Support</p>
        </div>
      </div>

      {shownBullets.length > 0 ? (
        <div className="mt-1.5 grid gap-1.5">
          {shownBullets.map((line) => (
            <div key={line} className="flex items-start gap-2 pt-[5px]">
              <span className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-[2px] bg-[#9FC7B6]" />
              <span className="text-[10.5px] leading-snug text-[#435048]">{line}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap gap-[7px] border-t border-[#EDF3EF] pt-[13px]">
        <PlanEditDialog plan={plan} variant="cardPrimary" />
        <ResourceActionDialog
          triggerLabel="Price"
          title={`Schedule a price change — ${plan.name}`}
          description={plan.subscriberCount > 0 ? `${plan.subscriberCount} school${plan.subscriberCount === 1 ? " is" : "s are"} on this plan. Each is told in the app now, the price waits out 30 days' notice, and it is applied automatically on the date you choose.` : "No school is on this plan, so the price can change at once — pick today's date."}
          endpoint={`/api/super-admin/plans-features/plans/${plan.id}/price`}
          method="POST"
          variant="cardCompact"
          submitLabel="Schedule change"
          fields={[
            { name: "newMonthly", label: "New price per semester (₦)", type: "number", required: true, defaultValue: plan.monthlyPrice, min: 0 },
            { name: "newAnnual", label: "New annual price (₦)", type: "number", required: true, defaultValue: plan.annualPrice, min: 0 },
            { name: "effectiveAt", label: "Takes effect on", type: "date", required: true },
            { name: "reason", label: "Why the price is changing", type: "textarea", required: true, note: "Schools see this in the notice." }
          ]}
        />
        <ResourceActionDialog
          triggerLabel="Lifecycle"
          title={`Plan lifecycle — ${plan.name}`}
          description="Draft: not yet offered. Active: offered to new schools. Legacy: closed to new schools, kept for those on it. Archived: gone — a plan with schools on it can only be archived by moving them to another plan."
          endpoint={`/api/super-admin/plans-features/plans/${plan.id}/lifecycle`}
          method="POST"
          variant="cardCompact"
          submitLabel="Change lifecycle"
          confirmLabel="Confirm"
          confirmMessage={plan.subscriberCount > 0 ? "Archiving moves every school on this plan to the plan you choose, and tells them." : undefined}
          fields={[
            { name: "lifecycle", label: "Lifecycle", type: "select", defaultValue: lifecycle, options: [{ label: "Draft", value: "DRAFT" }, { label: "Active", value: "ACTIVE" }, { label: "Legacy", value: "LEGACY" }, { label: "Archived", value: "ARCHIVED" }] },
            { name: "migrateToPlanId", label: "Move schools to (needed to archive a plan with schools on it)", type: "select", defaultValue: "", options: [{ label: "—", value: "" }, ...others.filter((other) => other.id !== plan.id && other.plan !== plan.plan && ["ACTIVE", "LEGACY"].includes(lifecycleOf(other))).map((other) => ({ label: `${other.name} (${other.plan.toLowerCase()})`, value: other.id }))] }
          ]}
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
          <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">Subscription plans</p>
          <p className="mt-1 max-w-2xl text-[11px] text-[var(--color-text-muted)]">
            Priced and invoiced in Naira, flat rate per school per semester — not per student, not per currency. New subscriptions and upgrades use these terms.
          </p>
        </div>
        {actions}
      </div>
      {plans.length === 0 ? (
        <p className="rounded-[14px] border border-[var(--color-border-default)] bg-white p-6 text-[11.5px] text-[var(--color-text-muted)]">
          No subscription plans configured yet — build one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} others={plans} />
          ))}
        </div>
      )}
    </section>
  );
}
