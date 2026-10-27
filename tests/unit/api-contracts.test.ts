import { membershipsContract, notificationsContract, plansContract, slugCheckContract } from "@/lib/api/contracts";

describe("what the browser expects of the API", () => {
  it("reads all three notification feeds the bell can be pointed at", () => {
    // Staff (`/notifications/mine`): has a destination, no channel.
    const staff = [{ id: "n1", title: "Leave request waiting", body: "…", status: "SENT", sentAt: "2026-10-27T09:00:00.000Z", href: "/portals/teacher/leave" }, { id: "n2", title: "Welcome", body: "…", status: "READ", sentAt: null, href: null }];
    // Parent and student: a channel, no destination.
    const family = [{ id: "n3", title: "Results out", body: "…", channel: "IN_APP", status: "SENT", sentAt: "2026-10-27T09:00:00.000Z" }, { id: "n4", title: "Fee reminder", body: "…", channel: "EMAIL", status: "SENT" }];
    expect(notificationsContract.safeParse(staff).success).toBe(true);
    expect(notificationsContract.safeParse(family).success).toBe(true);
  });

  it("still refuses an answer that is the wrong shape", () => {
    expect(notificationsContract.safeParse([{ id: 1, title: "x" }]).success).toBe(false);
    expect(notificationsContract.safeParse({ data: [] }).success).toBe(false);
  });

  it("reads the other lookups", () => {
    expect(membershipsContract.safeParse([{ schoolId: "s", schoolName: "Greenfield", role: "TEACHER", current: true }]).success).toBe(true);
    expect(slugCheckContract.safeParse({ tone: "good", badge: "Available", note: "ok", available: true, slug: "greenfield" }).success).toBe(true);
    expect(plansContract.safeParse([{ slug: "trial", name: "Trial", plan: "PROFESSIONAL", monthlyPrice: 0, annualPrice: 0, includedModules: [], staffLimit: null }]).success).toBe(true);
  });
});
