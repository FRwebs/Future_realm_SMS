import type { ReactNode } from "react";

import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { Route } from "next";
import Link from "next/link";

import { PlanDuplicateDialog, PlanEditDialog, type Entitlements, type PlanRates } from "@/components/super-admin/plan-action-dialogs";
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

function PlanCard({ plan, others, rates }: { plan: SuperAdminPlanRow; others: SuperAdminPlanRow[]; rates?: PlanRates }) {
  const lifecycle = lifecycleOf(plan);
  const entitlements = parseEntitlements(plan.includedModules);
  const bullets = [...entitlements.modules, ...entitlements.features].slice(0, 3);
  const fallbackBullets = [`${plan.supportTier} support`, plan.apiAccess ? "API access" : null, plan.customBranding ? "Custom branding" : null].filter(
    (item): item is string => Boolean(item)
  );
  const shownBullets = bullets.length > 0 ? bullets : fallbackBullets.slice(0, 3);
  const revenue = plan.monthlyPrice * plan.subscriberCount;

  return (
    <article className="flex min-w-0 flex-col rounded-[14px] border border-(--color-border-default) bg-white p-[18px]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate font-(--font-heading) text-[14.5px] font-bold text-(--color-text-primary)">{plan.name}</p>
          <p className="mt-[2.5px] truncate text-[10px] text-(--color-text-muted)">{planCode(plan)}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F1F4F2] px-[8px] py-[2.5px] text-[10px] font-bold text-[#5C6A62]">
          {lifecycle.charAt(0) + lifecycle.slice(1).toLowerCase()}{plan.version && plan.version > 1 ? ` · v${plan.version}` : ""}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[20.5px] font-bold text-(--color-text-primary)">{formatCurrency(plan.monthlyPrice)}</span>
        <span className="text-[10.5px] text-(--color-text-muted)">flat rate, per school, per semester</span>
      </div>
      <p className="mt-1 text-[10.5px] text-(--color-text-muted)">{planLimits(plan)}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#EDF3EF] pt-3">
        <div>
          <p className="text-[12.5px] font-bold text-(--color-text-primary)">{plan.subscriberCount}</p>
          <p className="text-[9.5px] text-(--color-text-muted)">Schools</p>
        </div>
        <div>
          <p className="truncate text-[12.5px] font-bold text-(--color-text-primary)">{formatCurrency(revenue)}</p>
          <p className="text-[9.5px] text-(--color-text-muted)">Recorded revenue</p>
        </div>
        <div>
          <p className="truncate text-[12.5px] font-bold text-(--color-text-primary)">{plan.supportTier}</p>
          <p className="text-[9.5px] text-(--color-text-muted)">Support</p>
        </div>
      </div>

      {shownBullets.length > 0 ? (
        <div className="mt-1.5 grid gap-1.5">
          {shownBullets.map((line) => (
            <div key={line} className="flex items-start gap-2 pt-[4.5px]">
              <span className="mt-[5.5px] h-[4.5px] w-[4.5px] shrink-0 rounded-[2px] bg-[#9FC7B6]" />
              <span className="text-[10.5px] leading-snug text-[#435048]">{line}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap gap-[6.5px] border-t border-[#EDF3EF] pt-[11.5px]">
        <PlanEditDialog plan={plan} variant="cardPrimary" rates={rates} />
        <PlanDuplicateDialog plan={plan} variant="cardCompact" rates={rates} />
        {lifecycle === "DRAFT" ? (
          <>
            <ResourceActionDialog
              triggerLabel="Publish"
              title={`Publish ${plan.name}`}
              description="Makes the plan available to sales and to new schools. Any plan already on offer for this tier moves to Legacy if schools are still on it."
              endpoint={`/api/super-admin/plans-features/plans/${plan.id}/lifecycle`}
              method="POST"
              variant="cardCompact"
              submitLabel="Publish plan"
              note="Publishing is its own act, from Lifecycle — a plan with no way back should not be published."
              impact={{ label: "On publishing", rows: [["Offered to new schools", "Sellable and assignable from today"], ["The plan it replaces", "Stays for the schools already on it, as Legacy; goes if none are"], ["Logged", "A version records who published it and when"]] }}
              fields={[{ name: "lifecycle", label: "Lifecycle", type: "hidden", defaultValue: "ACTIVE" }, { name: "confirm", label: "Publishing", type: "static", placeholder: `${plan.name} · v${plan.version ?? 1}`, section: "What is being published" }]}
            />
            <ResourceActionDialog
              triggerLabel="Discard draft"
              title={`Discard the draft ${plan.name}`}
              description="The draft is archived. Nothing else is affected — no school was ever on it."
              endpoint={`/api/super-admin/plans-features/plans/${plan.id}/lifecycle`}
              method="POST"
              variant="cardCompact"
              submitLabel="Discard draft"
              fields={[{ name: "lifecycle", label: "Lifecycle", type: "hidden", defaultValue: "ARCHIVED" }, { name: "reason", label: "Why it is being discarded", type: "textarea", required: true }]}
            />
          </>
        ) : (
          <>
            <Link href={"/super-admin/feature-flags?tab=matrix" as Route} className="rounded-[8px] border border-(--color-border-default) bg-transparent px-[11px] py-[6px] text-[11.5px] font-semibold text-[#435048] hover:border-(--color-border-strong)">
              Manage features
            </Link>
            <ResourceActionDialog
              triggerLabel="Price"
              title={`Schedule a price change · ${plan.name}`}
              description={plan.subscriberCount > 0 ? `${plan.subscriberCount} school${plan.subscriberCount === 1 ? " is" : "s are"} on this plan. Each is told in the app now, the price waits out 30 days’ notice, and it is applied automatically on the date you choose.` : "No school is on this plan, so the price can change at once — pick today’s date."}
              endpoint={`/api/super-admin/plans-features/plans/${plan.id}/price`}
              method="POST"
              variant="cardCompact"
              submitLabel="Schedule change"
              note="A price a school agreed to is honoured until it has been told, and a change needs 30 days’ notice."
              impact={{ label: "On scheduling", rows: [["Schools are told now", `${plan.subscriberCount} school${plan.subscriberCount === 1 ? "" : "s"} on the plan, in the app, with your reason`], ["Nothing changes until the date", "The price they pay today is untouched"], ["Applied automatically", "On the date you choose, and recorded as a new version"]] }}
              fields={[
                { name: "newMonthly", label: "New price per semester (₦)", type: "number", required: true, defaultValue: plan.monthlyPrice, min: 0, section: "The new price" },
                { name: "newAnnual", label: "New annual price (₦)", type: "number", required: true, defaultValue: plan.annualPrice, min: 0, section: "The new price" },
                { name: "effectiveAt", label: "Takes effect on", type: "date", required: true, section: "When" },
                { name: "reason", label: "Why the price is changing", type: "textarea", required: true, note: "Schools read this in the notice", section: "Why" }
              ]}
            />
            <ResourceActionDialog
              triggerLabel={lifecycle === "LEGACY" ? "Close plan" : "Archive"}
              title={lifecycle === "LEGACY" ? `Close ${plan.name}` : `Archive ${plan.name}`}
              description={plan.subscriberCount > 0 ? `${plan.subscriberCount} school${plan.subscriberCount === 1 ? " is" : "s are"} on this plan. Choose the plan to move them to; they are moved, recorded and told.` : "Nobody is on this plan, so it can be archived now."}
              endpoint={`/api/super-admin/plans-features/plans/${plan.id}/lifecycle`}
              method="POST"
              variant="cardCompact"
              submitLabel={lifecycle === "LEGACY" ? "Close plan" : "Archive plan"}
              note="An archive needs zero schools on the plan — the migration completes first, and the system blocks it otherwise."
              impact={{ label: "On archiving", rows: [["Schools on the plan", plan.subscriberCount > 0 ? "Moved to the plan you choose, each told in the app" : "None to move"], ["Data is never deleted", "Records outside the new plan’s entitlements stay, read-only"], ["Logged", "The move, who made it and why, in the plan’s history"]] }}
              fields={[
                { name: "lifecycle", label: "Lifecycle", type: "hidden", defaultValue: "ARCHIVED" },
                ...(plan.subscriberCount > 0
                  ? [{ name: "migrateToPlanId", label: "Move schools to", type: "select" as const, required: true, defaultValue: "", options: [{ label: "Choose a plan", value: "" }, ...others.filter((other) => other.id !== plan.id && other.plan !== plan.plan && ["ACTIVE", "LEGACY"].includes(lifecycleOf(other))).map((other) => ({ label: `${other.name} (${other.plan.toLowerCase()})`, value: other.id }))], section: "Plan migration" }]
                  : []),
                { name: "reason", label: "Why it is being closed", type: "textarea", section: "Reason" }
              ]}
            />
            {lifecycle === "ACTIVE" ? (
              <ResourceActionDialog
                triggerLabel="Close to new sales"
                title={`Close ${plan.name} to new sales`}
                description="The plan becomes Legacy: no new school can choose it, and the schools already on it keep it."
                endpoint={`/api/super-admin/plans-features/plans/${plan.id}/lifecycle`}
                method="POST"
                variant="cardCompact"
                submitLabel="Close to new sales"
                fields={[{ name: "lifecycle", label: "Lifecycle", type: "hidden", defaultValue: "LEGACY" }, { name: "reason", label: "Why it is being closed", type: "textarea", required: true }]}
              />
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

export function PlanCardGrid({ plans, actions, rates }: { plans: SuperAdminPlanRow[]; actions: ReactNode; rates?: PlanRates }) {
  return (
    <section className="grid gap-[14px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-bold text-(--color-text-primary)">Subscription plans</p>
          <p className="mt-1 max-w-2xl text-[11px] text-(--color-text-muted)">
            Priced and invoiced in Naira, flat rate per school per semester — not per student, not per currency. New subscriptions and upgrades use these terms.
          </p>
        </div>
        {actions}
      </div>
      {plans.length === 0 ? (
        <p className="rounded-[14px] border border-(--color-border-default) bg-white p-6 text-[11.5px] text-(--color-text-muted)">
          No subscription plans configured yet — build one to get started.
        </p>
      ) : (
        <div className="grid items-stretch gap-[11px] grid-cols-[repeat(auto-fill,minmax(232px,1fr))]">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} others={plans} rates={rates} />
          ))}
        </div>
      )}
    </section>
  );
}
