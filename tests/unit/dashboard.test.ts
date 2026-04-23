import { canSeeDashboardWidget, getDashboardQuickActions } from "@/lib/domain/dashboard";

describe("dashboard domain", () => {
  it("keeps finance mutation shortcuts away from principals", () => {
    expect(canSeeDashboardWidget("PRINCIPAL", "finance")).toBe(true);
    expect(getDashboardQuickActions("PRINCIPAL").map((item) => item.label)).not.toContain("Create invoice");
  });

  it("shows finance shortcuts to bursars and admission shortcuts to admissions officers", () => {
    expect(getDashboardQuickActions("ACCOUNTANT").map((item) => item.label)).toContain("Create invoice");
    expect(getDashboardQuickActions("BURSAR").map((item) => item.label)).toContain("Create invoice");
    expect(getDashboardQuickActions("ADMISSIONS_OFFICER").map((item) => item.label)).toEqual(["Review admissions", "Parents directory"]);
  });
});
