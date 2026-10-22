import { randomBytes } from "node:crypto";

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";
import { store } from "../staff-access/staff-access.shared";
import { personaLabels } from "../../../../src/lib/modules/teacher-workspace";
import { TeacherNotesService } from "./lesson-notes/notes.service";
import { TeacherScoresService } from "./scores.service";
import { TeacherWorkspaceService } from "./workspace.service";

const DAY = 86_400_000;
/** Prices are held in kobo so no figure is ever a rounded float. */
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
export const SECTIONS = ["School courses", "Safeguarding and welfare", "Teaching practice", "Subject knowledge", "Assessment", "Digital skills", "Leadership"];
const PERSONAS = ["form-master", "head-of-department", "subject-teacher", "early-years", "teaching-assistant", "cover"];
const FORMATS = ["Self-paced", "Blended", "Live cohort"];
/** What a course can be about, in the words the work itself raises. A teacher's classes, results and deadlines raise these; a course carrying one is recommended. */
export const TOPICS = ["assessment", "reporting", "planning", "large classes", "inclusion", "new to the tools"];

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
  /// Taken in naira from the form and held in kobo; blank or zero means free.
  price: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().min(0).max(5_000_000).nullable()).optional(),
  outcomes: z.union([z.string(), z.array(z.string())]).optional(),
  task: z.string().trim().optional(),
  personas: z.array(z.string()).default([]),
  subjects: z.union([z.string(), z.array(z.string())]).optional(),
  topics: z.union([z.string(), z.array(z.string())]).optional(),
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
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly scores: TeacherScoresService, private readonly notes: TeacherNotesService) {}

  /* ───────────────────────── what a person sees ───────────────────────── */

  private async context(session: SessionPayload) {
    const me = await this.workspace.me(session, { anyStaff: true });
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
    const [courses, enrolments, certificates, purchases] = await Promise.all([
      prisma.trainingCourse.findMany({ where: { schoolId: session.schoolId, archivedAt: null, publishedAt: { not: null } }, include: { _count: { select: { lessons: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.trainingEnrolment.findMany({ where: { schoolId: session.schoolId, userId: session.userId } }),
      prisma.trainingCertificate.findMany({ where: { schoolId: session.schoolId, userId: session.userId, state: { not: "SUPERSEDED" } }, orderBy: { issuedAt: "desc" } }),
      prisma.trainingPurchase.findMany({ where: { schoolId: session.schoolId, userId: session.userId } })
    ]);
    const now = Date.now();
    const shaped = courses.filter((course) => this.fits(course, me.persona, subjects)).map((course) => {
      const enrolment = enrolments.find((entry) => entry.courseId === course.id);
      const purchase = purchases.find((entry) => entry.courseId === course.id);
      const free = course.priceKobo === null || course.priceKobo === 0;
      // A free course is open; a paid one is open once it is settled, whoever paid.
      const owned = free || purchase?.state === "APPROVED" || purchase?.state === "PAID";
      const done = enrolment?.completedLessons.length ?? 0;
      const lessons = course._count.lessons;
      const completed = Boolean(enrolment?.completedAt) || (lessons > 0 && done >= lessons);
      const required = course.requiredFor.length > 0 && (course.requiredFor.includes(me.persona) || course.requiredFor.includes("all")) && !completed;
      const dueDays = required && course.requiredBy ? Math.ceil((course.requiredBy.getTime() - now) / DAY) : null;
      return {
        id: course.id, title: course.title, summary: course.summary, section: course.section, provider: course.provider, hours: course.hours, format: course.format, certificateName: course.certificateName, validMonths: course.validMonths, pathway: course.pathway,
        lessons, done, completed,
        // What it costs and where that stands, said separately from how far through it
        // the person is — an unbought course has no progress to report.
        price: free ? null : course.priceKobo, currency: course.currency, free, owned,
        purchase: purchase ? { state: purchase.state, payer: purchase.payer, decision: purchase.decision } : null,
        priceLabel: free ? "Free" : naira(course.priceKobo as number),
        state: !owned
          ? purchase?.state === "BASKET" ? "In your basket" : purchase?.state === "REQUESTED" ? "Asked the school" : purchase?.state === "DECLINED" ? "Not approved" : "Not bought"
          : completed ? "Completed" : done ? "In progress" : required ? "Required" : "Not started",
        required, requiredBy: course.requiredBy?.toISOString() ?? null, requiredNote: course.requiredNote, dueDays, outcomes: course.outcomes
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

  /**
   * What this person's own work is asking for. Each signal is counted from their classes, their sheets, their notes and their remarks —
   * never typed in — and each carries the sentence that says why a course is being put in front of them.
   */
  private async signals(session: SessionPayload, me: Awaited<ReturnType<TeacherWorkspaceService["me"]>>) {
    const out = new Map<string, string>();
    const quietly = async <T,>(work: () => Promise<T>) => { try { return await work(); } catch { return null; } };
    const weak = await quietly(() => this.scores.weakestComponent(session));
    if (weak) out.set("assessment", `${weak.subject} ${weak.arm} loses most marks in ${weak.exam ? "the exam" : weak.name.toLowerCase()} — ${weak.pct}% of the marks available. ${weak.exam ? "Class work is holding up; the examination is where the gap opens." : "Worth a look before the next assessment."}`);
    const form = me.formArms[0];
    if (form && me.term) {
      const written = await prisma.reportRemark.count({ where: { schoolId: session.schoolId, termId: me.term.id, classId: form.id, author: "FORM_MASTER", text: { not: "" } } });
      const left = form.roll - written;
      if (left > 0) out.set("reporting", `${left} remark${left === 1 ? " is" : "s are"} still to write for ${form.name}. This is about how to write them faster, and so that a family reads them.`);
      const plans = await prisma.learningSupportPlan.count({ where: { schoolId: session.schoolId, status: "ACTIVE", studentId: { in: (await prisma.student.findMany({ where: { schoolId: session.schoolId, currentClassId: form.id, status: "ACTIVE" }, select: { id: true } })).map((student) => student.id) } } });
      if (plans) out.set("inclusion", `${plans === 1 ? "One child" : `${plans} children`} in ${form.name} ${plans === 1 ? "has" : "have"} a learning support plan.`);
    }
    const toWrite = await quietly(() => this.notes.landing(session));
    if (toWrite && toWrite.kpis.toWrite > 0) out.set("planning", `${toWrite.kpis.toWrite} lesson note${toWrite.kpis.toWrite === 1 ? " is" : "s are"} still to write this term. It shows how to write one a colleague could teach from.`);
    const classIds = [...new Set(me.teaching.filter((row) => !row.assistant).map((row) => row.classId))];
    if (classIds.length) {
      const sizes = await prisma.student.groupBy({ by: ["currentClassId"], where: { schoolId: session.schoolId, currentClassId: { in: classIds }, status: "ACTIVE" }, _count: true });
      const biggest = sizes.sort((a, b) => b._count - a._count)[0];
      if (biggest && biggest._count >= 30) out.set("large classes", `Your largest class has ${biggest._count} children.`);
    }
    if (me.persona === "cover" || me.persona === "teaching-assistant") out.set("new to the tools", "You are new to these tools this term.");
    return out;
  }

  async home(session: SessionPayload) {
    const { me, subjects, courses, certificates } = await this.visible(session);
    const certs = certificates.map((cert) => this.certView(cert));
    const expiring = certs.filter((cert) => cert.state === "Expiring" || cert.state === "Expired");
    const signals = await this.signals(session, me);
    const topicsOf = new Map((await prisma.trainingCourse.findMany({ where: { id: { in: courses.map((course) => course.id) } }, select: { id: true, topics: true } })).map((row) => [row.id, row.topics]));
    const recs: Array<{ course: (typeof courses)[number]; why: string }> = [];
    for (const course of courses) {
      if (course.completed || course.required) continue;
      const renew = expiring.find((cert) => cert.name.toLowerCase() === course.certificateName.toLowerCase());
      const subject = subjects.find((name) => (course as { title: string }).title.toLowerCase().includes(name));
      const raised = (topicsOf.get(course.id) ?? []).find((topic) => signals.has(topic));
      if (renew) recs.push({ course, why: `${renew.name} ${renew.state === "Expired" ? "has expired" : `expires ${renew.expires}`} — this renews it.` });
      else if (raised) recs.push({ course, why: signals.get(raised) as string });
      else if (course.pathway && !certs.some((cert) => cert.courseId === course.id)) recs.push({ course, why: `It counts towards ${course.pathway}, which your school sets out for its staff.` });
      else if (subject) recs.push({ course, why: `You teach ${subject.replace(/^./, (c) => c.toUpperCase())}, and it is written for that.` });
    }
    // What your own work raises comes first; a pathway or a subject is the fallback.
    recs.sort((a, b) => Number(signals.has((topicsOf.get(b.course.id) ?? []).find((topic) => signals.has(topic)) ?? "")) - Number(signals.has((topicsOf.get(a.course.id) ?? []).find((topic) => signals.has(topic)) ?? "")));
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
    const { me, certificates } = await this.visible(session);
    const cpd = await this.cpd(session.schoolId, certificates);
    const [person, school, head] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } }),
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true, address: true, city: true, mainPhone: true, ownerEmail: true } }),
      prisma.user.findFirst({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: { in: ["PRINCIPAL", "HEAD_TEACHER"] } }, select: { firstName: true, lastName: true, role: true } }),
    ]);
    return {
      cpd, holder: person ? fullName(person) : "", holderRole: personaLabels[me.persona as keyof typeof personaLabels] ?? "Member of staff", school: school?.name ?? "",
      letterhead: { name: school?.name ?? "", place: [school?.address, school?.city].filter(Boolean).join(", "), contact: [school?.mainPhone, school?.ownerEmail].filter(Boolean).join(" · ") },
      signatory: head ? { name: fullName(head), role: `${head.role === "HEAD_TEACHER" ? "Head Teacher" : "Principal"}, ${school?.name ?? ""}` } : null,
      certificates: certificates.map((cert) => this.certView(cert)),
    };
  }

  async course(session: SessionPayload, id: string) {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null }, include: { lessons: { orderBy: { position: "asc" }, select: { position: true, title: true, minutes: true, body: true } } } });
    if (!course) throw new NotFoundException("That course is not open to you.");
    const { me, subjects } = await this.context(session);
    if (!this.fits(course, me.persona, subjects)) throw new ForbiddenException("That course is not written for your work.");
    const free = course.priceKobo === null || course.priceKobo === 0;
    const [enrolment, cert, purchase] = await Promise.all([
      prisma.trainingEnrolment.findUnique({ where: { courseId_userId: { courseId: id, userId: session.userId } } }),
      prisma.trainingCertificate.findFirst({ where: { schoolId: session.schoolId, userId: session.userId, courseId: id, state: { not: "SUPERSEDED" } }, orderBy: { issuedAt: "desc" } }),
      prisma.trainingPurchase.findUnique({ where: { courseId_userId: { courseId: id, userId: session.userId } } }),
    ]);
    // A paid course can be read about — what it covers and what it costs — before it is bought; only its lessons are held back.
    const owned = free || purchase?.state === "APPROVED" || purchase?.state === "PAID";
    const done = owned ? enrolment?.completedLessons ?? [] : [];
    const required = course.requiredFor.length > 0 && (course.requiredFor.includes(me.persona) || course.requiredFor.includes("all"));
    const signal = owned && (enrolment || required) ? null : (await this.home(session)).recommended.find((entry) => entry.course.id === id)?.why ?? null;
    return {
      id: course.id, title: course.title, summary: course.summary, provider: course.provider, hours: course.hours, format: course.format, certificateName: course.certificateName, validMonths: course.validMonths, outcomes: course.outcomes, task: course.task,
      owned, price: free ? null : course.priceKobo, priceLabel: free ? "Free" : naira(course.priceKobo as number), purchase: purchase ? { state: purchase.state, payer: purchase.payer, decision: purchase.decision } : null, why: signal,
      required: required ? { by: course.requiredBy?.toISOString() ?? null, note: course.requiredNote } : null,
      lessons: course.lessons.map((lesson) => ({ position: lesson.position, title: lesson.title, minutes: lesson.minutes, summary: owned ? lesson.body.split(/(?<=[.!?])\s/)[0] ?? "" : "", done: done.includes(lesson.position) })),
      done: done.length, completed: owned && Boolean(enrolment?.completedAt), certificate: cert ? this.certView(cert) : null,
    };
  }

  async lesson(session: SessionPayload, id: string, position: number) {
    const course = await this.course(session, id);
    if (!course.owned) throw new ForbiddenException(course.purchase?.state === "REQUESTED" ? `${course.title} is waiting on the school's decision.` : course.purchase?.state === "DECLINED" ? `The school did not approve ${course.title}.` : `${course.title} has to be paid for before it opens.`);
    const lesson = await prisma.trainingLesson.findUnique({ where: { courseId_position: { courseId: id, position } } });
    if (!lesson) throw new NotFoundException("That lesson does not exist.");
    // A person cannot skip ahead of what they have finished.
    const firstOpen = course.lessons.find((entry) => !entry.done)?.position ?? course.lessons.length + 1;
    if (position > firstOpen) throw new BadRequestException("Finish the lessons before this one first.");
    // The correct answer is never sent to the reader — it is checked on the server.
    return { course: { id: course.id, title: course.title, task: course.task, hours: course.hours, certificateName: course.certificateName, provider: course.provider, required: course.required, lessonsTotal: course.lessons.length, done: course.done }, outline: course.lessons.map((entry) => ({ position: entry.position, title: entry.title, minutes: entry.minutes, done: entry.done })), lesson: { position, title: lesson.title, minutes: lesson.minutes, body: lesson.body, question: lesson.question, options: lesson.options, done: course.lessons.find((entry) => entry.position === position)?.done ?? false } };
  }

  async answer(session: SessionPayload, id: string, position: number, body: unknown) {
    const input = z.object({ choice: z.coerce.number().int().min(0) }).parse(body);
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null }, include: { lessons: { orderBy: { position: "asc" } } } });
    if (!course) throw new NotFoundException("That course is not open to you.");
    const lesson = course.lessons.find((entry) => entry.position === position);
    if (!lesson) throw new NotFoundException("That lesson does not exist.");
    await this.assertOwned(session, course);
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
      // A renewed certificate replaces the one it renews on the person's record; the old one stays on file, no longer counted.
      await prisma.trainingCertificate.updateMany({ where: { schoolId: session.schoolId, userId: session.userId, courseId: course.id, id: { not: created.id }, state: { in: ["VALID", "PENDING"] } }, data: { state: "SUPERSEDED" } });
      certificate = { code: created.code };
      await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "TrainingCertificate", entityId: created.id, metadata: { summary: `Course finished · ${course.title}`, certificate: course.certificateName } } });
    }
    return { correct: true, finished, certificate, explanation: lesson.explanation ?? "", next: finished ? null : course.lessons.find((entry) => !completed.includes(entry.position))?.position ?? null };
  }

  /**
   * Start a course again to renew the certificate it earned. Allowed once the certificate is within sixty days of lapsing, or lapsed;
   * the old certificate stays until the new one is earned, and is then replaced on the record.
   */
  async renew(session: SessionPayload, id: string) {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null } });
    if (!course) throw new NotFoundException("That course is not open to you.");
    await this.assertOwned(session, course);
    const cert = await prisma.trainingCertificate.findFirst({ where: { schoolId: session.schoolId, userId: session.userId, courseId: id, state: "VALID" }, orderBy: { issuedAt: "desc" } });
    if (!cert) throw new BadRequestException("There is no certificate from this course to renew.");
    const view = this.certView(cert);
    if (view.state !== "Expiring" && view.state !== "Expired") throw new BadRequestException(cert.expiresAt ? `${cert.name} is current until ${view.expires}. You can renew it in the last sixty days.` : `${cert.name} does not expire, so there is nothing to renew.`);
    await prisma.trainingEnrolment.update({ where: { courseId_userId: { courseId: id, userId: session.userId } }, data: { completedLessons: [], completedAt: null, startedAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "TrainingCourse", entityId: id, metadata: { summary: `Renewal begun · ${course.title}` } } });
    return { id };
  }

  /* ───────────────────────── paid courses ───────────────────────── */

  /**
   * A paid course cannot be opened until it is settled.
   *
   * Checked on reading the course and again on answering a lesson, because the second is
   * what writes progress and issues the certificate — a gate only on the page would be a
   * gate on the door of a room with another way in.
   */
  private async assertOwned(session: SessionPayload, course: { id: string; priceKobo: number | null; title: string }) {
    if (course.priceKobo === null || course.priceKobo === 0) return;
    const purchase = await prisma.trainingPurchase.findUnique({ where: { courseId_userId: { courseId: course.id, userId: session.userId } } });
    if (purchase && (purchase.state === "APPROVED" || purchase.state === "PAID")) return;
    throw new ForbiddenException(
      purchase?.state === "REQUESTED" ? `${course.title} is waiting on the school's decision.`
        : purchase?.state === "DECLINED" ? `The school did not approve ${course.title}.`
        : `${course.title} has to be paid for before it opens.`,
    );
  }

  /** Everything this person has in their basket or has asked the school to fund. */
  async basket(session: SessionPayload) {
    const rows = await prisma.trainingPurchase.findMany({
      where: { schoolId: session.schoolId, userId: session.userId, state: { in: ["BASKET", "REQUESTED", "APPROVED", "DECLINED", "PAID"] } },
      include: { course: { select: { title: true, provider: true, hours: true } } },
      orderBy: { addedAt: "desc" },
    });
    const basket = rows.filter((row) => row.state === "BASKET");
    return {
      basket: basket.map((row) => ({ id: row.id, courseId: row.courseId, title: row.course.title, provider: row.course.provider, hours: row.course.hours, price: row.priceKobo, priceLabel: naira(row.priceKobo) })),
      total: basket.reduce((sum, row) => sum + row.priceKobo, 0),
      totalLabel: naira(basket.reduce((sum, row) => sum + row.priceKobo, 0)),
      history: rows.filter((row) => row.state !== "BASKET").map((row) => ({
        id: row.id, courseId: row.courseId, title: row.course.title, provider: row.course.provider, state: row.state, payer: row.payer,
        priceLabel: naira(row.priceKobo), decision: row.decision, requestedAt: row.requestedAt?.toISOString() ?? null, decidedAt: row.decidedAt?.toISOString() ?? null,
      })),
    };
  }

  async addToBasket(session: SessionPayload, courseId: string) {
    const course = await prisma.trainingCourse.findFirst({ where: { id: courseId, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null } });
    if (!course) throw new NotFoundException("That course is not open to you.");
    if (course.priceKobo === null || course.priceKobo === 0) throw new BadRequestException(`${course.title} is free — open it from the catalogue.`);
    const existing = await prisma.trainingPurchase.findUnique({ where: { courseId_userId: { courseId, userId: session.userId } } });
    if (existing && existing.state !== "DECLINED") throw new BadRequestException(existing.state === "BASKET" ? "It is already in your basket." : "You have already asked for this one.");
    // A price declined once can be asked for again; the row is reused so the history stays on one line.
    const data = { priceKobo: course.priceKobo, currency: course.currency, state: "BASKET", payer: "SCHOOL", reason: null, decision: null, requestedAt: null, decidedAt: null, decidedById: null, addedAt: new Date() };
    const row = existing
      ? await prisma.trainingPurchase.update({ where: { id: existing.id }, data })
      : await prisma.trainingPurchase.create({ data: { schoolId: session.schoolId, userId: session.userId, courseId, ...data } });
    return { id: row.id };
  }

  /** Several courses into the basket at once, from the catalogue's selection. Each is checked as if added alone; the first that cannot be is said, and none are added. */
  async addManyToBasket(session: SessionPayload, body: unknown) {
    const input = z.object({ courseIds: z.array(z.string()).min(1, "Choose at least one course.").max(40) }).parse(body);
    const ids = [...new Set(input.courseIds)];
    const courses = await prisma.trainingCourse.findMany({ where: { id: { in: ids }, schoolId: session.schoolId, publishedAt: { not: null }, archivedAt: null } });
    const paid = courses.filter((course) => course.priceKobo && course.priceKobo > 0);
    if (!paid.length) throw new BadRequestException("None of those needs buying — a free course opens from the catalogue.");
    const existing = await prisma.trainingPurchase.findMany({ where: { userId: session.userId, courseId: { in: paid.map((course) => course.id) } } });
    let added = 0;
    for (const course of paid) {
      const have = existing.find((entry) => entry.courseId === course.id);
      if (have && have.state !== "DECLINED") continue;
      await this.addToBasket(session, course.id);
      added += 1;
    }
    if (!added) throw new BadRequestException("Those are already in your basket, or already asked for.");
    return { added };
  }

  async removeFromBasket(session: SessionPayload, courseId: string) {
    const row = await prisma.trainingPurchase.findUnique({ where: { courseId_userId: { courseId, userId: session.userId } } });
    if (!row || row.state !== "BASKET") throw new BadRequestException("That course is not in your basket.");
    await prisma.trainingPurchase.delete({ where: { id: row.id } });
    return { id: row.id };
  }

  /**
   * Check out the basket.
   *
   * Asking the school to fund it is a request the school decides, so it goes no further
   * than REQUESTED here. Paying it yourself records the payment you made outside this
   * system against a reference — the platform takes no money from staff, and saying so
   * is more honest than drawing a card form that does nothing.
   */
  async checkout(session: SessionPayload, body: unknown) {
    const input = z
      .object({ payer: z.enum(["SCHOOL", "SELF"]).default("SCHOOL"), reason: z.string().trim().max(600).optional(), reference: z.string().trim().max(120).optional() })
      .parse(body);
    const rows = await prisma.trainingPurchase.findMany({ where: { schoolId: session.schoolId, userId: session.userId, state: "BASKET" }, include: { course: { select: { title: true } } } });
    if (!rows.length) throw new BadRequestException("Your basket is empty.");
    if (input.payer === "SCHOOL" && !input.reason) throw new BadRequestException("Say why the school should fund it — whoever decides reads this.");
    if (input.payer === "SELF" && !input.reference) throw new BadRequestException("Give the payment reference from the provider, so the office can check it.");
    const now = new Date();
    await prisma.trainingPurchase.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: input.payer === "SCHOOL"
        ? { state: "REQUESTED", payer: "SCHOOL", reason: input.reason, requestedAt: now }
        : { state: "PAID", payer: "SELF", reference: input.reference, requestedAt: now, decidedAt: now },
    });
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "TrainingPurchase", entityId: rows[0]!.id,
        metadata: { summary: `${input.payer === "SCHOOL" ? "Asked the school to fund" : "Recorded payment for"} ${rows.length} course${rows.length === 1 ? "" : "s"}`, courses: rows.map((row) => row.course.title), total: rows.reduce((sum, row) => sum + row.priceKobo, 0) },
      },
    });
    return { count: rows.length, payer: input.payer };
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
    const [courses, enrolments, pending, suggestions, funding, staff, policy] = await Promise.all([
      prisma.trainingCourse.findMany({ where: { schoolId }, include: { _count: { select: { lessons: true } } }, orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }] }),
      prisma.trainingEnrolment.findMany({ where: { schoolId } }),
      prisma.trainingCertificate.findMany({ where: { schoolId, state: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100 }),
      prisma.trainingSuggestion.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.trainingPurchase.findMany({ where: { schoolId, state: "REQUESTED" }, include: { course: { select: { title: true, provider: true, hours: true } } }, orderBy: { requestedAt: "asc" }, take: 60 }),
      prisma.user.count({ where: { schoolId, isActive: true, deletedAt: null, staffProfile: { isNot: null }, role: { in: ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT"] } } }),
      store(schoolId, "learning-policy").get<{ cpdTarget?: number | null }>("policy")
    ]);
    const people = await prisma.user.findMany({ where: { id: { in: [...new Set([...pending.map((cert) => cert.userId), ...suggestions.map((entry) => entry.userId), ...funding.map((entry) => entry.userId)])] } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((person) => [person.id, fullName(person)]));
    return {
      staff, cpdTarget: policy?.data.cpdTarget ?? null, sections: SECTIONS, personas: PERSONAS, formats: FORMATS, topics: TOPICS,
      courses: courses.map((course) => {
        const entries = enrolments.filter((entry) => entry.courseId === course.id);
        return { id: course.id, title: course.title, section: course.section, hours: course.hours, format: course.format, certificateName: course.certificateName, price: course.priceKobo, priceLabel: course.priceKobo ? naira(course.priceKobo) : "Free", lessons: course._count.lessons, published: Boolean(course.publishedAt), archived: Boolean(course.archivedAt), required: course.requiredFor.length > 0, requiredBy: course.requiredBy?.toISOString() ?? null, requiredFor: course.requiredFor, started: entries.length, finished: entries.filter((entry) => entry.completedAt).length };
      }),
      pending: pending.map((cert) => ({ id: cert.id, who: nameOf.get(cert.userId) ?? "", name: cert.name, issuedBy: cert.issuedBy, issued: dateLabel(cert.issuedAt), hours: cert.hours, hasFile: Boolean(cert.evidence), filed: dateLabel(cert.createdAt) })),
      suggestions: suggestions.map((entry) => ({ id: entry.id, who: nameOf.get(entry.userId) ?? "", topic: entry.topic, why: entry.why, at: dateLabel(entry.createdAt) })),
      funding: funding.map((entry) => ({ id: entry.id, who: nameOf.get(entry.userId) ?? "", course: entry.course.title, provider: entry.course.provider, hours: entry.course.hours, priceLabel: naira(entry.priceKobo), price: entry.priceKobo, reason: entry.reason, asked: entry.requestedAt ? dateLabel(entry.requestedAt) : "" })),
      fundingTotal: naira(funding.reduce((sum, entry) => sum + entry.priceKobo, 0))
    };
  }

  /** A school leader settles a funding request. Approving it opens the course for that person. */
  async decideFunding(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ decision: z.enum(["APPROVED", "DECLINED"]), note: z.string().trim().max(600).optional() }).parse(body);
    const row = await prisma.trainingPurchase.findFirst({ where: { id, schoolId: session.schoolId, state: "REQUESTED" }, include: { course: { select: { title: true } } } });
    if (!row) throw new NotFoundException("That request is not waiting on a decision.");
    if (input.decision === "DECLINED" && !input.note) throw new BadRequestException("Say why it was not approved — the person asking reads this.");
    await prisma.trainingPurchase.update({ where: { id }, data: { state: input.decision, decision: input.note ?? null, decidedAt: new Date(), decidedById: session.userId } });
    await prisma.notificationLog.create({
      data: {
        schoolId: session.schoolId, userId: row.userId, channel: "IN_APP", status: "QUEUED", sentAt: new Date(),
        title: input.decision === "APPROVED" ? `The school is funding ${row.course.title}` : `${row.course.title} was not approved`,
        body: input.decision === "APPROVED" ? "It is open in Training now." : input.note ?? "",
      },
    });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "TrainingPurchase", entityId: id, metadata: { summary: `Funding ${input.decision.toLowerCase()} · ${row.course.title}`, note: input.note ?? null } } });
    return { id, decision: input.decision };
  }

  async manageCourse(session: SessionPayload, id: string) {
    const course = await prisma.trainingCourse.findFirst({ where: { id, schoolId: session.schoolId }, include: { lessons: { orderBy: { position: "asc" } } } });
    if (!course) throw new NotFoundException("That course does not exist.");
    const [started, finished] = await Promise.all([prisma.trainingEnrolment.count({ where: { courseId: id } }), prisma.trainingEnrolment.count({ where: { courseId: id, completedAt: { not: null } } })]);
    return {
      id: course.id, title: course.title, summary: course.summary, section: course.section, provider: course.provider, hours: course.hours, format: course.format, certificateName: course.certificateName, validMonths: course.validMonths, pathway: course.pathway, outcomes: course.outcomes, task: course.task, personas: course.personas, subjects: course.subjects, topics: course.topics, topicOptions: TOPICS, price: course.priceKobo ? course.priceKobo / 100 : null, requiredFor: course.requiredFor, requiredBy: course.requiredBy?.toISOString().slice(0, 10) ?? null, requiredNote: course.requiredNote,
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
        certificateName: input.certificateName, validMonths: input.validMonths, pathway: input.pathway || null, priceKobo: input.price ? Math.round(input.price * 100) : null, outcomes: lines(input.outcomes), task: input.task || null, personas: input.personas.filter((item) => PERSONAS.includes(item)), subjects: lines(input.subjects), topics: lines(input.topics).filter((topic) => TOPICS.includes(topic)),
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
      data: { title: input.title, summary: input.summary || null, section: input.section, provider: input.provider || course.provider, hours: input.hours, format: FORMATS.includes(input.format) ? input.format : course.format, certificateName: input.certificateName, validMonths: input.validMonths, pathway: input.pathway || null, priceKobo: input.price ? Math.round(input.price * 100) : null, outcomes: lines(input.outcomes), task: input.task || null, personas: input.personas.filter((item) => PERSONAS.includes(item)), subjects: lines(input.subjects), topics: lines(input.topics).filter((topic) => TOPICS.includes(topic)), requiredFor: input.requiredFor, requiredBy: input.requiredBy ? new Date(input.requiredBy) : null, requiredNote: input.requiredNote || null }
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
      const wasPublished = Boolean(course.publishedAt);
      await prisma.trainingCourse.update({ where: { id }, data: { publishedAt: new Date(), archivedAt: null } });
      if (!wasPublished && course.requiredFor.length) await this.announceRequired(session, course);
    } else if (state === "archive") await prisma.trainingCourse.update({ where: { id }, data: { archivedAt: new Date() } });
    else await prisma.trainingCourse.update({ where: { id }, data: { archivedAt: null } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "TrainingCourse", entityId: id, metadata: { summary: `Course ${state}d · ${course.title}`.replace("archived", "archived").replace("restored", "restored") } } });
    return { id, state };
  }

  /** A course the school requires reaches each person it is required of, the day it is published — on My Day too, where it also appears. */
  private async announceRequired(session: SessionPayload, course: { id: string; title: string; hours: number; requiredFor: string[]; requiredBy: Date | null; requiredNote: string | null }) {
    const staff = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, id: { not: session.userId }, role: { in: ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT", "TEACHING_ASSISTANT", "COVER_TEACHER"] } }, select: { id: true, role: true } });
    const everyone = course.requiredFor.includes("all");
    const due = course.requiredBy ? ` by ${dateLabel(course.requiredBy)}` : "";
    for (const person of staff) {
      if (!everyone) {
        const persona = (await this.workspace.me({ userId: person.id, schoolId: session.schoolId, role: person.role } as SessionPayload, { anyStaff: true }).catch(() => null))?.persona;
        if (!persona || !course.requiredFor.includes(persona)) continue;
      }
      await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: person.id, channel: "IN_APP", status: "QUEUED", sentAt: new Date(), title: `Required training: ${course.title}`, body: `${course.hours} hour${course.hours === 1 ? "" : "s"}, self-paced — required${due}.${course.requiredNote ? ` ${course.requiredNote}` : ""}` } });
    }
  }

  async decideCertificate(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ decision: z.enum(["verify", "reject"]), note: z.string().trim().optional() }).parse(body);
    const cert = await prisma.trainingCertificate.findFirst({ where: { id, schoolId: session.schoolId, state: "PENDING" } });
    if (!cert) throw new NotFoundException("That certificate is not waiting to be verified.");
    if (input.decision === "reject" && !input.note) throw new BadRequestException("Say why it is not accepted — the person reads it.");
    await prisma.trainingCertificate.update({ where: { id }, data: { state: input.decision === "verify" ? "VALID" : "REJECTED", verifiedById: session.userId, verifiedAt: new Date(), note: input.note || null } });
    // A renewed outside certificate replaces the earlier one of the same name on the record.
    if (input.decision === "verify") await prisma.trainingCertificate.updateMany({ where: { schoolId: session.schoolId, userId: cert.userId, external: true, name: { equals: cert.name, mode: "insensitive" }, id: { not: id }, state: "VALID" }, data: { state: "SUPERSEDED" } });
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: cert.userId, channel: "IN_APP", title: input.decision === "verify" ? "Your certificate was verified" : "Your certificate was not accepted", body: `${cert.name}${input.note ? ` — ${input.note}` : ""}`, status: "QUEUED", sentAt: new Date() } });
    return { id, decision: input.decision };
  }

  async setPolicy(session: SessionPayload, body: unknown) {
    const input = z.object({ cpdTarget: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().min(0).max(500).nullable()) }).parse(body);
    await store(session.schoolId, "learning-policy").put("policy", "Learning policy", { cpdTarget: input.cpdTarget });
    return { cpdTarget: input.cpdTarget };
  }
}
