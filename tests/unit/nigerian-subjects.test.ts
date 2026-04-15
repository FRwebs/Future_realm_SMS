import { getNigerianSubjectDefaults, getNigerianSubjectsForClass } from "@/lib/nigerian-subjects";

describe("Nigerian subject defaults", () => {
  it("provides developmental learning areas for creche", () => {
    expect(getNigerianSubjectDefaults("CRECHE").map((subject) => subject.name)).toEqual(
      expect.arrayContaining(["Language Development", "Number Work", "Creative Play"])
    );
  });

  it("maps lower and upper primary subjects to the right class bands", () => {
    expect(getNigerianSubjectsForClass("PRIMARY_2").map((subject) => subject.name)).toEqual(
      expect.arrayContaining(["English Studies", "Basic Science"])
    );
    expect(getNigerianSubjectsForClass("PRIMARY_6").map((subject) => subject.name)).toEqual(
      expect.arrayContaining(["Basic Science and Technology", "Pre-vocational Studies"])
    );
  });

  it("separates senior secondary tracks and trade subjects", () => {
    const seniorSubjects = getNigerianSubjectsForClass("SSS_2");

    expect(seniorSubjects.some((subject) => subject.trackSpecific === "SCIENCE" && subject.name === "Biology")).toBe(true);
    expect(seniorSubjects.some((subject) => subject.trackSpecific === "HUMANITIES" && subject.name === "Government")).toBe(true);
    expect(seniorSubjects.some((subject) => subject.trackSpecific === "BUSINESS" && subject.name === "Accounting")).toBe(true);
    expect(seniorSubjects.some((subject) => subject.tradeSubject && subject.name === "Fashion Design and Garment Making")).toBe(true);
  });
});
