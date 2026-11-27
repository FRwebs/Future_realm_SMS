import { FamilyDispatchService, NO_CONSENT, type Family } from "../../backend/src/modules/communications/family-dispatch.service";

const family = (id: string, consented: boolean): Family => ({ id, name: `Family ${id}`, phone: "08030000000", email: `${id}@x.ng`, canSms: true, canEmail: true, userId: id, language: "English", children: ["Ada"], arms: ["JSS 1 A"], consented });
const families = [family("a", true), family("b", false), family("c", false)];
const body = "Hello {Guardian}, school resumes on Monday.";

describe("a send reaches only the families who have agreed to notifications", () => {
  const dispatcher = new FamilyDispatchService();

  it("leaves out those who have not, before the count and the cost", () => {
    const plan = dispatcher.plan("SMS", body, families, "Resumption", { requireConsent: true });
    expect(plan.reach).toBe(1);
    expect(plan.credits).toBe(1);
    expect(plan.noConsent).toBe(2);
    expect(plan.rows.filter((row) => !row.reachable).map((row) => row.reason)).toEqual([NO_CONSENT, NO_CONSENT]);
  });

  it("applies to the in-app channel as well", () => {
    const plan = dispatcher.plan("IN_APP", body, families, "Resumption", { requireConsent: true });
    expect(plan.reach).toBe(1);
    expect(plan.noConsent).toBe(2);
  });

  it("reaches everyone, as an emergency does, when the rule is switched off", () => {
    const plan = dispatcher.plan("SMS", body, families, "Emergency", { requireConsent: false });
    expect(plan.reach).toBe(3);
    expect(plan.noConsent).toBe(0);
  });

  it("leaves the rule off for a sender that does not ask for it", () => {
    expect(dispatcher.plan("SMS", body, families, "Note").reach).toBe(3);
  });
});
