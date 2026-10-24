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

import { icsFor } from "../../backend/src/modules/student-portal/student-workspace.service";

describe("a student’s calendar feed", () => {
  const feed = icsFor("Temi · Greenfield, College", [
    { id: "e1", date: "2026-11-03", end: "2026-11-03", title: "Chemistry test", time: "09:00 – 10:30", where: "Lab 1", note: "Bring a calculator; and a pen" },
    { id: "due-1", date: "2026-11-05", end: "2026-11-06", title: "Biology due · Essay", time: "", where: "", note: "" },
  ]);
  it("is a calendar every phone can read", () => {
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(feed).toContain("X-WR-CALNAME:Temi · Greenfield\\, College");
  });
  it("puts a timed event at the right moment, Lagos being an hour ahead of UTC", () => {
    expect(feed).toContain("DTSTART:20261103T080000Z");
    expect(feed).toContain("DTEND:20261103T093000Z");
    expect(feed).toContain("DESCRIPTION:Bring a calculator\\; and a pen");
  });
  it("keeps a whole day a whole day, ending the day after", () => {
    expect(feed).toContain("DTSTART;VALUE=DATE:20261105");
    expect(feed).toContain("DTEND;VALUE=DATE:20261107");
  });
});
