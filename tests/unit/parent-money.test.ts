import { currencyName, money, symbolOf } from "@/lib/modules/live/parent/shared";

describe("a figure in a school's own money", () => {
  it("writes naira as it always has been, and cedis the way Ghana does", () => {
    expect(money(124_000)).toBe("₦124,000");
    expect(money(124_000, "NGN")).toBe("₦124,000");
    expect(money(11_550, "GHS")).toBe("GH₵11,550");
  });

  it("falls back to the code for a currency it cannot format", () => {
    expect(money(900, "XXX")).toMatch(/900/);
  });

  it("gives the sign and the name for a form label and a sentence", () => {
    expect(symbolOf("NGN")).toBe("₦");
    expect(symbolOf("GHS")).toBe("GH₵");
    expect(currencyName("GHS")).toBe("Ghanaian cedi");
    expect(currencyName("NGN")).toBe("Nigerian naira");
  });
});

import { wholeFamily, type ParentMe } from "@/lib/modules/live/parent/shared";

describe("naming the schools a page covers", () => {
  const family = (count: number) => ({ schools: Array.from({ length: count }, (_, index) => ({ id: String(index) })) }) as unknown as ParentMe;

  it("says nothing for one school, and names two as both", () => {
    expect(wholeFamily("Whole family", family(1))).toBe("Whole family");
    expect(wholeFamily("Whole family", family(2))).toBe("Whole family · both schools");
    expect(wholeFamily("Whole family", family(3))).toBe("Whole family · all 3 schools");
  });

  it("leaves a label that already says more, or is about one child, alone", () => {
    expect(wholeFamily("Whole family · this term", family(2))).toBe("Whole family · this term");
    expect(wholeFamily("Daniel", family(2))).toBe("Daniel");
  });
});
