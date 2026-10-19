import { armState, bandOf, cardReference, remarkState, suggestion, sumState, toneFor, type ChildCard } from "../../backend/src/modules/report-cards/cards.shared";

const child = (state: ChildCard["state"]): ChildCard => ({ id: state, name: state, adm: "A", average: 60, grade: "C", pos: 1, scores: state !== "Blocked", blockedBy: [], remark: "Submitted", review: true, published: state === "Published", withheld: state === "Withheld", owes: false, state, resultSheetId: null, cardId: null, revision: 1 });
const stamp = new Date("2026-04-01T00:00:00Z");
const row = (state: string) => ({ author: "FORM_MASTER", text: "A steady term.", tone: "Plain", flags: [], state, authorId: "u1", onBehalf: false, submittedAt: stamp, updatedAt: stamp });

describe("M6 remark bands", () => {
  it("reads an average into the band the remark is written for", () => {
    expect([bandOf(80), bandOf(75), bandOf(72), bandOf(66), bandOf(55), bandOf(45), bandOf(20), bandOf(null)]).toEqual(["Excellent", "Excellent", "Very good", "Good", "Fair", "Weak", "Of concern", "Not scored"]);
  });

  it("says nothing about a child who has no result", () => {
    expect(suggestion(null, "Ada")).toContain("no result yet");
    expect(suggestion(80, "Ada")).toContain("Ada");
    expect(toneFor(null)).toBe("Plain");
    expect(toneFor(30)).toBe("Firm");
  });

  it("reads an old result's sentence as submitted, with no author", () => {
    expect(remarkState(undefined, "  Good effort.  ")).toMatchObject({ state: "Submitted", text: "Good effort." });
    expect(remarkState(undefined, "  ").state).toBe("Not written");
    expect(remarkState(undefined, null).state).toBe("Not written");
  });

  it("lets a draft stay a draft", () => {
    expect(remarkState(row("DRAFT"), "old").state).toBe("Draft");
    expect(remarkState(row("SUBMITTED"), null).state).toBe("Submitted");
  });
});

describe("M6 completion", () => {
  it("counts every card into exactly one state", () => {
    const sum = sumState([child("Ready"), child("Ready"), child("Blocked"), child("Remark owed"), child("Awaiting review"), child("Published"), child("Withheld")]);
    expect(sum).toEqual({ roll: 7, ready: 2, blocked: 1, owed: 1, inReview: 1, published: 1, withheld: 1 });
  });

  it("never calls an arm ready while one child is blocked", () => {
    expect(armState(sumState([child("Ready"), child("Blocked")]))).toBe("Blocked");
    expect(armState(sumState([child("Ready"), child("Ready")]))).toBe("Ready");
    expect(armState(sumState([child("Published"), child("Published")]))).toBe("Published");
    expect(armState(sumState([child("Ready"), child("Remark owed")]))).toBe("Remarks owed");
    expect(armState(sumState([child("Ready"), child("Awaiting review")]))).toBe("Awaiting review");
  });

  it("builds a reference a family can quote", () => {
    expect(cardReference("GFC/2025/014", "Second Term")).toBe("GFC2025014-SEC");
  });
});
