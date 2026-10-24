import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { iso, isSchoolDay, lagosClock, longDay, loadPolicy, today } from "../attendance-management/attendance.shared";
import { loadAll, loadStaffNames } from "../score-results/arm";
import { armName, fullName } from "../fee-management/fees.shared";
import { TeacherStudentQuestionsService } from "./student-questions.service";
import { TeacherStudentWorkService } from "./student-work.service";
import { TeacherWorkspaceService } from "./workspace.service";

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type QueueItem = {
  work: string;
  what: string;
  /** What the due column says: "Overdue", "Today", "Closes 8 Sep". */
  due: string;
  /** Sorts the queue: lower is sooner. */
  rank: number;
  urgent: boolean;
  state: "Returned" | "Not started" | "In progress" | "Draft" | "Waiting on you" | "Attention" | "New";
  href: string;
  /** The primary action's words when this is the first item. */
  action: string;
  kind: "register" | "sheet" | "returned" | "remarks" | "note" | "document" | "review" | "training" | "appraisal" | "cover" | "family" | "students";
};

const shortDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * "My Day": everything a teaching person owes, counted from their own assignments and nobody else's. Registers come from the
 * attendance ledger, sheets from the score entries, remarks from the report cards, periods from the running timetable — read
 * here once, so the page cannot say something the module behind it does not.
 */
@Injectable()
export class MyDayService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly studentQuestions: TeacherStudentQuestionsService, private readonly studentWork: TeacherStudentWorkService) {}

  async day(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no day to plan. Set one in School Configuration.");
    const schoolId = session.schoolId;
    const now = new Date();
    const date = today(now);
    const clock = lagosClock(now) ?? "00:00";
    const policy = await loadPolicy(schoolId);
    const term = await prisma.term.findUniqueOrThrow({ where: { id: me.term.id } });
    const schoolDay = isSchoolDay(term, date);
    const dow = new Date(date).getUTCDay();

    /* registers: the daily register of every arm this person is the form master of */
    const registerRows = me.formArms.length
      ? await prisma.attendanceRegister.findMany({ where: { classId: { in: me.formArms.map((arm) => arm.id) }, date }, select: { classId: true, status: true, submittedAt: true } })
      : [];
    const registers = me.formArms.map((arm) => {
      const row = registerRows.find((entry) => entry.classId === arm.id);
      const state = row?.status === "SUBMITTED" ? "Marked" : row?.status === "DRAFT" ? "In progress" : "Not started";
      return { classId: arm.id, arm: arm.name, role: me.persona === "early-years" ? "Class Teacher" : "Form Master", state, markedAt: lagosClock(row?.submittedAt ?? null), roll: arm.roll, pastCutoff: schoolDay && state !== "Marked" && clock > policy.markCutoff };
    });

    /* sheets: the subject-arms this person is named on */
    const classIds = [...new Set(me.teaching.filter((row) => !row.assistant).map((row) => row.classId))];
    const arms = classIds.length ? await loadAll(schoolId, { id: term.id, name: term.name }, classIds) : [];
    const windows = await prisma.assessmentWindow.findMany({ where: { schoolId, termId: term.id }, select: { closesAt: true, allowLateEntry: true, reopenedAt: true } });
    const open = windows.filter((window) => window.closesAt >= now || window.allowLateEntry || (window.reopenedAt && window.reopenedAt > window.closesAt));
    const closes = open.length ? new Date(Math.min(...open.map((window) => window.closesAt.getTime()))) : null;
    const decisionBy = new Map<string, string>();
    const deciderIds = arms.flatMap((arm) => arm.subjects.map((subject) => subject.sheet?.decidedById ?? "")).filter(Boolean);
    if (deciderIds.length) {
      const people = await prisma.user.findMany({ where: { id: { in: [...new Set(deciderIds)] } }, select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true } });
      for (const person of people) decisionBy.set(person.id, `${fullName(person)}|${person.jobTitle ?? person.role.replaceAll("_", " ").toLowerCase()}`);
    }
    const sheets = arms.flatMap((arm) =>
      arm.subjects
        .filter((subject) => subject.teacherId === session.userId || subject.coverIds.includes(session.userId))
        .map((subject) => {
          const entered = subject.rows.filter((row) => row.complete).length;
          const [by, byRole] = (subject.sheet?.decidedById ? decisionBy.get(subject.sheet.decidedById) ?? "" : "").split("|");
          return {
            classId: arm.room.id, subjectId: subject.subjectId, subject: subject.name, arm: arm.room.name, state: subject.state, roll: subject.roll, entered, blanks: subject.roll - entered,
            returned: subject.state === "Returned" ? { note: subject.sheet?.decisionNote ?? "", at: subject.sheet?.returnedAt ?? null, by: by || "The reviewer", byRole: byRole || "" } : null
          };
        })
    );
    const openSheets = sheets.filter((sheet) => sheet.state !== "Submitted" && sheet.state !== "Approved");

    /* remarks: the form master's paragraph for each child */
    let remarks: { classId: string; arm: string; written: number; roll: number; due: string | null; days: number | null } | null = null;
    if (me.formArms.length) {
      const arm = me.formArms[0];
      const written = await prisma.reportRemark.count({ where: { schoolId, termId: term.id, classId: arm.id, author: "FORM_MASTER", state: "SUBMITTED" } });
      const release = await prisma.assessmentWindow.findFirst({ where: { schoolId, termId: term.id }, orderBy: { releaseAt: "desc" }, select: { releaseAt: true } });
      remarks = { classId: arm.id, arm: arm.name, written, roll: arm.roll, due: release ? iso(release.releaseAt) : null, days: release ? Math.ceil((release.releaseAt.getTime() - now.getTime()) / 86_400_000) : null };
    }

    /* periods: today's timetable for this person */
    const entries = schoolDay
      ? await prisma.timetableEntry.findMany({ where: { schoolId, teacherId: session.userId, termId: term.id, dayOfWeek: dow }, include: { classRoom: true, subject: true }, orderBy: { periodNumber: "asc" } })
      : [];
    const periods = entries.map((entry) => ({
      from: entry.startsAt, to: entry.endsAt, what: `${entry.subject?.name ?? entry.slotType} · ${armName(entry.classRoom)}`, where: entry.venue ?? "—",
      note: entry.notes ?? (entry.slotType === "lesson" ? "Period register" : entry.slotType),
      state: clock >= entry.endsAt ? "done" : clock >= entry.startsAt ? "now" : "later"
    }));
    const next = periods.find((period) => period.state === "later");
    if (next) next.state = "next";

    /* what the device has queued that the server knows about */
    const [pending, lastSynced, queuedRows] = await Promise.all([
      prisma.syncDraft.count({ where: { schoolId, userId: session.userId, syncedAt: null } }),
      prisma.syncDraft.findFirst({ where: { schoolId, userId: session.userId, syncedAt: { not: null } }, orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
      prisma.syncDraft.findMany({ where: { schoolId, userId: session.userId, syncedAt: null }, orderBy: { createdAt: "asc" }, take: 5, select: { type: true, createdAt: true } })
    ]);

    /* the queue, in the order it must be cleared */
    const queue: QueueItem[] = [];
    for (const sheet of sheets.filter((entry) => entry.returned)) {
      queue.push({ work: `Returned · ${sheet.subject} ${sheet.arm}`, what: sheet.returned?.note || "Returned for correction", due: "Today", rank: 0, urgent: true, state: "Returned", href: `/score-entry-results/enter/${sheet.classId}/${sheet.subjectId}`, action: `Correct ${sheet.subject} ${sheet.arm}`, kind: "returned" });
    }
    for (const register of registers.filter((entry) => entry.state !== "Marked" && schoolDay)) {
      queue.push({ work: `Daily register · ${register.arm}`, what: register.pastCutoff ? `Past the ${policy.markCutoff} cutoff — nobody is present until you say so` : `Due before ${policy.markCutoff}`, due: register.pastCutoff ? "Overdue" : "Today", rank: register.pastCutoff ? 1 : 2, urgent: register.pastCutoff, state: register.state === "In progress" ? "In progress" : "Not started", href: `/attendance/mark/${register.classId}`, action: `Mark the ${register.arm} register`, kind: "register" });
    }
    for (const sheet of openSheets.filter((entry) => !entry.returned)) {
      queue.push({ work: `Score sheet · ${sheet.subject} ${sheet.arm}`, what: sheet.entered ? `${sheet.entered} of ${sheet.roll} entered · ${sheet.blanks} blank${sheet.blanks === 1 ? "" : "s"}` : `Nothing entered yet · ${sheet.roll} children`, due: closes ? `Closes ${shortDate(closes)}` : "This term", rank: closes ? 10 + Math.max(0, Math.ceil((closes.getTime() - now.getTime()) / 86_400_000)) : 40, urgent: false, state: sheet.entered ? "In progress" : "Not started", href: `/score-entry-results/enter/${sheet.classId}/${sheet.subjectId}`, action: `Continue ${sheet.subject} ${sheet.arm}`, kind: "sheet" });
    }
    if (remarks && remarks.written < remarks.roll) {
      queue.push({ work: `Remarks · ${remarks.arm}`, what: me.persona === "early-years" ? "A short paragraph for each child" : "One paragraph for each child", due: remarks.due ? shortDate(new Date(remarks.due)) : "This term", rank: 20 + Math.max(0, remarks.days ?? 20), urgent: false, state: remarks.written ? "In progress" : "Not started", href: "/report-cards/remarks", action: `${remarks.written ? "Continue" : "Start"} the ${remarks.arm} remarks`, kind: "remarks" });
    }
    /* families: what the class's guardians have sent in that only their form master can decide */
    if (me.formArms.length) {
      const waiting = await prisma.guardianSubmission.findMany({ where: { schoolId, state: { in: ["NEW", "ASSIGNED", "IN_PROGRESS"] }, type: { in: ["Absence explanation", "Collection change"] }, student: { currentClassId: { in: me.formArms.map((arm) => arm.id) } } }, select: { createdAt: true } });
      if (waiting.length) {
        const oldest = Math.max(...waiting.map((row) => Math.floor((now.getTime() - row.createdAt.getTime()) / 86_400_000)));
        queue.push({ work: "Families waiting on you", what: `${waiting.length} submission${waiting.length === 1 ? "" : "s"} from ${me.formArms.map((arm) => arm.name).join(" and ")} families · the oldest is ${oldest} day${oldest === 1 ? "" : "s"} old`, due: oldest > 2 ? "Overdue" : "Today", rank: oldest > 2 ? 4 : 9, urgent: oldest > 2, state: "Waiting on you", href: "/parents-guardians/submissions", action: "Decide the oldest", kind: "family" });
      }
    }
    /* students: questions put to this person that nobody has answered yet */
    const asked = await this.studentQuestions.waiting(session);
    if (asked.waiting) {
      const oldest = asked.oldest ? Math.floor((now.getTime() - new Date(asked.oldest).getTime()) / 86_400_000) : 0;
      queue.push({ work: "Students are asking", what: `${asked.waiting} question${asked.waiting === 1 ? "" : "s"} from students · the oldest is ${oldest} day${oldest === 1 ? "" : "s"} old`, due: oldest > 2 ? "Overdue" : "Today", rank: oldest > 2 ? 5 : 11, urgent: oldest > 2, state: "Waiting on you", href: "/student-questions", action: "Answer them", kind: "students" });
    }
    /* homework handed in and not yet marked */
    const toMark = await this.studentWork.waitingCount(session);
    if (toMark) queue.push({ work: "Homework to mark", what: `${toMark} piece${toMark === 1 ? "" : "s"} of homework handed in by students`, due: "This week", rank: 14, urgent: false, state: "Waiting on you", href: "/student-work", action: "Mark it", kind: "students" });
    /* lesson notes: what came back, what this week still owes, and — for a head of department — what is waiting to be signed */
    const ownSubjects = [...new Map(me.teaching.filter((row) => !row.assistant).map((row) => [row.subjectId, row])).values()];
    if (ownSubjects.length) {
      const subjectIds = ownSubjects.map((row) => row.subjectId);
      const [plans, topics] = await Promise.all([
        prisma.lessonPlan.findMany({ where: { schoolId, teacherId: session.userId, termId: term.id, subjectId: { in: subjectIds }, deletedAt: null }, select: { subjectId: true, weekNumber: true, status: true, reviewNote: true, topic: true } }),
        prisma.sowTopic.findMany({ where: { schoolId, weekNumber: me.term.week, schemeOfWork: { termId: term.id, subjectId: { in: subjectIds }, classId: { in: ownSubjects.map((row) => row.classId) } } }, select: { topic: true, schemeOfWork: { select: { subjectId: true } } } })
      ]);
      const label = (subjectId: string) => ownSubjects.find((row) => row.subjectId === subjectId)?.subject ?? "Lesson note";
      for (const plan of plans.filter((entry) => entry.status === "RETURNED")) {
        queue.push({ work: `Returned note · ${label(plan.subjectId)} week ${plan.weekNumber}`, what: plan.reviewNote || "Returned for changes", due: "Today", rank: 3, urgent: true, state: "Returned", href: `/lesson-notes/notes/${plan.subjectId}/${plan.weekNumber}`, action: `Revise the ${label(plan.subjectId)} note`, kind: "note" });
      }
      for (const subjectId of subjectIds) {
        const topic = topics.find((entry) => entry.schemeOfWork.subjectId === subjectId && !/topic to be planned$/i.test(entry.topic));
        if (!topic) continue;
        const plan = plans.find((entry) => entry.subjectId === subjectId && entry.weekNumber === me.term!.week);
        if (plan && plan.status !== "DRAFT") continue;
        queue.push({ work: `Lesson note · ${label(subjectId)}`, what: `${topic.topic} — week ${me.term.week}`, due: "This week", rank: 15, urgent: false, state: plan ? "Draft" : "Not started", href: `/lesson-notes/notes/${subjectId}/${me.term.week}`, action: `Write this week’s ${label(subjectId)} note`, kind: "note" });
      }
    }
    if (me.persona === "head-of-department" && me.department) {
      const waiting = await prisma.lessonPlan.count({ where: { schoolId, departmentId: me.department.id, status: "SUBMITTED", deletedAt: null, teacherId: { not: session.userId } } });
      if (waiting) queue.push({ work: "Lesson notes to sign", what: `${waiting} note${waiting === 1 ? " is" : "s are"} with you from your department`, due: "This week", rank: 12, urgent: false, state: "Waiting on you", href: "/lesson-notes/review", action: "Open the notes to sign", kind: "review" });
    }
    /* their own record: a self-assessment owed, a credential about to lapse, and — for a head of department — a gap nobody covers */
    const [appraisal, documents, away] = await Promise.all([
      prisma.staffAppraisal.findFirst({ where: { schoolId, staff: { userId: session.userId }, status: "DRAFT", selfSubmittedAt: null }, orderBy: { createdAt: "desc" }, select: { cycle: true } }),
      prisma.profileDocument.findMany({ where: { schoolId, userId: session.userId, deletedAt: null, expiresOn: { not: null, lte: new Date(now.getTime() + 60 * 86_400_000) } }, select: { title: true, expiresOn: true }, orderBy: { expiresOn: "asc" }, take: 3 }),
      me.persona === "head-of-department" && me.department
        ? prisma.user.findMany({ where: { schoolId, id: { not: session.userId }, staffProfile: { departmentId: me.department.id } }, select: { id: true } }).then((people) => prisma.staffAbsence.findMany({ where: { schoolId, day: date, userId: { in: people.map((person) => person.id) } }, select: { userId: true } }))
        : Promise.resolve([])
    ]);
    const requiredCourses = await prisma.trainingCourse.findMany({ where: { schoolId, publishedAt: { not: null }, archivedAt: null, requiredFor: { hasSome: ["all", me.persona] } }, select: { id: true, title: true, requiredBy: true, hours: true } });
    if (requiredCourses.length) {
      const finished = await prisma.trainingEnrolment.findMany({ where: { schoolId, userId: session.userId, courseId: { in: requiredCourses.map((course) => course.id) }, completedAt: { not: null } }, select: { courseId: true } });
      for (const course of requiredCourses.filter((entry) => !finished.some((done) => done.courseId === entry.id))) {
        const days = course.requiredBy ? Math.ceil((course.requiredBy.getTime() - now.getTime()) / 86_400_000) : null;
        queue.push({ work: `Required training · ${course.title}`, what: `${course.hours} hour${course.hours === 1 ? "" : "s"}, self-paced${days !== null ? days < 0 ? ` — ${-days} days overdue` : ` — due in ${days} days` : ""}`, due: course.requiredBy ? shortDate(course.requiredBy) : "This term", rank: days !== null && days < 0 ? 4 : days !== null && days < 14 ? 14 : 28, urgent: days !== null && days < 0, state: "Not started", href: `/training/catalogue/${course.id}`, action: `Start ${course.title}`, kind: "training" });
      }
    }
    if (appraisal) queue.push({ work: "Self-assessment", what: `${appraisal.cycle} — yours alone until you submit it`, due: "This cycle", rank: 30, urgent: false, state: "Not started", href: "/my-employment/appraisal", action: "Start your self-assessment", kind: "appraisal" });
    for (const document of documents) {
      const days = Math.ceil((document.expiresOn!.getTime() - now.getTime()) / 86_400_000);
      queue.push({ work: document.title, what: days < 0 ? "Expired — upload the renewal" : `Expires in ${days} day${days === 1 ? "" : "s"} — upload the renewal`, due: shortDate(document.expiresOn!), rank: days < 0 ? 5 : 25, urgent: days < 0, state: "Attention", href: "/my-employment/payslips", action: `Upload the ${document.title} renewal`, kind: "document" });
    }
    if (away.length) {
      const covered = await prisma.coverAssignment.findMany({ where: { schoolId, ownerUserId: { in: away.map((entry) => entry.userId) }, endedAt: null, startsOn: { lte: date }, endsOn: { gte: date } }, select: { ownerUserId: true } });
      const uncovered = away.filter((entry) => !covered.some((cover) => cover.ownerUserId === entry.userId)).length;
      if (uncovered) queue.push({ work: "Cover needed today", what: `${uncovered} colleague${uncovered === 1 ? " is" : "s are"} away with nobody holding their classes`, due: "Today", rank: 2, urgent: true, state: "Waiting on you", href: "/my-employment/my-assignments", action: "Assign cover", kind: "cover" });
    }
    queue.sort((a, b) => a.rank - b.rank);

    return {
      date: iso(date), label: longDay(date), weekday: DOW_NAMES[dow], clock, schoolDay, cutoff: policy.markCutoff,
      week: me.term.week, weeks: me.term.weeks, termName: `${me.term.name} ${me.term.session}`,
      registers, sheets, returned: sheets.filter((sheet) => sheet.returned).map((sheet) => ({ ...sheet.returned!, label: `${sheet.subject} · ${sheet.arm}`, classId: sheet.classId, subjectId: sheet.subjectId, at: sheet.returned!.at?.toISOString() ?? null })),
      closes: closes?.toISOString() ?? null, remarks, periods, queue,
      sync: { pending, lastSyncedAt: lastSynced?.syncedAt?.toISOString() ?? null, items: queuedRows.map((row) => ({ kind: row.type, at: row.createdAt.toISOString() })) }
    };
  }

  /** The department the head heads, and nothing outside it: every sheet of its subjects, and who is holding each up. */
  async oversight(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (me.persona !== "head-of-department" || !me.department) throw new ForbiddenException("Oversight is for the head of a department.");
    if (!me.term) throw new NotFoundException("No term is current, so there are no sheets to oversee.");
    const schoolId = session.schoolId;
    const now = new Date();
    const term = { id: me.term.id, name: me.term.name };
    const mapped = await prisma.classSubject.findMany({ where: { schoolId, isActive: true, subject: { departmentId: me.department.id, deletedAt: null, isActive: true }, classRoom: { deletedAt: null, isActive: true } }, select: { classId: true, subjectId: true } });
    const arms = mapped.length ? await loadAll(schoolId, term, [...new Set(mapped.map((entry) => entry.classId))]) : [];
    const wanted = new Set(mapped.map((entry) => `${entry.classId}:${entry.subjectId}`));
    const windows = await prisma.assessmentWindow.findMany({ where: { schoolId, termId: term.id }, select: { closesAt: true } });
    const closes = windows.map((window) => window.closesAt).filter((at) => at >= now).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const names = await loadStaffNames(schoolId, arms.flatMap((arm) => arm.subjects.map((subject) => subject.teacherId ?? "")));

    const rows = arms.flatMap((arm) =>
      arm.subjects.filter((subject) => wanted.has(`${arm.room.id}:${subject.subjectId}`)).map((subject) => {
        const entered = subject.rows.filter((row) => row.complete).length;
        const stamp = (date: Date | null | undefined) => (date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
        const daysAgo = (date: Date | null | undefined) => (date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000)) : 0);
        const age =
          subject.state === "Submitted" ? (daysAgo(subject.sheet?.submittedAt) ? `${daysAgo(subject.sheet?.submittedAt)} days ago` : "Today")
          : subject.state === "Approved" ? `Approved ${stamp(subject.sheet?.decidedAt)}`
          : subject.state === "Returned" ? `Returned ${stamp(subject.sheet?.returnedAt)}`
          : subject.state === "In progress" ? `${entered} of ${subject.roll} entered`
          : subject.state === "Unassigned" ? "Nobody teaches it"
          : closes ? `${Math.max(0, Math.ceil((closes.getTime() - now.getTime()) / 86_400_000))} days left` : "No window set";
        return {
          classId: arm.room.id, subjectId: subject.subjectId, unit: `${subject.name} · ${arm.room.name}`, sub: `${subject.roll} children`, subject: subject.name, arm: arm.room.name, roll: subject.roll, entered, mean: subject.mean,
          submittedAt: subject.sheet?.submittedAt?.toISOString() ?? null, decidedAt: subject.sheet?.decidedAt?.toISOString() ?? null,
          ownerId: subject.teacherId, owner: subject.teacherId === session.userId ? "You" : subject.teacherId ? names.get(subject.teacherId) ?? "Unknown" : "Nobody yet",
          state: subject.state, age, overdue: (subject.state === "Not started" || subject.state === "In progress") && Boolean(closes && closes.getTime() - now.getTime() < 5 * 86_400_000),
          decidedByMe: subject.sheet?.decidedById === session.userId
        };
      })
    );
    const inCount = rows.filter((row) => row.state === "Submitted" || row.state === "Approved").length;
    const mine = rows.filter((row) => row.ownerId === session.userId);
    return {
      department: me.department.name, term: `${me.term.name} ${me.term.session}`, reportsTo: me.reportsTo,
      kpis: {
        submitted: inCount, sheets: rows.length, withTeacher: rows.filter((row) => row.state !== "Submitted" && row.state !== "Approved" && row.ownerId !== session.userId).length,
        returnedByMe: rows.filter((row) => row.decidedByMe && row.state === "Returned").length,
        mineSubmitted: mine.filter((row) => row.state === "Submitted" || row.state === "Approved").length, mine: mine.length,
        waitingOnMe: rows.filter((row) => row.state === "Submitted" && row.ownerId !== session.userId).length,
        notStarted: rows.filter((row) => row.state === "Not started").length, approved: rows.filter((row) => row.state === "Approved").length
      },
      closes: closes?.toISOString() ?? null,
      rows: rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.unit.localeCompare(b.unit))
    };
  }
}
