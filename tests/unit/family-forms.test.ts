import { answerCode, factsFrom, reaches } from "../../backend/src/modules/guardian-management/forms.shared";

describe("forms the school sends its families", () => {
  it("reads one label and value to a line as a list, and plain sentences as a paragraph", () => {
    expect(factsFrom("Date: Friday 6 November\nWhere: Zuma Rock")).toEqual([["Date", "Friday 6 November"], ["Where", "Zuma Rock"]]);
    expect(factsFrom("Cost: ₦8,500: added if you agree")).toEqual([["Cost", "₦8,500: added if you agree"]]);
    expect(factsFrom("Please read this carefully.\nThen answer.")).toEqual([["Details", "Please read this carefully. Then answer."]]);
  });

  it("sends a form to every family, or only to families with a child in the chosen classes", () => {
    expect(reaches({ classIds: [] }, [null])).toBe(true);
    expect(reaches({ classIds: ["a"] }, ["a", "b"])).toBe(true);
    expect(reaches({ classIds: ["a"] }, ["b", null])).toBe(false);
  });

  it("files one answer per family per form", () => {
    expect(answerCode("f1", "g1")).toBe("f1:g1");
  });
});
