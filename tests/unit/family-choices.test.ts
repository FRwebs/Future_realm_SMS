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
