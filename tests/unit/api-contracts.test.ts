import { internalDevicesContract, internalOwnsContract, membershipsContract, notificationsContract, partnerOverviewContract, plansContract, slugCheckContract, tierChangePreviewContract } from "@/lib/api/contracts";

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

  it("reads what the Back Office, partner portal and plan switch ask for after a page has loaded", () => {
    // Taken from the API's own answers.
    expect(internalDevicesContract.safeParse([{ device: "Mozilla/5.0", first: "2026-10-27T15:15:30.567Z", last: "2026-10-27T15:15:30.567Z", count: 1, ip: null }]).success).toBe(true);
    expect(internalOwnsContract.safeParse({ openTickets: 0, schools: 0, openFlags: 4 }).success).toBe(true);
    const tier = { key: "PREMIUM", name: "Premium", rate: 900 };
    const preview = { isUpgrade: false, direction: "DOWNGRADE", currentTier: tier, targetTier: { ...tier, key: "STANDARD", rate: 600 }, activeStudentCount: 338, term: { id: "t", label: "Second Term", startDate: "2026-01-08T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" }, totalTermDays: 113, remainingTermDays: 0, prorationRatio: 0, immediateAmountDue: 0, taxOnImmediate: 0, immediateTotal: 0, effectiveDate: "Next term", effectiveOn: null, newTermlyAmount: 202800, termlyDifference: -101400, blocked: null };
    expect(tierChangePreviewContract.safeParse(preview).success).toBe(true);
    expect(tierChangePreviewContract.safeParse({ ...preview, term: null, blocked: { code: "NO_TERM", message: "No term is open." } }).success).toBe(true);
    expect(tierChangePreviewContract.safeParse({ ...preview, immediateTotal: "0" }).success).toBe(false);
    const overview = { person: { name: "A", email: "a@x.ng" }, partner: { name: "P", code: null, tier: null, territory: null }, schools: [], deals: [], commission: { accrued: 0, statements: [] } };
    expect(partnerOverviewContract.safeParse(overview).success).toBe(true);
    expect(partnerOverviewContract.safeParse({ ...overview, commission: { accrued: "0", statements: [] } }).success).toBe(false);
  });
});
