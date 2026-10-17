import { accountTab, loadAccount } from "@/lib/modules/live/m11-account";
import { creditsTab, loadCredits } from "@/lib/modules/live/m11-credits";
import { loadPlan, planTab } from "@/lib/modules/live/m11-plan";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M11 Subscription & Billing, read from `/api/v1/subscription-billing`.
 *
 * Plan (what Future Realm costs at the current roll), Credits (what is left to send with) and
 * Account (the agreement, the contacts, ownership, the full export and closure).
 */
export async function subscriptionBillingLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "plan") {
    const [plan, credits] = await Promise.all([loadPlan(), loadCredits()]);
    return planTab(plan, credits);
  }
  if (tabSlug === "credits") return creditsTab(await loadCredits());
  if (tabSlug === "account") return accountTab(await loadAccount());
  return undefined;
}
