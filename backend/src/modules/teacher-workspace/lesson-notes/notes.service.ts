import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../../src/lib/auth/session-core";
import { prisma } from "../../../../../src/lib/db/prisma";
import { armName, fullName } from "../../fee-management/fees.shared";
import { TeacherSchemeService, type WeekView } from "./scheme.service";
import { GRID_SUFFIX, PLACEHOLDER, countWritten, focusWeek, letterhead, noteState, sectionsFor, termsOf, type Group, type Term } from "./shared";

const DAY = 86_400_000;
const noteSchema = z.object({ sections: z.record(z.string()).default({}), termId: z.string().optional(), /** The note's updatedAt as the writer last saw it; null means they saw none. Left out, nothing is checked. */ base: z.string().nullable().optional() });
const submitSchema = z.object({ reply: z.string().trim().max(2000).optional(), termId: z.string().optional() });
const decideSchema = z.object({ decision: z.enum(["sign", "return"]), note: z.string().trim().max(2000).optional(), section: z.string().optional() });
const bulkSign = z.object({ planIds: z.array(z.string()).min(1, "Choose the notes to sign.").max(100) });

const leaders = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMINISTRATOR", "SUPER_ADMIN"]);
const days = (from: Date | null) => (from ? Math.max(0, Math.floor((Date.now() - from.getTime()) / DAY)) : 0);

/**
 * The lesson note, page by page: the landing, a subject's notes, the note itself, what was signed in earlier terms, what a reviewer
 * sees, and what the term has actually covered. A week's note is written against its scheme topic; the scheme says what and when,
 * the note says how.
 */
@Injectable()
export class TeacherNotesService {
  constructor(private readonly scheme: TeacherSchemeService) {}

  /* ───────────────────────── shared ───────────────────────── */

  private pick(terms: { current: Term; next: Term | null }, termId?: string) {
    return termId && terms.next?.id === termId ? terms.next : terms.current;
  }

  /** Who signs this person's notes: their head of department, else the deputy for academics, else the principal. */
  async signerOf(session: SessionPayload, me: { persona: string; department: { id: string } | null }) {
    const lead = (roles: string[], departmentId?: string | null) => prisma.user.findFirst({ where: { schoolId: session.schoolId, id: { not: session.userId }, isActive: true, deletedAt: null, role: { in: roles as never[] }, ...(departmentId ? { staffProfile: { departmentId } } : {}) }, select: { id: true, firstName: true, lastName: true, role: true } });
    const head = me.persona !== "head-of-department" && me.department ? await lead(["HEAD_OF_DEPARTMENT"], me.department.id) : null;
    return head ?? (await lead(["VICE_PRINCIPAL_ACADEMICS"])) ?? (await lead(["PRINCIPAL", "HEAD_TEACHER"]));
  }

  private async views(session: SessionPayload, group: Group, term: Term) {
    const schemes = await this.scheme.schemesFor(session.schoolId, term.id, group.subjectId, group.classIds);
    const plans = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, teacherId: group.ownerId ?? "-", subjectId: group.subjectId, termId: term.id, deletedAt: null }, orderBy: { weekNumber: "asc" } });
    const weeks = this.scheme.weekViews(term, group, schemes, plans, sectionsFor(group).length);
    return { schemes, plans, weeks };
  }

  private due(term: Term, weeks: WeekView[]) {
    const upTo = term.current ?? (term.phase === "after" ? term.weeks : 0);
    return weeks.filter((week) => (week.kind === "teach" || week.kind === "rev") && week.week <= upTo);
  }

  private async thread(planId: string) {
    const comments = await prisma.lessonNoteComment.findMany({ where: { planId }, orderBy: { createdAt: "asc" } });
    const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(comments.map((comment) => comment.authorId))] } }, select: { id: true, firstName: true, lastName: true } });
    const name = new Map(authors.map((author) => [author.id, fullName(author)]));
    return comments.map((comment) => ({ id: comment.id, kind: comment.kind, author: name.get(comment.authorId) ?? "Someone", section: comment.section, body: comment.body, at: comment.createdAt.toISOString() }));
  }

  /* ───────────────────────── landing ───────────────────────── */

  async landing(session: SessionPayload, termId?: string) {
    const { me, terms, groups } = await this.scheme.ctx(session);
    const term = this.pick(terms, termId);
    const signer = await this.signerOf(session, me);
    const rework = [];
    const subjects = [];
    let drafts = 0;
    let reviewer = 0;
    let signed = 0;
    let toWrite = 0;
    let returned = 0;
    for (const group of groups) {
      const { plans, weeks } = await this.views(session, group, term);
      const due = this.due(term, weeks);
      const planned = weeks.filter((week) => week.kind === "teach" || week.kind === "rev");
      const by = (state: string) => planned.filter((week) => week.note.state === state);
      const behind = due.filter((week) => week.note.state === "Not started");
      const entry = {
        subjectId: group.subjectId, subject: group.subject, arms: group.arms.map((arm) => arm.name), readOnly: group.readOnly, earlyYears: group.earlyYears,
        planned: planned.length, due: due.length, notStarted: behind.length, drafts: by("Draft").length, submitted: by("Submitted").length, signed: by("Approved").length, returned: by("Returned").length,
        next: planned.find((week) => week.note.state === "Not started" && (term.current === null || week.week >= term.current))?.week ?? behind[0]?.week ?? null,
        // What this subject is teaching in the week running now, so the row answers
        // "where am I today" without opening it.
        thisWeek: (() => {
          if (term.current === null) return null;
          const week = planned.find((candidate) => candidate.week === term.current);
          return week ? { week: week.week, topic: week.topic, state: week.note.state } : null;
        })(),
        state: group.readOnly ? "Read only" : !planned.length ? "No scheme" : by("Returned").length ? "Returned" : behind.length ? "Behind" : by("Draft").length ? "Draft open" : "On track",
      };
      subjects.push(entry);
      if (group.readOnly) continue;
      drafts += entry.drafts; reviewer += entry.submitted; signed += entry.signed; toWrite += entry.notStarted; returned += entry.returned;
      for (const plan of plans.filter((candidate) => candidate.status === "RETURNED")) {
        const week = weeks.find((candidate) => candidate.week === plan.weekNumber);
        rework.push({ planId: plan.id, subjectId: group.subjectId, subject: group.subject, arms: entry.arms, week: plan.weekNumber, topic: week?.topic || plan.topic, section: plan.returnedSection, note: plan.reviewNote ?? "", at: (plan.rejectedAt ?? plan.updatedAt).toISOString() });
      }
    }
    const past = await prisma.lessonPlan.groupBy({ by: ["subjectId", "termId"], where: { schoolId: session.schoolId, teacherId: session.userId, deletedAt: null, status: "APPROVED" }, _count: { _all: true } });
    const subjectsNamed = await prisma.subject.findMany({ where: { id: { in: [...new Set(past.map((row) => row.subjectId))] } }, select: { id: true, name: true } });
    const termsNamed = await prisma.term.findMany({ where: { id: { in: [...new Set(past.map((row) => row.termId).filter((id): id is string => Boolean(id)))] } }, select: { id: true, name: true, startDate: true, academicSessionId: true } });
    const sessionsNamed = await prisma.academicSession.findMany({ where: { id: { in: termsNamed.map((entry) => entry.academicSessionId) } }, select: { id: true, name: true } });
    const history = subjectsNamed.map((subject) => ({ subjectId: subject.id, subject: subject.name, terms: past.filter((row) => row.subjectId === subject.id).map((row) => { const t = termsNamed.find((entry) => entry.id === row.termId); return { termId: row.termId, term: t?.name ?? "A term", session: sessionsNamed.find((entry) => entry.id === t?.academicSessionId)?.name ?? "", at: t?.startDate.getTime() ?? 0, signed: row._count._all }; }).sort((a, b) => b.at - a.at) })).sort((a, b) => a.subject.localeCompare(b.subject));
    return {
      persona: me.persona, term: this.scheme.termView(term), terms: [this.scheme.termView(terms.current), ...(terms.next ? [this.scheme.termView(terms.next)] : [])],
      signer: signer ? { name: fullName(signer) } : null, kpis: { toWrite, drafts, withReviewer: reviewer, signed, returned }, rework, subjects, history,
    };
  }

  /* ───────────────────────── a subject's notes ───────────────────────── */

  async subject(session: SessionPayload, subjectId: string, termId?: string) {
    const { me, terms, groups } = await this.scheme.ctx(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach, so its notes are not yours to read.");
    const term = this.pick(terms, termId);
    const { plans, weeks } = await this.views(session, group, term);
    const signer = await this.signerOf(session, me);
    const planOf = new Map(plans.map((plan) => [plan.weekNumber, plan]));
    return {
      subjectId, subject: group.subject, arms: group.arms.map((arm) => arm.name), readOnly: group.readOnly, earlyYears: group.earlyYears, term: this.scheme.termView(term), terms: [this.scheme.termView(terms.current), ...(terms.next ? [this.scheme.termView(terms.next)] : [])],
      focus: focusWeek(term), signer: signer ? { name: fullName(signer) } : null, sections: sectionsFor(group).length, letterhead: await letterhead(session.schoolId),
      weeks: weeks.filter((week) => week.kind === "teach" || week.kind === "rev").map((week) => {
        const plan = planOf.get(week.week);
        return { week: week.week, dates: week.dates, short: week.short, topic: week.topic, kind: week.kind, status: week.status, subtopics: week.subtopics.length, covered: week.covered.length, state: week.note.state, done: week.note.done, of: week.note.of, planId: plan?.id ?? null, version: plan?.version ?? 1, returnedSection: plan?.status === "RETURNED" ? plan.returnedSection : null, reviewNote: plan?.status === "RETURNED" ? plan.reviewNote : null, at: plan?.updatedAt.toISOString() ?? null, current: term.current === week.week };
      }),
    };
  }

  /* ───────────────────────── the note itself ───────────────────────── */

  private async owned(session: SessionPayload, subjectId: string, week: number, termId?: string, write = false) {
    const { me, terms, groups } = await this.scheme.ctx(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach, so its note is not yours to write.");
    if (write && group.readOnly) throw new ForbiddenException("You hold this on cover, so you read the note and teach from it — it is not yours to change.");
    const term = this.pick(terms, termId);
    const { schemes, plans, weeks } = await this.views(session, group, term);
    const entry = weeks.find((candidate) => candidate.week === week);
    if (!entry || !(entry.kind === "teach" || entry.kind === "rev")) throw new BadRequestException("Plan this week in the scheme of work first — a note is written against a topic.");
    const existing = plans.find((plan) => plan.weekNumber === week) ?? null;
    return { me, term, terms, group, schemes, weeks, entry, existing };
  }

  private draftFor(group: Group, entry: WeekView) {
    const subs = entry.subtopics;
    const list = (head: string, tail: (sub: string) => string) => (subs.length ? `${head}\n${subs.map((sub, index) => `${index + 1}. ${tail(sub)}`).join("\n")}` : "");
    return {
      obj: group.earlyYears ? list("Children will begin to:", (sub) => sub) : list("By the end of the lesson, students should be able to:", (sub) => `explain ${sub.charAt(0).toLowerCase()}${sub.slice(1)}`),
      vocab: subs.join(" · "),
      res: entry.resources.map((resource) => `${resource.kind} — ${resource.label}`).join("\n"),
      eval: group.earlyYears ? subs.map((sub) => `Can they show ${sub.charAt(0).toLowerCase()}${sub.slice(1)}?`).join("\n") : subs.map((sub, index) => `${index + 1}. Ask a question that shows whether ${sub.charAt(0).toLowerCase()}${sub.slice(1)} landed.`).join("\n"),
      asg: entry.topic ? `Exercise on ${entry.topic}, due next lesson.` : "",
      home: entry.topic ? `Ask your child to tell you one thing about ${entry.topic}.` : "",
    } as Record<string, string>;
  }

  async note(session: SessionPayload, subjectId: string, week: number, termId?: string) {
    const { me, term, group, schemes, weeks, entry, existing } = await this.owned(session, subjectId, week, termId);
    const full = existing ? await prisma.lessonPlan.findUnique({ where: { id: existing.id }, include: { approvedBy: { select: { firstName: true, lastName: true } } } }) : null;
    const earlier = group.readOnly || group.earlyYears ? null : await prisma.lessonPlan.findFirst({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, status: "APPROVED", deletedAt: null, termId: { not: term.id }, topic: { equals: entry.topic, mode: "insensitive" } }, orderBy: { approvedAt: "desc" }, include: { term: { select: { name: true, academicSession: { select: { name: true } } } } } });
    const signer = group.readOnly ? null : await this.signerOf(session, me);
    const neighbours = weeks.filter((candidate) => candidate.kind === "teach" || candidate.kind === "rev");
    const at = neighbours.findIndex((candidate) => candidate.week === week);
    const taughtTo = group.arms.map((arm) => { const own = schemes.find((scheme) => scheme.classId === arm.id)?.topics.find((topic) => topic.weekNumber === week); const subs = entry.subtopics.length; const covered = own ? (own.isCovered ? subs : (own.coveredSubtopics ?? []).length) : 0; return { arm: arm.name, covered, of: subs, taught: subs > 0 && covered >= subs }; });
    const status = noteState(full?.status, full?.sections as Record<string, string> | null);
    return {
      subjectId, subject: group.subject, arms: group.arms.map((arm) => arm.name), earlyYears: group.earlyYears, readOnly: group.readOnly,
      week, dates: entry.dates, weeks: term.weeks, term: this.scheme.termView(term), topic: entry.topic, subtopics: entry.subtopics.map((name, index) => ({ name, covered: entry.covered.includes(index) })), schemeStatus: entry.status, assessment: entry.assessment, periods: entry.periods, resources: entry.resources, taughtTo,
      sections: sectionsFor(group), text: (full?.sections ?? {}) as Record<string, string>, planId: full?.id ?? null, state: status, version: full?.version ?? 1,
      thread: full ? await this.thread(full.id) : [],
      returned: full?.status === "RETURNED" ? { note: full.reviewNote ?? "", section: full.returnedSection ?? null, at: full.rejectedAt?.toISOString() ?? null } : null,
      resubmitReply: full?.resubmitReply ?? null, signedBy: full?.approvedBy ? fullName(full.approvedBy) : null, signedAt: full?.approvedAt?.toISOString() ?? null, submittedAt: full?.submittedAt?.toISOString() ?? null, updatedAt: full?.updatedAt.toISOString() ?? null,
      signer: signer ? { name: fullName(signer) } : null,
      reuse: earlier?.sections ? { term: earlier.term?.name ?? "An earlier term", session: earlier.term?.academicSession?.name ?? "", sections: earlier.sections as Record<string, string> } : null,
      draft: this.draftFor(group, entry),
      previous: at > 0 ? { week: neighbours[at - 1]!.week, topic: neighbours[at - 1]!.topic } : null, next: at >= 0 && at < neighbours.length - 1 ? { week: neighbours[at + 1]!.week, topic: neighbours[at + 1]!.topic } : null,
      person: me.person.name, letterhead: await letterhead(session.schoolId),
    };
  }

  async save(session: SessionPayload, subjectId: string, week: number, body: unknown) {
    const input = noteSchema.parse(body);
    const { me, term, group, entry, existing } = await this.owned(session, subjectId, week, input.termId, true);
    if (existing && (existing.status === "SUBMITTED" || existing.status === "APPROVED")) throw new BadRequestException(existing.status === "APPROVED" ? "This note is signed. Revise it to make a new version for signing." : "This note is with the reviewer. Withdraw it to edit.");
    if (input.base !== undefined && (existing?.updatedAt.toISOString() ?? null) !== input.base) {
      throw new ConflictException("This note was changed after you opened it — in another tab or on another device. Reload to see the latest, then make your changes again.");
    }
    const sections = Object.fromEntries(sectionsFor(group).flatMap((section) => [
      [section.key, String(input.sections[section.key] ?? "").slice(0, 20_000)],
      ...(section.kind === "week-grid" && input.sections[`${section.key}${GRID_SUFFIX}`] ? [[`${section.key}${GRID_SUFFIX}`, String(input.sections[`${section.key}${GRID_SUFFIX}`]).slice(0, 20_000)]] : []),
    ]));
    const data = { sections: sections as Prisma.InputJsonValue, objectives: sections.obj || "—", resources: sections.res || null, topic: entry.topic, classIds: group.classIds, classId: group.classIds[0] ?? null, departmentId: me.department?.id ?? null };
    const plan = existing
      ? await prisma.lessonPlan.update({ where: { id: existing.id }, data })
      : await prisma.lessonPlan.create({ data: { schoolId: session.schoolId, academicSessionId: term.academicSessionId, termId: term.id, subjectId, teacherId: session.userId, weekNumber: week, status: "DRAFT", ...data } });
    return { id: plan.id, state: noteState(plan.status, sections), written: countWritten(sections), updatedAt: plan.updatedAt.toISOString() };
  }

  async submit(session: SessionPayload, subjectId: string, week: number, body: unknown) {
    const input = submitSchema.parse(body);
    const { me, group, entry, existing } = await this.owned(session, subjectId, week, input.termId, true);
    if (!existing) throw new BadRequestException("Write the note before you submit it.");
    if (existing.status === "SUBMITTED" || existing.status === "APPROVED") throw new BadRequestException("That note has already been submitted.");
    const sections = (existing.sections ?? {}) as Record<string, string>;
    const missing = sectionsFor(group).filter((section) => section.required && !String(sections[section.key] ?? "").trim()).map((section) => section.label);
    if (missing.length) throw new BadRequestException(`These sections are required before a note can be submitted: ${missing.join(", ")}.`);
    if (existing.status === "RETURNED" && !input.reply) throw new BadRequestException("Say what you changed — the reviewer reads it.");
    const signer = await this.signerOf(session, me);
    await prisma.lessonPlan.update({ where: { id: existing.id }, data: { status: "SUBMITTED", submittedAt: new Date(), rejectedAt: null, returnedSection: null, resubmitReply: existing.status === "RETURNED" ? input.reply ?? null : null } });
    if (existing.status === "RETURNED" && input.reply) await prisma.lessonNoteComment.create({ data: { schoolId: session.schoolId, planId: existing.id, authorId: session.userId, kind: "REPLY", body: input.reply } });
    if (signer) await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: signer.id, channel: "IN_APP", title: "A lesson note is waiting to be signed", body: `${me.person.name} · ${entry.topic} · week ${week}`, status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "LessonPlan", entityId: existing.id, metadata: { summary: `Lesson note submitted · week ${week} · ${entry.topic}`, resubmitted: existing.status === "RETURNED" } } });
    return { subjectId, week, to: signer ? fullName(signer) : "the reviewer" };
  }

  /** Every draft that is complete goes to the reviewer at once; the ones that are missing a required section are left and named. */
  async submitDrafts(session: SessionPayload, subjectId: string, termId?: string) {
    const { me, terms, groups } = await this.scheme.ctx(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach.");
    if (group.readOnly) throw new ForbiddenException("You hold this on cover, so its notes are not yours to submit.");
    const term = this.pick(terms, termId);
    const drafts = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, termId: term.id, status: "DRAFT", deletedAt: null }, orderBy: { weekNumber: "asc" } });
    const required = sectionsFor(group).filter((section) => section.required);
    const ready = drafts.filter((plan) => required.every((section) => String(((plan.sections ?? {}) as Record<string, string>)[section.key] ?? "").trim()));
    const left = drafts.filter((plan) => !ready.includes(plan));
    if (!drafts.length) throw new BadRequestException("There are no drafts to submit.");
    if (!ready.length) throw new BadRequestException(`None of the drafts is complete yet — each needs ${required.map((section) => section.label).join(", ")}.`);
    await prisma.lessonPlan.updateMany({ where: { id: { in: ready.map((plan) => plan.id) } }, data: { status: "SUBMITTED", submittedAt: new Date(), rejectedAt: null, returnedSection: null, resubmitReply: null } });
    const signer = await this.signerOf(session, me);
    if (signer) await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: signer.id, channel: "IN_APP", title: `${ready.length} lesson note${ready.length === 1 ? " is" : "s are"} waiting to be signed`, body: `${me.person.name} · ${group.subject} · week${ready.length === 1 ? "" : "s"} ${ready.map((plan) => plan.weekNumber).join(", ")}`, status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "LessonPlan", entityId: subjectId, metadata: { summary: `Lesson notes submitted together · ${group.subject}`, weeks: ready.map((plan) => plan.weekNumber) } } });
    return { submitted: ready.map((plan) => plan.weekNumber), left: left.map((plan) => plan.weekNumber), to: signer ? fullName(signer) : "the reviewer" };
  }

  async withdraw(session: SessionPayload, subjectId: string, week: number, termId?: string) {
    const { existing } = await this.owned(session, subjectId, week, termId, true);
    if (!existing || existing.status !== "SUBMITTED") throw new BadRequestException("Only a note that is with the reviewer can be withdrawn.");
    await prisma.lessonPlan.update({ where: { id: existing.id }, data: { status: "DRAFT", submittedAt: null, resubmitReply: null } });
    return { subjectId, week };
  }

  /** A signed note is revised into a new version, which goes for signing again. The signed text stays in the thread until it is. */
  async revise(session: SessionPayload, subjectId: string, week: number, termId?: string) {
    const { existing } = await this.owned(session, subjectId, week, termId, true);
    if (!existing || existing.status !== "APPROVED") throw new BadRequestException("Only a signed note can be revised.");
    await prisma.lessonPlan.update({ where: { id: existing.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null, submittedAt: null, version: existing.version + 1 } });
    await prisma.lessonNoteComment.create({ data: { schoolId: session.schoolId, planId: existing.id, authorId: session.userId, kind: "NOTE", body: `Opened for revision — version ${existing.version + 1}.` } });
    return { subjectId, week, version: existing.version + 1 };
  }

  /* ───────────────────────── history ───────────────────────── */

  async history(session: SessionPayload, subjectId: string) {
    const plans = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, deletedAt: null, status: "APPROVED" }, include: { term: { select: { id: true, name: true, startDate: true, academicSession: { select: { name: true } } } }, approvedBy: { select: { firstName: true, lastName: true } } }, orderBy: [{ weekNumber: "asc" }] });
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: session.schoolId }, select: { name: true } });
    if (!subject) throw new NotFoundException("That subject is not on this school’s list.");
    const out = new Map<string, { termId: string; term: string; session: string; at: number; notes: Array<{ planId: string; week: number; topic: string; signedAt: string | null; signedBy: string | null; version: number }> }>();
    for (const plan of plans) {
      const key = plan.termId ?? "none";
      const group = out.get(key) ?? { termId: key, term: plan.term?.name ?? "An earlier term", session: plan.term?.academicSession?.name ?? "", at: plan.term?.startDate.getTime() ?? 0, notes: [] };
      group.notes.push({ planId: plan.id, week: plan.weekNumber, topic: plan.topic, signedAt: plan.approvedAt?.toISOString() ?? null, signedBy: plan.approvedBy ? fullName(plan.approvedBy) : null, version: plan.version });
      out.set(key, group);
    }
    return { subjectId, subject: subject.name, terms: [...out.values()].sort((a, b) => b.at - a.at) };
  }

  async historyNote(session: SessionPayload, subjectId: string, planId: string) {
    const plan = await prisma.lessonPlan.findFirst({ where: { id: planId, schoolId: session.schoolId, teacherId: session.userId, subjectId, status: "APPROVED", deletedAt: null }, include: { term: { select: { name: true, academicSession: { select: { name: true } } } }, subject: { select: { name: true } }, approvedBy: { select: { firstName: true, lastName: true } } } });
    if (!plan) throw new NotFoundException("That signed note is not in your history.");
    const rooms = plan.classIds.length ? await prisma.classRoom.findMany({ where: { id: { in: plan.classIds } }, select: { name: true, arm: true } }) : [];
    const early = (plan.sections && "vocab" in (plan.sections as object)) || (plan.sections && "home" in (plan.sections as object));
    return { id: plan.id, subjectId, subject: plan.subject.name, topic: plan.topic, week: plan.weekNumber, arms: rooms.map(armName), term: plan.term?.name ?? "An earlier term", session: plan.term?.academicSession?.name ?? "", version: plan.version, sections: early ? sectionsFor({ earlyYears: true }) : sectionsFor({ earlyYears: false }), text: (plan.sections ?? {}) as Record<string, string>, signedBy: plan.approvedBy ? fullName(plan.approvedBy) : null, signedAt: plan.approvedAt?.toISOString() ?? null, thread: await this.thread(plan.id), letterhead: await letterhead(session.schoolId) };
  }

  /* ───────────────────────── review ───────────────────────── */

  /** The notes a reviewer may sign: a head of department's own department (never their own), or — for leadership — every note. */
  async reviewScope(session: SessionPayload) {
    if (leaders.has(session.role)) return { all: true as const, departmentId: null as string | null };
    if (session.role === "HEAD_OF_DEPARTMENT") {
      const profile = await prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { departmentId: true } });
      if (profile?.departmentId) return { all: false as const, departmentId: profile.departmentId };
    }
    throw new ForbiddenException("Notes are signed by a head of department or the school's leadership.");
  }

  private async currentTerm(schoolId: string) {
    const terms = await termsOf(schoolId);
    if (!terms.current) throw new NotFoundException("No term is current.");
    return terms.current;
  }

  /** One row for every subject, arm and week a note is due — started or not — so the reviewer sees what is missing as well as what is waiting. */
  async review(session: SessionPayload) {
    const scope = await this.reviewScope(session);
    const term = await this.currentTerm(session.schoolId);
    const upTo = term.current ?? (term.phase === "after" ? term.weeks : 0);
    const schemes = await prisma.schemeOfWork.findMany({ where: { schoolId: session.schoolId, termId: term.id, ...(scope.all ? {} : { subject: { departmentId: scope.departmentId } }) }, include: { topics: { orderBy: { weekNumber: "asc" } }, subject: { select: { name: true } } } });
    const plans = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, termId: term.id, deletedAt: null, ...(scope.all ? {} : { OR: [{ departmentId: scope.departmentId }, { subject: { departmentId: scope.departmentId } }] }) }, include: { subject: { select: { name: true } } } });
    const ids = [...new Set([...schemes.map((scheme) => scheme.teacherId), ...plans.map((plan) => plan.teacherId)].filter(Boolean))] as string[];
    const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, role: true } });
    const who = new Map(people.map((person) => [person.id, person]));
    const rooms = await prisma.classRoom.findMany({ where: { schoolId: session.schoolId }, select: { id: true, name: true, arm: true } });
    const armOf = new Map(rooms.map((room) => [room.id, armName(room)]));
    const deputy = await prisma.user.findFirst({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: "VICE_PRINCIPAL_ACADEMICS" }, select: { firstName: true, lastName: true } });
    const rows = new Map<string, { id: string; planId: string | null; teacherId: string; teacher: string; subjectId: string; subject: string; arms: string[]; week: number; topic: string; state: string; own: boolean; canSign: boolean; routedTo: string | null; age: number; at: string | null; resubmitted: boolean }>();
    const put = (teacherId: string, subjectId: string, subject: string, week: number, topic: string, arms: string[], plan: (typeof plans)[number] | undefined) => {
      const own = teacherId === session.userId;
      const state = noteState(plan?.status, plan?.sections as Record<string, string> | null);
      const person = who.get(teacherId);
      rows.set(`${teacherId}|${subjectId}|${week}`, {
        id: plan?.id ?? `${teacherId}|${subjectId}|${week}`, planId: plan?.id ?? null, teacherId, teacher: own ? "You" : person ? fullName(person) : "—", subjectId, subject, arms, week, topic, state, own,
        canSign: state === "Submitted" && !own, routedTo: own && state === "Submitted" ? (deputy ? `${fullName(deputy)} (deputy, academics)` : "the principal") : null,
        age: state === "Submitted" ? days(plan?.submittedAt ?? plan?.updatedAt ?? null) : 0, at: (plan?.submittedAt ?? plan?.updatedAt)?.toISOString() ?? null, resubmitted: Boolean(plan?.resubmitReply && plan.status === "SUBMITTED"),
      });
    };
    const unit = new Map<string, typeof schemes>();
    for (const scheme of schemes) if (scheme.teacherId) unit.set(`${scheme.teacherId}|${scheme.subjectId}`, [...(unit.get(`${scheme.teacherId}|${scheme.subjectId}`) ?? []), scheme]);
    for (const [key, list] of unit) {
      const [teacherId, subjectId] = key.split("|") as [string, string];
      const arms = list.map((scheme) => armOf.get(scheme.classId) ?? "").filter(Boolean);
      const start = Math.max(1, ...list.map((scheme) => scheme.startWeek));
      const weeks = new Set(list.flatMap((scheme) => scheme.topics.filter((topic) => topic.topic.trim() && !PLACEHOLDER.test(topic.topic) && topic.weekNumber >= start).map((topic) => topic.weekNumber)));
      for (const week of weeks) {
        const topic = list.flatMap((scheme) => scheme.topics).find((candidate) => candidate.weekNumber === week && !PLACEHOLDER.test(candidate.topic))!;
        const plan = plans.find((candidate) => candidate.teacherId === teacherId && candidate.subjectId === subjectId && candidate.weekNumber === week);
        if (week <= upTo || plan) put(teacherId, subjectId, list[0]!.subject.name, week, topic.topic, arms, plan);
      }
    }
    for (const plan of plans) if (!rows.has(`${plan.teacherId}|${plan.subjectId}|${plan.weekNumber}`)) put(plan.teacherId, plan.subjectId, plan.subject.name, plan.weekNumber, plan.topic, plan.classIds.map((id) => armOf.get(id) ?? "").filter(Boolean), plan);
    const list = [...rows.values()].sort((a, b) => b.week - a.week || a.subject.localeCompare(b.subject));
    const count = (state: string) => list.filter((row) => row.state === state).length;
    return { scope: scope.all ? "school" : "department", term: this.scheme.termView(term), rows: list, kpis: { notStarted: count("Not started"), inProgress: count("Draft"), submitted: count("Submitted"), signed: count("Approved"), returned: count("Returned"), signable: list.filter((row) => row.canSign).length } };
  }

  async readNote(session: SessionPayload, planId: string) {
    const scope = await this.reviewScope(session);
    const plan = await prisma.lessonPlan.findFirst({ where: { id: planId, schoolId: session.schoolId, deletedAt: null, ...(scope.all ? {} : { OR: [{ departmentId: scope.departmentId }, { subject: { departmentId: scope.departmentId } }] }) }, include: { teacher: { select: { firstName: true, lastName: true } }, subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } }, term: { select: { name: true } } } });
    if (!plan) throw new NotFoundException("That note is not in your scope.");
    const rooms = plan.classIds.length ? await prisma.classRoom.findMany({ where: { id: { in: plan.classIds } }, select: { name: true, arm: true } }) : plan.classRoom ? [plan.classRoom] : [];
    const early = Boolean(plan.sections && ("vocab" in (plan.sections as object) || "home" in (plan.sections as object)));
    return { id: plan.id, subject: plan.subject.name, topic: plan.topic, week: plan.weekNumber, term: plan.term?.name ?? "", version: plan.version, arms: rooms.map(armName), teacher: fullName(plan.teacher), state: noteState(plan.status, plan.sections as Record<string, string>), sections: sectionsFor({ earlyYears: early }), text: (plan.sections ?? {}) as Record<string, string>, own: plan.teacherId === session.userId, canSign: plan.status === "SUBMITTED" && plan.teacherId !== session.userId, resubmitReply: plan.resubmitReply, thread: await this.thread(plan.id), letterhead: await letterhead(session.schoolId) };
  }

  private async sign(session: SessionPayload, plan: { id: string; teacherId: string; weekNumber: number; topic: string; status: string; subject: { name: string } }, input: z.infer<typeof decideSchema>) {
    if (plan.teacherId === session.userId) throw new ForbiddenException("You wrote this note, so someone else must sign it — it goes to the academic lead.");
    if (plan.status !== "SUBMITTED") throw new BadRequestException("Only a note that has been submitted can be signed or returned.");
    if (input.decision === "return" && !(input.note ?? "").trim()) throw new BadRequestException("Say what to change — a return without a comment cannot be acted on.");
    const stamp = new Date();
    await prisma.lessonPlan.update({ where: { id: plan.id }, data: input.decision === "sign" ? { status: "APPROVED", approvedAt: stamp, approvedById: session.userId, reviewNote: null, returnedSection: null } : { status: "RETURNED", rejectedAt: stamp, reviewNote: input.note ?? null, returnedSection: input.section || null } });
    await prisma.lessonNoteComment.create({ data: { schoolId: session.schoolId, planId: plan.id, authorId: session.userId, kind: input.decision === "sign" ? "SIGN" : "RETURN", section: input.section || null, body: input.note?.trim() || "Signed." } });
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: plan.teacherId, channel: "IN_APP", title: input.decision === "sign" ? "Your lesson note was signed" : "Your lesson note was returned", body: `${plan.subject.name} · week ${plan.weekNumber} · ${plan.topic}${input.note ? ` — ${input.note}` : ""}`, status: "QUEUED", sentAt: stamp } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: input.decision === "sign" ? AuditAction.APPROVE : AuditAction.UPDATE, entityType: "LessonPlan", entityId: plan.id, metadata: { summary: `Lesson note ${input.decision === "sign" ? "signed" : "returned"} · week ${plan.weekNumber} · ${plan.topic}` } } });
  }

  async decide(session: SessionPayload, planId: string, body: unknown) {
    const input = decideSchema.parse(body);
    const scope = await this.reviewScope(session);
    const plan = await prisma.lessonPlan.findFirst({ where: { id: planId, schoolId: session.schoolId, deletedAt: null, ...(scope.all ? {} : { OR: [{ departmentId: scope.departmentId }, { subject: { departmentId: scope.departmentId } }] }) }, include: { subject: { select: { name: true } } } });
    if (!plan) throw new NotFoundException("That note is not in your scope.");
    await this.sign(session, plan, input);
    return { id: plan.id, state: input.decision === "sign" ? "Approved" : "Returned" };
  }

  /** "Sign the N waiting": each is read, signed and recorded on its own; one that is the signer's own is left and said so. */
  async signMany(session: SessionPayload, body: unknown) {
    const input = bulkSign.parse(body);
    const scope = await this.reviewScope(session);
    const plans = await prisma.lessonPlan.findMany({ where: { id: { in: input.planIds }, schoolId: session.schoolId, deletedAt: null, status: "SUBMITTED", ...(scope.all ? {} : { OR: [{ departmentId: scope.departmentId }, { subject: { departmentId: scope.departmentId } }] }) }, include: { subject: { select: { name: true } } } });
    const own = plans.filter((plan) => plan.teacherId === session.userId);
    const signable = plans.filter((plan) => plan.teacherId !== session.userId);
    for (const plan of signable) await this.sign(session, plan, { decision: "sign" });
    if (!signable.length) throw new BadRequestException(own.length ? "Those are your own notes — someone else has to sign them." : "None of those is waiting to be signed.");
    return { signed: signable.length, left: own.length };
  }

  /* ───────────────────────── coverage ───────────────────────── */

  /** Evidence only: a week has been reached when every sub-topic is ticked or the teacher marked it taught. The calendar's guess does not count. */
  async coverage(session: SessionPayload) {
    const scope = await this.reviewScope(session);
    const term = await this.currentTerm(session.schoolId);
    const upTo = term.current ?? (term.phase === "after" ? term.weeks : 0);
    const classSubjects = await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, subject: { code: { not: "EYFS-ALL" }, ...(scope.all ? {} : { departmentId: scope.departmentId }) } }, include: { subject: { select: { name: true } }, classRoom: { select: { id: true, name: true, arm: true } } }, take: 600 });
    const teachers = await prisma.user.findMany({ where: { id: { in: classSubjects.map((row) => row.teacherId ?? "").filter(Boolean) } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(teachers.map((user) => [user.id, fullName(user)]));
    const schemes = await prisma.schemeOfWork.findMany({ where: { schoolId: session.schoolId, termId: term.id, classId: { in: classSubjects.map((row) => row.classId) } }, include: { topics: true } });
    const rows = classSubjects.map((row) => {
      const scheme = schemes.find((entry) => entry.classId === row.classId && entry.subjectId === row.subjectId);
      const planned = (scheme?.topics ?? []).filter((topic) => topic.topic.trim() && !PLACEHOLDER.test(topic.topic) && topic.weekNumber >= (scheme?.startWeek ?? 1) && topic.weekType !== "HOLIDAY");
      const expected = planned.filter((topic) => topic.weekNumber <= upTo).length;
      const reached = planned.filter((topic) => topic.weekNumber <= upTo && (topic.statusOverride === "Taught" || topic.isCovered || (Array.isArray(topic.subtopics) && (topic.subtopics as unknown[]).length > 0 && (topic.coveredSubtopics ?? []).length >= (topic.subtopics as unknown[]).length))).length;
      return { subjectId: row.subjectId, subject: row.subject.name, arm: armName(row.classRoom), teacher: row.teacherId === session.userId ? "You" : row.teacherId ? nameOf.get(row.teacherId) ?? "—" : "Nobody named", planned: planned.length, expected, reached, state: !scheme || !planned.length ? "No scheme on file" : term.phase === "before" ? "Term not started" : reached >= expected ? "On schedule" : "Behind" };
    }).sort((a, b) => a.subject.localeCompare(b.subject) || a.arm.localeCompare(b.arm));
    const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
    const reachedTotal = rows.reduce((sum, row) => sum + Math.min(row.reached, row.expected), 0);
    return { scope: scope.all ? "school" : "department", term: this.scheme.termView(term), rows, kpis: { onSchedule: rows.filter((row) => row.state === "On schedule").length, behind: rows.filter((row) => row.state === "Behind").length, none: rows.filter((row) => row.state === "No scheme on file").length, covered: expectedTotal ? Math.round((reachedTotal / expectedTotal) * 100) : null, total: rows.length } };
  }

  async exportCoverage(session: SessionPayload) {
    const data = await this.coverage(session);
    const cell = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [["Subject", "Arm", "Teacher", "Weeks planned", "Weeks expected by now", "Weeks reached", "State"].map(cell).join(","), ...data.rows.map((row) => [row.subject, row.arm, row.teacher, row.planned, row.expected, row.reached, row.state].map(cell).join(","))].join("\n");
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.EXPORT, entityType: "SchemeOfWork", entityId: data.term.id, metadata: { summary: `Curriculum coverage exported · ${data.term.name}`, rows: data.rows.length } } });
    return { filename: `curriculum-coverage-${data.term.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csv };
  }
}
