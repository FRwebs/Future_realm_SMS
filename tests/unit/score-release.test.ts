import { isScoreReleased } from "../../backend/src/common/score-release";

const now = Date.parse("2026-11-21T10:00:00Z");
const day = 86_400_000;

describe("when a family may see a mark", () => {
  it("holds an approved mark that has no release date", () => {
    expect(isScoreReleased({ releaseAt: null, early: false, cardPublished: false, now })).toBe(false);
    expect(isScoreReleased({ releaseAt: undefined, early: false, cardPublished: false, now })).toBe(false);
  });

  it("holds a mark whose release date is still ahead", () => {
    expect(isScoreReleased({ releaseAt: new Date(now + day), early: false, cardPublished: false, now })).toBe(false);
  });

  it("shows a mark once its release date has come", () => {
    expect(isScoreReleased({ releaseAt: new Date(now - day), early: false, cardPublished: false, now })).toBe(true);
    expect(isScoreReleased({ releaseAt: now, early: false, cardPublished: false, now })).toBe(true);
  });

  it("shows an approved mark with no date only where the school chose to show marks early", () => {
    expect(isScoreReleased({ releaseAt: null, early: true, cardPublished: false, now })).toBe(true);
  });

  it("does not let the early setting override a release date still ahead", () => {
    expect(isScoreReleased({ releaseAt: new Date(now + day), early: true, cardPublished: false, now })).toBe(false);
  });

  it("shows every mark once the term's report card is published", () => {
    expect(isScoreReleased({ releaseAt: null, early: false, cardPublished: true, now })).toBe(true);
    expect(isScoreReleased({ releaseAt: new Date(now + day), early: false, cardPublished: true, now })).toBe(true);
  });
});
