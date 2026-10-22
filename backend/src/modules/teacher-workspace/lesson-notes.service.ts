import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, SchemeOfWorkWeekType } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName, fullName } from "../fee-management/fees.shared";
import { CurriculumCatalogueService, termNumber } from "../curriculum-catalogue/curriculum-catalogue.service";
import { TeacherWorkspaceService } from "./workspace.service";

/** The seven sections of a note — what a colleague needs to teach from it. Required ones must be written before it can be submitted. */
export const NOTE_SECTIONS = [
  { key: "obj", label: "Learning objectives", hint: "What a student will be able to do by the end. Three at most.", placeholder: "By the end of the lesson, students should be able to…", required: true },
  { key: "prior", label: "Starter and prior knowledge", hint: "What they already know, and the first five minutes.", placeholder: "Recall… then a short starter…", required: false },
  { key: "content", label: "Lesson content", hint: "The explanation itself, step by step — enough for a colleague to teach from it.", placeholder: "1. …", required: true },
  { key: "act", label: "Teaching and learning activities", hint: "What you do, and what the students do.", placeholder: "Teacher: …  Students: …", required: false },
  { key: "res", label: "Resources", hint: "Books, pages, materials and anything the room needs ready.", placeholder: "Textbook, chapter…", required: false },
  { key: "eval", label: "Evaluation", hint: "Questions that show whether the lesson landed.", placeholder: "1. …", required: true },
  { key: "asg", label: "Assignment", hint: "What they take home, and when it is due.", placeholder: "Exercise…", required: false },
] as const;

const PLACEHOLDER = /topic to be planned$/i;
const WEEKS_DEFAULT = 13;

const weekSchema = z.object({
  topic: z.string().trim().min(3, "Name the topic."),
  subtopics: z.string().optional().default(""),
  kind: z.enum(["TEACHING", "REVISION", "EXAM", "HOLIDAY", "ACTIVITY"]).optional(),
});
const noteSchema = z.object({ sections: z.record(z.string()).default({}) });
const submitSchema = z.object({ reply: z.string().trim().optional() });
const decideSchema = z.object({ decision: z.enum(["sign", "return"]), note: z.string().trim().optional(), section: z.string().trim().optional() });

const lines = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : []);

/**
 * Lesson Notes. The curriculum comes first: one scheme of work per subject a teacher holds, a term's weeks, each week a topic broken into
 * what is actually taught. A note is written once per topic and serves every arm that takes it — so the scheme, the note, the coverage
 * and the week ahead are one piece of work, never four. A note is the teacher's; it is signed by their head of department (and a head of
 * department's own by the academic lead), never edited by the person who signs it.
 */
@Injectable()
export class TeacherLessonNotesService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly catalogue: CurriculumCatalogueService) {}

  /* ───────────────────────── who holds what ───────────────────────── */

  private async mine(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no scheme to plan.");
    const own = me.teaching.filter((row) => !row.assistant);
    const bySubject = new Map<string, { subjectId: string; subject: string; classIds: string[]; arms: string[] }>();
    for (const row of own) {
      const group = bySubject.get(row.subjectId) ?? { subjectId: row.subjectId, subject: row.subject, classIds: [], arms: [] };
      group.classIds.push(row.classId);
      group.arms.push(row.arm);
      bySubject.set(row.subjectId, group);
    }
    return { me, term: me.term, groups: [...bySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject)) };
  }

  private async schemes(schoolId: string, termId: string, subjectId: string, classIds: string[]) {
    return prisma.schemeOfWork.findMany({ where: { schoolId, termId, subjectId, classId: { in: classIds } }, include: { topics: { orderBy: { weekNumber: "asc" } } } });
  }

  /** The term's weeks for a subject, as the teacher's own scheme has them: planned, in progress, taught — or nothing yet. */
  private weeksOf(schemes: Awaited<ReturnType<TeacherLessonNotesService["schemes"]>>, weeks: number, current: number) {
    const out = [];
    for (let week = 1; week <= weeks; week += 1) {
      const topics = schemes.map((scheme) => scheme.topics.find((topic) => topic.weekNumber === week)).filter((topic): topic is NonNullable<typeof topic> => Boolean(topic));
      const planned = topics.find((topic) => !PLACEHOLDER.test(topic.topic));
      const covered = topics.length > 0 && topics.every((topic) => topic.isCovered);
      const some = topics.some((topic) => topic.isCovered);
      out.push({
        week, topic: planned?.topic ?? "", planned: Boolean(planned), subtopics: planned ? lines(planned.subtopics) : [], kind: planned?.weekType ?? "TEACHING",
        status: !planned ? "Not planned" : covered ? "Taught" : some ? "Partly taught" : week === current ? "In progress" : week < current ? "Planned" : "Planned"
      });
    }
    return out;
  }

  /* ───────────────────────── curriculum ───────────────────────── */

  async curriculum(session: SessionPayload) {
    const { me, term, groups } = await this.mine(session);
    const weeks = Math.max(term.weeks, WEEKS_DEFAULT);
    const rows = [];
    for (const group of groups) {
      const schemes = await this.schemes(session.schoolId, term.id, group.subjectId, group.classIds);
      const list = this.weeksOf(schemes, weeks, term.week);
      const planned = list.filter((entry) => entry.planned);
      const reached = planned.filter((entry) => entry.status === "Taught" || entry.status === "Partly taught").length;
      const expected = planned.filter((entry) => entry.week <= term.week).length;
      rows.push({
        subjectId: group.subjectId, subject: group.subject, arms: group.arms, schemes: schemes.length, planned: planned.length, weeks, reached, expected,
        thisWeek: list.find((entry) => entry.week === term.week)?.topic || null,
        status: schemes.length === 0 ? "No scheme" : schemes.every((scheme) => scheme.status === "APPROVED") ? "Approved" : schemes.some((scheme) => scheme.status === "SUBMITTED") ? "Submitted" : schemes.some((scheme) => scheme.status === "RETURNED") ? "Returned" : "Draft"
      });
    }
    return { persona: me.persona, term: { name: me.term!.name, session: me.term!.session, week: me.term!.week, weeks }, rows };
  }

  async scheme(session: SessionPayload, subjectId: string) {
    const { me, term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach, so its scheme of work is not yours to plan.");
    const weeks = Math.max(term.weeks, WEEKS_DEFAULT);
    const schemes = await this.schemes(session.schoolId, term.id, subjectId, group.classIds);
    const list = this.weeksOf(schemes, weeks, term.week);
    const notes = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, termId: term.id, deletedAt: null }, select: { weekNumber: true, status: true } });
    const noteOf = new Map(notes.map((note) => [note.weekNumber, note.status]));
    return {
      subject: group.subject, subjectId, arms: group.arms, term: { name: me.term!.name, session: me.term!.session, week: term.week, weeks },
      schemeStatus: schemes.length === 0 ? "No scheme" : schemes.every((scheme) => scheme.status === "APPROVED") ? "Approved" : schemes.some((scheme) => scheme.status === "SUBMITTED") ? "Submitted" : "Draft",
      returnReason: schemes.find((scheme) => scheme.returnReason)?.returnReason ?? null,
      weeks: list.map((entry) => ({ ...entry, note: noteOf.get(entry.week) ?? null }))
    };
  }

  /** Make sure every arm the teacher takes this subject in has a scheme for the term. */
  private async ensureSchemes(session: SessionPayload, termId: string, sessionId: string, group: { subjectId: string; classIds: string[] }) {
    for (const classId of group.classIds) {
      const existing = await prisma.schemeOfWork.findFirst({ where: { schoolId: session.schoolId, termId, subjectId: group.subjectId, classId } });
      if (existing) continue;
      await prisma.schemeOfWork.create({
        data: {
          schoolId: session.schoolId, subjectId: group.subjectId, classId, academicSessionId: sessionId, termId, teacherId: session.userId,
          topics: { create: Array.from({ length: WEEKS_DEFAULT }, (_, index) => ({ schoolId: session.schoolId, weekNumber: index + 1, topic: `Week ${index + 1} topic to be planned`, weekType: SchemeOfWorkWeekType.TEACHING, sortOrder: index + 1 })) }
        }
      });
    }
  }

  async saveWeek(session: SessionPayload, subjectId: string, week: number, body: unknown) {
    const input = weekSchema.parse(body);
    const { term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach.");
    const full = await prisma.term.findUniqueOrThrow({ where: { id: term.id }, select: { academicSessionId: true } });
    await this.ensureSchemes(session, term.id, full.academicSessionId, group);
    const subtopics = lines(input.subtopics);
    for (const classId of group.classIds) {
      const scheme = await prisma.schemeOfWork.findFirstOrThrow({ where: { schoolId: session.schoolId, termId: term.id, subjectId, classId } });
      if (scheme.status === "APPROVED" || scheme.status === "SUBMITTED") await prisma.schemeOfWork.update({ where: { id: scheme.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null } });
      await prisma.sowTopic.upsert({
        where: { schemeOfWorkId_weekNumber: { schemeOfWorkId: scheme.id, weekNumber: week } },
        update: { topic: input.topic, subtopics: subtopics as Prisma.InputJsonValue, ...(input.kind ? { weekType: input.kind } : {}) },
        create: { schoolId: session.schoolId, schemeOfWorkId: scheme.id, weekNumber: week, topic: input.topic, subtopics: subtopics as Prisma.InputJsonValue, weekType: input.kind ?? SchemeOfWorkWeekType.TEACHING, sortOrder: week }
      });
    }
    return { subjectId, week };
  }

  /** The published outlines this subject could be started from — same subject, same stage as one of its arms, same term. */
  async catalogueFor(session: SessionPayload, subjectId: string) {
    const { me, term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach.");
    const rooms = await prisma.classRoom.findMany({ where: { id: { in: group.classIds } }, select: { classLevel: { select: { name: true } } } });
    const stages = [...new Set(rooms.map((room) => room.classLevel.name))];
    const number = termNumber(me.term!.name);
    const found = await this.catalogue.matching(session.schoolId, group.subject, stages, number);
    return { subject: group.subject, stages, term: number, termName: me.term!.name, weeks: Math.max(term.weeks, WEEKS_DEFAULT), options: found.map((entry) => ({ id: entry.id, curriculum: entry.curriculum, stage: entry.stage, source: entry.source, book: entry.book, own: entry.own, topics: entry.topics.length, preview: entry.topics.slice(0, 4).map((topic) => topic.topic) })) };
  }

  /** Fills the term from an outline. Weeks the teacher has already planned stay as they are unless they ask for them to be replaced. */
  async applyCatalogue(session: SessionPayload, subjectId: string, body: unknown) {
    const input = z.object({ entryId: z.string().min(1, "Choose an outline."), replace: z.coerce.boolean().default(false) }).parse(body);
    const options = await this.catalogueFor(session, subjectId);
    if (!options.options.some((option) => option.id === input.entryId)) throw new BadRequestException("That outline is not one for this subject, stage and term.");
    const entry = await this.catalogue.entry(session.schoolId, input.entryId);
    if (!entry) throw new NotFoundException("That outline is no longer in the catalogue.");
    const { term, groups } = await this.mine(session);
    const group = groups.find((candidate) => candidate.subjectId === subjectId)!;
    const schemes = await this.schemes(session.schoolId, term.id, subjectId, group.classIds);
    const planned = new Set(this.weeksOf(schemes, options.weeks, term.week).filter((week) => week.planned).map((week) => week.week));
    let filled = 0;
    let kept = 0;
    for (const topic of entry.topics) {
      if (topic.week > options.weeks) continue;
      if (planned.has(topic.week) && !input.replace) { kept += 1; continue; }
      await this.saveWeek(session, subjectId, topic.week, { topic: topic.topic.length < 3 ? `${topic.topic}…` : topic.topic, subtopics: topic.subtopics.join("\n"), kind: "TEACHING" });
      filled += 1;
    }
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "SchemeOfWork", entityId: subjectId, metadata: { summary: `Scheme started from the catalogue · ${entry.subject} ${entry.stage} term ${entry.term}`, curriculum: entry.curriculum, filled, kept } } });
    return { filled, kept, from: `${entry.curriculum} · ${entry.subject} · ${entry.stage}` };
  }

  async setTaught(session: SessionPayload, subjectId: string, week: number, taught: boolean) {
    const { term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach.");
    for (const scheme of await this.schemes(session.schoolId, term.id, subjectId, group.classIds)) {
      const topic = scheme.topics.find((entry) => entry.weekNumber === week);
      if (topic) await prisma.sowTopic.update({ where: { id: topic.id }, data: { isCovered: taught, coveredDate: taught ? new Date() : null, coveredById: taught ? session.userId : null } });
    }
    return { subjectId, week, taught };
  }

  async submitScheme(session: SessionPayload, subjectId: string) {
    const { term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach.");
    const schemes = await this.schemes(session.schoolId, term.id, subjectId, group.classIds);
    if (!schemes.length) throw new BadRequestException("Plan at least some weeks first — there is no scheme to submit.");
    const planned = Math.max(...schemes.map((scheme) => scheme.topics.filter((topic) => !PLACEHOLDER.test(topic.topic)).length));
    if (planned < 10) throw new BadRequestException(`At least 10 weeks must be planned before a scheme is submitted. You have planned ${planned}.`);
    await prisma.schemeOfWork.updateMany({ where: { id: { in: schemes.map((scheme) => scheme.id) } }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedById: session.userId, returnReason: null } });
    return { subjectId, planned };
  }

  /* ───────────────────────── notes ───────────────────────── */

  private signerOf = async (session: SessionPayload, me: { persona: string; department: { id: string } | null }) => {
    const lead = (roles: string[], departmentId?: string | null) => prisma.user.findFirst({ where: { schoolId: session.schoolId, id: { not: session.userId }, isActive: true, deletedAt: null, role: { in: roles as never[] }, ...(departmentId ? { staffProfile: { departmentId } } : {}) }, select: { id: true, firstName: true, lastName: true, role: true } });
    const head = me.persona !== "head-of-department" && me.department ? await lead(["HEAD_OF_DEPARTMENT"], me.department.id) : null;
    return head ?? (await lead(["VICE_PRINCIPAL_ACADEMICS"])) ?? (await lead(["PRINCIPAL", "HEAD_TEACHER"]));
  };

  async notes(session: SessionPayload) {
    const { me, term, groups } = await this.mine(session);
    const weeks = Math.max(term.weeks, WEEKS_DEFAULT);
    const plans = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, teacherId: session.userId, termId: term.id, deletedAt: null } });
    const signer = await this.signerOf(session, me);
    const rows = [];
    for (const group of groups) {
      const list = this.weeksOf(await this.schemes(session.schoolId, term.id, group.subjectId, group.classIds), weeks, term.week).filter((entry) => entry.planned);
      const weeksOut = list.map((entry) => {
        const plan = plans.find((candidate) => candidate.subjectId === group.subjectId && candidate.weekNumber === entry.week);
        const written = plan ? Object.values((plan.sections ?? {}) as Record<string, string>).filter((value) => String(value).trim()).length : 0;
        return { week: entry.week, topic: entry.topic, state: plan ? stateOf(plan.status) : "Not started", written, planId: plan?.id ?? null, review: plan?.reviewNote ?? null, section: plan?.returnedSection ?? null, resubmitted: Boolean(plan?.resubmitReply && plan.status === "SUBMITTED"), at: (plan?.updatedAt ?? null)?.toISOString() ?? null };
      });
      rows.push({ subjectId: group.subjectId, subject: group.subject, arms: group.arms, weeks: weeksOut });
    }
    return { persona: me.persona, signer: signer ? { name: fullName(signer) } : null, term: { week: term.week, weeks, name: me.term!.name, session: me.term!.session }, sections: NOTE_SECTIONS, rows };
  }

  async note(session: SessionPayload, subjectId: string, week: number) {
    const { me, term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach, so its note is not yours to write.");
    const schemes = await this.schemes(session.schoolId, term.id, subjectId, group.classIds);
    const list = this.weeksOf(schemes, Math.max(term.weeks, WEEKS_DEFAULT), term.week);
    const entry = list.find((candidate) => candidate.week === week);
    if (!entry?.planned) throw new BadRequestException("Plan this week in the scheme of work first — a note is written against a topic.");
    const plan = await prisma.lessonPlan.findFirst({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, termId: term.id, weekNumber: week, deletedAt: null }, include: { approvedBy: { select: { firstName: true, lastName: true } } } });
    // Last session's note on the same subject, to start from when the topic comes round again.
    const earlier = await prisma.lessonPlan.findFirst({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, status: "APPROVED", deletedAt: null, termId: { not: term.id }, topic: { equals: entry.topic, mode: "insensitive" } }, orderBy: { approvedAt: "desc" } });
    const signer = await this.signerOf(session, me);
    const neighbours = list.filter((candidate) => candidate.planned);
    const at = neighbours.findIndex((candidate) => candidate.week === week);
    return {
      subject: group.subject, subjectId, arms: group.arms, week, weeks: Math.max(term.weeks, WEEKS_DEFAULT), term: { name: me.term!.name, session: me.term!.session, current: term.week },
      topic: entry.topic, subtopics: entry.subtopics, status: entry.status, sections: NOTE_SECTIONS,
      state: plan ? stateOf(plan.status) : "Not started", text: (plan?.sections ?? {}) as Record<string, string>, planId: plan?.id ?? null,
      returned: plan?.status === "RETURNED" ? { note: plan.reviewNote ?? "", section: plan.returnedSection ?? null, at: plan.rejectedAt?.toISOString() ?? null } : null,
      resubmitReply: plan?.resubmitReply ?? null, signedBy: plan?.approvedBy ? fullName(plan.approvedBy) : null, signedAt: plan?.approvedAt?.toISOString() ?? null,
      signer: signer ? { name: fullName(signer) } : null, reuse: earlier?.sections ? { term: earlier.termId, sections: earlier.sections as Record<string, string> } : null,
      previous: at > 0 ? { week: neighbours[at - 1]!.week, topic: neighbours[at - 1]!.topic } : null, next: at >= 0 && at < neighbours.length - 1 ? { week: neighbours[at + 1]!.week, topic: neighbours[at + 1]!.topic } : null,
      person: me.person.name
    };
  }

  private async ownedPlan(session: SessionPayload, subjectId: string, week: number) {
    const { me, term, groups } = await this.mine(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach.");
    const topic = this.weeksOf(await this.schemes(session.schoolId, term.id, subjectId, group.classIds), Math.max(term.weeks, WEEKS_DEFAULT), term.week).find((entry) => entry.week === week);
    if (!topic?.planned) throw new BadRequestException("Plan this week in the scheme of work first.");
    const existing = await prisma.lessonPlan.findFirst({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, termId: term.id, weekNumber: week, deletedAt: null } });
    return { me, term, group, topic, existing };
  }

  async saveNote(session: SessionPayload, subjectId: string, week: number, body: unknown) {
    const input = noteSchema.parse(body);
    const { me, term, group, topic, existing } = await this.ownedPlan(session, subjectId, week);
    if (existing && (existing.status === "SUBMITTED" || existing.status === "APPROVED")) throw new BadRequestException(existing.status === "APPROVED" ? "This note is signed. Revise it to make a new version for signing." : "This note is with the reviewer. Withdraw it to edit.");
    const sections = Object.fromEntries(NOTE_SECTIONS.map((section) => [section.key, String(input.sections[section.key] ?? "").slice(0, 20_000)]));
    const data = { sections: sections as Prisma.InputJsonValue, objectives: sections.obj || "—", resources: sections.res || null, topic: topic.topic, classIds: group.classIds, classId: group.classIds[0] ?? null, departmentId: me.department?.id ?? null };
    const plan = existing
      ? await prisma.lessonPlan.update({ where: { id: existing.id }, data })
      : await prisma.lessonPlan.create({ data: { schoolId: session.schoolId, academicSessionId: (await prisma.term.findUniqueOrThrow({ where: { id: term.id }, select: { academicSessionId: true } })).academicSessionId, termId: term.id, subjectId, teacherId: session.userId, weekNumber: week, status: "DRAFT", ...data } });
    return { id: plan.id, state: stateOf(plan.status), written: Object.values(sections).filter((value) => value.trim()).length };
  }

  async withdraw(session: SessionPayload, subjectId: string, week: number) {
    const { existing } = await this.ownedPlan(session, subjectId, week);
    if (!existing || existing.status !== "SUBMITTED") throw new BadRequestException("Only a note that is with the reviewer can be withdrawn.");
    await prisma.lessonPlan.update({ where: { id: existing.id }, data: { status: "DRAFT", submittedAt: null, resubmitReply: null } });
    return { subjectId, week };
  }

  async revise(session: SessionPayload, subjectId: string, week: number) {
    const { existing } = await this.ownedPlan(session, subjectId, week);
    if (!existing || existing.status !== "APPROVED") throw new BadRequestException("Only a signed note can be revised.");
    await prisma.lessonPlan.update({ where: { id: existing.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null, submittedAt: null } });
    return { subjectId, week };
  }

  async submitNote(session: SessionPayload, subjectId: string, week: number, body: unknown) {
    const input = submitSchema.parse(body);
    const { me, existing } = await this.ownedPlan(session, subjectId, week);
    if (!existing) throw new BadRequestException("Write the note before you submit it.");
    if (existing.status === "SUBMITTED" || existing.status === "APPROVED") throw new BadRequestException("That note has already been submitted.");
    const sections = (existing.sections ?? {}) as Record<string, string>;
    const missing = NOTE_SECTIONS.filter((section) => section.required && !String(sections[section.key] ?? "").trim()).map((section) => section.label);
    if (missing.length) throw new BadRequestException(`These sections are required before a note can be submitted: ${missing.join(", ")}.`);
    if (existing.status === "RETURNED" && !input.reply) throw new BadRequestException("Say what you changed — the reviewer reads it.");
    const signer = await this.signerOf(session, me);
    await prisma.lessonPlan.update({ where: { id: existing.id }, data: { status: "SUBMITTED", submittedAt: new Date(), rejectedAt: null, returnedSection: null, resubmitReply: existing.status === "RETURNED" ? input.reply ?? null : null } });
    if (signer) await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: signer.id, channel: "IN_APP", title: "A lesson note is waiting to be signed", body: `${me.person.name} · ${existing.topic} · week ${week}`, status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "LessonPlan", entityId: existing.id, metadata: { summary: `Lesson note submitted · week ${week} · ${existing.topic}`, resubmitted: existing.status === "RETURNED" } } });
    return { subjectId, week, to: signer ? fullName(signer) : "the reviewer" };
  }

  /* ───────────────────────── review and coverage ───────────────────────── */

  /** The notes a reviewer may sign: a head of department's own department (never their own), or — for leadership — every note. */
  private async reviewScope(session: SessionPayload) {
    const leader = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMINISTRATOR", "SUPER_ADMIN"]);
    if (leader.has(session.role)) return { all: true as const, departmentId: null as string | null };
    if (session.role === "HEAD_OF_DEPARTMENT") {
      const profile = await prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { departmentId: true } });
      if (profile?.departmentId) return { all: false as const, departmentId: profile.departmentId };
    }
    throw new ForbiddenException("Notes are signed by a head of department or the school's leadership.");
  }

  async review(session: SessionPayload) {
    const scope = await this.reviewScope(session);
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, select: { id: true, name: true, startDate: true, endDate: true, academicSession: { select: { name: true } } } });
    if (!term) throw new NotFoundException("No term is current.");
    const week = Math.max(1, Math.floor((Date.now() - term.startDate.getTime()) / (7 * 86_400_000)) + 1);
    const where: Prisma.LessonPlanWhereInput = { schoolId: session.schoolId, termId: term.id, deletedAt: null, ...(scope.all ? {} : { departmentId: scope.departmentId }) };
    const plans = await prisma.lessonPlan.findMany({ where, include: { teacher: { select: { id: true, firstName: true, lastName: true, role: true } }, subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } } }, orderBy: [{ weekNumber: "desc" }, { submittedAt: "asc" }], take: 300 });
    const mineOwn = (teacherId: string) => teacherId === session.userId;
    const arms = await prisma.classRoom.findMany({ where: { id: { in: [...new Set(plans.flatMap((plan) => plan.classIds))] } }, select: { id: true, name: true, arm: true } });
    const armOf = new Map(arms.map((room) => [room.id, armName(room)]));
    const rows = plans.map((plan) => ({
      id: plan.id, week: plan.weekNumber, topic: plan.topic, subject: plan.subject.name, arms: plan.classIds.length ? plan.classIds.map((id) => armOf.get(id) ?? "").filter(Boolean) : plan.classRoom ? [armName(plan.classRoom)] : [], teacherId: plan.teacherId, teacher: mineOwn(plan.teacherId) ? "You" : fullName(plan.teacher), role: plan.teacher.role,
      state: stateOf(plan.status), own: mineOwn(plan.teacherId), canSign: plan.status === "SUBMITTED" && !mineOwn(plan.teacherId) && (scope.all || true), at: (plan.submittedAt ?? plan.updatedAt).toISOString(), resubmitted: Boolean(plan.resubmitReply && plan.status === "SUBMITTED")
    }));
    const waiting = rows.filter((entry) => entry.state === "Submitted" && !entry.own);
    return { scope: scope.all ? "school" : "department", term: { name: term.name, session: term.academicSession.name, week }, rows, waiting: waiting.length, signed: rows.filter((entry) => entry.state === "Approved").length, returned: rows.filter((entry) => entry.state === "Returned").length };
  }

  async readNote(session: SessionPayload, planId: string) {
    const scope = await this.reviewScope(session);
    const plan = await prisma.lessonPlan.findFirst({ where: { id: planId, schoolId: session.schoolId, deletedAt: null, ...(scope.all ? {} : { departmentId: scope.departmentId }) }, include: { teacher: { select: { firstName: true, lastName: true } }, subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } } } });
    if (!plan) throw new NotFoundException("That note is not in your scope.");
    const rooms = plan.classIds.length ? await prisma.classRoom.findMany({ where: { id: { in: plan.classIds } }, select: { name: true, arm: true } }) : plan.classRoom ? [plan.classRoom] : [];
    return { id: plan.id, subject: plan.subject.name, topic: plan.topic, week: plan.weekNumber, arms: rooms.map((room) => armName(room)), teacher: fullName(plan.teacher), state: stateOf(plan.status), sections: NOTE_SECTIONS, text: (plan.sections ?? {}) as Record<string, string>, own: plan.teacherId === session.userId, canSign: plan.status === "SUBMITTED" && plan.teacherId !== session.userId };
  }

  async decide(session: SessionPayload, planId: string, body: unknown) {
    const input = decideSchema.parse(body);
    const scope = await this.reviewScope(session);
    const plan = await prisma.lessonPlan.findFirst({ where: { id: planId, schoolId: session.schoolId, deletedAt: null, ...(scope.all ? {} : { departmentId: scope.departmentId }) }, include: { subject: { select: { name: true } } } });
    if (!plan) throw new NotFoundException("That note is not in your scope.");
    if (plan.teacherId === session.userId) throw new ForbiddenException("You wrote this note, so someone else must sign it — it goes to the academic lead.");
    if (plan.status !== "SUBMITTED") throw new BadRequestException("Only a note that has been submitted can be signed or returned.");
    if (input.decision === "return" && !(input.note ?? "").trim()) throw new BadRequestException("Say what to change — a return without a comment cannot be acted on.");
    const stamp = new Date();
    await prisma.lessonPlan.update({ where: { id: plan.id }, data: input.decision === "sign" ? { status: "APPROVED", approvedAt: stamp, approvedById: session.userId, reviewNote: null, returnedSection: null } : { status: "RETURNED", rejectedAt: stamp, reviewNote: input.note ?? null, returnedSection: input.section || null } });
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: plan.teacherId, channel: "IN_APP", title: input.decision === "sign" ? "Your lesson note was signed" : "Your lesson note was returned", body: `${plan.subject.name} · week ${plan.weekNumber} · ${plan.topic}${input.note ? ` — ${input.note}` : ""}`, status: "QUEUED", sentAt: stamp } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: input.decision === "sign" ? AuditAction.APPROVE : AuditAction.UPDATE, entityType: "LessonPlan", entityId: plan.id, metadata: { summary: `Lesson note ${input.decision === "sign" ? "signed" : "returned"} · week ${plan.weekNumber} · ${plan.topic}` } } });
    return { id: plan.id, state: input.decision === "sign" ? "Approved" : "Returned" };
  }

  async coverage(session: SessionPayload) {
    const scope = await this.reviewScope(session);
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, select: { id: true, name: true, startDate: true, endDate: true, academicSession: { select: { name: true } } } });
    if (!term) throw new NotFoundException("No term is current.");
    const week = Math.max(1, Math.floor((Date.now() - term.startDate.getTime()) / (7 * 86_400_000)) + 1);
    const classSubjects = await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, ...(scope.all ? {} : { subject: { departmentId: scope.departmentId } }) }, include: { subject: { select: { name: true } }, classRoom: { select: { id: true, name: true, arm: true } } }, take: 400 });
    const teachers = await prisma.user.findMany({ where: { id: { in: classSubjects.map((row) => row.teacherId ?? "").filter(Boolean) } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(teachers.map((user) => [user.id, fullName(user)]));
    const schemes = await prisma.schemeOfWork.findMany({ where: { schoolId: session.schoolId, termId: term.id, classId: { in: classSubjects.map((row) => row.classId) } }, include: { topics: { select: { weekNumber: true, topic: true, isCovered: true } } } });
    const rows = classSubjects.map((row) => {
      const scheme = schemes.find((entry) => entry.classId === row.classId && entry.subjectId === row.subjectId);
      const planned = (scheme?.topics ?? []).filter((topic) => !PLACEHOLDER.test(topic.topic));
      const expected = planned.filter((topic) => topic.weekNumber <= week).length;
      const reached = planned.filter((topic) => topic.isCovered).length;
      return { subject: row.subject.name, arm: armName(row.classRoom), teacher: row.teacherId === session.userId ? "You" : row.teacherId ? nameOf.get(row.teacherId) ?? "—" : "Nobody named", expected, reached, state: !scheme || !planned.length ? "No scheme on file" : reached >= expected ? "On schedule" : "Behind" };
    }).sort((a, b) => a.subject.localeCompare(b.subject) || a.arm.localeCompare(b.arm));
    const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
    const reachedTotal = rows.reduce((sum, row) => sum + Math.min(row.reached, row.expected), 0);
    return { scope: scope.all ? "school" : "department", term: { name: term.name, session: term.academicSession.name, week }, rows, kpis: { onSchedule: rows.filter((row) => row.state === "On schedule").length, behind: rows.filter((row) => row.state === "Behind").length, none: rows.filter((row) => row.state === "No scheme on file").length, covered: expectedTotal ? Math.round((reachedTotal / expectedTotal) * 100) : null, total: rows.length } };
  }
}

const stateOf = (status: string) => (status === "DRAFT" ? "Draft" : status === "SUBMITTED" ? "Submitted" : status === "APPROVED" ? "Approved" : status === "RETURNED" ? "Returned" : status);
