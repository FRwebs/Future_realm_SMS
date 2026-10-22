import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { activeCovers } from "../../common/teaching-scope";
import { REASONS, dayOf, iso, isSchoolDay, lagosClock, longDay, loadPolicy, today, type Mark } from "../attendance-management/attendance.shared";
import { armName, fullName } from "../fee-management/fees.shared";

const entrySchema = z.object({ studentId: z.string().min(1), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]), reason: z.string().trim().optional(), reasonCode: z.string().trim().optional() });
const submitSchema = z.object({ date: z.string().min(8), entries: z.array(entrySchema).min(1, "Mark at least one child before saving."), openedAt: z.string().optional(), note: z.string().trim().optional() });
const draftSchema = z.object({ date: z.string().min(8), entries: z.array(entrySchema) });

/**
 * Period registers: a register taken for one period by the teacher who teaches it.
 *
 * A daily register and a period register are different records. The daily register is authoritative — report cards are built from it.
 * A period register is subordinate: where the daily register already has a child absent, the absence is carried in, so nobody is asked
 * the same question twice; and a child present on the daily register but absent from the period is a truancy alert to their form
 * master. A period register never overwrites the daily figure.
 */
@Injectable()
export class PeriodRegistersService {
  private async term(schoolId: string) {
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
    if (!term) throw new NotFoundException("No term is current, so there is no register to take.");
    return term;
  }

  /** Whether this person teaches this subject-arm — the only way to hold its period register. */
  private async assertTeaches(session: SessionPayload, classId: string, subjectId: string) {
    const include = { classRoom: true, subject: true } as const;
    let row = await prisma.classSubject.findFirst({ where: { schoolId: session.schoolId, classId, subjectId, isActive: true, OR: [{ teacherId: session.userId }, { assistantTeacherId: session.userId }] }, include });
    // Cover holds the period register of the subject-arm it is stated for — until its end date, not a day after.
    if (!row && (await activeCovers(session.schoolId, session.userId)).some((cover) => cover.classId === classId && (cover.subjectId === subjectId || cover.subjectId === null))) {
      row = await prisma.classSubject.findFirst({ where: { schoolId: session.schoolId, classId, subjectId, isActive: true }, include });
    }
    if (!row) throw new ForbiddenException("You do not teach that subject in that arm, so its period register is not yours to take.");
    return row;
  }

  /** The period (and its times) this subject-arm has on a day, from the published timetable. */
  private async slot(schoolId: string, termId: string, classId: string, subjectId: string, teacherId: string, date: Date, periodNumber: number) {
    return prisma.timetableEntry.findFirst({ where: { schoolId, termId, classId, subjectId, teacherId, isPublished: true, dayOfWeek: date.getUTCDay(), periodNumber } });
  }

  async state(session: SessionPayload, classId: string, subjectId: string, periodNumber: number, dateText?: string) {
    const schoolId = session.schoolId;
    const term = await this.term(schoolId);
    const row = await this.assertTeaches(session, classId, subjectId);
    const now = today();
    const date = dateText ? dayOf(dateText) : now;
    const slot = await this.slot(schoolId, term.id, classId, subjectId, row.teacherId ?? session.userId, date, periodNumber);
    const [roster, daily, existing, register] = await Promise.all([
      prisma.student.findMany({ where: { schoolId, currentClassId: classId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, admissionNumber: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId: null }, select: { studentId: true, status: true, reason: true, reasonCode: true } }),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId }, select: { studentId: true, status: true, reason: true, reasonCode: true } }),
      prisma.periodRegister.findUnique({ where: { classId_date_periodNumber: { classId, date, periodNumber } } })
    ]);
    const dailyOf = new Map(daily.map((entry) => [entry.studentId, entry]));
    const saved = new Map(existing.map((entry) => [entry.studentId, entry]));
    const draft = (register?.status === "DRAFT" ? (register.draft ?? {}) : {}) as Record<string, { status?: string; reason?: string; reasonCode?: string }>;
    const submitted = register?.status === "SUBMITTED";
    let whyNot: string | null = null;
    if (date.getTime() !== now.getTime()) whyNot = date > now ? "A register cannot be taken for a day that has not happened." : "A period register closes at midnight. A correction needs the form master or the office.";
    else if (!isSchoolDay(term, date)) whyNot = `${longDay(date)} is not a school day in ${term.name}.`;
    else if (!slot) whyNot = "This subject has no published period for you on this day, so there is no period register to take.";
    return {
      arm: { id: classId, name: armName(row.classRoom) }, subject: { id: subjectId, name: row.subject.name }, periodNumber,
      slot: slot ? { from: slot.startsAt, to: slot.endsAt, room: slot.venue } : null,
      date: iso(date), label: longDay(date), mode: submitted ? "submitted" : register?.status === "DRAFT" ? "draft" : "new",
      startedAt: lagosClock(register?.startedAt ?? null), markedAt: lagosClock(register?.submittedAt ?? null), whyNot, editable: !whyNot,
      carried: daily.filter((entry) => entry.status === "ABSENT" || entry.status === "EXCUSED").length, dailyMarked: daily.length > 0,
      students: roster.map((student, index) => {
        const mine = saved.get(student.id);
        const staged = draft[student.id];
        const carried = dailyOf.get(student.id);
        // The daily register already said this child is away: the period begins from that, not from a blank.
        const carriedIn = carried && (carried.status === "ABSENT" || carried.status === "EXCUSED") ? carried : null;
        return {
          id: student.id, roll: index + 1, name: fullName(student), adm: student.admissionNumber,
          status: (mine?.status ?? (staged?.status as Mark | undefined) ?? carriedIn?.status ?? null) as Mark | null,
          reason: mine?.reason ?? staged?.reason ?? carriedIn?.reason ?? "", reasonCode: mine?.reasonCode ?? staged?.reasonCode ?? carriedIn?.reasonCode ?? "",
          termRate: null as number | null
        };
      }),
      reasons: REASONS
    };
  }

  async saveDraft(session: SessionPayload, classId: string, subjectId: string, periodNumber: number, body: unknown) {
    const input = draftSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.term(schoolId);
    await this.assertTeaches(session, classId, subjectId);
    const date = dayOf(input.date);
    if (date.getTime() !== today().getTime()) throw new BadRequestException("A period register is taken on the day of the period.");
    const existing = await prisma.periodRegister.findUnique({ where: { classId_date_periodNumber: { classId, date, periodNumber } } });
    if (existing?.status === "SUBMITTED") throw new BadRequestException("This period register has already been submitted.");
    const roll = await prisma.student.count({ where: { schoolId, currentClassId: classId, status: "ACTIVE" } });
    const draft = Object.fromEntries(input.entries.map((entry) => [entry.studentId, { status: entry.status, reason: entry.reason ?? "", reasonCode: entry.reasonCode ?? "" }])) as Prisma.InputJsonValue;
    const saved = await prisma.periodRegister.upsert({
      where: { classId_date_periodNumber: { classId, date, periodNumber } },
      update: { draft, markedById: session.userId, roll },
      create: { schoolId, classId, subjectId, termId: term.id, date, periodNumber, status: "DRAFT", draft, markedById: session.userId, roll }
    });
    return { id: saved.id, saved: input.entries.length, roll };
  }

  async submit(session: SessionPayload, classId: string, subjectId: string, periodNumber: number, body: unknown) {
    const input = submitSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.term(schoolId);
    const row = await this.assertTeaches(session, classId, subjectId);
    const date = dayOf(input.date);
    if (date.getTime() !== today().getTime()) throw new BadRequestException("A period register is taken on the day of the period.");
    if (!isSchoolDay(term, date)) throw new BadRequestException(`${longDay(date)} is not a school day in ${term.name}.`);
    const slot = await this.slot(schoolId, term.id, classId, subjectId, row.teacherId ?? session.userId, date, periodNumber);
    if (!slot) throw new BadRequestException("This subject has no published period for you on this day.");

    const roster = await prisma.student.findMany({ where: { schoolId, currentClassId: classId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true } });
    const onRoll = new Map(roster.map((student) => [student.id, student]));
    const strays = input.entries.filter((entry) => !onRoll.has(entry.studentId));
    if (strays.length) throw new BadRequestException(`${strays.length} of those children are not on ${armName(row.classRoom)}'s roll.`);
    const given = new Map(input.entries.map((entry) => [entry.studentId, entry]));
    const missing = roster.filter((student) => !given.has(student.id));
    if (missing.length) throw new BadRequestException(`${missing.length} ${missing.length === 1 ? "child has" : "children have"} no mark. An unmarked child is not a present one — set every row.`);

    const taken = await prisma.periodRegister.findUnique({ where: { classId_date_periodNumber: { classId, date, periodNumber } } });
    const stamp = new Date();
    const clock = lagosClock(stamp) ?? "00:00";
    const inPeriod = clock <= slot.endsAt;
    const existingRows = await prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId }, select: { id: true, studentId: true, status: true } });
    const byStudent = new Map(existingRows.map((entry) => [entry.studentId, entry]));
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    const creates: Prisma.StudentAttendanceCreateManyInput[] = [];
    for (const entry of input.entries) {
      const mine = byStudent.get(entry.studentId);
      const reason = entry.status === "ABSENT" || entry.status === "EXCUSED" || entry.status === "LATE" ? entry.reason || entry.reasonCode || null : null;
      if (mine) operations.push(prisma.studentAttendance.update({ where: { id: mine.id }, data: { status: entry.status, reason, reasonCode: entry.reasonCode || null, markedById: session.userId, markedAt: stamp } }));
      else creates.push({ schoolId, studentId: entry.studentId, classId, termId: term.id, markedById: session.userId, subjectId, date, status: entry.status, reason, reasonCode: entry.reasonCode || null, markedAt: stamp });
    }
    await prisma.$transaction([
      ...operations,
      ...(creates.length ? [prisma.studentAttendance.createMany({ data: creates })] : []),
      prisma.periodRegister.upsert({
        where: { classId_date_periodNumber: { classId, date, periodNumber } },
        update: taken?.status === "SUBMITTED" ? { roll: roster.length } : { status: "SUBMITTED", draft: Prisma.DbNull, markedById: session.userId, submittedAt: stamp, roll: roster.length, inPeriod },
        create: { schoolId, classId, subjectId, termId: term.id, date, periodNumber, status: "SUBMITTED", markedById: session.userId, startedAt: taken?.startedAt ?? stamp, submittedAt: stamp, roll: roster.length, inPeriod }
      })
    ]);

    /* a child who was in the building this morning and is not in this period: their form master is told */
    const daily = await prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId: null }, select: { studentId: true, status: true } });
    const here = new Set(daily.filter((entry) => entry.status === "PRESENT" || entry.status === "LATE").map((entry) => entry.studentId));
    const truant = input.entries.filter((entry) => entry.status === "ABSENT" && here.has(entry.studentId));
    if (truant.length && !taken) {
      const arm = await prisma.classRoom.findUnique({ where: { id: classId }, select: { classTeacherId: true } });
      if (arm?.classTeacherId && arm.classTeacherId !== session.userId) {
        const names = truant.map((entry) => fullName(onRoll.get(entry.studentId)!)).join(", ");
        await prisma.notificationLog.create({ data: { schoolId, userId: arm.classTeacherId, channel: "IN_APP", title: `Truancy alert · ${armName(row.classRoom)}`, body: `${names} ${truant.length === 1 ? "was" : "were"} present on the daily register and absent from ${row.subject.name} (period ${periodNumber}) on ${longDay(date)}.`, status: "QUEUED", sentAt: stamp } });
      }
    }
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: taken ? AuditAction.UPDATE : AuditAction.CREATE, entityType: "PeriodRegister", entityId: `${classId}:${iso(date)}:${periodNumber}`, metadata: { summary: `Period register ${taken ? "corrected" : "submitted"} · ${row.subject.name} · ${armName(row.classRoom)} · period ${periodNumber}`, present: input.entries.filter((entry) => entry.status === "PRESENT").length, absent: input.entries.filter((entry) => entry.status === "ABSENT").length, truancy: truant.length, inPeriod } } });
    return { classId, subjectId, date: iso(date), arm: armName(row.classRoom), marked: input.entries.length, inPeriod, markedAt: clock, truancyAlerts: truant.length, fields: [["Taken at", clock], ["Children", String(input.entries.length)], ["Truancy alerts raised", String(truant.length)], ...(inPeriod ? [] : [["Period", `Taken after it ended at ${slot.endsAt}`]])] };
  }

  /** Today's registers for this person: every daily register they hold, and a period register for each period they teach. */
  async today(session: SessionPayload, me: { formArms: Array<{ id: string; name: string; roll: number }> }) {
    const schoolId = session.schoolId;
    const term = await this.term(schoolId);
    const now = new Date();
    const date = today(now);
    const clock = lagosClock(now) ?? "00:00";
    const policy = await loadPolicy(schoolId);
    const schoolDay = isSchoolDay(term, date);
    const [dailyRows, entries, periodRows] = await Promise.all([
      me.formArms.length ? prisma.attendanceRegister.findMany({ where: { classId: { in: me.formArms.map((arm) => arm.id) }, date }, select: { classId: true, status: true, submittedAt: true } }) : Promise.resolve([]),
      schoolDay ? prisma.timetableEntry.findMany({ where: { schoolId, termId: term.id, teacherId: session.userId, isPublished: true, subjectId: { not: null }, dayOfWeek: date.getUTCDay() }, include: { classRoom: true, subject: true }, orderBy: { periodNumber: "asc" } }) : Promise.resolve([]),
      prisma.periodRegister.findMany({ where: { schoolId, markedById: session.userId, date }, select: { classId: true, periodNumber: true, status: true, submittedAt: true, inPeriod: true } })
    ]);
    const daily = me.formArms.map((arm) => {
      const row = dailyRows.find((entry) => entry.classId === arm.id);
      const state = row?.status === "SUBMITTED" ? "Marked" : row?.status === "DRAFT" ? "In progress" : "Not started";
      return { kind: "daily" as const, classId: arm.id, arm: arm.name, subjectId: null as string | null, periodNumber: null as number | null, what: "Daily register", roll: arm.roll, state, markedAt: lagosClock(row?.submittedAt ?? null), at: null as string | null, pastCutoff: schoolDay && state !== "Marked" && clock > policy.markCutoff };
    });
    const periods = entries.map((entry) => {
      const row = periodRows.find((candidate) => candidate.classId === entry.classId && candidate.periodNumber === entry.periodNumber);
      const state = row?.status === "SUBMITTED" ? "Marked" : row?.status === "DRAFT" ? "In progress" : clock < entry.startsAt ? "Not due" : "Not started";
      return { kind: "period" as const, classId: entry.classId, arm: armName(entry.classRoom), subjectId: entry.subjectId, periodNumber: entry.periodNumber, what: `Period ${entry.periodNumber} · ${entry.subject?.name ?? ""}`, roll: 0, state, markedAt: lagosClock(row?.submittedAt ?? null), at: entry.startsAt, pastCutoff: false };
    });
    const rolls = await prisma.student.groupBy({ by: ["currentClassId"], where: { schoolId, status: "ACTIVE", currentClassId: { in: periods.map((entry) => entry.classId) } }, _count: { _all: true } });
    for (const period of periods) period.roll = rolls.find((entry) => entry.currentClassId === period.classId)?._count._all ?? 0;
    return { date: iso(date), schoolDay, cutoff: policy.markCutoff, clock, registers: [...daily, ...periods] };
  }
}
