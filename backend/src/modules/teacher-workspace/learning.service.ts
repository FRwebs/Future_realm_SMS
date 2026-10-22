import { randomBytes } from "node:crypto";

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";
import { store } from "../staff-access/staff-access.shared";
import { TeacherWorkspaceService } from "./workspace.service";

const DAY = 86_400_000;
export const SECTIONS = ["School courses", "Safeguarding and welfare", "Teaching practice", "Subject knowledge", "Assessment", "Digital skills", "Leadership"];
const PERSONAS = ["form-master", "head-of-department", "subject-teacher", "early-years", "teaching-assistant", "cover"];
const FORMATS = ["Self-paced", "Blended", "Live cohort"];

const dateLabel = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const code = () => `FR-${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
const lines = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : []);

const courseSchema = z.object({
  title: z.string().trim().min(4, "Name the course."),
  summary: z.string().trim().optional(),
  section: z.string().default("School courses"),
  provider: z.string().trim().optional(),
  hours: z.coerce.number().min(0.25, "Say how long it takes.").max(80),
  format: z.string().default("Self-paced"),
  certificateName: z.string().trim().min(3, "Name the certificate it earns."),
  validMonths: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().int().min(1).max(120).nullable()),
  pathway: z.string().trim().optional(),
  outcomes: z.union([z.string(), z.array(z.string())]).optional(),
  task: z.string().trim().optional(),
  personas: z.array(z.string()).default([]),
  subjects: z.union([z.string(), z.array(z.string())]).optional(),
  requiredFor: z.array(z.string()).default([]),
  requiredBy: z.string().optional(),
  requiredNote: z.string().trim().optional()
});
const lessonSchema = z.object({
  title: z.string().trim().min(3, "Name the lesson."),
  minutes: z.coerce.number().int().min(1).max(240).default(10),
  body: z.string().trim().min(20, "Write the lesson itself — a sentence is not a lesson."),
  question: z.string().trim().min(5, "Every lesson ends with one question."),
  options: z.union([z.string(), z.array(z.string())]).transform((value) => lines(value)).refine((value) => value.length >= 2 && value.length <= 6, "Give between two and six answers, one per line."),
  correct: z.coerce.number().int().min(0),
  explanation: z.string().trim().optional()
});

/**
 * Training and CPD. A course is lessons that each end in one question, and a certificate that is the person's own and carries a code
 * anyone can check. The school sees that a course was finished — never the answers. A course is written by the school: this build has
 * no platform course library yet, so nothing in the catalogue is anything but what the school authored.
 */
@Injectable()
export class LearningService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  /* ───────────────────────── what a person sees ───────────────────────── */

  private async context(session: SessionPayload) {
    const me = await this.workspace.me(session);
    const subjects = me.teaching.map((row) => row.subject.toLowerCase());
    return { me, subjects };
  }

  private fits(course: { personas: string[]; subjects: string[] }, persona: string, subjects: string[]) {
    if (course.personas.length && !course.personas.includes(persona)) return false;
    if (course.subjects.length && persona !== "head-of-department") return subjects.some((subject) => course.subjects.some((word) => subject.includes(word.toLowerCase())));
    return true;
  }

  private async visible(session: SessionPayload) {
    const { me, subjects } = await this.context(session);
    const [courses, enrolments, certificates] = await Promise.all([
      prisma.trainingCourse.findMany({ where: { schoolId: session.schoolId, archivedAt: null, publishedAt: { not: null } }, include: { _count: { select: { lessons: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.trainingEnrolment.findMany({ where: { schoolId: session.schoolId, userId: session.userId } }),
      prisma.trainingCertificate.findMany({ where: { schoolId: session.schoolId, userId: session.userId }, orderBy: { issuedAt: "desc" } })
    ]);
    const now = Date.now();
    const shaped = courses.filter((course) => this.fits(course, me.persona, subjects)).map((course) => {
      const enrolment = enrolments.find((entry) => entry.courseId === course.id);
      const done = enrolment?.completedLessons.length ?? 0;
      const lessons = course._count.lessons;
      const completed = Boolean(enrolment?.completedAt) || (lessons > 0 && done >= lessons);
      const required = course.requiredFor.length > 0 && (course.requiredFor.includes(me.persona) || course.requiredFor.includes("all")) && !completed;
      const dueDays = required && course.requiredBy ? Math.ceil((course.requiredBy.getTime() - now) / DAY) : null;
      return {
        id: course.id, title: course.title, summary: course.summary, section: course.section, provider: course.provider, hours: course.hours, format: course.format, certificateName: course.certificateName, validMonths: course.validMonths, pathway: course.pathway,
        lessons, done, completed, state: completed ? "Completed" : done ? "In progress" : required ? "Required" : "Not started", required, requiredBy: course.requiredBy?.toISOString() ?? null, requiredNote: course.requiredNote, dueDays, outcomes: course.outcomes
      };
    });
    return { me, subjects, courses: shaped, certificates };
  }

  private certView(cert: { id: string; name: string; issuedBy: string; issuedAt: Date; expiresAt: Date | null; hours: number; code: string; state: string; external: boolean; courseId: string | null; note: string | null }) {
    const days = cert.expiresAt ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / DAY) : null;
    const state = cert.state === "PENDING" ? "Pending" : cert.state === "REJECTED" ? "Not accepted" : days !== null && days < 0 ? "Expired" : days !== null && days <= 60 ? "Expiring" : "Valid";
    return { id: cert.id, name: cert.name, by: cert.issuedBy, issued: dateLabel(cert.issuedAt), issuedAt: cert.issuedAt.toISOString(), expires: cert.expiresAt ? dateLabel(cert.expiresAt) : "Does not expire", expiresAt: cert.expiresAt?.toISOString() ?? null, days, hours: cert.hours, code: cert.code, state, external: cert.external, courseId: cert.courseId, note: cert.note };
  }

  private async cpd(schoolId: string, certificates: Array<{ issuedAt: Date; hours: number; state: string }>) {
    const sessionRow = await prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true }, select: { startDate: true, endDate: true } });
    const now = new Date();
    // The school's session when today is inside it; otherwise the last twelve months, so a lapsed calendar never hides what was earned.
    const inside = sessionRow && sessionRow.startDate <= now && sessionRow.endDate >= now;
    const from = inside ? sessionRow.startDate : new Date(now.getTime() - 365 * DAY);
    const to = inside ? sessionRow.endDate : now;
    const hours = certificates.filter((cert) => cert.state === "VALID" && cert.issuedAt >= from && cert.issuedAt <= to).reduce((sum, cert) => sum + cert.hours, 0);
    const policy = await store(schoolId, "learning-policy").get<{ cpdTarget?: number | null }>("policy");
    return { hours: Math.round(hours * 10) / 10, target: policy?.data.cpdTarget ?? null };
  }

  async home(session: SessionPayload) {
    const { me, subjects, courses, certificates } = await this.visible(session);
    const certs = certificates.map((cert) => this.certView(cert));
    const expiring = certs.filter((cert) => cert.state === "Expiring" || cert.state === "Expired");
    const recs: Array<{ course: (typeof courses)[number]; why: string }> = [];
    for (const course of courses) {
      if (course.completed || course.required) continue;
      const renew = expiring.find((cert) => cert.name.toLowerCase() === course.certificateName.toLowerCase());
      const subject = subjects.find((name) => (course as { title: string }).title.toLowerCase().includes(name));
      if (renew) recs.push({ course, why: `${renew.name} ${renew.state === "Expired" ? "has expired" : `expires ${renew.expires}`} — this renews it.` });
      else if (course.pathway && !certs.some((cert) => cert.courseId === course.id)) recs.push({ course, why: `It counts towards ${course.pathway}, which your school sets out for its staff.` });
      else if (subject) recs.push({ course, why: `You teach ${subject.replace(/^./, (c) => c.toUpperCase())}, and it is written for that.` });
    }
    const pathways = [...new Set(courses.map((course) => course.pathway).filter(Boolean) as string[])].map((name) => {
      const members = courses.filter((course) => course.pathway === name);
      const done = members.filter((course) => course.completed).length;
      return { name, total: members.length, done, titles: members.map((course) => course.title) };
    });
    const cpd = await this.cpd(session.schoolId, certificates);
    return {
      persona: me.persona, cpd, required: courses.filter((course) => course.required).sort((a, b) => (a.dueDays ?? 9999) - (b.dueDays ?? 9999)),
      inProgress: courses.filter((course) => course.state === "In progress" && !course.required), recommended: recs.slice(0, 3), pathways, certificates: certs.length, expiring: expiring[0] ?? null,
      total: courses.length, completed: courses.filter((course) => course.completed).length
    };
  }

  async catalogue(session: SessionPayload) {
    const { courses } = await this.visible(session);
    return { sections: SECTIONS, courses: courses.sort((a, b) => Number(b.required) - Number(a.required) || a.title.localeCompare(b.title)) };
  }

  async certificates(session: SessionPayload) {
    const { certificates } = await this.visible(session);
    const cpd = await this.cpd(session.schoolId, certificates);
    const person = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const school = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } });
    return { cpd, holder: person ? fullName(person) : "", school: school?.name ?? "", certificates: certificates.map((cert) => this.certView(cert)) };
  }

  async course(session: SessionPayload, id: string) {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null }, include: { lessons: { orderBy: { position: "asc" }, select: { position: true, title: true, minutes: true, body: true } } } });
    if (!course) throw new NotFoundException("That course is not open to you.");
    const { me, subjects } = await this.context(session);
    if (!this.fits(course, me.persona, subjects)) throw new ForbiddenException("That course is not written for your work.");
    const [enrolment, cert] = await Promise.all([
      prisma.trainingEnrolment.findUnique({ where: { courseId_userId: { courseId: id, userId: session.userId } } }),
      prisma.trainingCertificate.findFirst({ where: { schoolId: session.schoolId, userId: session.userId, courseId: id }, orderBy: { issuedAt: "desc" } })
    ]);
    const done = enrolment?.completedLessons ?? [];
    const required = course.requiredFor.length > 0 && (course.requiredFor.includes(me.persona) || course.requiredFor.includes("all"));
    return {
      id: course.id, title: course.title, summary: course.summary, provider: course.provider, hours: course.hours, format: course.format, certificateName: course.certificateName, validMonths: course.validMonths, outcomes: course.outcomes, task: course.task,
      required: required ? { by: course.requiredBy?.toISOString() ?? null, note: course.requiredNote } : null,
      lessons: course.lessons.map((lesson) => ({ position: lesson.position, title: lesson.title, minutes: lesson.minutes, summary: lesson.body.split(/(?<=[.!?])\s/)[0] ?? "", done: done.includes(lesson.position) })),
      done: done.length, completed: Boolean(enrolment?.completedAt), certificate: cert ? this.certView(cert) : null
    };
  }

  async lesson(session: SessionPayload, id: string, position: number) {
    const course = await this.course(session, id);
    const lesson = await prisma.trainingLesson.findUnique({ where: { courseId_position: { courseId: id, position } } });
    if (!lesson) throw new NotFoundException("That lesson does not exist.");
    // A person cannot skip ahead of what they have finished.
    const firstOpen = course.lessons.find((entry) => !entry.done)?.position ?? course.lessons.length + 1;
    if (position > firstOpen) throw new BadRequestException("Finish the lessons before this one first.");
    // The correct answer is never sent to the reader — it is checked on the server.
    return { course: { id: course.id, title: course.title, hours: course.hours, certificateName: course.certificateName, provider: course.provider, required: course.required, lessonsTotal: course.lessons.length, done: course.done }, outline: course.lessons.map((entry) => ({ position: entry.position, title: entry.title, minutes: entry.minutes, done: entry.done })), lesson: { position, title: lesson.title, minutes: lesson.minutes, body: lesson.body, question: lesson.question, options: lesson.options, done: course.lessons.find((entry) => entry.position === position)?.done ?? false } };
  }

  async answer(session: SessionPayload, id: string, position: number, body: unknown) {
    const input = z.object({ choice: z.coerce.number().int().min(0) }).parse(body);
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null }, include: { lessons: { orderBy: { position: "asc" } } } });
    if (!course) throw new NotFoundException("That course is not open to you.");
    const lesson = course.lessons.find((entry) => entry.position === position);
    if (!lesson) throw new NotFoundException("That lesson does not exist.");
    const enrolment = await prisma.trainingEnrolment.upsert({ where: { courseId_userId: { courseId: id, userId: session.userId } }, update: {}, create: { schoolId: session.schoolId, courseId: id, userId: session.userId } });
    if (enrolment.completedLessons.includes(position)) return { correct: true, already: true, finished: Boolean(enrolment.completedAt), explanation: lesson.explanation ?? "" };
    const firstOpen = course.lessons.find((entry) => !enrolment.completedLessons.includes(entry.position))?.position ?? 0;
    if (position > firstOpen) throw new BadRequestException("Finish the lessons before this one first.");
    if (input.choice !== lesson.correctIndex) throw new BadRequestException(`Not quite — try another answer. ${(lesson.explanation ?? "").split(/(?<=[.!?])\s/)[0] ?? ""}`.trim());
    const completed = [...new Set([...enrolment.completedLessons, position])].sort((a, b) => a - b);
    const finished = completed.length >= course.lessons.length;
    let certificate: { code: string } | null = null;
    await prisma.trainingEnrolment.update({ where: { id: enrolment.id }, data: { completedLessons: completed, ...(finished ? { completedAt: new Date() } : {}) } });
    if (finished) {
      const issuedAt = new Date();
      const expiresAt = course.validMonths ? new Date(Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth() + course.validMonths, issuedAt.getUTCDate())) : null;
      const school = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } });
      const created = await prisma.trainingCertificate.create({ data: { schoolId: session.schoolId, userId: session.userId, courseId: course.id, name: course.certificateName, issuedBy: course.provider || school?.name || "The school", issuedAt, expiresAt, hours: course.hours, code: code(), state: "VALID" } });
      certificate = { code: created.code };
      await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "TrainingCertificate", entityId: created.id, metadata: { summary: `Course finished · ${course.title}`, certificate: course.certificateName } } });
    }
    return { correct: true, finished, certificate, explanation: lesson.explanation ?? "", next: finished ? null : course.lessons.find((entry) => !completed.includes(entry.position))?.position ?? null };
  }

  async addExternal(session: SessionPayload, body: unknown) {
    const input = z
      .object({ name: z.string().trim().min(3, "Name the certificate."), issuedBy: z.string().trim().min(2, "Say who issued it."), issuedOn: z.string().min(1, "Give the date it was issued."), expiresOn: z.string().optional(), hours: z.coerce.number().min(0).max(500).optional(), evidence: z.string().optional() })
      .parse(body);
    const issuedAt = new Date(input.issuedOn);
    if (Number.isNaN(issuedAt.getTime()) || issuedAt > new Date()) throw new BadRequestException("A certificate cannot be issued in the future.");
    const expiresAt = input.expiresOn ? new Date(input.expiresOn) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new BadRequestException("Give a real expiry date, or leave it blank.");
    const evidence = input.evidence && input.evidence.startsWith("data:") && input.evidence.length < 2_500_000 ? input.evidence : null;
    const created = await prisma.trainingCertificate.create({ data: { schoolId: session.schoolId, userId: session.userId, name: input.name, issuedBy: input.issuedBy, issuedAt, expiresAt, hours: input.hours ?? 0, code: code(), state: "PENDING", external: true, evidence } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "TrainingCertificate", entityId: created.id, metadata: { summary: `Outside certificate filed · ${input.name}` } } });
    return { id: created.id };
  }

  async suggest(session: SessionPayload, body: unknown) {
    const input = z.object({ topic: z.string().trim().min(4, "Say what you want to learn."), why: z.string().trim().optional() }).parse(body);
    const created = await prisma.trainingSuggestion.create({ data: { schoolId: session.schoolId, userId: session.userId, topic: input.topic, why: input.why || null } });
    return { id: created.id };
  }

  /** Anyone may check a certificate against its code. Only what a verifier needs is returned: never the person's other details. */
  async verify(codeValue: string) {
    const cert = await prisma.trainingCertificate.findUnique({ where: { code: codeValue.toUpperCase() } });
    if (!cert || cert.state !== "VALID") return { valid: false };
    const person = await prisma.user.findUnique({ where: { id: cert.userId }, select: { firstName: true, lastName: true } });
    const school = await prisma.school.findUnique({ where: { id: cert.schoolId }, select: { name: true } });
    const view = this.certView(cert);
    return { valid: view.state !== "Expired", state: view.state, certificate: cert.name, holder: person ? `${person.firstName} ${person.lastName.charAt(0)}.` : "", issuedBy: cert.issuedBy, school: school?.name ?? "", issuedAt: cert.issuedAt.toISOString(), expiresAt: cert.expiresAt?.toISOString() ?? null };
  }

  /* ───────────────────────── what the school manages ───────────────────────── */

  async manage(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [courses, enrolments, pending, suggestions, staff, policy] = await Promise.all([
      prisma.trainingCourse.findMany({ where: { schoolId }, include: { _count: { select: { lessons: true } } }, orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }] }),
      prisma.trainingEnrolment.findMany({ where: { schoolId } }),
      prisma.trainingCertificate.findMany({ where: { schoolId, state: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100 }),
      prisma.trainingSuggestion.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.user.count({ where: { schoolId, isActive: true, deletedAt: null, staffProfile: { isNot: null }, role: { in: ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT"] } } }),
      store(schoolId, "learning-policy").get<{ cpdTarget?: number | null }>("policy")
    ]);
    const people = await prisma.user.findMany({ where: { id: { in: [...new Set([...pending.map((cert) => cert.userId), ...suggestions.map((entry) => entry.userId)])] } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((person) => [person.id, fullName(person)]));
    return {
      staff, cpdTarget: policy?.data.cpdTarget ?? null, sections: SECTIONS, personas: PERSONAS, formats: FORMATS,
      courses: courses.map((course) => {
        const entries = enrolments.filter((entry) => entry.courseId === course.id);
        return { id: course.id, title: course.title, section: course.section, hours: course.hours, format: course.format, certificateName: course.certificateName, lessons: course._count.lessons, published: Boolean(course.publishedAt), archived: Boolean(course.archivedAt), required: course.requiredFor.length > 0, requiredBy: course.requiredBy?.toISOString() ?? null, requiredFor: course.requiredFor, started: entries.length, finished: entries.filter((entry) => entry.completedAt).length };
      }),
      pending: pending.map((cert) => ({ id: cert.id, who: nameOf.get(cert.userId) ?? "", name: cert.name, issuedBy: cert.issuedBy, issued: dateLabel(cert.issuedAt), hours: cert.hours, hasFile: Boolean(cert.evidence), filed: dateLabel(cert.createdAt) })),
      suggestions: suggestions.map((entry) => ({ id: entry.id, who: nameOf.get(entry.userId) ?? "", topic: entry.topic, why: entry.why, at: dateLabel(entry.createdAt) }))
    };
  }

  async manageCourse(session: SessionPayload, id: string) {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId }, include: { lessons: { orderBy: { position: "asc" } } } });
    if (!course) throw new NotFoundException("That course does not exist.");
    const [started, finished] = await Promise.all([prisma.trainingEnrolment.count({ where: { courseId: id } }), prisma.trainingEnrolment.count({ where: { courseId: id, completedAt: { not: null } } })]);
    return {
      id: course.id, title: course.title, summary: course.summary, section: course.section, provider: course.provider, hours: course.hours, format: course.format, certificateName: course.certificateName, validMonths: course.validMonths, pathway: course.pathway, outcomes: course.outcomes, task: course.task, personas: course.personas, subjects: course.subjects, requiredFor: course.requiredFor, requiredBy: course.requiredBy?.toISOString().slice(0, 10) ?? null, requiredNote: course.requiredNote,
      published: Boolean(course.publishedAt), archived: Boolean(course.archivedAt), started, finished, sections: SECTIONS, personaOptions: PERSONAS, formats: FORMATS,
      lessons: course.lessons.map((lesson) => ({ position: lesson.position, title: lesson.title, minutes: lesson.minutes, body: lesson.body, question: lesson.question, options: lesson.options, correct: lesson.correctIndex, explanation: lesson.explanation }))
    };
  }

  private async schoolName(schoolId: string) {
    return (await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }))?.name ?? "The school";
  }

  async createCourse(session: SessionPayload, body: unknown) {
    const input = courseSchema.parse(body);
    const created = await prisma.trainingCourse.create({
      data: {
        schoolId: session.schoolId, title: input.title, summary: input.summary || null, section: input.section, provider: input.provider || (await this.schoolName(session.schoolId)), hours: input.hours, format: FORMATS.includes(input.format) ? input.format : "Self-paced",
        certificateName: input.certificateName, validMonths: input.validMonths, pathway: input.pathway || null, outcomes: lines(input.outcomes), task: input.task || null, personas: input.personas.filter((item) => PERSONAS.includes(item)), subjects: lines(input.subjects),
        requiredFor: input.requiredFor, requiredBy: input.requiredBy ? new Date(input.requiredBy) : null, requiredNote: input.requiredNote || null, createdById: session.userId
      }
    });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "TrainingCourse", entityId: created.id, metadata: { summary: `Course created · ${input.title}` } } });
    return { id: created.id };
  }

  async updateCourse(session: SessionPayload, id: string, body: unknown) {
    const input = courseSchema.parse(body);
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!course) throw new NotFoundException("That course does not exist.");
    await prisma.trainingCourse.update({
      where: { id },
      data: { title: input.title, summary: input.summary || null, section: input.section, provider: input.provider || course.provider, hours: input.hours, format: FORMATS.includes(input.format) ? input.format : course.format, certificateName: input.certificateName, validMonths: input.validMonths, pathway: input.pathway || null, outcomes: lines(input.outcomes), task: input.task || null, personas: input.personas.filter((item) => PERSONAS.includes(item)), subjects: lines(input.subjects), requiredFor: input.requiredFor, requiredBy: input.requiredBy ? new Date(input.requiredBy) : null, requiredNote: input.requiredNote || null }
    });
    return { id };
  }

  async saveLesson(session: SessionPayload, id: string, position: number | null, body: unknown) {
    const input = lessonSchema.parse(body);
    if (input.correct >= input.options.length) throw new BadRequestException("Mark one of the answers as the right one.");
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId }, include: { _count: { select: { lessons: true } } } });
    if (!course) throw new NotFoundException("That course does not exist.");
    if (position === null) {
      const next = course._count.lessons + 1;
      await prisma.trainingLesson.create({ data: { courseId: id, position: next, title: input.title, minutes: input.minutes, body: input.body, question: input.question, options: input.options, correctIndex: input.correct, explanation: input.explanation || null } });
      return { position: next };
    }
    await prisma.trainingLesson.update({ where: { courseId_position: { courseId: id, position } }, data: { title: input.title, minutes: input.minutes, body: input.body, question: input.question, options: input.options, correctIndex: input.correct, explanation: input.explanation || null } });
    return { position };
  }

  async removeLesson(session: SessionPayload, id: string, position: number) {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!course) throw new NotFoundException("That course does not exist.");
    if (course.publishedAt && (await prisma.trainingEnrolment.count({ where: { courseId: id } }))) throw new BadRequestException("People have started this course, so a lesson cannot be taken out from under them. Archive it and write a new one.");
    await prisma.trainingLesson.delete({ where: { courseId_position: { courseId: id, position } } });
    const rest = await prisma.trainingLesson.findMany({ where: { courseId: id }, orderBy: { position: "asc" } });
    for (const [index, lesson] of rest.entries()) if (lesson.position !== index + 1) await prisma.trainingLesson.update({ where: { id: lesson.id }, data: { position: index + 1 } });
    return { id };
  }

  async setPublished(session: SessionPayload, id: string, state: "publish" | "archive" | "restore") {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId }, include: { _count: { select: { lessons: true } } } });
    if (!course) throw new NotFoundException("That course does not exist.");
    if (state === "publish") {
      if (!course._count.lessons) throw new BadRequestException("A course with no lessons cannot be published.");
      await prisma.trainingCourse.update({ where: { id }, data: { publishedAt: new Date(), archivedAt: null } });
    } else if (state === "archive") await prisma.trainingCourse.update({ where: { id }, data: { archivedAt: new Date() } });
    else await prisma.trainingCourse.update({ where: { id }, data: { archivedAt: null } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "TrainingCourse", entityId: id, metadata: { summary: `Course ${state}d · ${course.title}`.replace("archived", "archived").replace("restored", "restored") } } });
    return { id, state };
  }

  async decideCertificate(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ decision: z.enum(["verify", "reject"]), note: z.string().trim().optional() }).parse(body);
    const cert = await prisma.trainingCertificate.findFirst({ where: { id, schoolId: session.schoolId, state: "PENDING" } });
    if (!cert) throw new NotFoundException("That certificate is not waiting to be verified.");
    if (input.decision === "reject" && !input.note) throw new BadRequestException("Say why it is not accepted — the person reads it.");
    await prisma.trainingCertificate.update({ where: { id }, data: { state: input.decision === "verify" ? "VALID" : "REJECTED", verifiedById: session.userId, verifiedAt: new Date(), note: input.note || null } });
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: cert.userId, channel: "IN_APP", title: input.decision === "verify" ? "Your certificate was verified" : "Your certificate was not accepted", body: `${cert.name}${input.note ? ` — ${input.note}` : ""}`, status: "QUEUED", sentAt: new Date() } });
    return { id, decision: input.decision };
  }

  async setPolicy(session: SessionPayload, body: unknown) {
    const input = z.object({ cpdTarget: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().min(0).max(500).nullable()) }).parse(body);
    await store(session.schoolId, "learning-policy").put("policy", "Learning policy", { cpdTarget: input.cpdTarget });
    return { cpdTarget: input.cpdTarget };
  }
}
