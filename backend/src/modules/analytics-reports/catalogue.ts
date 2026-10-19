import { prisma } from "../../../../src/lib/db/prisma";
import { armName, currentTerm } from "../attendance-management/attendance.shared";
import { loadAll, studentResults } from "../score-results/arm";
import { CREDIT_MARK, round1 } from "../score-results/scores.shared";

/**
 * Everything the school can take out of its own records, as rows.
 *
 * Each generator reads the live tables at the moment it is called — never a cached or rounded figure — and returns a
 * header and rows. The service turns them into a CSV, archives the copy and counts the rows, so what is on the page,
 * what is downloaded and what is logged cannot disagree.
 */

export type Sheet = { head: string[]; rows: Array<Array<string | number | null>> };
export type Generator = { code: string; name: string; answers: string; covers: string; run: (schoolId: string) => Promise<Sheet> };

const LIMIT = 60_000;
const full = (user: { firstName: string; lastName: string }) => `${user.firstName} ${user.lastName}`.trim();
const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : "");
const num = (value: unknown) => Number(value ?? 0);

async function termOf(schoolId: string) {
  const term = await currentTerm(schoolId);
  return term ? { id: term.id, name: term.name, session: term.academicSession?.name ?? "" } : null;
}

async function roomNames(schoolId: string) {
  const rooms = await prisma.classRoom.findMany({ where: { schoolId }, select: { id: true, name: true, arm: true } });
  return new Map(rooms.map((room) => [room.id, armName(room)]));
}

/* ───────────────────────── the twelve standard reports ───────────────────────── */

const broadsheet: Generator["run"] = async (schoolId) => {
  const term = await termOf(schoolId);
  if (!term) return { head: ["Note"], rows: [["There is no current term, so there is nothing to compute."]] };
  const arms = await loadAll(schoolId, term);
  const rows: Sheet["rows"] = [];
  for (const arm of arms) for (const subject of arm.subjects) for (const row of subject.rows) rows.push([arm.room.name, row.name, row.adm, subject.name, row.total, row.grade ?? "", subject.state]);
  return { head: ["Arm", "Student", "Admission no", "Subject", "Total", "Grade", "Sheet state"], rows };
};

const termSummary: Generator["run"] = async (schoolId) => {
  const term = await termOf(schoolId);
  if (!term) return { head: ["Note"], rows: [["There is no current term."]] };
  const arms = await loadAll(schoolId, term);
  const rows: Sheet["rows"] = [];
  for (const arm of arms) for (const result of studentResults(arm)) rows.push([arm.room.name, result.name, result.adm, result.average, result.pos, result.grade ?? "", result.ready ? "Complete" : result.blockedBy.slice(0, 2).join("; ")]);
  return { head: ["Arm", "Student", "Admission no", "Average", "Position", "Grade", "Complete"], rows };
};

const attendanceRegister: Generator["run"] = async (schoolId) => {
  const term = await termOf(schoolId);
  const [rows, rooms] = await Promise.all([
    prisma.studentAttendance.findMany({ where: { schoolId, subjectId: null, ...(term ? { termId: term.id } : {}) }, orderBy: [{ date: "asc" }, { classId: "asc" }], take: LIMIT, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } }),
    roomNames(schoolId),
  ]);
  return { head: ["Date", "Arm", "Student", "Admission no", "Mark", "Reason"], rows: rows.map((row) => [day(row.date), rooms.get(row.classId) ?? "", full(row.student), row.student.admissionNumber, row.status, row.reason ?? ""]) };
};

const feeCollection: Generator["run"] = async (schoolId) => {
  const invoices = await prisma.invoice.findMany({ where: { schoolId, status: { not: "VOID" } }, take: LIMIT, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } } } } } });
  return { head: ["Invoice", "Student", "Admission no", "Arm", "Billed", "Discounts", "Paid", "Balance", "State"], rows: invoices.map((row) => [row.invoiceNumber, full(row.student), row.student.admissionNumber, row.student.currentClass ? armName(row.student.currentClass) : "No arm", num(row.total), num(row.discount), num(row.total) - num(row.balance), num(row.balance), row.status]) };
};

const debtorList: Generator["run"] = async (schoolId) => {
  const invoices = await prisma.invoice.findMany({ where: { schoolId, balance: { gt: 0 }, status: { notIn: ["VOID", "DRAFT"] } }, orderBy: { dueOn: "asc" }, take: LIMIT, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } }, guardians: { where: { isPrimary: true }, take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } } } } } });
  return { head: ["Student", "Admission no", "Arm", "Invoice", "Owing", "Due", "Days overdue", "Guardian", "Phone"], rows: invoices.map((row) => { const guardian = row.student.guardians[0]?.guardian; return [full(row.student), row.student.admissionNumber, row.student.currentClass ? armName(row.student.currentClass) : "No arm", row.invoiceNumber, num(row.balance), day(row.dueOn), Math.max(0, Math.floor((Date.now() - row.dueOn.getTime()) / 86_400_000)), guardian ? full(guardian) : "", guardian?.phone ?? ""]; }) };
};

const enrolmentReturn: Generator["run"] = async (schoolId) => {
  const students = await prisma.student.findMany({ where: { schoolId, status: "ACTIVE" }, select: { gender: true, currentClass: { select: { name: true, arm: true, classLevel: { select: { name: true } } } } } });
  const tally = new Map<string, { level: string; arm: string; male: number; female: number; other: number }>();
  for (const student of students) {
    const arm = student.currentClass ? armName(student.currentClass) : "No arm";
    const row = tally.get(arm) ?? { level: student.currentClass?.classLevel?.name ?? "", arm, male: 0, female: 0, other: 0 };
    if (student.gender === "MALE") row.male += 1;
    else if (student.gender === "FEMALE") row.female += 1;
    else row.other += 1;
    tally.set(arm, row);
  }
  return { head: ["Level", "Arm", "Male", "Female", "Other", "Total"], rows: Array.from(tally.values()).sort((a, b) => a.level.localeCompare(b.level) || a.arm.localeCompare(b.arm)).map((row) => [row.level, row.arm, row.male, row.female, row.other, row.male + row.female + row.other]) };
};

const staffList: Generator["run"] = async (schoolId) => {
  const staff = await prisma.staffProfile.findMany({ where: { schoolId }, include: { user: { select: { firstName: true, lastName: true, role: true, email: true, phone: true } }, department: { select: { name: true } } }, orderBy: { employeeNo: "asc" } });
  return { head: ["Staff no", "Name", "Role", "Department", "Employment", "Qualification", "Employed on", "Phone", "Email"], rows: staff.map((row) => [row.employeeNo, full(row.user), String(row.user.role), row.department?.name ?? "", row.employmentType ?? row.staffType, row.qualification ?? "", day(row.employmentDate), row.user.phone ?? "", row.user.email ?? ""]) };
};

const nominalRoll: Generator["run"] = async (schoolId) => {
  const students = await prisma.student.findMany({ where: { schoolId }, orderBy: [{ admissionNumber: "asc" }], take: LIMIT, select: { admissionNumber: true, firstName: true, middleName: true, lastName: true, gender: true, dateOfBirth: true, status: true, admissionDate: true, currentClass: { select: { name: true, arm: true } } } });
  return { head: ["Admission no", "Surname", "Given names", "Gender", "Date of birth", "Arm", "Status", "Admitted"], rows: students.map((row) => [row.admissionNumber, row.lastName, [row.firstName, row.middleName].filter(Boolean).join(" "), row.gender, day(row.dateOfBirth), row.currentClass ? armName(row.currentClass) : "No arm", row.status, day(row.admissionDate)]) };
};

const termPerformance: Generator["run"] = async (schoolId) => {
  const term = await termOf(schoolId);
  if (!term) return { head: ["Note"], rows: [["There is no current term."]] };
  const arms = await loadAll(schoolId, term);
  const rows: Sheet["rows"] = [];
  for (const arm of arms) for (const subject of arm.subjects) {
    const totals = subject.rows.map((row) => row.total).filter((value): value is number => value !== null);
    rows.push([subject.name, arm.room.name, totals.length, subject.mean === null ? "" : round1(subject.mean), totals.length ? round1((totals.filter((value) => value >= subject.passMark).length / totals.length) * 100) : "", totals.length ? round1((totals.filter((value) => value >= CREDIT_MARK).length / totals.length) * 100) : "", subject.state]);
  }
  return { head: ["Subject", "Arm", "Scored", "Average", "Pass rate %", "Credit rate %", "Sheet state"], rows };
};

const resultDay: Generator["run"] = async (schoolId) => {
  const term = await termOf(schoolId);
  if (!term) return { head: ["Note"], rows: [["There is no current term."]] };
  const arms = await loadAll(schoolId, term);
  return { head: ["Arm", "Subjects", "Approved", "Not approved", "What is holding it up"], rows: arms.map((arm) => { const counted = arm.subjects.filter((subject) => subject.counts); const approved = counted.filter((subject) => subject.state === "Approved").length; return [arm.room.name, counted.length, approved, counted.length - approved, counted.filter((subject) => subject.state !== "Approved").map((subject) => `${subject.name} · ${subject.state.toLowerCase()}`).join("; ")]; }) };
};

const parentMeeting: Generator["run"] = async (schoolId) => {
  const term = await termOf(schoolId);
  const arms = term ? await loadAll(schoolId, term) : [];
  const students = await prisma.student.findMany({ where: { schoolId, status: "ACTIVE" }, take: LIMIT, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClassId: true, guardians: { where: { isPrimary: true }, take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } }, invoices: { where: { status: { notIn: ["VOID", "DRAFT"] } }, select: { balance: true } }, attendance: { where: { subjectId: null, ...(term ? { termId: term.id } : {}) }, select: { status: true } } } });
  const results = new Map<string, { average: number | null; pos: number | null }>();
  for (const arm of arms) for (const result of studentResults(arm)) results.set(result.id, { average: result.average, pos: result.pos });
  const rooms = await roomNames(schoolId);
  return { head: ["Student", "Admission no", "Arm", "Average", "Position", "Attendance %", "Owing", "Guardian", "Phone"], rows: students.map((student) => { const marks = student.attendance.length; const present = student.attendance.filter((mark) => mark.status !== "ABSENT").length; const guardian = student.guardians[0]?.guardian; const result = results.get(student.id); return [full(student), student.admissionNumber, student.currentClassId ? rooms.get(student.currentClassId) ?? "" : "No arm", result?.average ?? "", result?.pos ?? "", marks ? round1((present / marks) * 100) : "", student.invoices.reduce((sum, invoice) => sum + num(invoice.balance), 0), guardian ? full(guardian) : "", guardian?.phone ?? ""]; }) };
};

const consentCoverage: Generator["run"] = async (schoolId) => {
  const guardians = await prisma.guardian.findMany({ where: { schoolId, mergedIntoId: null }, take: LIMIT, select: { firstName: true, lastName: true, phone: true, consents: { select: { typeCode: true, status: true, recordedAt: true } }, students: { take: 1, select: { student: { select: { firstName: true, lastName: true } } } } } });
  return { head: ["Guardian", "Phone", "Child", "Consents on file", "Recorded"], rows: guardians.map((row) => [full(row), row.phone, row.students[0] ? full(row.students[0].student) : "", row.consents.map((consent) => `${consent.typeCode}: ${consent.status}`).join("; ") || "None", row.consents.length ? day(row.consents.map((consent) => consent.recordedAt).sort((a, b) => b.getTime() - a.getTime())[0]) : ""]) };
};

export const STANDARD: Generator[] = [
  { code: "broadsheet", name: "Broadsheet", answers: "Students against subjects, per arm", covers: "The document a school checks results on", run: broadsheet },
  { code: "term-summary", name: "Term academic summary", answers: "Averages, positions, pass rates", covers: "What the term achieved, per level", run: termSummary },
  { code: "attendance-register", name: "Attendance register", answers: "Paper-register layout, per arm", covers: "What an inspection asks for", run: attendanceRegister },
  { code: "fee-collection", name: "Fee collection summary", answers: "Expected, collected, outstanding", covers: "The proprietor's monthly figure", run: feeCollection },
  { code: "debtor-list", name: "Debtor list", answers: "Who owes, how much, how long", covers: "Taken into a management meeting", run: debtorList },
  { code: "enrolment-return", name: "Enrolment return", answers: "Headcount by level, arm and gender", covers: "Filed with the education authority", run: enrolmentReturn },
  { code: "staff-list", name: "Staff list", answers: "Roles, departments, load", covers: "For the authority and for insurance", run: staffList },
  { code: "nominal-roll", name: "Nominal roll", answers: "Every student, formally listed", covers: "The authority's own format", run: nominalRoll },
  { code: "term-performance", name: "Term performance analysis", answers: "Subject and arm comparison", covers: "Prepared for a staff meeting", run: termPerformance },
  { code: "result-day", name: "Result-day readiness", answers: "Blockers, named and counted", covers: "Can we publish, and if not why", run: resultDay },
  { code: "parent-meeting", name: "Parent meeting pack", answers: "Per child, per family", covers: "Printed for consultation day", run: parentMeeting },
  { code: "consent-coverage", name: "Consent coverage", answers: "Who consented to what, and when", covers: "Produced when a parent or regulator asks", run: consentCoverage },
];

/* ───────────────────────── every dataset, to CSV ───────────────────────── */

export type Dataset = { code: string; columns: string[]; name: string; count: (schoolId: string) => Promise<number>; run: (schoolId: string) => Promise<Sheet> };

export const DATASETS: Dataset[] = [
  { code: "students", columns: ["Admission no", "Surname", "Given names", "Gender", "Date of birth", "Nationality", "State of origin", "Religion", "Address", "Previous school", "Arm", "Status", "Admitted"], name: "Students · full record", count: (schoolId) => prisma.student.count({ where: { schoolId } }), run: async (schoolId) => {
    const rows = await prisma.student.findMany({ where: { schoolId }, take: LIMIT, orderBy: { admissionNumber: "asc" }, select: { admissionNumber: true, firstName: true, middleName: true, lastName: true, gender: true, dateOfBirth: true, nationality: true, stateOfOrigin: true, religion: true, address: true, previousSchool: true, status: true, admissionDate: true, currentClass: { select: { name: true, arm: true } } } });
    return { head: ["Admission no", "Surname", "Given names", "Gender", "Date of birth", "Nationality", "State of origin", "Religion", "Address", "Previous school", "Arm", "Status", "Admitted"], rows: rows.map((row) => [row.admissionNumber, row.lastName, [row.firstName, row.middleName].filter(Boolean).join(" "), row.gender, day(row.dateOfBirth), row.nationality, row.stateOfOrigin ?? "", row.religion ?? "", row.address ?? "", row.previousSchool ?? "", row.currentClass ? armName(row.currentClass) : "No arm", row.status, day(row.admissionDate)]) };
  } },
  { code: "scores", columns: ["Admission no", "Student", "Subject", "Component", "Score", "Out of", "Final", "Recorded"], name: "Scores · all components", count: (schoolId) => prisma.scoreEntry.count({ where: { schoolId } }), run: async (schoolId) => {
    const rows = await prisma.scoreEntry.findMany({ where: { schoolId }, take: LIMIT, orderBy: { recordedAt: "desc" }, select: { score: true, maxScore: true, isDraft: true, recordedAt: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } }, subject: { select: { name: true } }, assessmentComponent: { select: { name: true } } } });
    return { head: ["Admission no", "Student", "Subject", "Component", "Score", "Out of", "Final", "Recorded"], rows: rows.map((row) => [row.student.admissionNumber, full(row.student), row.subject.name, row.assessmentComponent.name, row.score, row.maxScore, row.isDraft ? "No" : "Yes", day(row.recordedAt)]) };
  } },
  { code: "attendance", columns: ["Date", "Arm", "Student", "Admission no", "Mark", "Reason"], name: "Attendance · every mark", count: (schoolId) => prisma.studentAttendance.count({ where: { schoolId } }), run: attendanceRegister },
  { code: "payments", columns: ["Reference", "Receipt", "Student", "Admission no", "Amount", "Method", "State", "Paid", "Reversed"], name: "Payments and receipts", count: (schoolId) => prisma.payment.count({ where: { schoolId } }), run: async (schoolId) => {
    const rows = await prisma.payment.findMany({ where: { schoolId }, take: LIMIT, orderBy: { paidAt: "desc" }, select: { reference: true, receiptNumber: true, amount: true, method: true, status: true, paidAt: true, isReversed: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } } });
    return { head: ["Reference", "Receipt", "Student", "Admission no", "Amount", "Method", "State", "Paid", "Reversed"], rows: rows.map((row) => [row.reference, row.receiptNumber ?? "", full(row.student), row.student.admissionNumber, num(row.amount), String(row.method), String(row.status), day(row.paidAt), row.isReversed ? "Yes" : "No"]) };
  } },
  { code: "guardians", columns: ["Guardian", "Phone", "Child", "Consents on file", "Recorded"], name: "Guardians and consents", count: (schoolId) => prisma.guardian.count({ where: { schoolId } }), run: consentCoverage },
  { code: "staff", columns: ["Staff no", "Name", "Role", "Department", "Employment", "Qualification", "Employed on", "Phone", "Email"], name: "Staff and permissions", count: (schoolId) => prisma.staffProfile.count({ where: { schoolId } }), run: staffList },
  { code: "messages", columns: ["Channel", "Title", "Status", "Sent"], name: "Messages and delivery", count: (schoolId) => prisma.notificationLog.count({ where: { schoolId } }), run: async (schoolId) => {
    const rows = await prisma.notificationLog.findMany({ where: { schoolId }, take: LIMIT, orderBy: { sentAt: "desc" }, select: { channel: true, title: true, status: true, sentAt: true } });
    return { head: ["Channel", "Title", "Status", "Sent"], rows: rows.map((row) => [String(row.channel), row.title, row.status, row.sentAt?.toISOString() ?? ""]) };
  } },
  { code: "invoices", columns: ["Invoice", "Student", "Admission no", "Arm", "Billed", "Discounts", "Paid", "Balance", "State"], name: "Invoices and balances", count: (schoolId) => prisma.invoice.count({ where: { schoolId } }), run: feeCollection },
  { code: "audit", columns: ["When", "Who", "Action", "Record type", "Record", "What"], name: "Audit log · complete", count: (schoolId) => prisma.auditLog.count({ where: { schoolId } }), run: async (schoolId) => {
    const rows = await prisma.auditLog.findMany({ where: { schoolId }, take: LIMIT, orderBy: { createdAt: "desc" }, select: { createdAt: true, action: true, entityType: true, entityId: true, metadata: true, actor: { select: { firstName: true, lastName: true } } } });
    return { head: ["When", "Who", "Action", "Record type", "Record", "What"], rows: rows.map((row) => [row.createdAt.toISOString(), row.actor ? full(row.actor) : "The system", String(row.action), row.entityType, row.entityId ?? "", String((row.metadata as { summary?: string } | null)?.summary ?? "")]) };
  } },
];

const BOM = String.fromCharCode(0xfeff);

/** A CSV a spreadsheet opens correctly: quoted, escaped, with the byte-order mark Excel wants. */
export function toCsv(sheet: Sheet): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${BOM}${[sheet.head, ...sheet.rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
