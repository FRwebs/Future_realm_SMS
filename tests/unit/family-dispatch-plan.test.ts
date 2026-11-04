import { FamilyDispatchService, type Family } from "../../backend/src/modules/communications/family-dispatch.service";

const base: Family = {
  id: "g1", name: "Mrs Yusuf", phone: "08031234567", email: "a@b.ng", canSms: true, canEmail: true, userId: "u1", language: "English",
  children: ["Daniel", "Maryam"], arms: ["Nursery 2 A"], kids: [{ first: "Daniel", arm: "Nursery 2 A" }, { first: "Maryam", arm: "Nursery 1 B" }],
};
const service = new FamilyDispatchService();

describe("what a family is sent", () => {
  it("writes one message to the family, naming every child, unless it asked otherwise", () => {
    const plan = service.plan("SMS", "Dear {Guardian}, {Child} in {Class} has a notice.", [base]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.text).toContain("Daniel and Maryam");
    expect(plan.credits).toBe(1);
  });

  it("writes one message for each child when the family asked for that, each with its own name and class", () => {
    const plan = service.plan("SMS", "Dear {Guardian}, {Child} in {Class} has a notice.", [{ ...base, choices: { digest: "separate" } }]);
    expect(plan.rows.map((row) => row.text)).toEqual([
      "Dear Mrs Yusuf, Daniel in Nursery 2 A has a notice.",
      "Dear Mrs Yusuf, Maryam in Nursery 1 B has a notice.",
    ]);
    expect(plan.credits).toBe(2);
  });

  it("charges a WhatsApp message one credit, and only to a family that chose it", () => {
    const chosen = { ...base, canWhatsApp: true, choices: { familyNotify: { "general:WhatsApp": true } } };
    expect(service.plan("WHATSAPP", "Newsletter for {Guardian}", [chosen]).credits).toBe(1);
    expect(service.plan("WHATSAPP", "Newsletter for {Guardian}", [base]).reach).toBe(0);
    expect(service.plan("WHATSAPP", "Fees reminder for {Guardian}", [chosen]).reach).toBe(0);
  });
});
