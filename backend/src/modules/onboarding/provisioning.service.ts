import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, type Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { schoolRoleTemplates } from "../../../../src/lib/modules/school-modules";
import { dayOf, today } from "../attendance-management/attendance.shared";
import { CardService } from "../report-cards/card.service";
import { cardReference, suggestion } from "../report-cards/cards.shared";
import { loadArm } from "../score-results/arm";
import { ensureColumns, liveFramework } from "../score-results/scores.shared";
import { syncResultSheets } from "../score-results/sync";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { templates, checkBands, type Band } from "../config-library/templates.service";
import { CATEGORY_OF, COMPONENTS, calendarFor, gradingFor, ladderFor, offeredTo, sampleNames, schoolDays, seeded, subjectsFor, type Section } from "./school-template";

/**
 * What a new school is given the moment it exists — the list the signup's "Set up automatically" panel promises, and
 * the list the "you're done" screen reads back. Each step reports what it actually did, so the screen never claims
 * something that was not written.
 */

/** What a trial carries. A school pays per student per term afterwards; this is just enough to try messaging. */
export const TRIAL_CREDITS = { SMS: 200, WHATSAPP: 100 } as const;

export type ProvisionStep = { key: string; label: string; detail: string };

@Injectable()
export class ProvisioningService {
  constructor(private readonly cards: CardService) {}

  /** The permanent record of the trial: its tier, its credits, and the ledger that explains them. */
  async issueTrial(tx: Prisma.TransactionClient | typeof prisma, schoolId: string, ownerId: string, email: string): Promise<ProvisionStep> {
    await tx.schoolSubscription.upsert({
      where: { schoolId },
      create: { schoolId, tier: "PREMIUM", billingEmail: email, receiptEmail: email, billingContact: "The Proprietor", productOnly: true },
      update: {},
    });
    await tx.notificationWallet.upsert({
      where: { schoolId },
      create: { schoolId, smsBalance: TRIAL_CREDITS.SMS, whatsappBalance: TRIAL_CREDITS.WHATSAPP, lastToppedUpAt: new Date() },
      update: { smsBalance: { increment: TRIAL_CREDITS.SMS }, whatsappBalance: { increment: TRIAL_CREDITS.WHATSAPP }, lastToppedUpAt: new Date() },
    });
    await tx.creditLedger.createMany({
      data: [
        { schoolId, channel: "SMS", kind: "TRIAL", credits: TRIAL_CREDITS.SMS, note: "Free trial credits", createdById: ownerId },
        { schoolId, channel: "WHATSAPP", kind: "TRIAL", credits: TRIAL_CREDITS.WHATSAPP, note: "Free trial credits", createdById: ownerId },
      ],
    });
    return { key: "trial", label: "Trial record created and notification credits issued", detail: `${TRIAL_CREDITS.SMS} SMS and ${TRIAL_CREDITS.WHATSAPP} WhatsApp credits · every feature unlocked` };
  }

  roleTemplates(): ProvisionStep {
    return { key: "roles", label: "Default staff role templates ready", detail: `${schoolRoleTemplates.length} templates, from Proprietor to front desk, ready to assign in Staff & Access` };
  }

  /** The country's published scale from the library, when there is one that still checks out. */
  private async libraryScale(country: string) {
    const { curriculum, grading } = await templates.forCountry(country);
    if (!grading) return null;
    const bands = grading.gradeBands as unknown as Band[];
    if (!Array.isArray(bands) || checkBands(bands, grading.passMark).length) return null;
    return { grading, curriculum, scale: { name: `${grading.name} (v${grading.version})`, description: `Copied from the platform's ${grading.name} template, version ${grading.version}. The school can edit its own copy.`, passMark: grading.passMark, bands: bands.map((band) => ({ label: band.grade, min: band.min, max: band.max, remark: band.remark ?? "" })) } };
  }

  private async gradingScale(country: string) {
    const fallback = gradingFor(country);
    const row = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" }, select: { defaultGradingScale: true } });
    const raw = row?.defaultGradingScale;
    if (!Array.isArray(raw) || !raw.length) return fallback;
    const bands = raw.map((band) => band as { grade?: string; min?: number; max?: number; remark?: string });
    const usable = bands.every((band) => band.grade && typeof band.min === "number" && typeof band.max === "number" && band.remark) && bands.some((band) => band.min === 0) && bands.some((band) => (band.max as number) >= 99);
    if (!usable) return fallback;
    return { name: "Platform default scale", description: "The default scale set by the platform for every new school. The school can edit its own copy.", passMark: fallback.passMark, bands: bands.map((band) => ({ label: band.grade as string, min: band.min as number, max: band.max as number, remark: band.remark as string })) };
  }

  /* ───────────────────────── the school's own structure ───────────────────────── */

  /**
   * The calendar, the grading scale, the subjects its sections teach, and a class for every level it said it runs — then,
   * if asked, a sample class to look at. Returns what was actually written, line by line.
   */
  async academics(schoolId: string, ownerId: string, o: { country: string; levels: string[]; withSample: boolean }): Promise<ProvisionStep[]> {
    const steps: ProvisionStep[] = [];
    const cal = calendarFor();
    const session = await prisma.academicSession.create({ data: { schoolId, name: cal.sessionName, startDate: cal.startDate, endDate: cal.endDate, isCurrent: true } });
    const terms = [];
    for (const term of cal.terms) terms.push(await prisma.term.create({ data: { schoolId, academicSessionId: session.id, name: term.name, order: term.order, startDate: term.startDate, endDate: term.endDate, isCurrent: term.order === cal.current.order } }));
    const current = terms.find((term) => term.isCurrent) ?? terms[0];
    await new ConfigStore(schoolId, "academic-context").put("CURRENT_ACADEMIC_CONTEXT", "Current Academic Context", { academicSessionId: session.id, academicSessionName: session.name, activeTermId: current.id, activeTermName: current.name, availableTerms: terms.map((term) => ({ id: term.id, name: term.name, order: term.order, isCurrent: term.id === current.id })) });

    // A scale published in the library for this country comes first; then the platform's own default (Settings → School defaults); then the code's fallback for the country.
    const fromLibrary = await this.libraryScale(o.country);
    const grading = fromLibrary?.scale ?? (await this.gradingScale(o.country));
    if (fromLibrary) await templates.recordAdoption(schoolId, [{ kind: "GRADING", templateId: fromLibrary.grading.id, templateName: fromLibrary.grading.name, version: fromLibrary.grading.version }, ...(fromLibrary.curriculum ? [{ kind: "CURRICULUM" as const, templateId: fromLibrary.curriculum.id, templateName: fromLibrary.curriculum.name, version: fromLibrary.curriculum.version }] : [])]);
    await prisma.gradingScheme.create({ data: { schoolId, academicSessionId: session.id, name: grading.name, description: grading.description, isActive: true, passMark: grading.passMark, bands: { create: grading.bands.map((band, index) => ({ schoolId, label: band.label, minScore: band.min, maxScore: band.max, remark: band.remark, order: index + 1 })) } } });

    const ladder = ladderFor(o.levels);
    const sections = Array.from(new Set<Section>([...ladder.map((rung) => rung.section).filter((section): section is Section => Boolean(section)), ...(o.withSample ? (["PRIMARY"] as Section[]) : [])]));
    await prisma.sectionAssessmentComponent.createMany({ data: sections.flatMap((section) => COMPONENTS.map((component) => ({ schoolId, academicSessionId: session.id, section, name: component.name, code: component.code, type: component.type, weight: component.weight, maxScore: component.maxScore, order: component.order }))), skipDuplicates: true });

    const wanted = sections.flatMap((section) => subjectsFor(o.country, section));
    await prisma.subject.createMany({ data: wanted.map((subject, index) => ({ schoolId, name: subject.name, code: subject.code, section: subject.section, isCore: subject.isCore, isOptional: subject.isOptional, religionSpecific: subject.religionSpecific, applicableClassLevels: subject.levels ?? undefined, sortOrder: index })), skipDuplicates: true });
    const subjects = await prisma.subject.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, section: true, isCore: true, isOptional: true, religionSpecific: true, applicableClassLevels: true, name: true }, orderBy: { sortOrder: "asc" } });
    steps.push({ key: "curriculum", label: `Curriculum and grading template loaded for ${o.country}`, detail: `${grading.name} · ${subjects.length} subjects across ${sections.length} ${sections.length === 1 ? "section" : "sections"} · ${COMPONENTS.length} assessment components` });

    let at = 0;
    for (const rung of ladder) {
      at += 1;
      const level = await prisma.classLevel.create({ data: { schoolId, name: rung.name, section: rung.section ? CATEGORY_OF[rung.section] : "MIXED", schoolSection: rung.section, order: at } });
      const room = await prisma.classRoom.create({ data: { schoolId, classLevelId: level.id, name: rung.name, arm: "A", capacity: 40, displayOrder: at } });
      const offered = rung.section ? offeredTo(subjects.filter((subject) => subject.section === rung.section), rung.name) : [];
      if (offered.length) await prisma.classSubject.createMany({ data: offered.map((subject) => ({ schoolId, classId: room.id, subjectId: subject.id, assignedById: ownerId })), skipDuplicates: true });
    }
    steps.push({ key: "ladder", label: "Class ladder built from the levels you chose", detail: ladder.length ? `${ladder.length} ${ladder.length === 1 ? "class" : "classes"}, each with its subjects ready for a teacher` : "No levels were chosen, so no classes were created" });

    if (o.withSample) {
      try {
        steps.push(await this.sampleClass(schoolId, ownerId, o.country, { sessionId: session.id, term: current }));
      } catch (error) {
        steps.push({ key: "sample", label: "Sample demo class could not be loaded", detail: error instanceof Error ? error.message : "Something went wrong — your school is otherwise ready" });
      }
    }
    return steps;
  }

  /**
   * Thirty sample students in one class, with a term's attendance marked, every subject scored and approved, and a
   * published report card each — so the product can be seen working in the first hour. No guardian, phone number or
   * email is created, so nothing about it can ever be messaged. Everything it makes is listed so it can be removed whole.
   */
  private async sampleClass(schoolId: string, ownerId: string, country: string, ctx: { sessionId: string; term: { id: string; name: string; startDate: Date; endDate: Date } }): Promise<ProvisionStep> {
    const rand = seeded(schoolId);
    const level = await prisma.classLevel.create({ data: { schoolId, name: "Sample Class", section: "PRIMARY", schoolSection: "PRIMARY", order: 999, visibleToParents: false } });
    const room = await prisma.classRoom.create({ data: { schoolId, classLevelId: level.id, name: "Sample Class", arm: "A", capacity: 40, displayOrder: 999 } });
    const subjects = offeredTo(await prisma.subject.findMany({ where: { schoolId, section: "PRIMARY", deletedAt: null }, orderBy: { sortOrder: "asc" } }), "Primary 4", 10);
    if (!subjects.length) throw new BadRequestException("There are no primary subjects to teach the sample class.");
    await prisma.classSubject.createMany({ data: subjects.map((subject) => ({ schoolId, classId: room.id, subjectId: subject.id, assignedById: ownerId })) });

    const now = new Date();
    const names = sampleNames(country);
    const year = now.getUTCFullYear();
    const students = [];
    for (const [index, person] of names.entries()) {
      students.push(await prisma.student.create({ data: { schoolId, currentClassId: room.id, currentSessionId: ctx.sessionId, admissionNumber: `SMP-${String(index + 1).padStart(3, "0")}`, firstName: person.firstName, lastName: person.lastName, gender: person.gender, dateOfBirth: new Date(Date.UTC(year - 9, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27))), admissionDate: ctx.term.startDate, nationality: country === "Nigeria" ? "Nigerian" : "Not stated" } }));
    }

    /* a term's attendance, up to yesterday */
    const yesterday = new Date(today().getTime() - 86_400_000);
    const last = yesterday < ctx.term.endDate ? yesterday : ctx.term.endDate;
    const days = schoolDays(dayOf(ctx.term.startDate), last);
    const absentProne = new Set(students.filter(() => rand() < 0.15).map((student) => student.id));
    await prisma.attendanceRegister.createMany({ data: days.map((date) => ({ schoolId, classId: room.id, termId: ctx.term.id, date, status: "SUBMITTED", markedById: ownerId, startedAt: new Date(date.getTime() + 7 * 3_600_000), submittedAt: new Date(date.getTime() + 8 * 3_600_000), roll: students.length })) });
    const marks: Prisma.StudentAttendanceCreateManyInput[] = [];
    for (const date of days) {
      for (const student of students) {
        const roll = rand();
        const status = roll < (absentProne.has(student.id) ? 0.14 : 0.03) ? "ABSENT" : roll < 0.95 ? "PRESENT" : roll < 0.985 ? "LATE" : "EXCUSED";
        marks.push({ schoolId, studentId: student.id, classId: room.id, termId: ctx.term.id, markedById: ownerId, date, status: status as "PRESENT", markedAt: new Date(date.getTime() + 8 * 3_600_000) });
      }
    }
    await prisma.studentAttendance.createMany({ data: marks });

    /* every subject scored, in the school's own framework, and approved */
    const columns = await ensureColumns(schoolId, await liveFramework(schoolId, ctx.term.id, "PRIMARY"));
    await prisma.resultSheet.createMany({ data: students.map((student) => ({ schoolId, studentId: student.id, termId: ctx.term.id, classId: room.id, createdById: ownerId })) });
    const sheets = await prisma.resultSheet.findMany({ where: { schoolId, termId: ctx.term.id, classId: room.id }, select: { id: true, studentId: true } });
    const sheetOf = new Map(sheets.map((sheet) => [sheet.studentId, sheet.id]));
    const ability = new Map(students.map((student) => [student.id, Math.max(32, Math.min(94, 64 + (rand() + rand() + rand() - 1.5) * 34))]));
    const span = Math.max(1, last.getTime() - ctx.term.startDate.getTime());
    const entries: Prisma.ScoreEntryCreateManyInput[] = [];
    for (const subject of subjects) {
      const bias = (rand() - 0.5) * 12;
      for (const student of students) {
        for (const [order, column] of columns.entries()) {
          const raw = ((ability.get(student.id) as number) + bias + (rand() - 0.5) * 18) / 100;
          const score = Math.max(0, Math.min(column.max, Math.round(raw * column.max)));
          const at = new Date(ctx.term.startDate.getTime() + span * ((order + 1) / (columns.length + 1)));
          entries.push({ schoolId, studentId: student.id, resultSheetId: sheetOf.get(student.id) as string, subjectId: subject.id, assessmentComponentId: column.id as string, enteredById: ownerId, score, maxScore: column.max, recordedAt: at, isDraft: false, submittedAt: at });
        }
      }
    }
    await prisma.scoreEntry.createMany({ data: entries });
    const stamp = new Date();
    await prisma.scoreSheet.createMany({ data: subjects.map((subject) => ({ schoolId, termId: ctx.term.id, classId: room.id, subjectId: subject.id, status: "APPROVED", framework: columns as unknown as Prisma.InputJsonValue, enteredByIds: [ownerId], submittedById: ownerId, submittedAt: stamp, decidedById: ownerId, decidedAt: stamp, decisionNote: "Sample class" })) });

    /* totals, positions, grades — the same arithmetic the real sheets use — then published */
    const termRef = { id: ctx.term.id, name: ctx.term.name };
    await syncResultSheets(schoolId, termRef, room.id, ownerId);
    const arm = await loadArm(schoolId, termRef, room.id);
    if (!arm) throw new BadRequestException("The sample class could not be read back.");
    const fullTerm = await this.cards.term(schoolId, ctx.term.id);
    await prisma.resultSheet.updateMany({ where: { schoolId, termId: ctx.term.id, classId: room.id }, data: { status: "PUBLISHED", publishedAt: stamp, lockedAt: stamp, approvedById: ownerId } });
    const averages = new Map(arm.subjects.length ? students.map((student) => [student.id, arm.subjects.map((subject) => subject.rows.find((row) => row.id === student.id)?.total).filter((value): value is number => typeof value === "number")] as const) : []);
    await prisma.reportRemark.createMany({ data: students.flatMap((student) => {
      const totals = averages.get(student.id) ?? [];
      const average = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null;
      const text = suggestion(average, student.firstName);
      return [
        { schoolId, studentId: student.id, termId: ctx.term.id, classId: room.id, author: "FORM_MASTER", text, tone: average !== null && average >= 70 ? "Encouraging" : "Plain", authorId: ownerId, onBehalf: true, submittedAt: stamp },
        { schoolId, studentId: student.id, termId: ctx.term.id, classId: room.id, author: "PRINCIPAL", text: "Reviewed. Sample remark — written for the demonstration class.", tone: "Plain", authorId: ownerId, submittedAt: stamp },
      ];
    }) });
    for (const student of students) {
      const data = await this.cards.build(schoolId, fullTerm, arm, student.id, true);
      await prisma.reportCard.create({ data: { schoolId, studentId: student.id, academicSessionId: ctx.sessionId, termId: ctx.term.id, classId: room.id, status: "PUBLISHED", data: { ...data, issuedAt: stamp.toISOString() } as unknown as Prisma.InputJsonValue, publishedAt: stamp, lockedAt: stamp, revision: 1, reference: cardReference(student.admissionNumber, ctx.term.name), publishedById: ownerId, generatedById: ownerId, deliveryState: "UNDELIVERED" } });
    }

    await new ConfigStore(schoolId, "sample-data").put("manifest", "Sample class", { classId: room.id, levelId: room.classLevelId, studentIds: students.map((student) => student.id), termId: ctx.term.id, students: students.length, days: days.length, subjects: subjects.length });
    await prisma.school.update({ where: { id: schoolId }, data: { sampleDataLoadedAt: stamp } });
    return { key: "sample", label: "Sample demo class loaded", detail: `${students.length} students · ${days.length} school days marked · ${subjects.length} subjects scored · ${students.length} report cards — remove it any time` };
  }

  /** The sample class, removed whole. What the school has added of its own is not touched. */
  async clearSample(schoolId: string, actorId: string) {
    const item = await new ConfigStore(schoolId, "sample-data").get<{ classId: string; levelId: string; studentIds: string[]; students: number }>("manifest");
    if (!item) throw new BadRequestException("There is no sample class to remove.");
    const { classId, levelId, studentIds } = item.data;
    await prisma.$transaction(async (tx) => {
      await tx.reportCard.deleteMany({ where: { schoolId, classId } });
      await tx.reportRemark.deleteMany({ where: { schoolId, classId } });
      await tx.scoreEntry.deleteMany({ where: { schoolId, studentId: { in: studentIds } } });
      await tx.resultApproval.deleteMany({ where: { schoolId, resultSheet: { classId } } });
      await tx.resultSheet.deleteMany({ where: { schoolId, classId } });
      await tx.scoreSheet.deleteMany({ where: { schoolId, classId } });
      await tx.studentAttendance.deleteMany({ where: { schoolId, classId } });
      await tx.attendanceRegister.deleteMany({ where: { schoolId, classId } });
      await tx.classSubject.deleteMany({ where: { schoolId, classId } });
      await tx.student.deleteMany({ where: { schoolId, id: { in: studentIds } } });
      await tx.classRoom.deleteMany({ where: { schoolId, id: classId } });
      await tx.classLevel.deleteMany({ where: { schoolId, id: levelId } });
      await tx.school.update({ where: { id: schoolId }, data: { sampleDataClearedAt: new Date() } });
    });
    await new ConfigStore(schoolId, "sample-data").remove("manifest");
    await prisma.auditLog.create({ data: { schoolId, actorId, action: AuditAction.DELETE, entityType: "SampleData", entityId: classId, metadata: { summary: `Sample class removed · ${item.data.students} students`, removed: studentIds.length } as never } });
    return { removed: item.data.students };
  }
}
