import { prisma } from "../../../../src/lib/db/prisma";
import { armName, shortDay } from "../attendance-management/attendance.shared";
import { loadArm } from "../score-results/arm";
import { itemKey, type Decided, type Item, type Person, type RouteType, type Source } from "./hub.shared";

/**
 * Where each kind of decision is read from.
 *
 * Every decision stays in the module that raised it — that module still holds its record and still knows
 * how to apply it. Each reader here turns that module's own table into the one shape the queue works in,
 * and nothing more: it never decides anything itself.
 */

export type Fact = [string, string, string?];
export type Context = { request: Fact[]; context: Fact[]; downstream: Fact[]; evidence: Fact[]; table?: { title: string; sub: string; head: string[]; rows: string[][] } };

const LIMIT = 300;
const text = (value: string | null | undefined, fallback = "—") => (value && value.trim() ? value.trim() : fallback);
const who = (user: { firstName: string; lastName: string; preferredName?: string | null } | undefined | null) => (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "");
const num = (value: unknown) => Number(value ?? 0);
const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

/** Everyone the queue names, read once. */
async function peopleOf(schoolId: string, ids: Array<string | null | undefined>): Promise<Map<string, NonNullable<Person>>> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (!wanted.length) return new Map();
  const users = await prisma.user.findMany({ where: { schoolId, id: { in: wanted } }, select: { id: true, firstName: true, lastName: true, preferredName: true, role: true } });
  return new Map(users.map((user) => [user.id, { id: user.id, name: user.preferredName?.trim() || who(user), role: user.role }]));
}

async function studentsOf(schoolId: string, ids: string[]) {
  const rows = ids.length ? await prisma.student.findMany({ where: { schoolId, id: { in: Array.from(new Set(ids)) } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { id: true, name: true, arm: true } } } }) : [];
  return new Map(rows.map((row) => [row.id, { name: who(row), adm: row.admissionNumber, arm: row.currentClass ? armName(row.currentClass) : "No arm", classId: row.currentClass?.id ?? null }]));
}

async function subjectsOf(schoolId: string, ids: string[]) {
  const rows = ids.length ? await prisma.subject.findMany({ where: { schoolId, id: { in: Array.from(new Set(ids)) } }, select: { id: true, name: true } }) : [];
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function roomsOf(schoolId: string, ids: string[]) {
  const rows = ids.length ? await prisma.classRoom.findMany({ where: { schoolId, id: { in: Array.from(new Set(ids)) } }, select: { id: true, name: true, arm: true } }) : [];
  return new Map(rows.map((row) => [row.id, armName(row)]));
}

/* ───────────────────────── what is waiting ───────────────────────── */

export async function loadPending(schoolId: string): Promise<Item[]> {
  const [corrections, sheets, registers, waivers, changes, leave, native, joins, sends] = await Promise.all([
    prisma.scoreCorrection.findMany({ where: { schoolId, status: { in: ["AWAITING", "IN_REVIEW"] } }, orderBy: { createdAt: "asc" }, take: LIMIT }),
    prisma.scoreSheet.findMany({ where: { schoolId, status: "SUBMITTED" }, orderBy: { submittedAt: "asc" }, take: LIMIT }),
    prisma.attendanceCorrection.findMany({ where: { schoolId, status: "AWAITING" }, orderBy: { createdAt: "asc" }, take: LIMIT }),
    prisma.feeWaiver.findMany({ where: { schoolId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT, include: { invoice: { select: { invoiceNumber: true, balance: true } } } }),
    prisma.studentChangeRequest.findMany({ where: { schoolId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT }),
    prisma.leaveRequest.findMany({ where: { schoolId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT, include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true, role: true } } } } } }),
    prisma.approvalRequest.findMany({ where: { schoolId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT }),
    prisma.schoolJoinRequest.findMany({ where: { schoolId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT, include: { user: { select: { id: true, firstName: true, lastName: true, jobTitle: true, userCode: true } } } }),
    prisma.messageCampaign.findMany({ where: { schoolId, status: "AWAITING_APPROVAL" }, orderBy: { createdAt: "asc" }, take: LIMIT }),
  ]);
  const people = await peopleOf(schoolId, [...sends.map((row) => row.createdById), ...corrections.map((row) => row.requestedById), ...sheets.map((row) => row.submittedById), ...registers.map((row) => row.requestedById), ...waivers.map((row) => row.requestedById), ...changes.map((row) => row.requestedById), ...native.map((row) => row.requestedById)]);
  const students = await studentsOf(schoolId, [...corrections.map((row) => row.studentId), ...registers.map((row) => row.studentId), ...waivers.map((row) => row.studentId), ...changes.map((row) => row.studentId)]);
  const subjects = await subjectsOf(schoolId, [...corrections.map((row) => row.subjectId), ...sheets.map((row) => row.subjectId)]);
  const rooms = await roomsOf(schoolId, [...corrections.map((row) => row.classId), ...sheets.map((row) => row.classId), ...registers.map((row) => row.classId)]);
  const person = (id: string | null | undefined): Person => (id ? people.get(id) ?? null : null);
  const out: Item[] = [];
  const add = (source: Source, id: string, rest: Omit<Item, "key" | "source" | "id">) => out.push({ key: itemKey(source, id), source, id, ...rest });

  for (const row of corrections) {
    const student = students.get(row.studentId);
    const from = row.fromScore === null ? "blank" : String(row.fromScore);
    const to = row.toScore < 0 ? "absent" : String(row.toScore);
    add("SCORE_CORRECTION", row.id, { type: "SCORE_CORRECTION", title: `${subjects.get(row.subjectId) ?? "Subject"} · ${rooms.get(row.classId) ?? "Arm"} · ${student?.name ?? "A child"} ${from} → ${to}`, summary: row.explanation, requester: person(row.requestedById), raisedAt: row.createdAt, state: row.status === "IN_REVIEW" ? "In review" : "Awaiting", step: row.status === "IN_REVIEW" ? 2 : 1, blocking: row.reachedParent ? "A family has already seen this result" : "1 child's result", evidence: row.evidence?.trim() || null, href: "/score-entry-results/results", ref: {} });
  }
  for (const row of sheets) {
    const submitted = row.submittedAt ?? row.updatedAt;
    add("SCORE_SHEET", row.id, { type: "SCORE_SHEET", title: `${subjects.get(row.subjectId) ?? "Subject"} · ${rooms.get(row.classId) ?? "Arm"} · score sheet`, summary: "A teacher's sheet, submitted for the last check before the marks are final.", requester: person(row.submittedById), raisedAt: submitted, state: "Awaiting", step: 1, blocking: `Every report card in ${rooms.get(row.classId) ?? "the arm"}`, evidence: null, href: `/score-entry-results/review/${row.classId}/${row.subjectId}`, ref: { classId: row.classId, subjectId: row.subjectId } });
  }
  for (const row of registers) {
    const student = students.get(row.studentId);
    add("ATTENDANCE_CORRECTION", row.id, { type: "ATTENDANCE_CORRECTION", title: `${student?.name ?? "A child"} · ${shortDay(row.date)} · ${row.fromStatus.toLowerCase()} → ${row.toStatus.toLowerCase()}`, summary: row.explanation, requester: person(row.requestedById), raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: `${rooms.get(row.classId) ?? "One"} register`, evidence: row.evidence ? "Evidence seen and filed" : null, href: "/attendance/compliance", ref: {} });
  }
  for (const row of waivers) {
    const student = students.get(row.studentId);
    const value = row.waiverType === "PERCENTAGE" && row.percentage ? `${num(row.percentage)}% of the balance` : row.waiverType === "FULL" ? "the full balance" : naira(num(row.amount));
    add("FEE_WAIVER", row.id, { type: "FEE_WAIVER", title: `${student?.name ?? "A child"} · waiver of ${value}`, summary: row.reason, requester: person(row.requestedById), raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: "1 family's balance", evidence: null, href: "/fee-management/review", ref: {} });
  }
  for (const row of changes) {
    const student = students.get(row.studentId);
    add("RECORD_CHANGE", row.id, { type: "RECORD_CHANGE", title: `${student?.name ?? "A child"} · ${row.field.toLowerCase()} change`, summary: `${text(row.before)} → ${row.after}${row.reason ? ` — ${row.reason}` : ""}`, requester: person(row.requestedById), raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: null, evidence: row.evidence?.trim() || null, href: "/student-records/changes", ref: {} });
  }
  for (const row of leave) {
    const user = row.staff.user;
    add("LEAVE", row.id, { type: "LEAVE", title: `${who(user)} · ${/leave$/i.test(row.type) ? row.type.toLowerCase() : `${row.type.toLowerCase()} leave`}`, summary: row.reason, requester: { id: user.id, name: user.preferredName?.trim() || who(user), role: user.role }, raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: row.coverState === "Not arranged" ? "Cover has not been arranged" : null, evidence: null, href: "/staff-access/leave", ref: {} });
  }
  for (const row of joins) {
    add("JOIN_REQUEST", row.id, { type: "TEACHER_JOIN", title: `${who(row.user)} · asks to join`, summary: `${row.user.jobTitle ?? "Teacher"}${row.subjects.length ? ` · ${row.subjects.slice(0, 3).join(", ")}` : ""}`, requester: { id: row.user.id, name: who(row.user), role: "TEACHER" }, raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: null, evidence: null, href: "/approvals-workflow/queue", ref: {} });
  }
  for (const row of sends) {
    add("MESSAGE_SEND", row.id, { type: "MASS_COMMUNICATION", title: `${row.audienceLabel} · ${row.recipientCount} ${row.recipientCount === 1 ? "family" : "families"}`, summary: row.body.length > 160 ? `${row.body.slice(0, 157)}…` : row.body, requester: person(row.createdById), raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: `${row.recipientCount} ${row.recipientCount === 1 ? "family" : "families"} not yet written to`, evidence: null, href: "/communication-center/sent", ref: {} });
  }
  for (const row of native) {
    const type = (["SCORE_CORRECTION", "RESULTS_PUBLICATION", "FEE_WAIVER", "RECORD_CHANGE", "LEAVE", "STAFF_ACCESS", "MASS_COMMUNICATION", "TIMETABLE_CHANGE"].includes(row.kind) ? row.kind : "OTHER") as RouteType;
    add("NATIVE", row.id, { type, title: row.title, summary: row.summary, requester: person(row.requestedById), raisedAt: row.createdAt, state: "Awaiting", step: 1, blocking: row.blocking, evidence: null, href: "/approvals-workflow/queue", nativeAssigneeId: row.assigneeId, nativeAssigneeRole: row.assigneeRole, ref: {} });
  }
  return out;
}

/* ───────────────────────── what has been decided ───────────────────────── */

export async function loadDecided(schoolId: string, since: Date): Promise<Decided[]> {
  const [corrections, sheets, registers, waivers, changes, leave, native, joins, sends] = await Promise.all([
    prisma.scoreCorrection.findMany({ where: { schoolId, status: { in: ["APPROVED", "DECLINED"] }, decidedAt: { gte: since } }, take: 500 }),
    prisma.scoreSheet.findMany({ where: { schoolId, status: { in: ["APPROVED", "RETURNED"] }, decidedAt: { gte: since }, submittedAt: { not: null } }, take: 500 }),
    prisma.attendanceCorrection.findMany({ where: { schoolId, status: { in: ["APPLIED", "DECLINED"] }, decidedAt: { gte: since } }, take: 500 }),
    prisma.feeWaiver.findMany({ where: { schoolId, status: { in: ["APPROVED", "REJECTED"] }, approvedAt: { gte: since } }, take: 500 }),
    prisma.studentChangeRequest.findMany({ where: { schoolId, status: { in: ["APPROVED", "DECLINED"] }, decidedAt: { gte: since } }, take: 500 }),
    prisma.leaveRequest.findMany({ where: { schoolId, status: { in: ["APPROVED", "REJECTED"] }, reviewedAt: { gte: since } }, take: 500, include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } } }),
    prisma.approvalRequest.findMany({ where: { schoolId, status: { in: ["APPROVED", "REJECTED", "RETURNED"] }, decidedAt: { gte: since } }, take: 500 }),
    prisma.schoolJoinRequest.findMany({ where: { schoolId, status: { in: ["APPROVED", "DECLINED"] }, decidedAt: { gte: since } }, take: 500, include: { user: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.messageCampaign.findMany({ where: { schoolId, approvedById: { not: null }, status: { in: ["SENT", "RETURNED", "CANCELLED"] }, updatedAt: { gte: since } }, take: 500 }),
  ]);
  const people = await peopleOf(schoolId, [...sends.flatMap((row) => [row.createdById, row.approvedById]), ...corrections.flatMap((row) => [row.requestedById, row.decidedById]), ...sheets.flatMap((row) => [row.submittedById, row.decidedById]), ...registers.flatMap((row) => [row.requestedById, row.decidedById]), ...waivers.flatMap((row) => [row.requestedById, row.approvedById]), ...changes.flatMap((row) => [row.requestedById, row.decidedById]), ...leave.map((row) => row.decidedById), ...native.flatMap((row) => [row.requestedById, row.decidedById])]);
  const name = (id: string | null | undefined) => (id ? people.get(id)?.name ?? null : null);
  const out: Decided[] = [];
  const add = (source: Source, id: string, type: RouteType, title: string, requesterId: string | null, requesterName: string | null, decidedById: string | null, raisedAt: Date, decidedAt: Date | null, outcome: Decided["outcome"], note: string | null) => {
    if (decidedAt) out.push({ key: itemKey(source, id), type, title, requesterId, requesterName, decidedById, decidedByName: name(decidedById), raisedAt, decidedAt, outcome, note });
  };
  for (const row of corrections) add("SCORE_CORRECTION", row.id, "SCORE_CORRECTION", `${row.componentName} correction`, row.requestedById, name(row.requestedById), row.decidedById, row.createdAt, row.decidedAt, row.status === "APPROVED" ? "Approved" : "Declined", row.decisionNote);
  for (const row of sheets) add("SCORE_SHEET", row.id, "SCORE_SHEET", "Score sheet", row.submittedById, name(row.submittedById), row.decidedById, row.submittedAt as Date, row.decidedAt, row.status === "APPROVED" ? "Approved" : "Returned", row.decisionNote);
  for (const row of registers) add("ATTENDANCE_CORRECTION", row.id, "ATTENDANCE_CORRECTION", "Register correction", row.requestedById, name(row.requestedById), row.decidedById, row.createdAt, row.decidedAt, row.status === "APPLIED" ? "Approved" : "Declined", row.decisionNote);
  for (const row of waivers) add("FEE_WAIVER", row.id, "FEE_WAIVER", "Fee waiver", row.requestedById, name(row.requestedById), row.approvedById, row.createdAt, row.approvedAt, row.status === "APPROVED" ? "Approved" : "Declined", null);
  for (const row of changes) add("RECORD_CHANGE", row.id, "RECORD_CHANGE", `${row.field} change`, row.requestedById, name(row.requestedById), row.decidedById, row.createdAt, row.decidedAt, row.status === "APPROVED" ? "Approved" : "Declined", row.decisionNote);
  for (const row of leave) add("LEAVE", row.id, "LEAVE", `${row.type} leave`, row.staff.user.id, who(row.staff.user), row.decidedById, row.createdAt, row.reviewedAt, row.status === "APPROVED" ? "Approved" : "Declined", row.decisionNote);
  for (const row of joins) add("JOIN_REQUEST", row.id, "TEACHER_JOIN", `${who(row.user)} · asks to join`, row.user.id, who(row.user), row.decidedById, row.createdAt, row.decidedAt, row.status === "APPROVED" ? "Approved" : "Declined", row.note);
  for (const row of sends) add("MESSAGE_SEND", row.id, "MASS_COMMUNICATION", `${row.audienceLabel} · ${row.recipientCount} families`, row.createdById, name(row.createdById), row.approvedById, row.createdAt, row.updatedAt, row.status === "SENT" ? "Approved" : row.status === "RETURNED" ? "Returned" : "Declined", row.decisionNote);
  for (const row of native) {
    const type = (["SCORE_CORRECTION", "RESULTS_PUBLICATION", "FEE_WAIVER", "RECORD_CHANGE", "LEAVE", "STAFF_ACCESS", "MASS_COMMUNICATION", "TIMETABLE_CHANGE"].includes(row.kind) ? row.kind : "OTHER") as RouteType;
    add("NATIVE", row.id, type, row.title, row.requestedById, name(row.requestedById), row.decidedById, row.createdAt, row.decidedAt, row.status === "APPROVED" ? "Approved" : row.status === "RETURNED" ? "Returned" : "Declined", row.decisionNote);
  }
  return out;
}

/* ───────────────────────── the context needed to judge one ───────────────────────── */

/** What a person needs in front of them to decide — not just the change, but what surrounds it. */
export async function contextOf(schoolId: string, item: Item): Promise<Context> {
  const empty: Context = { request: [], context: [], downstream: [], evidence: [] };
  const requester = item.requester ? `${item.requester.name} · ${item.requester.role.toLowerCase().replace(/_/g, " ")}` : "Not recorded";

  if (item.source === "SCORE_CORRECTION") {
    const row = await prisma.scoreCorrection.findFirst({ where: { id: item.id, schoolId } });
    if (!row) return empty;
    const [students, subjects, term] = await Promise.all([studentsOf(schoolId, [row.studentId]), subjectsOf(schoolId, [row.subjectId]), prisma.term.findFirst({ where: { id: row.termId, schoolId }, select: { id: true, name: true } })]);
    const student = students.get(row.studentId);
    const subject = subjects.get(row.subjectId) ?? "the subject";
    const arm = term ? await loadArm(schoolId, term, row.classId) : null;
    const rows = arm ? arm.subjects.map((entry) => ({ name: entry.name, mine: entry.rows.find((candidate) => candidate.id === row.studentId)?.total ?? null, mean: entry.mean })) : [];
    const from = row.fromScore === null ? "blank" : String(row.fromScore);
    const to = row.toScore < 0 ? "absent" : String(row.toScore);
    const target = rows.find((entry) => entry.name === subject);
    return {
      request: [
        ["Request", `Change ${student?.name ?? "the child"}'s ${subject} ${row.componentName} from ${from} to ${to}`],
        ["Requester", requester],
        ["Type", row.reachedParent ? "Score correction · two steps, because a family has seen it" : "Score correction · one approver"],
        ["Reason", row.reasonCode],
        ["Why", `“${row.explanation}”`],
        ["Where it stands", row.status === "IN_REVIEW" ? `First step agreed by ${(await peopleOf(schoolId, [row.stepOneById])).get(row.stepOneById ?? "")?.name ?? "someone"} — the second decides` : "Waiting for the first decision"],
      ],
      context: [],
      downstream: [
        ["Reached a family?", row.reachedParent ? "Yes" : "No", row.reachedParent ? "Approving issues a revised report card beside the original and tells the family why" : "No card has been published, so no revision notice is needed"],
        ["If approved", `${subject} ${row.componentName} becomes ${to}`, "The arm's totals and positions are recomputed"],
        ["If declined", "The mark stays as it is", "The requester is told why"],
      ],
      evidence: [["Evidence", text(row.evidence, "None attached"), row.evidence ? undefined : "A correction with nothing behind it is worth a question"], ["Subject class average", target?.mean === null || target?.mean === undefined ? "—" : String(target.mean)]],
      table: rows.length ? { title: `${student?.name ?? "The child"}'s other scores this term`, sub: "The context needed to judge it — not just the change.", head: ["Subject", "Total", "Class average", "Reading"], rows: rows.map((entry) => [entry.name === subject ? `${entry.name} · as recorded` : entry.name, entry.mine === null ? "—" : String(entry.mine), entry.mean === null ? "—" : String(entry.mean), entry.mine === null || entry.mean === null ? "No score" : entry.mine < entry.mean ? "Below the class average" : "At or above the class average"]) } : undefined,
    };
  }

  if (item.source === "SCORE_SHEET") {
    const sheet = await prisma.scoreSheet.findFirst({ where: { id: item.id, schoolId } });
    const term = sheet ? await prisma.term.findFirst({ where: { id: sheet.termId, schoolId }, select: { id: true, name: true } }) : null;
    const arm = sheet && term ? await loadArm(schoolId, term, sheet.classId) : null;
    const subject = arm?.subjects.find((entry) => entry.subjectId === sheet?.subjectId);
    if (!sheet || !subject) return { ...empty, request: [["Request", item.title], ["Requester", requester]] };
    return {
      request: [["Request", `Approve ${subject.name} for ${arm?.room.name}`], ["Requester", requester], ["Teacher", subject.teacher ?? "No teacher mapped"], ["Submitted", sheet.submittedAt ? shortDay(sheet.submittedAt) : "—"], ["Components", subject.columns.map((column) => `${column.name} ${column.max}`).join(" · ")]],
      context: [["Scored", `${subject.scored} of ${subject.roll}`], ["Class average", subject.mean === null ? "—" : String(subject.mean)], ["Highest", subject.high ? `${subject.high.name} · ${subject.high.total}` : "—"], ["Lowest", subject.low ? `${subject.low.name} · ${subject.low.total}` : "—"], ["Pass mark", String(subject.passMark)], ["Passed", `${subject.passed} · failed ${subject.failed}`], ["Open verification flags", String(subject.openFlags), subject.openFlags ? "Record what was found for each before approving" : "None"]],
      downstream: [["What it blocks", `Every report card in ${arm?.room.name}`, "Until every sheet in the arm is approved"], ["If approved", "The marks become final", "Results are recomputed"], ["If sent back", "It returns to the teacher", "With your reason, word for word"]],
      evidence: [["Entered by", subject.teacher ?? "—"]],
    };
  }

  if (item.source === "ATTENDANCE_CORRECTION") {
    const row = await prisma.attendanceCorrection.findFirst({ where: { id: item.id, schoolId } });
    if (!row) return empty;
    const students = await studentsOf(schoolId, [row.studentId]);
    const student = students.get(row.studentId);
    const marks = await prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, studentId: row.studentId, subjectId: null }, _count: { _all: true } });
    const total = marks.reduce((sum, entry) => sum + entry._count._all, 0);
    const absent = marks.find((entry) => entry.status === "ABSENT")?._count._all ?? 0;
    return {
      request: [["Request", `Change ${student?.name ?? "the child"}'s mark on ${shortDay(row.date)} from ${row.fromStatus} to ${row.toStatus}`], ["Requester", requester], ["Kind", row.kind], ["Reason", row.reasonCode], ["Why", `“${row.explanation}”`]],
      context: [["This child's record", `${total ? Math.round(((total - absent) / total) * 1000) / 10 : "—"}% present`, `${absent} absences across ${total} marked days`], ["Class", student?.arm ?? "—"]],
      downstream: [["If approved", "The register is changed and the child's percentage recomputed", "Any chronic-absence case is re-read"], ["If declined", "The mark stays", "The requester is told why"]],
      evidence: [["Evidence", row.evidence ? "Seen and filed" : "None", row.evidence ? undefined : "A correction with nothing behind it is worth a question"]],
    };
  }

  if (item.source === "FEE_WAIVER") {
    const row = await prisma.feeWaiver.findFirst({ where: { id: item.id, schoolId }, include: { invoice: { select: { invoiceNumber: true, total: true, balance: true, discount: true } } } });
    if (!row) return empty;
    const students = await studentsOf(schoolId, [row.studentId]);
    const student = students.get(row.studentId);
    const balance = num(row.invoice.balance);
    const raw = row.waiverType === "PERCENTAGE" && row.percentage ? (balance * num(row.percentage)) / 100 : row.waiverType === "FULL" ? balance : num(row.amount);
    const amount = Math.min(raw, balance);
    return {
      request: [["Request", `Waive ${naira(amount)} of ${student?.name ?? "the child"}'s invoice ${row.invoice.invoiceNumber}`], ["Requester", requester], ["Type", row.waiverType === "PERCENTAGE" ? `${num(row.percentage)}% of the balance` : row.waiverType === "FULL" ? "The full balance" : "A fixed amount"], ["Why", `“${row.reason}”`]],
      context: [["Invoice", row.invoice.invoiceNumber], ["Billed", naira(num(row.invoice.total))], ["Balance now", naira(balance)], ["Already discounted", naira(num(row.invoice.discount))]],
      downstream: [["If approved", `The balance falls to ${naira(balance - amount)}`, "A waiver adjustment is written against the invoice"], ["If declined", "The balance is unchanged", "The bursary reads your reason"]],
      evidence: [["Student", student ? `${student.name} · ${student.adm}` : "—"], ["Class", student?.arm ?? "—"]],
    };
  }

  if (item.source === "RECORD_CHANGE") {
    const row = await prisma.studentChangeRequest.findFirst({ where: { id: item.id, schoolId } });
    if (!row) return empty;
    const students = await studentsOf(schoolId, [row.studentId]);
    const student = students.get(row.studentId);
    return {
      request: [["Request", `Change ${student?.name ?? "the child"}'s ${row.field.toLowerCase()}`], ["Requester", requester], ["Before", text(row.before)], ["After", row.after], ["Why", row.reason ? `“${row.reason}”` : "No reason given"]],
      context: [["Student", student ? `${student.name} · ${student.adm}` : "—"], ["Class", student?.arm ?? "—"]],
      downstream: [["If approved", "The record is changed everywhere it is read", "Registers, cards and portals"], ["If declined", "The record stays as it is", "The requester is told what to fix"]],
      evidence: [["Evidence", text(row.evidence, "None attached"), row.evidence ? undefined : "A change with nothing behind it is worth a question"]],
    };
  }

  if (item.source === "LEAVE") {
    const row = await prisma.leaveRequest.findFirst({ where: { id: item.id, schoolId }, include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } } });
    if (!row) return empty;
    const taken = await prisma.leaveRequest.aggregate({ where: { schoolId, staffId: row.staffId, status: "APPROVED", startDate: { gte: new Date(new Date().getFullYear(), 0, 1) } }, _sum: { days: true } });
    return {
      request: [["Request", `${who(row.staff.user)} · ${/leave$/i.test(row.type) ? row.type.toLowerCase() : `${row.type.toLowerCase()} leave`}, ${shortDay(row.startDate)} to ${shortDay(row.endDate)}`], ["Days", String(row.days ?? "—")], ["Why", `“${row.reason}”`], ["Stage", text(row.stage, "First stage")]],
      context: [["Taken this year", `${taken._sum.days ?? 0} days`, "Approved leave since 1 January"], ["Cover", row.cover ?? "Not arranged", row.coverState]],
      downstream: [["If approved", "The leave is booked", "The timetable and registers are told who is away"], ["If declined", "No leave is booked", "The requester reads your reason"]],
      evidence: [],
    };
  }

  if (item.source === "MESSAGE_SEND") {
    const row = await prisma.messageCampaign.findFirst({ where: { id: item.id, schoolId } });
    if (!row) return empty;
    const wallet = await prisma.notificationWallet.findUnique({ where: { schoolId } });
    const audience = (row.audience ?? {}) as { acknowledge?: boolean };
    return {
      request: [["Message", row.body], ["Audience", row.audienceLabel, `${row.recipientCount} reachable`], ["Channel", row.channel === "IN_APP" ? "In-app" : row.channel === "SMS" ? "SMS" : "Email", row.channel === "SMS" ? "1 credit per part of the message, per family" : "Free"], ["Asks for acknowledgement", audience.acknowledge ? "Yes" : "No"]],
      context: [["Sent by", requester, "Under the school's name, never theirs"], ["Why it waits", `More than ${row.thresholdAt ?? "the threshold"} recipients`, "The school's mass-communication threshold"], ["School SMS balance", `${(wallet?.smsBalance ?? 0).toLocaleString("en-NG")} credits`]],
      downstream: [["If approved", "It goes now", "Each family gets their own words; the credits are taken as it leaves"], ["If returned or declined", "Nothing is sent", "The sender reads your reason and can change it"]],
      evidence: [],
    };
  }

  if (item.source === "JOIN_REQUEST") {
    const row = await prisma.schoolJoinRequest.findFirst({ where: { id: item.id, schoolId }, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, jobTitle: true, userCode: true } } } });
    if (!row) return empty;
    return {
      request: [["Request", `${who(row.user)} asks to be linked to this school`], ["Position", text(row.user.jobTitle)], ["Name they gave for the school", row.nameClaimed], ["User ID", text(row.user.userCode)]],
      context: [["Teaches", row.subjects.length ? row.subjects.join(", ") : "Not stated"], ["Levels", row.levels.length ? row.levels.join(", ") : "Not stated"], ["Contact", `${row.user.email}${row.user.phone ? ` · ${row.user.phone}` : ""}`, "Verify they are who they say before you approve"]],
      downstream: [["If approved", "They join the staff list", "Their own login and User ID carry over; their personal workspace is archived"], ["If declined", "Nothing changes", "They keep their own workspace and are told"]],
      evidence: [],
    };
  }

  const native = await prisma.approvalRequest.findFirst({ where: { id: item.id, schoolId } });
  return { request: [["Request", item.title], ["Requester", requester], ...(native?.summary ? ([["Detail", native.summary]] as Fact[]) : [])], context: [], downstream: native?.blocking ? [["What it blocks", native.blocking]] : [], evidence: [] };
}
