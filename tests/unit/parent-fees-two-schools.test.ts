import { familyFees, letterhead, type Fees } from "@/lib/modules/live/parent/fees";
import type { ParentMe } from "@/lib/modules/live/parent/shared";

const child = (over: Record<string, unknown>) => ({ id: "c", name: "Chioma Adebayo", first: "Chioma", arm: "SSS 2A", invoiceNo: "INV-1", invoiceId: "i", payInvoiceId: "i", payAmount: 0, term: "First Term", billed: 0, paid: 0, balance: 0, outstanding: 0, fromEarlier: 0, oldestDue: null, status: "Paid in full", tone: "positive", ...over });
const me = { school: "Grace Academy", name: "Mrs Adebayo" } as unknown as ParentMe;
type Loose = { type: string; cards?: Array<{ label: string; value: string; sub?: string }>; title?: string; body?: string };
const panels = (data: Fees) => familyFees(data, me).rows.flatMap((entry) => entry.panels as unknown as Loose[]);

describe("the family's fees across two schools", () => {
  const two = {
    children: [
      child({ id: "a", first: "Chioma", schoolId: "s1", school: "Grace Academy", currency: "NGN", billed: 559_000, paid: 435_000, balance: 124_000, outstanding: 124_000, payAmount: 124_000, status: "Overdue", tone: "negative" }),
      child({ id: "b", first: "Kemi", name: "Kemi Adebayo", arm: "Year 11", schoolId: "s2", school: "Ridgeview", currency: "GHS", billed: 34_650, paid: 23_100, balance: 11_550, outstanding: 11_550, payAmount: 11_550, status: "Part paid", tone: "attention" }),
    ],
    invoices: [], payments: [], plans: [], reports: [],
  } as unknown as Fees;

  it("reads each school's figures in its own money and adds nothing across them", () => {
    const cards = panels(two).find((panel) => panel.type === "kpi")!.cards!;
    expect(cards.map((card) => [card.label, card.value])).toEqual([
      ["Grace Academy · owed now", "₦124,000"], ["Grace Academy · paid", "₦435,000"],
      ["Ridgeview · owed now", "GH₵11,550"], ["Ridgeview · paid", "GH₵23,100"],
    ]);
    expect(cards.find((card) => card.label === "Grace Academy · paid")!.sub).toBe("Of ₦559,000 billed");
    expect(cards.find((card) => card.label === "Ridgeview · paid")!.sub).toBe("Of GH₵34,650 billed");
  });

  it("says the schools are kept apart, and why", () => {
    const note = panels(two).find((panel) => panel.type === "note")!;
    expect(note.title).toBe("Two currencies, kept apart");
    expect(note.body).toMatch(/Grace Academy bills in Nigerian naira, Ridgeview bills in Ghanaian cedi/);
  });

  it("is the same four cards as ever for a family at one school", () => {
    const one = { ...two, children: [two.children[0]!] } as Fees;
    const cards = panels(one).find((panel) => panel.type === "kpi")!.cards!;
    expect(cards.map((card) => card.label)).toEqual(["Owed now", "Billed this term", "Paid this term", "Receipts on record"]);
    expect(cards[0]!.value).toBe("₦124,000");
    expect(panels(one).some((panel) => panel.type === "note")).toBe(false);
  });
});

describe("the paper a school issues", () => {
  const family = {
    school: "Grace Academy", office: { name: "Grace Academy", phone: "0803", website: "grace.example.ng", where: "Abuja, FCT" },
    schools: [
      { id: "s1", name: "Grace Academy", office: { phone: "0803", website: "grace.example.ng", where: "Abuja, FCT" } },
      { id: "s2", name: "Ridgeview International School", office: { phone: "0302000111", website: "ridgeview.example.gh", where: "Accra, Greater Accra" } },
    ],
  } as unknown as ParentMe;

  it("carries the name and office of the school that billed the child", () => {
    expect(letterhead(family, { schoolId: "s2" })).toEqual({ name: "Ridgeview International School", place: "Accra, Greater Accra", contact: "0302000111 · ridgeview.example.gh" });
    expect(letterhead(family, { schoolId: "s1" }).name).toBe("Grace Academy");
  });

  it("falls back to the signed-in school's office when the child's school is not known", () => {
    expect(letterhead(family).name).toBe("Grace Academy");
    expect(letterhead(family, { schoolId: "nope" }).contact).toBe("0803 · grace.example.ng");
  });
});
