import { feeStateOf, gradeOf, normalPhone, relevantInvoice, stateOf, validMobile, ageOf, STANDING } from "../../backend/src/modules/student-records/records.shared";
import { deliveryOf, guardianPortal } from "../../backend/src/modules/guardian-management/guardians.shared";

const bands = [{ label: "A", min: 70, max: 100 }, { label: "B", min: 60, max: 69.99 }, { label: "F", min: 0, max: 39.99 }];

describe("student state", () => {
  it("names a status the way the school would", () => {
    expect(stateOf("ACTIVE")).toBe("Enrolled");
    expect(stateOf("SUSPENDED")).toBe("Blocked");
    expect(stateOf("WITHDRAWN")).toBe("Withdrawn");
    expect(stateOf("GRADUATED")).toBe("Alumni");
  });

  it("counts a birthday only once it has passed", () => {
    expect(ageOf(new Date("2013-04-10"), new Date("2026-04-09"))).toBe(12);
    expect(ageOf(new Date("2013-04-10"), new Date("2026-04-10"))).toBe(13);
  });
});

describe("fees on a student", () => {
  it("reads paid, part paid and outstanding from the invoices themselves", () => {
    expect(feeStateOf([{ total: 100, balance: 0 }])).toBe("Paid");
    expect(feeStateOf([{ total: 100, balance: 40 }])).toBe("Part paid");
    expect(feeStateOf([{ total: 100, balance: 100 }])).toBe("Outstanding");
    expect(feeStateOf([])).toBe("Not billed");
  });

  it("ignores a voided invoice", () => {
    expect(feeStateOf([{ total: 100, balance: 100, status: "VOID" }])).toBe("Not billed");
  });

  it("counts an unpaid invoice from any term, so a balance reads the same as on the debtor list", () => {
    expect(relevantInvoice({ termId: null, balance: 0 }, "t-2")).toBe(true);
    expect(relevantInvoice({ termId: "t-1", balance: 125000 }, "t-2")).toBe(true);
    expect(relevantInvoice({ termId: "t-1", balance: 0 }, "t-2")).toBe(false);
  });
});

describe("grades and standing", () => {
  it("names a score on the school's own bands", () => {
    expect(gradeOf(bands, 71)).toBe("A");
    expect(gradeOf(bands, 65.5)).toBe("B");
    expect(gradeOf(bands, null)).toBe("—");
  });

  it("places a score against the class", () => {
    expect(STANDING(80, 70)).toBe("Well above the class");
    expect(STANDING(72, 70)).toBe("Above the class");
    expect(STANDING(66, 70)).toBe("Around the class");
    expect(STANDING(50, 70)).toBe("Below the class");
  });
});

describe("reaching a family", () => {
  it("recognises a Nigerian mobile however it is written", () => {
    expect(normalPhone("+234 803 111 2223")).toBe("08031112223");
    expect(validMobile("08031112223")).toBe(true);
    expect(validMobile("12345")).toBe(false);
  });

  it("calls a login that exists but was never used only invited", () => {
    expect(guardianPortal(null)).toBe("Not activated");
    expect(guardianPortal({ lastLoginAt: null })).toBe("Invited");
    expect(guardianPortal({ lastLoginAt: new Date() })).toBe("Active");
  });

  it("tells a bad number from no number", () => {
    expect(deliveryOf({ phone: "", email: null })).toBe("No number");
    expect(deliveryOf({ phone: "123", email: null })).toBe("Failing");
    expect(deliveryOf({ phone: "123", email: "a@b.ng" })).toBe("Delivered");
    expect(deliveryOf({ phone: "08031112223", email: null })).toBe("Delivered");
  });
});
