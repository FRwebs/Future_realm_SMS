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

import { deviceName } from "../../backend/src/modules/student-portal/student-workspace.service";

describe("a sign-in's device", () => {
  it("is named the way a person would name it", () => {
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.167 Safari/537.36")).toBe("Chrome on Mac");
    expect(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone or iPad");
    expect(deviceName(null)).toBe("Unknown device");
  });
});

import { isForStudents } from "../../backend/src/modules/student-portal/student-notify";

describe("who a notice is for", () => {
  it("is a student’s when it says students, everyone, the school or their own arm", () => {
    expect(isForStudents("Students")).toBe(true);
    expect(isForStudents("All school")).toBe(true);
    expect(isForStudents("SSS 3 - C", "sss 3 - c")).toBe(true);
    expect(isForStudents("Students and parents")).toBe(true);
  });
  it("is never a student’s when it names someone else", () => {
    expect(isForStudents("All staff")).toBe(false);
    expect(isForStudents("Teachers and staff")).toBe(false);
    expect(isForStudents("Parents and guardians")).toBe(false);
    expect(isForStudents("The whole school's teachers")).toBe(false);
  });
});
