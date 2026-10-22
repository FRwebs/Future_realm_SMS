import { joinNames, mergeBody, reachOf, smsSegments, unknownFields } from "@/lib/messaging/merge";

const family = { Guardian: "Mrs Kemi Adeyemi", Child: "Ayomide", Class: "JSS 2 Gold" };

describe("the words one family reads", () => {
  it("puts each family's own name, child and class into the message", () => {
    expect(mergeBody("Dear {Guardian}, {Child} in {Class} has a practical on Friday.", family)).toBe("Dear Mrs Kemi Adeyemi, Ayomide in JSS 2 Gold has a practical on Friday.");
  });

  it("reads a field however it is cased or spaced, and leaves a word that is not a field alone", () => {
    expect(mergeBody("{guardian} / { Child } / {Mood}", family)).toBe("Mrs Kemi Adeyemi / Ayomide / {Mood}");
  });

  it("refuses a field the school does not have, by name, before anything is sent", () => {
    expect(unknownFields("Dear {Parent}, {Child} and {Parent} and {House}")).toEqual(["Parent", "House"]);
    expect(unknownFields("Dear {Guardian}, {Child} in {Class}")).toEqual([]);
  });

  it("names siblings as a family would", () => {
    expect(joinNames(["Ada"])).toBe("Ada");
    expect(joinNames(["Ada", "Chidi"])).toBe("Ada and Chidi");
    expect(joinNames(["Ada", "Chidi", "Ngozi"])).toBe("Ada, Chidi and Ngozi");
    expect(joinNames([])).toBe("");
  });
});

describe("what a text costs", () => {
  it("is a credit up to 160 characters, and another for each further part", () => {
    expect(smsSegments("")).toBe(0);
    expect(smsSegments("x".repeat(160))).toBe(1);
    expect(smsSegments("x".repeat(161))).toBe(2);
    expect(smsSegments("x".repeat(306))).toBe(2);
    expect(smsSegments("x".repeat(307))).toBe(3);
  });
});

describe("who a message can reach", () => {
  const base = { phone: "08050000001", email: "k@example.com", canSms: true, canEmail: true };

  it("always reaches the portal inbox, whatever the contact details say", () => {
    expect(reachOf("IN_APP", { phone: null, email: null, canSms: false, canEmail: false })).toEqual({ ok: true });
  });

  it("says why an SMS cannot go, in words the sender can act on", () => {
    expect(reachOf("SMS", base)).toEqual({ ok: true });
    expect(reachOf("SMS", { ...base, phone: "—" })).toMatchObject({ ok: false, reason: expect.stringMatching(/no phone number/i) });
    expect(reachOf("SMS", { ...base, phone: "12345" })).toMatchObject({ ok: false, reason: expect.stringMatching(/not a nigerian mobile/i) });
    expect(reachOf("SMS", { ...base, canSms: false })).toMatchObject({ ok: false, reason: expect.stringMatching(/asked not to be sent sms/i) });
  });

  it("reads a number written with the country code as the same number", () => {
    expect(reachOf("SMS", { ...base, phone: "+234 805 000 0001" })).toEqual({ ok: true });
  });

  it("needs an address, and consent, for email", () => {
    expect(reachOf("EMAIL", base)).toEqual({ ok: true });
    expect(reachOf("EMAIL", { ...base, email: "" })).toMatchObject({ ok: false });
    expect(reachOf("EMAIL", { ...base, canEmail: false })).toMatchObject({ ok: false });
  });
});
