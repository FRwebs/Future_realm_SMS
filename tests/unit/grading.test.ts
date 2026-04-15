import {
  buildPortalSubjectResults,
  calculateNigerianSubjectResult,
  calculatePositions,
  calculateSubjectTotals,
  calculateWeightedScore,
  canAdvanceAcademicApproval,
  canTransitionResult,
  getNextAcademicApprovalStage,
  nigerianTermGradeBands,
  validateSectionAssessmentWeights,
  resolveGradeLabel
} from "@/lib/domain/grading";

describe("grading domain", () => {
  it("calculates weighted scores for WAEC-style inputs", () => {
    expect(
      calculateWeightedScore([
        { score: 28, maxScore: 40, weight: 40 },
        { score: 46, maxScore: 60, weight: 60 }
      ])
    ).toBe(74);
  });

  it("resolves grade bands correctly", () => {
    expect(resolveGradeLabel(81).label).toBe("A1");
    expect(resolveGradeLabel(42).label).toBe("E8");
  });

  it("assigns ranked positions by total score", () => {
    expect(
      calculatePositions([
        { studentId: "s1", total: 81 },
        { studentId: "s2", total: 74 },
        { studentId: "s3", total: 61 }
      ])
    ).toEqual([
      { studentId: "s1", position: 1 },
      { studentId: "s2", position: 2 },
      { studentId: "s3", position: 3 }
    ]);
  });

  it("validates result workflow transitions", () => {
    expect(canTransitionResult("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionResult("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransitionResult("APPROVED", "PUBLISHED")).toBe(true);
    expect(canTransitionResult("PUBLISHED", "DRAFT")).toBe(false);
  });

  it("builds shared portal subject results for student and parent views", () => {
    expect(
      buildPortalSubjectResults([
        {
          subjectId: "math",
          score: 28,
          subject: { name: "Mathematics" },
          assessmentComponent: { code: "CA" }
        },
        {
          subjectId: "math",
          score: 46,
          subject: { name: "Mathematics" },
          assessmentComponent: { code: "EXAM" }
        }
      ])
    ).toEqual([
      {
        subject: "Mathematics",
        continuousAssessment: 28,
        exam: 46,
        score: 74,
        grade: "B2"
      }
    ]);
  });

  it("calculates term sheet totals across multiple subjects", () => {
    expect(
      calculateSubjectTotals([
        { subjectId: "math", score: 28, assessmentComponent: { code: "CA" } },
        { subjectId: "math", score: 46, assessmentComponent: { code: "EXAM" } },
        { subjectId: "english", score: 31, assessmentComponent: { code: "CA" } },
        { subjectId: "english", score: 44, assessmentComponent: { code: "EXAM" } }
      ])
    ).toEqual({
      subjectCount: 2,
      totalScore: 149,
      averageScore: 74.5
    });
  });

  it("validates Nigerian section assessment weights at 100 percent", () => {
    expect(
      validateSectionAssessmentWeights([
        { section: "JUNIOR_SECONDARY", weight: 20 },
        { section: "JUNIOR_SECONDARY", weight: 20 },
        { section: "JUNIOR_SECONDARY", weight: 60 }
      ])
    ).toMatchObject({ ok: true, totals: { JUNIOR_SECONDARY: 100 } });

    expect(
      validateSectionAssessmentWeights([
        { section: "PRIMARY", weight: 30 },
        { section: "PRIMARY", weight: 60 }
      ])
    ).toMatchObject({ ok: false, invalidSections: [{ section: "PRIMARY", total: 90 }] });
  });

  it("calculates Nigerian CA plus exam subject results", () => {
    expect(
      calculateNigerianSubjectResult(
        [
          { type: "TEST", score: 18, maxScore: 20, weight: 20 },
          { type: "PROJECT", score: 17, maxScore: 20, weight: 20 },
          { type: "EXAMINATION", score: 42, maxScore: 60, weight: 60 }
        ],
        nigerianTermGradeBands
      )
    ).toEqual({
      caTotal: 35,
      examTotal: 42,
      total: 77,
      grade: "A",
      remark: "Excellent"
    });
  });

  it("advances Nigerian moderation stages safely", () => {
    expect(getNextAcademicApprovalStage("SUBJECT_TEACHER")).toBe("HEAD_OF_DEPARTMENT");
    expect(getNextAcademicApprovalStage("PRINCIPAL")).toBe("PUBLISHED");
    expect(canAdvanceAcademicApproval("HEAD_OF_DEPARTMENT", "APPROVE")).toBe(true);
    expect(canAdvanceAcademicApproval("PRINCIPAL", "PUBLISH")).toBe(true);
    expect(canAdvanceAcademicApproval("PUBLISHED", "PUBLISH")).toBe(true);
    expect(canAdvanceAcademicApproval("PUBLISHED", "APPROVE")).toBe(false);
  });
});
