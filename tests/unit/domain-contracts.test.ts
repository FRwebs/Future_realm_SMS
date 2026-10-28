import { SuperAdminPlanRowSchema, SubscriptionPlanSchema, SuperAdminPlanRowListSchema } from "@/lib/domain/types.zod";

const plan = { id: "p", name: "Trial", slug: "trial", plan: "PROFESSIONAL", monthlyPrice: 0, annualPrice: 0, studentLimit: null, smsUnitsPerMonth: 0, emailSendsPerMonth: 5000, supportTier: "EMAIL", apiAccess: false, customBranding: false, includedModules: { modules: [] }, isActive: true, subscriberCount: 0, createdAt: "2026-01-01T00:00:00.000Z" };

describe("the checks generated from the domain types", () => {
  it("accept what the API sends, including nulls where a field is optional and fields the type does not know", () => {
    expect(SuperAdminPlanRowSchema.safeParse({ ...plan, somethingNew: 1, subscriberCount: 3 }).success).toBe(true);
    expect(SubscriptionPlanSchema.safeParse("PROFESSIONAL").success).toBe(true);
    expect(SubscriptionPlanSchema.safeParse("SOMETHING_ELSE").success).toBe(false);
  });

  it("notice a number that arrived as text, which is what the plans list once did", () => {
    expect(SuperAdminPlanRowListSchema.safeParse([{ ...plan, monthlyPrice: "0" }]).success).toBe(false);
  });
});
