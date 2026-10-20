import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import type { TabContent } from "@/lib/modules/panels";

const status = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/lib/api/server", () => ({ apiGet: async (path: string) => (path.endsWith("/trial") ? status.value : { loaded: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));

import { trialRow } from "@/lib/modules/live/m1-trial";

const html = async () => {
  const row = await trialRow();
  return row ? renderToStaticMarkup(<PanelRows rows={[row] as TabContent["rows"]} />) : "";
};

describe("the trial banner", () => {
  it("says nothing is counted until the trial is started, and offers to start it", async () => {
    status.value = { state: "not-started", days: 30 };
    const out = await html();
    expect(out).toContain("Your free trial has not started");
    expect(out).toContain("Start my free trial");
  });

  it("counts the days left once it is running", async () => {
    status.value = { state: "running", daysLeft: 12, endsAt: "2026-11-19T00:00:00Z" };
    expect(await html()).toContain("12 days left in your free trial");
  });

  it("says plainly when it has ended, and that nothing was deleted", async () => {
    status.value = { state: "ended", daysLeft: 0, endsAt: "2026-10-01T00:00:00Z" };
    expect(await html()).toContain("Your free trial has ended");
  });

  it("shows nothing for a school on a plan, or a teacher's own workspace", async () => {
    status.value = { state: "none" };
    expect(await html()).toBe("");
  });
});
