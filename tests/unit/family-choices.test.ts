import { describe, expect, it } from "vitest";

import { familyAllows, kindOfMessage } from "@/lib/messaging/family-choices";

describe("what a family chose to hear", () => {
  it("reads the kind of a message from its words, and says nothing when they do not say", () => {
    expect(kindOfMessage("Second term fees are due on Friday")).toBe("financial");
    expect(kindOfMessage("Your child's report card is ready")).toBe("academic");
    expect(kindOfMessage("Inter-house sports on Saturday")).toBe("events");
    expect(kindOfMessage("Newsletter: resumption date")).toBe("general");
    expect(kindOfMessage("Hello")).toBeNull();
  });

  it("holds back a message only when the family said no to that kind by that channel", () => {
    const choices = { familyNotify: { "financial:SMS": false } };
    expect(familyAllows(choices, "SMS", "Fees are due").ok).toBe(false);
    expect(familyAllows(choices, "EMAIL", "Fees are due").ok).toBe(true);
    expect(familyAllows(choices, "SMS", "Report card is ready").ok).toBe(true);
  });

  it("sends what it cannot classify, and never holds back the in-app record or a safety notice", () => {
    const choices = { familyNotify: { "financial:SMS": false, "general:SMS": false } };
    expect(familyAllows(choices, "SMS", "Hello there").ok).toBe(true);
    expect(familyAllows(choices, "IN_APP", "Fees are due").ok).toBe(true);
    expect(familyAllows(choices, "SMS", "Urgent: school closed today, fees office too").ok).toBe(true);
    expect(familyAllows(null, "SMS", "Fees are due").ok).toBe(true);
  });
});

describe("WhatsApp is opt-in", () => {
  it("writes to a family only for the kinds it switched on", async () => {
    const { familyAllows: allows, whatsappChosen } = await import("@/lib/messaging/family-choices");
    const chosen = { familyNotify: { "financial:WhatsApp": true } };
    expect(allows(chosen, "WHATSAPP", "Fees are due").ok).toBe(true);
    expect(allows(chosen, "WHATSAPP", "Report card is ready").ok).toBe(false);
    expect(allows(null, "WHATSAPP", "Fees are due").ok).toBe(false);
    expect(allows({ familyNotify: { "financial:SMS": true } }, "WHATSAPP", "Fees are due").ok).toBe(false);
    expect(whatsappChosen(chosen)).toBe(true);
    expect(whatsappChosen({ familyNotify: { "financial:WhatsApp": false } })).toBe(false);
  });

  it("sends a safety notice to anyone who opted in at all, and an unclassified message too", async () => {
    const { familyAllows: allows } = await import("@/lib/messaging/family-choices");
    const chosen = { familyNotify: { "general:WhatsApp": true } };
    expect(allows(chosen, "WHATSAPP", "Urgent: school closed today").ok).toBe(true);
    expect(allows(chosen, "WHATSAPP", "Hello there").ok).toBe(true);
  });
});
