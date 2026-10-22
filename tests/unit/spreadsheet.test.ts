import { readCsv, readSpreadsheet, readXlsx, writeXlsx } from "../../backend/src/common/xlsx";
import { termNumber } from "../../backend/src/modules/curriculum-catalogue/curriculum-catalogue.service";
import { parseStrategies } from "../../backend/src/modules/student-records/support-plans.service";

describe("spreadsheets, without a library", () => {
  it("writes an .xlsx and reads it back — numbers stay numbers, text stays text, blanks stay blank", () => {
    const rows = [["Admission no", "Student", "CA /40"], ["GFC/1", "Ada & Obi <A>", 12.5], ["GFC/2", "Bayo", null]];
    const back = readXlsx(writeXlsx(rows, "Scores", [14, 28, 10]));
    expect(back[0]).toEqual(["Admission no", "Student", "CA /40"]);
    expect(back[1]).toEqual(["GFC/1", "Ada & Obi <A>", 12.5]);
    expect(back[2]!.slice(0, 2)).toEqual(["GFC/2", "Bayo"]);
    expect(back[2]![2] ?? null).toBeNull();
  });

  it("reads a CSV as Excel saves it: quotes, doubled quotes, semicolons and a byte-order mark", () => {
    expect(readCsv('a,b\n"x, y","he said ""hi"""\n1,2')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["1", "2"]]);
    expect(readCsv("﻿a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("tells an .xlsx from a CSV by its first bytes", () => {
    expect(readSpreadsheet(writeXlsx([["x"], [1]]))[1]).toEqual([1]);
    expect(readSpreadsheet(Buffer.from("x\n1"))[1]).toEqual(["1"]);
  });

  it("refuses something that is not a spreadsheet at all", () => {
    expect(() => readXlsx(Buffer.from("PK not really"))).toThrow();
  });
});

describe("curriculum catalogue and support plan helpers", () => {
  it("finds the term number a term's name implies, and none where it implies none", () => {
    expect(termNumber("First Term")).toBe(1);
    expect(termNumber("Second Term")).toBe(2);
    expect(termNumber("3rd term")).toBe(3);
    expect(termNumber("Summer School")).toBeNull();
  });

  it("splits support strategies into area and what to do, one per line", () => {
    expect(parseStrategies("Seating: Front of the room\nWritten work: Allow 25% more time\nGive one instruction at a time")).toEqual([
      { area: "Seating", strategy: "Front of the room" },
      { area: "Written work", strategy: "Allow 25% more time" },
      { area: "General", strategy: "Give one instruction at a time" },
    ]);
    expect(parseStrategies("  \n\n")).toEqual([]);
  });
});
