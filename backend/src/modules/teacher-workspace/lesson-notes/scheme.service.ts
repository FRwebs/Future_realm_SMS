import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, SchemeOfWorkWeekType, type SowTopic } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../../src/lib/auth/session-core";
import { prisma } from "../../../../../src/lib/db/prisma";
import { readSpreadsheet } from "../../../common/xlsx";
import { CurriculumCatalogueService, termNumber } from "../../curriculum-catalogue/curriculum-catalogue.service";
import { armName, fullName } from "../../fee-management/fees.shared";
import { TeacherWorkspaceService } from "../workspace.service";
import { ASSESSMENTS, PLACEHOLDER, countWritten, letterhead, RESOURCE_KINDS, STATUS_OPTIONS, focusWeek, groupsOf, isLive, isShortWeek, lines, noteState, rangeLabel, statusOf, termsOf, uiKind, type Group, type Term } from "./shared";

const REVISION_DEFAULT = [
  { topic: "Revision", subtopics: ["The term in review", "Past questions, timed"], assessment: "Quiz" },
  { topic: "End-of-term review", subtopics: ["Going over the examination", "Targets for next term"], assessment: "None" },
];

const resourceSchema = z.object({ kind: z.string().default("Other"), label: z.string().trim().min(1) });
const weekItem = z.object({
  from: z.number().int().min(1).max(40).nullable().optional(),
  kind: z.enum(["teach", "rev", "free"]).default("teach"),
  topic: z.string().trim().max(200).default(""),
  subtopics: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  covered: z.array(z.number().int().min(0)).default([]),
  assessment: z.string().trim().max(60).nullable().optional(),
  periods: z.number().int().min(0).max(14).nullable().optional(),
  resources: z.array(resourceSchema).max(30).default([]),
  status: z.string().nullable().optional(),
});
const replaceSchema = z.object({ baseVersion: z.number().int().min(0).optional(), weeks: z.array(weekItem).min(1).max(30), discardNotes: z.boolean().default(false), termId: z.string().optional() });
const coverageSchema = z.object({
  termId: z.string().optional(),
  covered: z.array(z.number().int().min(0)).optional(),
  status: z.string().nullable().optional(),
  action: z.enum(["carry", "markAll", "push"]).optional(),
});
const addSchema = z.object({
  subjectId: z.string().min(1, "Choose the subject."),
  classIds: z.array(z.string()).min(1, "Choose at least one class."),
  periodsPerWeek: z.number().int().min(1).max(14).default(3),
  lessonMinutes: z.number().int().min(20).max(120).default(40),
  curriculum: z.string().trim().optional(),
  source: z.string().trim().optional(),
  book: z.string().trim().optional(),
  weeks: z.array(z.object({ topic: z.string().trim().default(""), subtopics: z.array(z.string().trim()).default([]), assessment: z.string().nullable().optional(), periods: z.number().int().min(0).max(14).nullable().optional(), kind: z.enum(["teach", "rev"]).default("teach") })).min(1).max(30),
  nextTerm: z.array(z.object({ topic: z.string().trim().default(""), subtopics: z.array(z.string().trim()).default([]), assessment: z.string().nullable().optional(), kind: z.enum(["teach", "rev"]).default("teach") })).max(30).default([]),
});

type Schemes = Awaited<ReturnType<TeacherSchemeService["schemesFor"]>>;
export type WeekView = ReturnType<TeacherSchemeService["weekViews"]>[number];

/**
 * The scheme of work, as the teacher plans and runs it. One scheme per subject is held across every arm that takes it, so a week is
 * planned once; what is on each week — topic, sub-topics, what has been covered, the periods it takes, its resources — is what the notes,
 * the coverage and the week ahead all read. A week's status is the calendar's guess until the teacher says otherwise.
 */
@Injectable()
export class TeacherSchemeService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly catalogue: CurriculumCatalogueService) {}

  /* ───────────────────────── context ───────────────────────── */

  async ctx(session: SessionPayload) {
    const terms = await termsOf(session.schoolId);
    if (!terms.current) throw new NotFoundException("No term is current, so there is no scheme to plan. Set one in School Configuration.");
    const { me, groups } = await groupsOf(session, this.workspace, terms);
    return { me, terms: terms as { current: Term; next: Term | null }, groups };
  }

  private pickTerm(terms: { current: Term; next: Term | null }, termId?: string) {
    if (termId && terms.next && terms.next.id === termId) return terms.next;
    return terms.current;
  }

  async schemesFor(schoolId: string, termId: string, subjectId: string, classIds: string[]) {
    return prisma.schemeOfWork.findMany({ where: { schoolId, termId, subjectId, classId: { in: classIds } }, include: { topics: { orderBy: { weekNumber: "asc" } } }, orderBy: { createdAt: "asc" } });
  }

  private async plansFor(schoolId: string, ownerId: string | null, subjectId: string, termId: string) {
    return prisma.lessonPlan.findMany({ where: { schoolId, teacherId: ownerId ?? "-", subjectId, termId, deletedAt: null }, select: { weekNumber: true, status: true, sections: true, topic: true } });
  }

  /* ───────────────────────── reading ───────────────────────── */

  /** Each week as the page draws it, built from the topic rows of every arm. */
  weekViews(term: Term, group: Group, schemes: Schemes, plans: Awaited<ReturnType<TeacherSchemeService["plansFor"]>>, sectionCount: number) {
    const startWeek = Math.max(1, ...schemes.map((scheme) => scheme.startWeek));
    const count = Math.max(term.weeks, ...schemes.flatMap((scheme) => scheme.topics.map((topic) => topic.weekNumber)));
    const out = [];
    for (let week = 1; week <= count; week += 1) {
      const rows = schemes.map((scheme) => scheme.topics.find((topic) => topic.weekNumber === week)).filter((row): row is SowTopic => Boolean(row));
      const row = rows.find((candidate) => candidate.topic.trim() && !PLACEHOLDER.test(candidate.topic)) ?? rows[0];
      const topic = row && !PLACEHOLDER.test(row.topic) ? row.topic : "";
      const kind: "teach" | "rev" | "free" | "pre" = week < startWeek ? "pre" : uiKind(row?.weekType ?? "TEACHING", topic);
      const subtopics = row ? lines(row.subtopics) : [];
      const covered = row ? (row.isCovered && !(row.coveredSubtopics ?? []).length ? subtopics.map((_, index) => index) : (row.coveredSubtopics ?? []).filter((index) => index < subtopics.length)) : [];
      const override = row?.statusOverride ?? null;
      const status = kind === "pre" ? "Not planned" : statusOf(term, week, { kind, override, subs: subtopics.length, covered: covered.length, startWeek });
      const auto = kind === "pre" ? "Not planned" : statusOf(term, week, { kind, override: null, subs: subtopics.length, covered: covered.length, startWeek });
      const plan = plans.find((candidate) => candidate.weekNumber === week);
      const written = plan ? countWritten(plan.sections) : 0;
      const resources = Array.isArray(row?.resourceList) ? (row!.resourceList as Array<{ kind: string; label: string }>) : [];
      out.push({
        week, dates: rangeLabel(term, week), short: isShortWeek(term, week), kind, topic, subtopics, covered, status, auto, override,
        assessment: row?.assessment ?? null, periods: row?.periods ?? null, resources,
        /** The teacher said so — every sub-topic ticked, or the week marked taught. The calendar's guess is not evidence. */
        evidence: kind !== "pre" && kind !== "free" && (override === "Taught" || (subtopics.length > 0 && covered.length >= subtopics.length)),
        note: { state: kind === "free" || kind === "pre" ? "" : noteState(plan?.status, plan?.sections as Record<string, string> | null), done: written, of: sectionCount },
        locked: kind === "pre" || (term.phase === "after" && term.isCurrent ? false : term.current !== null && week < term.current),
      });
    }
    return out;
  }

  private async periodsThisWeek(session: SessionPayload, group: Group, term: Term) {
    if (group.earlyYears || term.current === null) return [];
    const entries = await prisma.timetableEntry.findMany({ where: { schoolId: session.schoolId, termId: term.id, subjectId: group.subjectId, classId: { in: group.classIds }, isPublished: true }, orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }], select: { classId: true, dayOfWeek: true, periodNumber: true, startsAt: true, endsAt: true } });
    const now = new Date();
    const dow = now.getUTCDay();
    const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(now);
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return group.arms.map((arm) => {
      const own = entries.filter((entry) => entry.classId === arm.id);
      return { arm: arm.name, periods: own.map((entry) => ({ day: names[entry.dayOfWeek] ?? "", period: entry.periodNumber, time: `${entry.startsAt}–${entry.endsAt}`, done: entry.dayOfWeek < dow || (entry.dayOfWeek === dow && entry.endsAt <= clock) })) };
    }).filter((arm) => arm.periods.length);
  }

  async overview(session: SessionPayload) {
    const { me, terms, groups } = await this.ctx(session);
    const sections = (group: Group) => (group.earlyYears ? 6 : 7);
    const subjects = [];
    for (const group of groups) {
      const schemes = await this.schemesFor(session.schoolId, terms.current.id, group.subjectId, group.classIds);
      const plans = await this.plansFor(session.schoolId, group.ownerId, group.subjectId, terms.current.id);
      const weeks = this.weekViews(terms.current, group, schemes, plans, sections(group));
      // As the scheme itself reads: a topic is taught when its week says so — by the calendar, the ticks, or the teacher.
      const teach = weeks.filter((week) => week.kind === "teach");
      const planned = weeks.filter((week) => week.kind === "teach" || week.kind === "rev");
      const taught = teach.filter((week) => week.status === "Taught").length;
      const slipped = planned.some((week) => week.status === "Postponed" || week.status === "Partly taught");
      const signed = weeks.filter((week) => week.note.state === "Approved").length;
      const toWrite = weeks.filter((week) => week.note.state === "Not started" && (week.kind === "teach" || week.kind === "rev") && (terms.current.current === null || week.week <= terms.current.current)).length;
      const meta = schemes[0];
      const expected = planned.filter((week) => terms.current.phase === "after" || (terms.current.current !== null && week.week <= terms.current.current)).length;
      subjects.push({
        subjectId: group.subjectId, subject: group.subject, arms: group.arms.map((arm) => arm.name), earlyYears: group.earlyYears, readOnly: group.readOnly, custom: group.custom,
        per: meta?.periodsPerWeek ?? null, lessonMinutes: meta?.lessonMinutes ?? 40, source: meta?.source ?? meta?.curriculum ?? null,
        planned: planned.length, weeks: terms.current.weeks, taught, teachTotal: teach.length, signed, toWrite, expected,
        status: group.readOnly ? "Read only" : group.custom ? "Added by you" : !schemes.length || !planned.length ? "Not planned" : slipped ? "Behind" : "On schedule",
        awaitingTimetable: group.custom, schemeStatus: !schemes.length ? "None" : schemes.every((scheme) => scheme.status === "APPROVED") ? "Approved" : schemes.some((scheme) => scheme.status === "SUBMITTED") ? "Submitted" : schemes.some((scheme) => scheme.status === "RETURNED") ? "Returned" : "Draft",
      });
    }
    return { persona: me.persona, term: this.termView(terms.current), nextTerm: terms.next ? this.termView(terms.next) : null, canAdd: me.persona !== "early-years" && !groups.every((group) => group.readOnly) || groups.length === 0 && me.persona !== "early-years", coverOf: groups.find((group) => group.readOnly) ? true : false, subjects };
  }

  termView(term: Term) {
    return { id: term.id, name: term.name, session: term.session, startsOn: term.startsOn.toISOString(), endsOn: term.endsOn.toISOString(), weeks: term.weeks, current: term.current, phase: term.phase, isCurrent: term.isCurrent, number: termNumber(term.name) };
  }

  async scheme(session: SessionPayload, subjectId: string, termId?: string) {
    const { me, terms, groups } = await this.ctx(session);
    const group = groups.find((entry) => entry.subjectId === subjectId);
    if (!group) throw new ForbiddenException("That is not a subject you teach, so its scheme of work is not yours to read.");
    const term = this.pickTerm(terms, termId);
    const schemes = await this.schemesFor(session.schoolId, term.id, group.subjectId, group.classIds);
    const plans = await this.plansFor(session.schoolId, group.ownerId, group.subjectId, term.id);
    const weeks = this.weekViews(term, group, schemes, plans, group.earlyYears ? 6 : 7);
    const meta = schemes[0];
    const classSubject = await prisma.classSubject.findFirst({ where: { schoolId: session.schoolId, subjectId, classId: { in: group.classIds } }, select: { periodsPerWeek: true, subject: { select: { periodsPerWeek: true } } } });
    const owner = group.readOnly && group.ownerId ? await prisma.user.findUnique({ where: { id: group.ownerId }, select: { firstName: true, lastName: true } }) : null;
    const dup = await this.catalogue.matching(session.schoolId, group.subject, [...new Set((await prisma.classRoom.findMany({ where: { id: { in: group.classIds } }, select: { classLevel: { select: { name: true } } } })).map((room) => room.classLevel.name))], termNumber(term.name));
    return {
      subjectId, subject: group.subject, arms: group.arms.map((arm) => arm.name), earlyYears: group.earlyYears, readOnly: group.readOnly, owner: owner ? fullName(owner) : null, custom: group.custom,
      per: meta?.periodsPerWeek ?? classSubject?.periodsPerWeek ?? classSubject?.subject.periodsPerWeek ?? 3, lessonMinutes: meta?.lessonMinutes ?? 40, curriculum: meta?.curriculum ?? null, source: meta?.source ?? null, book: meta?.book ?? null,
      term: this.termView(term), terms: [this.termView(terms.current), ...(terms.next ? [this.termView(terms.next)] : [])],
      schemeStatus: !schemes.length ? "None" : schemes.every((scheme) => scheme.status === "APPROVED") ? "Approved" : schemes.some((scheme) => scheme.status === "SUBMITTED") ? "Submitted" : schemes.some((scheme) => scheme.status === "RETURNED") ? "Returned" : "Draft",
      returnReason: schemes.find((scheme) => scheme.returnReason)?.returnReason ?? null, updatedAt: schemes.map((scheme) => scheme.updatedAt.getTime()).sort((a, b) => b - a)[0] ?? 0, letterhead: await letterhead(session.schoolId),
      focus: focusWeek(term), weeks, periods: await this.periodsThisWeek(session, group, term), statuses: STATUS_OPTIONS, assessments: ASSESSMENTS, resourceKinds: RESOURCE_KINDS,
      catalogue: dup.map((entry) => ({ id: entry.id, curriculum: entry.curriculum, stage: entry.stage, source: entry.source, topics: entry.topics.length, own: entry.own })),
      me: { persona: me.persona },
    };
  }

  /* ───────────────────────── writing ───────────────────────── */

  private async ensureSchemes(session: SessionPayload, term: Term, group: Group, base?: { periodsPerWeek?: number | null; lessonMinutes?: number | null; curriculum?: string | null; source?: string | null; book?: string | null; addedByTeacher?: boolean }) {
    for (const classId of group.classIds) {
      const existing = await prisma.schemeOfWork.findFirst({ where: { schoolId: session.schoolId, termId: term.id, subjectId: group.subjectId, classId } });
      if (existing) continue;
      await prisma.schemeOfWork.create({ data: { schoolId: session.schoolId, subjectId: group.subjectId, classId, academicSessionId: term.academicSessionId, termId: term.id, teacherId: session.userId, ...(base ?? {}) } });
    }
  }

  /**
   * Writes the whole term from the page: every week, in the order the teacher left them. A week carries where it came from, so a note
   * follows its topic when topics are moved. Weeks already behind a teacher in the current term can be corrected, never moved.
   */
  /** The version of a scheme as a person last saw it: when anything in it last changed. */
  private async versionOf(schoolId: string, termId: string, group: Group) {
    const rows = await prisma.schemeOfWork.findMany({ where: { schoolId, termId, subjectId: group.subjectId, classId: { in: group.classIds } }, select: { updatedAt: true } });
    return rows.reduce((latest, row) => Math.max(latest, row.updatedAt.getTime()), 0);
  }

  private async writeWeeks(session: SessionPayload, group: Group, term: Term, items: Array<z.infer<typeof weekItem>>, discardNotes: boolean, baseVersion?: number) {
    if (baseVersion !== undefined && (await this.versionOf(session.schoolId, term.id, group)) !== baseVersion) {
      throw new ConflictException("This scheme was changed after you opened it — in another tab or on another device. Reload to see the latest, then make your changes again.");
    }
    await this.ensureSchemes(session, term, group);
    const schemes = await this.schemesFor(session.schoolId, term.id, group.subjectId, group.classIds);
    const startWeek = Math.max(1, ...schemes.map((scheme) => scheme.startWeek));
    items.forEach((item, index) => {
      const week = index + 1;
      if (term.current !== null && week < term.current && term.isCurrent && (item.from ?? week) !== week) throw new BadRequestException(`Week ${week} is already behind you, so a topic cannot be moved into it or out of it.`);
      if (week < startWeek && item.topic.trim()) throw new BadRequestException(`Week ${week} is before this subject starts.`);
    });
    const plans = await prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId: group.subjectId, termId: term.id, deletedAt: null } });
    const moved = new Set(items.map((item) => item.from).filter((value): value is number => typeof value === "number"));
    const orphaned = plans.filter((plan) => !moved.has(plan.weekNumber) && Object.values((plan.sections ?? {}) as Record<string, string>).some((value) => String(value).trim()));
    if (orphaned.length && !discardNotes) throw new BadRequestException(`Week ${orphaned.map((plan) => plan.weekNumber).join(", ")} ${orphaned.length === 1 ? "has" : "have"} a note written against ${orphaned.length === 1 ? "its" : "their"} topic, and ${orphaned.length === 1 ? "that topic is" : "those topics are"} being removed. Move the topic instead, or confirm that the note goes with it.`);
    const touched = new Set<string>();
    for (const scheme of schemes) {
      const existing = new Map(scheme.topics.map((topic) => [topic.weekNumber, topic]));
      for (const [index, item] of items.entries()) {
        const week = index + 1;
        const free = item.kind === "free" || !item.topic.trim();
        const subs = free ? [] : item.subtopics;
        const covered = item.covered.filter((entry) => entry < subs.length);
        const data = {
          topic: free ? `Week ${week} topic to be planned` : item.topic, subtopics: subs as Prisma.InputJsonValue, weekType: item.kind === "rev" ? SchemeOfWorkWeekType.REVISION : SchemeOfWorkWeekType.TEACHING,
          assessment: item.assessment ?? null, periods: item.periods ?? null, resourceList: item.resources as Prisma.InputJsonValue, statusOverride: free ? null : item.status && STATUS_OPTIONS.some(([name]) => name === item.status) ? item.status : null,
          coveredSubtopics: covered, isCovered: subs.length > 0 && covered.length >= subs.length, coveredDate: subs.length > 0 && covered.length >= subs.length ? new Date() : null, coveredById: subs.length > 0 && covered.length >= subs.length ? session.userId : null, sortOrder: week,
        };
        const before = existing.get(week);
        if (before) {
          const changed = before.topic !== data.topic || JSON.stringify(before.subtopics ?? []) !== JSON.stringify(subs) || before.weekType !== data.weekType;
          if (changed) touched.add(scheme.id);
          await prisma.sowTopic.update({ where: { id: before.id }, data });
        } else {
          touched.add(scheme.id);
          await prisma.sowTopic.create({ data: { schoolId: session.schoolId, schemeOfWorkId: scheme.id, weekNumber: week, ...data } });
        }
      }
      await prisma.sowTopic.deleteMany({ where: { schemeOfWorkId: scheme.id, weekNumber: { gt: items.length } } });
    }
    // Notes follow their topics.
    const remap = new Map<number, number>();
    items.forEach((item, index) => { if (typeof item.from === "number" && item.from !== index + 1) remap.set(item.from, index + 1); });
    const keepIds = new Set(plans.filter((plan) => moved.has(plan.weekNumber)).map((plan) => plan.id));
    for (const plan of plans) {
      if (!moved.has(plan.weekNumber)) { if (discardNotes) await prisma.lessonPlan.update({ where: { id: plan.id }, data: { deletedAt: new Date() } }); continue; }
      const target = remap.get(plan.weekNumber);
      const topic = items[(target ?? plan.weekNumber) - 1]?.topic;
      if (keepIds.has(plan.id) && (target !== undefined || (topic && topic !== plan.topic))) await prisma.lessonPlan.update({ where: { id: plan.id }, data: { ...(target !== undefined ? { weekNumber: target } : {}), ...(topic ? { topic } : {}) } });
    }
    await prisma.schemeOfWork.updateMany({ where: { id: { in: schemes.map((scheme) => scheme.id) } }, data: { updatedAt: new Date() } });
    for (const scheme of schemes) if (touched.has(scheme.id) && (scheme.status === "APPROVED" || scheme.status === "SUBMITTED")) await prisma.schemeOfWork.update({ where: { id: scheme.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null, submittedAt: null } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "SchemeOfWork", entityId: group.subjectId, metadata: { summary: `Scheme saved · ${group.subject} · ${term.name}`, weeks: items.length } } });
  }

  private editable(group: Group | undefined): Group {
    if (!group) throw new ForbiddenException("That is not a subject you teach, so its scheme of work is not yours to plan.");
    if (group.readOnly) throw new ForbiddenException("You hold this on cover, so you read its scheme and teach from it — the scheme itself is its owner's to change.");
    return group;
  }

  async replace(session: SessionPayload, subjectId: string, body: unknown) {
    const input = replaceSchema.parse(body);
    const { terms, groups } = await this.ctx(session);
    const group = this.editable(groups.find((entry) => entry.subjectId === subjectId));
    const term = this.pickTerm(terms, input.termId);
    await this.writeWeeks(session, group, term, input.weeks, input.discardNotes, input.baseVersion);
    return { subjectId, weeks: input.weeks.length };
  }

  private async currentItems(session: SessionPayload, group: Group, term: Term) {
    const schemes = await this.schemesFor(session.schoolId, term.id, group.subjectId, group.classIds);
    const plans = await this.plansFor(session.schoolId, group.ownerId, group.subjectId, term.id);
    return this.weekViews(term, group, schemes, plans, group.earlyYears ? 6 : 7).map((view): z.infer<typeof weekItem> => ({ from: view.week, kind: view.kind === "pre" ? "free" : view.kind, topic: view.topic, subtopics: view.subtopics, covered: view.covered, assessment: view.assessment, periods: view.periods, resources: view.resources, status: view.override }));
  }

  /** What happens at a week on the day: tick what was covered, say how it stands, carry the rest on, or push it a week. */
  async coverage(session: SessionPayload, subjectId: string, week: number, body: unknown) {
    const input = coverageSchema.parse(body);
    const { terms, groups } = await this.ctx(session);
    const group = this.editable(groups.find((entry) => entry.subjectId === subjectId));
    const term = this.pickTerm(terms, input.termId);
    const items = await this.currentItems(session, group, term);
    const at = week - 1;
    const item = items[at];
    if (!item || item.kind === "free") throw new BadRequestException("That week has nothing planned, so there is nothing to mark.");
    if (input.covered) item.covered = [...new Set(input.covered)].filter((index) => index < item.subtopics.length).sort((a, b) => a - b);
    if (input.status !== undefined) item.status = input.status;
    if (input.action === "markAll") item.covered = item.subtopics.map((_, index) => index);
    if (input.action === "carry") {
      const next = items[at + 1];
      if (!next || next.kind === "free") throw new BadRequestException("The next week has no topic to carry these into.");
      const left = item.subtopics.filter((_, index) => !item.covered.includes(index));
      if (!left.length) throw new BadRequestException("Everything in this week is already covered.");
      item.subtopics = item.subtopics.filter((_, index) => item.covered.includes(index));
      item.covered = item.subtopics.map((_, index) => index);
      next.subtopics = [...left.map((entry) => `${entry} (carried)`), ...next.subtopics];
      next.covered = next.covered.map((index) => index + left.length);
    }
    if (input.action === "push") {
      const next = items[at + 1];
      if (!next) throw new BadRequestException("There is no later week to push it into.");
      if (term.current !== null && week < term.current && term.isCurrent) throw new BadRequestException("That week is already behind you.");
      items[at] = { ...next, from: week + 1 };
      items[at + 1] = { ...item, from: week };
    }
    await this.writeWeeks(session, group, term, items, false);
    return { subjectId, week };
  }

  async submit(session: SessionPayload, subjectId: string, termId?: string) {
    const { terms, groups } = await this.ctx(session);
    const group = this.editable(groups.find((entry) => entry.subjectId === subjectId));
    const term = this.pickTerm(terms, termId);
    const schemes = await this.schemesFor(session.schoolId, term.id, group.subjectId, group.classIds);
    if (!schemes.length) throw new BadRequestException("Plan the weeks first — there is no scheme to submit.");
    const planned = Math.max(...schemes.map((scheme) => scheme.topics.filter((topic) => topic.topic.trim() && !PLACEHOLDER.test(topic.topic)).length));
    const need = Math.min(10, Math.max(4, term.weeks - 4));
    if (planned < need) throw new BadRequestException(`At least ${need} weeks must be planned before a scheme is submitted. You have planned ${planned}.`);
    await prisma.schemeOfWork.updateMany({ where: { id: { in: schemes.map((scheme) => scheme.id) } }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedById: session.userId, returnReason: null } });
    return { subjectId, planned };
  }

  /* ───────────────────────── the catalogue ───────────────────────── */

  async applyCatalogue(session: SessionPayload, subjectId: string, body: unknown) {
    const input = z.object({ entryId: z.string().min(1, "Choose an outline."), replace: z.coerce.boolean().default(false), termId: z.string().optional() }).parse(body);
    const { terms, groups } = await this.ctx(session);
    const group = this.editable(groups.find((entry) => entry.subjectId === subjectId));
    const term = this.pickTerm(terms, input.termId);
    const entry = await this.catalogue.entry(session.schoolId, input.entryId);
    if (!entry) throw new NotFoundException("That outline is no longer in the catalogue.");
    const items = await this.currentItems(session, group, term);
    while (items.length < term.weeks) items.push({ from: null, kind: "free", topic: "", subtopics: [], covered: [], resources: [] });
    let filled = 0;
    let kept = 0;
    for (const topic of entry.topics) {
      const at = topic.week - 1;
      if (at >= items.length) continue;
      const existing = items[at]!;
      if (existing.kind !== "free" && existing.topic.trim() && !input.replace) { kept += 1; continue; }
      items[at] = { ...existing, kind: "teach", topic: topic.topic, subtopics: topic.subtopics, covered: [], assessment: topic.assessment ?? existing.assessment ?? null };
      filled += 1;
    }
    await this.writeWeeks(session, group, term, items, true);
    await prisma.schemeOfWork.updateMany({ where: { schoolId: session.schoolId, termId: term.id, subjectId, classId: { in: group.classIds } }, data: { curriculum: entry.curriculum, source: entry.source ?? entry.curriculum, book: entry.book } });
    return { filled, kept, from: `${entry.curriculum} · ${entry.subject} · ${entry.stage}` };
  }

  /* ───────────────────────── adding a subject ───────────────────────── */

  async addOptions(session: SessionPayload) {
    const { me, terms, groups } = await this.ctx(session);
    if (me.persona === "early-years") throw new ForbiddenException("An early-years class plans its weekly sheet across all seven areas; there is no subject to add.");
    const [subjects, levels, entries] = await Promise.all([
      prisma.subject.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, code: { not: "EYFS-ALL" } }, select: { id: true, name: true, periodsPerWeek: true, applicableClassLevels: true, section: true }, orderBy: [{ name: "asc" }, { code: "asc" }] }),
      prisma.classLevel.findMany({ where: { schoolId: session.schoolId }, select: { id: true, name: true, order: true, classRooms: { where: { deletedAt: null, isActive: true }, select: { id: true, name: true, arm: true }, orderBy: { name: "asc" } } }, orderBy: { order: "asc" } }),
      this.catalogue.list(session.schoolId),
    ]);
    return {
      term: this.termView(terms.current), nextTerm: terms.next ? this.termView(terms.next) : null, weeks: terms.current.weeks,
      held: groups.map((group) => ({ subjectId: group.subjectId, subject: group.subject, classIds: group.classIds, arms: group.arms.map((arm) => arm.name) })),
      subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name, periodsPerWeek: subject.periodsPerWeek, levels: subject.applicableClassLevels, section: String(subject.section) })), levels: levels.filter((level) => level.classRooms.length).map((level) => ({ id: level.id, name: level.name, arms: level.classRooms.map((room) => ({ id: room.id, name: armName(room) })) })),
      catalogue: entries.filter((entry) => entry.term === termNumber(terms.current.name)), curricula: [...new Set(entries.map((entry) => entry.curriculum))], assessments: ASSESSMENTS, defaultLesson: 40,
    };
  }

  async addSubject(session: SessionPayload, body: unknown) {
    const input = addSchema.parse(body);
    const { me, terms, groups } = await this.ctx(session);
    if (me.persona === "early-years") throw new ForbiddenException("An early-years class plans across all seven areas.");
    const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, schoolId: session.schoolId, isActive: true, deletedAt: null } });
    if (!subject) throw new NotFoundException("That subject is not on this school’s list.");
    const rooms = await prisma.classRoom.findMany({ where: { id: { in: input.classIds }, schoolId: session.schoolId, deletedAt: null }, select: { id: true, name: true, arm: true } });
    if (rooms.length !== input.classIds.length) throw new BadRequestException("One of those classes is not on this school’s list.");
    const mine = groups.filter((group) => !group.readOnly && group.subjectId === subject.id);
    const clash = mine.flatMap((group) => group.classIds).filter((id) => input.classIds.includes(id));
    if (clash.length) throw new BadRequestException(`You already plan ${subject.name} for ${rooms.filter((room) => clash.includes(room.id)).map(armName).join(", ")}. Choose other arms, or open the one you have.`);
    const mapped = await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, subjectId: subject.id, classId: { in: input.classIds }, teacherId: { not: null, notIn: [session.userId] } }, include: { classRoom: { select: { name: true, arm: true } } } });
    if (mapped.length) throw new BadRequestException(`${subject.name} is already taught in ${mapped.map((row) => armName(row.classRoom)).join(", ")} by another teacher. Ask the school office to change it.`);
    const term = terms.current;
    const weeks = input.weeks.slice(0, term.weeks + 2);
    const group: Group = { subjectId: subject.id, subject: subject.name, classIds: input.classIds, arms: rooms.map((room) => ({ id: room.id, name: armName(room) })), readOnly: false, ownerId: session.userId, custom: true, earlyYears: false };
    await this.ensureSchemes(session, term, group, { periodsPerWeek: input.periodsPerWeek, lessonMinutes: input.lessonMinutes, curriculum: input.curriculum ?? null, source: input.source ?? input.curriculum ?? null, book: input.book ?? null, addedByTeacher: true });
    await this.writeWeeks(session, group, term, weeks.map((week) => ({ from: null, kind: week.topic.trim() ? week.kind : "free", topic: week.topic, subtopics: week.subtopics.filter(Boolean), covered: [], assessment: week.assessment ?? null, periods: week.periods ?? null, resources: [] })), true);
    if (terms.next && input.nextTerm.length) {
      await this.ensureSchemes(session, terms.next, group, { periodsPerWeek: input.periodsPerWeek, lessonMinutes: input.lessonMinutes, curriculum: input.curriculum ?? null, source: input.source ?? input.curriculum ?? null, book: input.book ?? null, addedByTeacher: true });
      await this.writeWeeks(session, group, terms.next, input.nextTerm.map((week) => ({ from: null, kind: week.topic.trim() ? week.kind : "free", topic: week.topic, subtopics: week.subtopics.filter(Boolean), covered: [], assessment: week.assessment ?? null, periods: null, resources: [] })), true);
    }
    // The school is told, so the subject can be put on the timetable. Until then it has no register and no score sheet.
    const office = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: { in: ["PRINCIPAL", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER"] } }, select: { id: true } });
    for (const person of office) await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: person.id, channel: "IN_APP", title: "A teacher added a subject to their curriculum", body: `${me.person.name} · ${subject.name} · ${group.arms.map((arm) => arm.name).join(", ")} — map it on Class & Timetable so it gets a register and a score sheet.`, status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "SchemeOfWork", entityId: subject.id, metadata: { summary: `Subject added by a teacher · ${subject.name} · ${group.arms.map((arm) => arm.name).join(", ")}`, weeks: weeks.length } } });
    return { subjectId: subject.id, subject: subject.name, arms: group.arms.map((arm) => arm.name), told: office.length };
  }

  /** A scheme read out of a filled-in spreadsheet: Week, Topic, Sub-topics (separated by semicolons), and optionally Assessment and Periods. */
  async importWeeks(session: SessionPayload, body: unknown) {
    const input = z.object({ file: z.string().min(10, "Choose the file first.") }).parse(body);
    await this.ctx(session);
    const base64 = input.file.includes(",") ? input.file.slice(input.file.indexOf(",") + 1) : input.file;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 2_000_000) throw new BadRequestException("That file is larger than 2 MB.");
    let grid;
    try { grid = readSpreadsheet(buffer); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "That file could not be read."); }
    const headerAt = grid.findIndex((row) => row.some((cell) => /^topic$/i.test(String(cell ?? "").trim())));
    if (headerAt < 0) throw new BadRequestException("The first row needs a “Topic” heading — and, if you like, Week, Sub-topics, Assessment and Periods.");
    const heads = grid[headerAt]!.map((cell) => String(cell ?? "").trim().toLowerCase());
    const col = (names: string[]) => heads.findIndex((head) => names.includes(head));
    const [wk, tp, st, as, pe] = [col(["week", "wk"]), col(["topic"]), col(["sub-topics", "subtopics", "sub topics"]), col(["assessment"]), col(["periods"])];
    const weeks: Array<{ week: number; topic: string; subtopics: string[]; assessment: string | null; periods: number | null }> = [];
    for (const [index, line] of grid.slice(headerAt + 1).entries()) {
      const topic = String(line[tp] ?? "").trim();
      if (!topic) continue;
      const week = wk >= 0 && Number(line[wk]) > 0 ? Number(line[wk]) : index + 1;
      weeks.push({ week, topic, subtopics: lines(String(line[st] ?? "")), assessment: as >= 0 && line[as] ? String(line[as]) : null, periods: pe >= 0 && Number(line[pe]) >= 0 && line[pe] !== null ? Number(line[pe]) : null });
    }
    if (!weeks.length) throw new BadRequestException("No topic was found in that file.");
    return { weeks: weeks.sort((a, b) => a.week - b.week).slice(0, 30), found: weeks.length };
  }

  async removeSubject(session: SessionPayload, subjectId: string) {
    const { terms, groups } = await this.ctx(session);
    const group = this.editable(groups.find((entry) => entry.subjectId === subjectId));
    if (!group.custom) throw new BadRequestException("A subject the school assigned to you can never be removed here.");
    const termIds = [terms.current.id, terms.next?.id].filter(Boolean) as string[];
    await prisma.lessonPlan.updateMany({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, termId: { in: termIds }, deletedAt: null }, data: { deletedAt: new Date() } });
    await prisma.schemeOfWork.deleteMany({ where: { schoolId: session.schoolId, teacherId: session.userId, subjectId, termId: { in: termIds }, addedByTeacher: true } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.DELETE, entityType: "SchemeOfWork", entityId: subjectId, metadata: { summary: `Added subject removed · ${group.subject}` } } });
    return { subjectId };
  }

  /** The revision weeks a new term ends with, so a blank scheme starts with the shape of a term rather than a blank page. */
  revisionDefaults() { return REVISION_DEFAULT; }
}
export { isLive };
