import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { decideDrawer, itemHref } from "@/lib/modules/live/m13-forms";
import { queueTab } from "@/lib/modules/live/m13-queue";
import type { ItemView, QueueOverview } from "@/lib/modules/live/m13-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));

const item = (over: Partial<ItemView> = {}): ItemView => ({ key: "FEE_WAIVER:w1", type: "FEE_WAIVER", typeName: "Fee waiver", title: "Ibrahim Salisu · waiver of ₦45,000", summary: "Hardship", requester: { name: "Ngozi Eze", role: "Bursar" }, approver: "Principal", second: "", state: "Awaiting", age: 4, escalatesIn: 3, overdue: false, escalated: false, blocking: "1 family's balance", evidence: null, mine: true, step: 1, bulk: false, href: "/fee-management/review", raisedAt: "2026-10-01T00:00:00Z", ...over });
const overview = (over: Partial<QueueOverview> = {}): QueueOverview => ({ me: { id: "u1", role: "PRINCIPAL" }, canSeeAll: true, scope: "me", kpis: { waiting: 1, escalating: 0, oldest: { days: 4, type: "Fee waiver", title: "x" }, blocked: { items: 1, text: "1 family's balance" }, decided: { count: 3, avgDays: 1.5 }, inFlight: 1 }, featured: null, waiting: [item()], list: [item()], raised: [], types: [{ type: "FEE_WAIVER", name: "Fee waiver" }], counts: { FEE_WAIVER: 1 }, ...over });

describe("M13 queue", () => {
  it("lists each decision and opens it on its own page", () => {
    const tab = queueTab(overview());
    expect(renderToStaticMarkup(<PanelRows rows={tab.rows} />)).toContain("Ibrahim Salisu");
    expect(JSON.stringify(tab)).toContain(itemHref("FEE_WAIVER:w1"));
  });

  it("offers no bulk bar for a queue of decisions that are only ever decided one at a time", () => {
    expect(JSON.stringify(queueTab(overview()))).not.toContain("Approve the ticked");
    expect(JSON.stringify(queueTab(overview({ list: [item({ bulk: true, type: "LEAVE" })] })))).toContain("Approve the ticked");
  });

  it("says so when nothing is waiting", () => {
    const tab = queueTab(overview({ kpis: { ...overview().kpis, waiting: 0, oldest: null }, waiting: [], list: [] }));
    expect(tab.primary?.label).toBe("Nothing waiting on you");
  });
});

describe("M13 decisions", () => {
  const deciding = { key: "LEAVE:l1", title: "Leave", typeName: "Staff leave", approver: "Principal", second: "", step: 1 as const, requester: { name: "Boma" } };

  it("will not send a return or a refusal without a reason, but lets an approval go without one", () => {
    const required = (decision: "approve" | "return" | "decline") => decideDrawer(deciding, decision, null).fields?.find((field) => field.kind === "area")?.required;
    expect(required("approve")).toBeFalsy();
    expect(required("return")).toBe(true);
    expect(required("decline")).toBe(true);
  });

  it("carries on to the next decision when there is one", () => {
    expect(decideDrawer(deciding, "approve", "LEAVE:l2").next?.href).toBe(itemHref("LEAVE:l2"));
    expect(decideDrawer(deciding, "approve", null).next?.href).toBe("/approvals-workflow/queue");
  });
});
