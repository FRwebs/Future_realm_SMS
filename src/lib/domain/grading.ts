import type {
  AcademicApprovalAction,
  AcademicApprovalStage,
  PortalSubjectResult,
  SchoolSectionView
} from "@/lib/domain/types";

export interface GradeBand {
  min: number;
  max: number;
  label: string;
  remark: string;
  gpa?: number;
}

export const waecGradeBands: GradeBand[] = [
  { min: 75, max: 100, label: "A1", remark: "Excellent" },
  { min: 70, max: 74.99, label: "B2", remark: "Very Good" },
  { min: 65, max: 69.99, label: "B3", remark: "Good" },
  { min: 60, max: 64.99, label: "C4", remark: "Credit" },
  { min: 55, max: 59.99, label: "C5", remark: "Credit" },
  { min: 50, max: 54.99, label: "C6", remark: "Credit" },
  { min: 45, max: 49.99, label: "D7", remark: "Pass" },
  { min: 40, max: 44.99, label: "E8", remark: "Pass" },
  { min: 0, max: 39.99, label: "F9", remark: "Fail" }
];

export const nigerianTermGradeBands: GradeBand[] = [
  { min: 70, max: 100, label: "A", remark: "Excellent" },
  { min: 60, max: 69.99, label: "B", remark: "Very Good" },
  { min: 50, max: 59.99, label: "C", remark: "Good" },
  { min: 45, max: 49.99, label: "D", remark: "Pass" },
  { min: 40, max: 44.99, label: "E", remark: "Fair" },
  { min: 0, max: 39.99, label: "F", remark: "Fail" }
];

export const academicApprovalStages: AcademicApprovalStage[] = [
  "SUBJECT_TEACHER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "EXAM_OFFICER",
  "VICE_PRINCIPAL_ACADEMICS",
  "PRINCIPAL",
  "PUBLISHED"
];

export function getNextAcademicApprovalStage(stage: AcademicApprovalStage): AcademicApprovalStage {
  const currentIndex = academicApprovalStages.indexOf(stage);
  return academicApprovalStages[Math.min(currentIndex + 1, academicApprovalStages.length - 1)] ?? "SUBJECT_TEACHER";
}

export function canAdvanceAcademicApproval(stage: AcademicApprovalStage, action: AcademicApprovalAction) {
  if (stage === "PUBLISHED") return action === "PUBLISH" || action === "UNLOCK";
  if (action === "REJECT" || action === "REQUEST_CORRECTION") return true;
  if (action === "APPROVE") return true;
  if (action === "PUBLISH") return stage === "PRINCIPAL";
  return action === "SUBMIT" || action === "COMPILE";
}

export function validateSectionAssessmentWeights(
  components: Array<{ section: SchoolSectionView; weight: number; isActive?: boolean }>
) {
  const totals = new Map<SchoolSectionView, number>();
  for (const component of components) {
    if (component.isActive === false) continue;
    totals.set(component.section, Number(((totals.get(component.section) ?? 0) + component.weight).toFixed(2)));
  }

  const invalid = Array.from(totals.entries()).filter(([, total]) => Math.abs(total - 100) > 0.01);
  return {
    ok: invalid.length === 0,
    totals: Object.fromEntries(totals.entries()) as Partial<Record<SchoolSectionView, number>>,
    invalidSections: invalid.map(([section, total]) => ({ section, total }))
  };
}

export function calculateNigerianSubjectResult(
  entries: Array<{ type?: string; score: number; maxScore: number; weight: number }>,
  bands: GradeBand[] = nigerianTermGradeBands
) {
  const caTotal = calculateWeightedScore(entries.filter((entry) => entry.type !== "EXAMINATION"));
  const examTotal = calculateWeightedScore(entries.filter((entry) => entry.type === "EXAMINATION"));
  const total = Number((caTotal + examTotal).toFixed(2));
  const grade = resolveGradeLabel(total, bands);

  return {
    caTotal,
    examTotal,
    total,
    grade: grade.label,
    remark: grade.remark
  };
}

export function calculateWeightedScore(components: Array<{ score: number; maxScore: number; weight: number }>) {
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight === 0) return 0;

  const score = components.reduce((sum, component) => {
    const normalized = component.maxScore === 0 ? 0 : (component.score / component.maxScore) * component.weight;
    return sum + normalized;
  }, 0);

  return Number(score.toFixed(2));
}

export function resolveGradeLabel(score: number, schema: GradeBand[] = waecGradeBands) {
  return schema.find((band) => score >= band.min && score <= band.max) ?? schema[schema.length - 1];
}

export function calculatePositions(items: Array<{ studentId: string; total: number }>) {
  return [...items]
    .sort((a, b) => b.total - a.total)
    .map((item, index) => ({
      studentId: item.studentId,
      position: index + 1
    }));
}

export type ResultWorkflowStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "RETURNED";

export function canTransitionResult(from: ResultWorkflowStatus, to: ResultWorkflowStatus) {
  const allowed: Record<ResultWorkflowStatus, ResultWorkflowStatus[]> = {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["UNDER_REVIEW", "APPROVED", "RETURNED"],
    UNDER_REVIEW: ["APPROVED", "REJECTED", "RETURNED"],
    APPROVED: ["PUBLISHED", "RETURNED"],
    REJECTED: ["DRAFT", "SUBMITTED"],
    RETURNED: ["DRAFT", "SUBMITTED"],
    PUBLISHED: ["APPROVED"]
  };

  return allowed[from]?.includes(to) ?? false;
}

export function calculateResultSummary(
  subjects: Array<{ studentId: string; subjectId: string; score: number; maxScore: number; weight: number }>
) {
  const byStudent = new Map<string, { studentId: string; total: number; subjectCount: number; average: number }>();
  for (const subject of subjects) {
    const entry = byStudent.get(subject.studentId) ?? {
      studentId: subject.studentId,
      total: 0,
      subjectCount: 0,
      average: 0
    };
    entry.total += calculateWeightedScore([{ score: subject.score, maxScore: subject.maxScore, weight: subject.weight }]);
    entry.subjectCount += 1;
    entry.average = entry.subjectCount === 0 ? 0 : Number((entry.total / entry.subjectCount).toFixed(2));
    byStudent.set(subject.studentId, entry);
  }

  return Array.from(byStudent.values());
}

export function buildPortalSubjectResults(
  entries: Array<{
    subjectId: string;
    score: number;
    subject: { name: string };
    assessmentComponent: { code: string };
  }>
): PortalSubjectResult[] {
  const subjects = new Map<string, PortalSubjectResult>();

  for (const entry of entries) {
    const existing = subjects.get(entry.subjectId) ?? {
      subject: entry.subject.name,
      continuousAssessment: 0,
      exam: 0,
      score: 0,
      grade: "N/A"
    };

    if (entry.assessmentComponent.code === "CA") {
      existing.continuousAssessment = (existing.continuousAssessment ?? 0) + entry.score;
    } else if (entry.assessmentComponent.code === "EXAM") {
      existing.exam = (existing.exam ?? 0) + entry.score;
    } else {
      existing.continuousAssessment = (existing.continuousAssessment ?? 0) + entry.score;
    }

    existing.score = (existing.continuousAssessment ?? 0) + (existing.exam ?? 0);
    existing.grade = resolveGradeLabel(existing.score).label;
    subjects.set(entry.subjectId, existing);
  }

  return Array.from(subjects.values());
}

export function calculateSubjectTotals(
  entries: Array<{
    subjectId: string;
    score: number;
    assessmentComponent: { code: string };
  }>
) {
  const subjects = new Map<string, { continuousAssessment: number; exam: number; score: number }>();

  for (const entry of entries) {
    const existing = subjects.get(entry.subjectId) ?? { continuousAssessment: 0, exam: 0, score: 0 };
    if (entry.assessmentComponent.code === "CA") {
      existing.continuousAssessment += entry.score;
    } else if (entry.assessmentComponent.code === "EXAM") {
      existing.exam += entry.score;
    } else {
      existing.continuousAssessment += entry.score;
    }
    existing.score = existing.continuousAssessment + existing.exam;
    subjects.set(entry.subjectId, existing);
  }

  const subjectTotals = Array.from(subjects.values());
  const totalScore = Number(subjectTotals.reduce((sum, subject) => sum + subject.score, 0).toFixed(2));
  const averageScore = subjectTotals.length ? Number((totalScore / subjectTotals.length).toFixed(2)) : 0;

  return {
    subjectCount: subjectTotals.length,
    totalScore,
    averageScore
  };
}
