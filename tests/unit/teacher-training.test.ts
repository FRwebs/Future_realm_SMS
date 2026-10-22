import { checkoutHref, checkoutPage, courseHref, lessonHref, type Basket } from "@/lib/modules/live/t19-training";

const basket = (count: number): Basket => ({
  basket: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, courseId: `c${index}`, title: `Course ${index}`, provider: "NTI", hours: 2, price: 1200000, priceLabel: "₦12,000" })),
  total: count * 1200000, totalLabel: `₦${(count * 12000).toLocaleString("en-NG")}`, history: [],
});

describe("where a teacher's training pages live", () => {
  it("keeps the course, its lessons and the checkout under the catalogue, so the Training tabs stay lit", () => {
    expect(courseHref("abc")).toBe("/training/catalogue/abc");
    expect(lessonHref("abc", 2)).toBe("/training/catalogue/abc/lessons/2");
    expect(checkoutHref).toBe("/training/catalogue/checkout");
  });
});

describe("the checkout page", () => {
  it("counts what is in the basket and hands the embed the total, the receipt address and a way back", () => {
    const page = checkoutPage(basket(2), "teacher@school.ng");
    expect(page.desc).toMatch(/^2 courses/);
    expect(page.crumb.href).toBe("/training/catalogue");
    const row = JSON.stringify(page.rows);
    expect(row).toContain("training-checkout");
    expect(row).toContain("teacher@school.ng");
    expect(row).toContain("₦24,000");
  });

  it("says so plainly when the basket is empty", () => {
    expect(checkoutPage(basket(0), "teacher@school.ng").desc).toBe("Your basket is empty.");
    expect(checkoutPage(basket(1), "teacher@school.ng").desc).toMatch(/^1 course ·/);
  });
});
