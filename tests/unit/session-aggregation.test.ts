import { SESSION_RULES, sessionAverage, type TermScore } from "../../backend/src/modules/score-results/session";

const terms = (first: number | null, second: number | null, third: number | null): TermScore[] => [
  { termId: "t1", termName: "First Term", order: 1, average: first },
  { termId: "t2", termName: "Second Term", order: 2, average: second },
  { termId: "t3", termName: "Third Term", order: 3, average: third }
];

describe("how a session score is worked out from its terms", () => {
  it("produces nothing when each term stands alone", () => {
    const result = sessionAverage("NONE", terms(60, 70, 80));
    expect(result.average).toBeNull();
    expect(result.basis).toBe("Each term stands alone");
  });

  it("averages the terms that have been scored", () => {
    expect(sessionAverage("MEAN", terms(60, 70, 80)).average).toBe(70);
  });

  it("does not let an unscored term drag the average down", () => {
    const result = sessionAverage("MEAN", terms(60, 80, null));
    expect(result.average).toBe(70);
    expect(result.partial).toBe(true);
  });

  it("reads the final term as the session result", () => {
    const result = sessionAverage("FINAL_TERM", terms(60, 70, 80));
    expect(result.average).toBe(80);
    expect(result.partial).toBe(false);
    expect(result.basis).toBe("Third Term only");
  });

  it("says so when the final term has not been scored yet", () => {
    const result = sessionAverage("FINAL_TERM", terms(60, 70, null));
    expect(result.average).toBe(70);
    expect(result.partial).toBe(true);
    expect(result.basis).toContain("not scored yet");
  });

  it("weights each term by its own share", () => {
    expect(sessionAverage("WEIGHTED", terms(50, 50, 100), [20, 20, 60]).average).toBe(80);
  });

  it("re-weights across the terms scored so far, rather than depressing the figure", () => {
    const result = sessionAverage("WEIGHTED", terms(50, 70, null), [20, 20, 60]);
    // 50 and 70 carry equal weight between them, so the running figure is 60 —
    // not 24, which is what counting the missing 60% as zero would give.
    expect(result.average).toBe(60);
    expect(result.partial).toBe(true);
  });

  it("falls back to the mean when the weights do not total 100", () => {
    expect(sessionAverage("WEIGHTED", terms(60, 70, 80), [10, 10, 10]).average).toBe(70);
  });

  it("produces nothing when no term has a score", () => {
    expect(sessionAverage("MEAN", terms(null, null, null)).average).toBeNull();
  });

  it("offers a rule for each way a school might report a session", () => {
    expect(SESSION_RULES.map((rule) => rule.value)).toEqual(["NONE", "MEAN", "FINAL_TERM", "WEIGHTED"]);
  });
});
