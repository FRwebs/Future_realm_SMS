import { insideQuietHours } from "../../backend/src/modules/student-portal/student-notify";

describe("a student’s quiet hours", () => {
  it("holds email back overnight, across midnight", () => {
    expect(insideQuietHours("21:00 – 07:00", "23:30")).toBe(true);
    expect(insideQuietHours("21:00 – 07:00", "03:00")).toBe(true);
    expect(insideQuietHours("21:00 – 07:00", "07:00")).toBe(false);
    expect(insideQuietHours("21:00 – 07:00", "16:00")).toBe(false);
  });
  it("does nothing when there are none", () => {
    expect(insideQuietHours("None", "23:30")).toBe(false);
    expect(insideQuietHours(undefined, "23:30")).toBe(false);
  });
  it("handles a window that does not cross midnight", () => {
    expect(insideQuietHours("13:00 – 15:00", "14:00")).toBe(true);
    expect(insideQuietHours("13:00 – 15:00", "15:00")).toBe(false);
  });
});
