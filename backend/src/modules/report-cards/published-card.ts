/**
 * A published report card's own snapshot, read back.
 *
 * The report-cards module freezes a card when it publishes it, so what a family reads is what the school signed off — not a figure
 * recomputed later from marks that may since have moved. Both the parent portal and the student portal read that same snapshot
 * through here, so a child and their parent are never shown two different versions of the same card.
 */
export type PublishedCard = {
  className: string; arm: string; formMaster: string | null; average: number | null; grade: string | null; gradeRemark: string | null;
  position: number | null; outOf: number; attendance: { days: number; present: number; absent: number; pct: number | null }; scheme: string; frameworkNote: string;
  classTeacherRemark: string; classTeacherBy: string | null; principalRemark: string; principalBy: string | null; resumption: string | null;
  traits: Array<{ title: string; items: Array<{ label: string; value: string }> }>;
  subjects: Array<{ subject: string; teacher: string | null; components: Array<{ name: string; short: string; max: number; score: number | "ABS" | null }>; total: number | null; grade: string | null; remark: string; pos: number | null; outOf: number; classAvg: number | null }>;
};

/**
 * A published card as the report-cards module now writes it (version 2), or as the first release did: a flat record with each subject's
 * continuous-assessment and examination totals. Both are read into one shape; a class size or a count of school days the older one never
 * kept is left at zero rather than invented.
 */
export function readCard(raw: unknown): PublishedCard | null {
  const data = raw as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;
  if (data.version === 2) return data as unknown as PublishedCard;
  const subjects = Array.isArray(data.subjects) ? (data.subjects as Array<Record<string, unknown>>) : [];
  if (!subjects.length || typeof data.average !== "number") return null;
  const pct = typeof data.attendance === "string" ? Number.parseFloat(data.attendance) : Number.NaN;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    className: text(data.className), arm: "", formMaster: null, average: data.average, grade: text(data.grade) || null, gradeRemark: text(data.promotionStatus) || null,
    position: typeof data.position === "number" ? data.position : null, outOf: 0,
    attendance: { days: 0, present: 0, absent: 0, pct: Number.isFinite(pct) ? pct : null }, scheme: "", frameworkNote: "",
    classTeacherRemark: text(data.classTeacherRemark), classTeacherBy: null, principalRemark: text(data.principalRemark), principalBy: null, resumption: null, traits: [],
    subjects: subjects.map((subject) => ({
      subject: text(subject.subject), teacher: null,
      components: [
        { name: "Continuous assessment", short: "CA", max: 0, score: typeof subject.caTotal === "number" ? subject.caTotal : null },
        { name: "Examination", short: "EXAM", max: 0, score: typeof subject.examTotal === "number" ? subject.examTotal : null },
      ],
      total: typeof subject.total === "number" ? subject.total : null, grade: text(subject.grade) || null, remark: text(subject.remark), pos: null, outOf: 0, classAvg: null,
    })),
  };
}
