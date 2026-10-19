import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ApprovalStatus } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { notifyStaff } from "../attendance-management/attendance.shared";
import { CorrectionsService as AttendanceCorrectionsService } from "../attendance-management/corrections.service";
import { ReviewService as FeeReviewService } from "../fee-management/review.service";
import { ScoreCorrectionsService } from "../score-results/corrections.service";
import { ReviewService as SheetReviewService } from "../score-results/review.service";
import { LeaveService } from "../staff-access/leave.service";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { ChangesService } from "../student-records/changes.service";
import { ApprovalsService } from "./approvals.service";
import { APPROVER_LABELS, ENFORCED, ESCALATE_TO, labelOfRole, loadRoutes, mayDecide, NOTIFY, OVERSIGHT, OWNERS, parseKey, ROLES_OF, ROUTE_DEFAULTS, WHO_MAY_SUBMIT, daysBetween, type Decided, type Item, type Route, type RouteType } from "./hub.shared";
import { contextOf, loadDecided, loadPending } from "./hub.sources";
import { RULE_FIELDS, type StandingRule } from "./standing-rules";

const DAY = 86_400_000;
/** Never offered a bulk approval, whatever a route says: each of these changes something that cannot be quietly undone. */
const LOCKED_BULK = new Set<RouteType>(["SCORE_CORRECTION", "RESULTS_PUBLICATION", "FEE_WAIVER", "STAFF_ACCESS"]);
const MAX_BULK = 20;

const decideSchema = z.object({ decision: z.enum(["approve", "return", "decline"]), note: z.string().trim().optional() });
const messageSchema = z.object({ text: z.string().trim().min(2, "Write the message.").max(2000) });
const bulkSchema = z.object({ keys: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])), decision: z.enum(["approve", "return", "decline"]).default("approve"), note: z.string().trim().optional() });
const routeSchema = z.object({
  approver: z.string().refine((value) => APPROVER_LABELS.includes(value), "Choose a role that decides this."),
  second: z.string().default("Not required").transform((value) => (value === "Not required" ? "" : value)),
  escalateDays: z.coerce.number().int().min(1).max(30),
  escalateTo: z.string().refine((value) => ESCALATE_TO.includes(value), "Choose who it escalates to."),
  evidence: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === "true"),
  bulk: z.string().default("Never"),
  who: z.string().refine((value) => WHO_MAY_SUBMIT.includes(value), "Choose who may submit it."),
  notify: z.string().refine((value) => NOTIFY.includes(value), "Choose when the requester is told."),
});
const ruleSchema = z.object({
  name: z.string().trim().min(6, "Name the rule so it can be recognised in the log."),
  fields: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])).refine((value) => value.length > 0 && value.every((field) => RULE_FIELDS.includes(field)), "Choose which fields it covers."),
  maxChars: z.coerce.number().int().min(1).max(5),
  why: z.string().trim().min(8, "Say why the school agreed this — it is read in the log."),
});

const typeName = (type: RouteType) => ROUTE_DEFAULTS.find((route) => route.type === type)?.name ?? type;

@Injectable()
export class HubService {
  constructor(
    private readonly natives: ApprovalsService,
    private readonly corrections: ScoreCorrectionsService,
    private readonly sheets: SheetReviewService,
    private readonly registers: AttendanceCorrectionsService,
    private readonly waivers: FeeReviewService,
    private readonly changes: ChangesService,
    private readonly leave: LeaveService,
  ) {}

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata: metadata as never } });
  }

  /** "This session" is the academic session the school is in, so a figure here and on Performance are the same figure. */
  private async sessionStart(schoolId: string): Promise<Date> {
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: { select: { startDate: true } } } });
    return term?.academicSession?.startDate ?? new Date(Date.now() - 180 * DAY);
  }

  /* ───────────────────────── what a person may decide ───────────────────────── */

  private canDecide(session: SessionPayload, item: Item, route: Route): boolean {
    if (item.requester?.id === session.userId) return false;
    if (item.source === "NATIVE") {
      if (item.nativeAssigneeId) return item.nativeAssigneeId === session.userId || OWNERS.has(session.role);
      if (item.nativeAssigneeRole === session.role) return true;
    }
    return mayDecide(session, route, item.step);
  }

  private async frame(session: SessionPayload) {
    const [routes, pending] = await Promise.all([loadRoutes(session.schoolId), loadPending(session.schoolId)]);
    const byType = new Map(routes.map((route) => [route.type, route]));
    const keys = pending.map((item) => item.key);
    const escalated = new Set((await prisma.approvalMessage.findMany({ where: { schoolId: session.schoolId, itemKey: { in: keys }, kind: "SYSTEM", body: { startsWith: "Escalated" } }, select: { itemKey: true } })).map((row) => row.itemKey));
    const now = Date.now();
    const views = pending.map((item) => {
      const route = byType.get(item.type) as Route;
      const dueAt = item.raisedAt.getTime() + route.escalateDays * DAY;
      return {
        item,
        route,
        age: Math.floor((now - item.raisedAt.getTime()) / DAY),
        escalatesIn: Math.ceil((dueAt - now) / DAY),
        overdue: dueAt < now,
        escalated: escalated.has(item.key),
        mine: this.canDecide(session, item, route),
        raisedByMe: item.requester?.id === session.userId,
      };
    });
    return { routes, byType, views };
  }

  private present(view: Awaited<ReturnType<HubService["frame"]>>["views"][number]) {
    const { item, route } = view;
    return {
      key: item.key,
      type: item.type,
      typeName: typeName(item.type),
      title: item.title,
      summary: item.summary,
      requester: item.requester ? { name: item.requester.name, role: labelOfRole(item.requester.role) } : null,
      approver: item.step === 2 && route.second ? route.second : route.approver,
      second: route.second,
      state: view.escalated ? "Escalated" : item.state,
      age: view.age,
      escalatesIn: view.escalatesIn,
      overdue: view.overdue,
      escalated: view.escalated,
      blocking: item.blocking,
      evidence: item.evidence,
      mine: view.mine,
      step: item.step,
      bulk: route.bulk && !LOCKED_BULK.has(item.type),
      href: item.href,
      raisedAt: item.raisedAt.toISOString(),
    };
  }

  /**
   * Anything past its routing period is escalated once: the person it escalates to is told, and the item's own
   * thread says so. It is read on the way through, so the queue never has to be polled for it to happen.
   */
  private async sweep(session: SessionPayload, views: Awaited<ReturnType<HubService["frame"]>>["views"]) {
    const late = views.filter((view) => view.overdue && !view.escalated && view.route.escalateTo !== ESCALATE_TO[2]).slice(0, 25);
    if (!late.length) return;
    const label = (route: Route) => (route.escalateTo === ESCALATE_TO[1] ? "Proprietor" : "Principal");
    for (const view of late) {
      const target = label(view.route);
      await prisma.approvalMessage.create({ data: { schoolId: session.schoolId, itemKey: view.item.key, kind: "SYSTEM", body: `Escalated to the ${target} after ${view.route.escalateDays} ${view.route.escalateDays === 1 ? "day" : "days"} without a decision.` } });
      const people = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: { in: ROLES_OF[target] as never[] } }, select: { id: true } });
      if (people.length) await notifyStaff(session.schoolId, session.userId, people.map((person) => person.id), { title: "Approvals · escalated", body: `${typeName(view.item.type)}: ${view.item.title} has waited ${view.age} days, past its ${view.route.escalateDays}-day period, and now sits with you.`, channels: ["In-app inbox"], link: `/approvals-workflow/queue/${encodeURIComponent(view.item.key)}` });
      view.escalated = true;
    }
  }

  /* ───────────────────────── the queue ───────────────────────── */

  async overview(session: SessionPayload, query: { scope?: string; type?: string; state?: string }) {
    const { routes, views } = await this.frame(session);
    await this.sweep(session, views);
    const canSeeAll = OVERSIGHT.has(session.role);
    const mine = views.filter((view) => view.mine).sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.age - a.age);
    const raised = views.filter((view) => view.raisedByMe);
    const decided = await loadDecided(session.schoolId, await this.sessionStart(session.schoolId));
    const mineDecided = decided.filter((entry) => entry.requesterId === session.userId).sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime()).slice(0, 4);
    const avg = decided.length ? decided.reduce((sum, entry) => sum + daysBetween(entry.raisedAt, entry.decidedAt), 0) / decided.length : null;
    const oldest = views.filter((view) => view.mine).sort((a, b) => b.age - a.age)[0] ?? null;
    const blocking = views.filter((view) => view.item.blocking && view.mine);
    const first = mine[0] ?? null;
    const context = first ? await contextOf(session.schoolId, first.item) : null;
    const scope = query.scope === "all" && canSeeAll ? "all" : query.scope === "raised" ? "raised" : "me";
    const pool = scope === "all" ? views : scope === "raised" ? raised : mine;
    const shown = pool.filter((view) => (!query.type || query.type === "all" || view.item.type === query.type) && (!query.state || query.state === "all" || this.present(view).state === query.state));
    return {
      me: { id: session.userId, role: session.role },
      canSeeAll,
      scope,
      kpis: {
        waiting: mine.length,
        escalating: mine.filter((view) => view.overdue).length,
        oldest: oldest ? { days: oldest.age, type: typeName(oldest.item.type), title: oldest.item.title } : null,
        blocked: { items: blocking.length, text: blocking.slice(0, 3).map((view) => view.item.blocking).join(" · ") },
        decided: { count: decided.length, avgDays: avg === null ? null : Math.round(avg * 10) / 10 },
        inFlight: views.length,
      },
      featured: first && context ? { ...this.present(first), facts: context.request } : null,
      waiting: mine.map((view) => this.present(view)),
      list: shown.map((view) => this.present(view)),
      raised: [
        ...raised.map((view) => ({ key: view.item.key, title: view.item.title, state: view.escalated ? "Escalated" : view.item.state, line: `Waiting on the ${view.item.step === 2 && view.route.second ? view.route.second : view.route.approver} · ${view.age} ${view.age === 1 ? "day" : "days"}${view.overdue ? " · past its period" : ` · escalates in ${Math.max(view.escalatesIn, 0)}`}` })),
        ...mineDecided.map((entry) => ({ key: entry.key, title: entry.title, state: entry.outcome, line: `${entry.outcome} by ${entry.decidedByName ?? "the system"}${entry.note ? ` — “${entry.note}”` : ""}` })),
      ],
      types: routes.map((route) => ({ type: route.type, name: route.name })),
      counts: Object.fromEntries(routes.map((route) => [route.type, views.filter((view) => view.item.type === route.type).length])),
    };
  }

  async count(session: SessionPayload) {
    const { views } = await this.frame(session);
    return { waiting: views.filter((view) => view.mine).length };
  }

  /* ───────────────────────── one decision ───────────────────────── */

  async item(session: SessionPayload, key: string) {
    const { views } = await this.frame(session);
    const view = views.find((entry) => entry.item.key === key);
    const messages = async () => {
      const rows = await prisma.approvalMessage.findMany({ where: { schoolId: session.schoolId, itemKey: key }, orderBy: { createdAt: "asc" }, include: { author: { select: { firstName: true, lastName: true, preferredName: true, role: true } } } });
      return rows.map((row) => ({ id: row.id, kind: row.kind, body: row.body, at: row.createdAt.toISOString(), by: row.author ? row.author.preferredName?.trim() || `${row.author.firstName} ${row.author.lastName}` : null, role: row.author ? labelOfRole(row.author.role) : null, mine: row.authorId === session.userId }));
    };
    if (view) {
      const context = await contextOf(session.schoolId, view.item);
      const queue = views.filter((entry) => entry.mine).sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.age - a.age).map((entry) => entry.item.key);
      const at = queue.indexOf(key);
      const next = queue.find((candidate, index) => candidate !== key && (at === -1 || index > at)) ?? queue.find((candidate) => candidate !== key) ?? null;
      return { ...this.present(view), decided: null, context, messages: await messages(), next, position: at === -1 ? null : at + 1, of: queue.length, route: { approver: view.route.approver, second: view.route.second, escalateDays: view.route.escalateDays, escalateTo: view.route.escalateTo, evidence: view.route.evidence, why: view.route.why, bulk: view.route.bulk && !LOCKED_BULK.has(view.item.type) }, can: { decide: view.mine, comment: true }, requestedAt: view.item.raisedAt.toISOString() };
    }
    const done = (await loadDecided(session.schoolId, new Date(Date.now() - 730 * DAY))).find((entry) => entry.key === key);
    if (!done) throw new NotFoundException("That decision is not in this school's queue.");
    const routes = await loadRoutes(session.schoolId);
    const route = routes.find((entry) => entry.type === done.type) as Route;
    return {
      key, type: done.type, typeName: typeName(done.type), title: done.title, summary: done.note, requester: done.requesterName ? { name: done.requesterName, role: "" } : null, approver: route.approver, second: route.second, state: done.outcome, age: Math.floor(daysBetween(done.raisedAt, done.decidedAt)), escalatesIn: 0, overdue: false, escalated: false, blocking: null, evidence: null, mine: false, step: 1 as const, bulk: false, href: "/approvals-workflow/queue", raisedAt: done.raisedAt.toISOString(),
      decided: { outcome: done.outcome, by: done.decidedByName, at: done.decidedAt.toISOString(), note: done.note, tookDays: Math.round(daysBetween(done.raisedAt, done.decidedAt) * 10) / 10 },
      context: { request: [["Request", done.title], ["Requester", done.requesterName ?? "Not recorded"], ["Decision", `${done.outcome} by ${done.decidedByName ?? "the system"}`], ["Reason given", done.note ?? "None recorded"]], context: [], downstream: [], evidence: [] },
      messages: await messages(), next: null, position: null, of: 0, route: { approver: route.approver, second: route.second, escalateDays: route.escalateDays, escalateTo: route.escalateTo, evidence: route.evidence, why: route.why, bulk: false }, can: { decide: false, comment: false }, requestedAt: done.raisedAt.toISOString(),
    };
  }

  /** The module that holds a decision is the one that decides it — this only says which and passes the answer on. */
  private async delegate(session: SessionPayload, item: Item, decision: "approve" | "return" | "decline", note: string | undefined, notifyRequester: boolean): Promise<{ state: string; fields: Array<[string, string]> }> {
    const body = { note };
    const out = (answer: unknown, fallback: string) => {
      const data = (answer ?? {}) as { state?: string; fields?: Array<[string, string]>; decision?: string };
      return { state: data.state ?? fallback, fields: data.fields ?? [] };
    };
    switch (item.source) {
      case "SCORE_CORRECTION":
        return out(await this.corrections.decide(session, item.id, { decision: decision === "approve" ? "Approve" : "Decline", ...body }), decision === "approve" ? "Approved" : "Declined");
      case "SCORE_SHEET":
        return out(await this.sheets.decide(session, item.ref.classId, item.ref.subjectId, { decision: decision === "approve" ? "Approve" : decision === "return" ? "Send back for rework" : "Decline", reason: note, tell: true }), decision === "approve" ? "Approved" : "Returned");
      case "ATTENDANCE_CORRECTION":
        return out(await this.registers.decide(session, item.id, { decision: decision === "approve" ? "Approve" : "Decline", ...body }), decision === "approve" ? "Approved" : "Declined");
      case "FEE_WAIVER":
        return out(await this.waivers.decideWaiver(session, item.id, { decision: decision === "approve" ? "approve" : "decline", ...body }), decision === "approve" ? "Approved" : "Declined");
      case "RECORD_CHANGE":
        return out(await this.changes.decide(session, item.id, { decision: decision === "approve" ? "approve" : "decline", ...body }), decision === "approve" ? "Approved" : "Declined");
      case "LEAVE":
        return out(await this.leave.decide(session, item.id, { decision, ...body }), decision === "approve" ? "Approved" : decision === "return" ? "Returned" : "Declined");
      default: {
        const action = decision === "approve" ? "APPROVE" : decision === "return" ? "RETURN" : "REJECT";
        const row = await this.natives.decide(session, item.id, { action, note });
        if (notifyRequester && item.requester && item.requester.id !== session.userId) await notifyStaff(session.schoolId, session.userId, [item.requester.id], { title: `Approvals · ${row.status.toLowerCase()}`, body: `${item.title}${note ? ` — ${note}` : ""}`, channels: ["In-app inbox"] });
        return { state: row.status === ApprovalStatus.APPROVED ? "Approved" : row.status === ApprovalStatus.RETURNED ? "Returned" : "Declined", fields: [] };
      }
    }
  }

  async decide(session: SessionPayload, key: string, body: unknown) {
    const input = decideSchema.parse(body);
    const { source, id } = parseKey(key);
    const { byType, views } = await this.frame(session);
    const view = views.find((entry) => entry.item.key === key);
    if (!view) throw new BadRequestException("That decision is no longer waiting — somebody else has already decided it.");
    const route = byType.get(view.item.type) as Route;
    if (!this.canDecide(session, view.item, route)) {
      if (view.item.requester?.id === session.userId) throw new ForbiddenException("You raised this yourself, so someone else must decide it.");
      throw new ForbiddenException(`This sits with the ${view.item.step === 2 && route.second ? route.second : route.approver}, not with you.`);
    }
    if (input.decision !== "approve" && !(input.note ?? "").trim()) throw new BadRequestException("Say why. A decision returned or declined without a reason cannot be acted on.");
    const result = await this.delegate(session, view.item, input.decision, input.note, route.notify !== NOTIFY[2]);
    const stillOpen = result.state === "In review";
    if (input.note) await prisma.approvalMessage.create({ data: { schoolId: session.schoolId, itemKey: key, authorId: session.userId, kind: "COMMENT", body: `${result.state}: ${input.note}` } });
    await this.audit(session, input.decision === "approve" ? AuditAction.APPROVE : AuditAction.UPDATE, "Approval", id, { summary: `Decision from the queue · ${typeName(view.item.type)} · ${result.state.toLowerCase()}`, source, key, note: input.note ?? null });
    const queue = views.filter((entry) => entry.mine && entry.item.key !== key).sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.age - a.age);
    const next = stillOpen ? null : queue[0]?.item.key ?? null;
    return { state: result.state, fields: result.fields, next, remaining: queue.length };
  }

  async message(session: SessionPayload, key: string, body: unknown) {
    const input = messageSchema.parse(body);
    const { views } = await this.frame(session);
    const view = views.find((entry) => entry.item.key === key);
    if (!view) throw new BadRequestException("That decision has been decided, so its conversation is closed.");
    const row = await prisma.approvalMessage.create({ data: { schoolId: session.schoolId, itemKey: key, authorId: session.userId, kind: "COMMENT", body: input.text } });
    // The other side of the conversation is told: the requester when an approver writes, the approvers when the requester does.
    const route = view.route;
    const approvers = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: { in: [...(ROLES_OF[route.approver] ?? []), ...(route.second ? ROLES_OF[route.second] ?? [] : [])] as never[] } }, select: { id: true } });
    // The route says when the person who asked is told: on every step (a message is a step), only on the decision, or never.
    const requesterHears = route.notify === NOTIFY[0];
    const audience = view.raisedByMe ? approvers.map((person) => person.id) : view.item.requester && requesterHears ? [view.item.requester.id] : [];
    if (audience.length) await notifyStaff(session.schoolId, session.userId, audience, { title: "Approvals · a message on a decision", body: `${view.item.title}: ${input.text.slice(0, 160)}`, channels: ["In-app inbox"], link: `/approvals-workflow/queue/${encodeURIComponent(key)}/conversation` });
    return { id: row.id };
  }

  async bulk(session: SessionPayload, body: unknown) {
    const input = bulkSchema.parse(body);
    if (input.keys.length > MAX_BULK) throw new BadRequestException(`Up to ${MAX_BULK} at a time — a queue worked in batches of more than that is not being read.`);
    if (input.decision !== "approve" && !(input.note ?? "").trim()) throw new BadRequestException("Say why.");
    const { byType, views } = await this.frame(session);
    const done: string[] = [];
    const skipped: string[] = [];
    for (const key of input.keys) {
      const view = views.find((entry) => entry.item.key === key);
      if (!view) {
        skipped.push("One was already decided");
        continue;
      }
      const route = byType.get(view.item.type) as Route;
      if (!route.bulk || LOCKED_BULK.has(view.item.type)) {
        skipped.push(`${view.item.title} — ${typeName(view.item.type).toLowerCase()} is decided one at a time`);
        continue;
      }
      try {
        await this.decide(session, key, { decision: input.decision, note: input.note });
        done.push(key);
      } catch (cause) {
        skipped.push(`${view.item.title} — ${cause instanceof Error ? cause.message : "could not be decided"}`);
      }
    }
    if (!done.length) throw new BadRequestException(skipped[0] ?? "Nothing was decided.");
    return { decided: done.length, skipped, fields: [["Decided", String(done.length)], ["Left for one-by-one", String(skipped.length)], ...(skipped.length ? [["Why", skipped.slice(0, 3).join("; ")]] : [])] };
  }

  /* ───────────────────────── performance ───────────────────────── */

  async performance(session: SessionPayload) {
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, include: { academicSession: { select: { name: true, startDate: true } } } });
    const start = term?.academicSession?.startDate ?? new Date(Date.now() - 180 * DAY);
    const span = Date.now() - start.getTime();
    const previousStart = new Date(start.getTime() - span);
    const [everything, { views, routes }] = await Promise.all([loadDecided(session.schoolId, previousStart), this.frame(session)]);
    const decided = everything.filter((entry) => entry.decidedAt >= start);
    const before = everything.filter((entry) => entry.decidedAt < start);
    const mean = (rows: Decided[]) => (rows.length ? rows.reduce((sum, entry) => sum + daysBetween(entry.raisedAt, entry.decidedAt), 0) / rows.length : null);
    const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
    const approverRoles = Array.from(new Set(routes.flatMap((route) => [...(ROLES_OF[route.approver] ?? []), ...(route.second ? ROLES_OF[route.second] ?? [] : [])])));
    const decidedIds = Array.from(new Set(decided.map((entry) => entry.decidedById).filter((id): id is string => Boolean(id))));
    const users = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, OR: [{ id: { in: decidedIds } }, { role: { in: approverRoles as never[] } }] }, select: { id: true, firstName: true, lastName: true, preferredName: true, role: true } });
    const approvers = users.map((user) => {
      const mine = decided.filter((entry) => entry.decidedById === user.id);
      const open = views.filter((view) => mayDecide(user, view.route, view.item.step) && view.item.requester?.id !== user.id);
      const escalatedPast = views.filter((view) => view.overdue && (ROLES_OF[view.route.approver] ?? []).includes(user.role));
      return { id: user.id, name: user.preferredName?.trim() || `${user.firstName} ${user.lastName}`, role: labelOfRole(user.role), you: user.id === session.userId, decided: mine.length, open: open.length, oldest: open.length ? Math.max(...open.map((view) => view.age)) : null, avgDays: round(mean(mine)), escalated: escalatedPast.length };
    }).filter((row) => row.decided || row.open).sort((a, b) => b.decided - a.decided);
    const byType = routes.map((route) => {
      const rows = decided.filter((entry) => entry.type === route.type);
      return { type: route.type, name: route.name, count: rows.length, avgDays: round(mean(rows)), escalateDays: route.escalateDays };
    }).filter((row) => row.count);
    const slowest = Math.max(...byType.map((row) => row.avgDays ?? 0), 0);
    const requesters = new Map<string, { name: string; total: number; returned: number; reason: string | null }>();
    for (const entry of decided) {
      if (!entry.requesterId) continue;
      const row = requesters.get(entry.requesterId) ?? { name: entry.requesterName ?? "Someone", total: 0, returned: 0, reason: null };
      row.total += 1;
      if (entry.outcome !== "Approved") {
        row.returned += 1;
        row.reason = row.reason ?? entry.note;
      }
      requesters.set(entry.requesterId, row);
    }
    const blockedViews = views.filter((view) => view.item.blocking);
    return {
      session: term?.academicSession?.name ?? "This session",
      term: term ? `${term.name} · term day ${Math.max(1, Math.floor((Date.now() - term.startDate.getTime()) / DAY) + 1)}` : "",
      kpis: {
        decided: decided.length,
        types: byType.length,
        outstanding: views.length,
        waitingOnMe: views.filter((view) => view.mine).length,
        escalated: views.filter((view) => view.overdue).length,
        avgDays: round(mean(decided)),
        previousAvgDays: round(mean(before)),
        blocked: blockedViews.length,
        blockedText: blockedViews.slice(0, 3).map((view) => view.item.blocking).join(" · "),
      },
      approvers,
      byType: byType.map((row) => ({ ...row, pct: slowest ? Math.round(((row.avgDays ?? 0) / slowest) * 100) : 0 })),
      requesters: Array.from(requesters.values()).filter((row) => row.total >= 1).sort((a, b) => b.returned / b.total - a.returned / a.total || b.total - a.total).slice(0, 6).map((row) => ({ name: row.name, total: row.total, returned: row.returned, pct: Math.round((row.returned / row.total) * 100), reason: row.reason })),
    };
  }

  /* ───────────────────────── workflow ───────────────────────── */

  private async ruleRows(schoolId: string) {
    const rows = await new ConfigStore(schoolId, "standing-rules").list<StandingRule>();
    return rows.map((row) => ({ id: row.id, code: row.code ?? row.id, name: row.name, ...row.data }));
  }

  async workflow(session: SessionPayload) {
    const [{ views, routes }, rules, decided] = await Promise.all([this.frame(session), this.ruleRows(session.schoolId), loadDecided(session.schoolId, await this.sessionStart(session.schoolId))]);
    const rows = routes.map((route) => {
      const done = decided.filter((entry) => entry.type === route.type);
      const avg = done.length ? done.reduce((sum, entry) => sum + daysBetween(entry.raisedAt, entry.decidedAt), 0) / done.length : null;
      return { type: route.type, name: route.name, module: route.module, moduleSlug: route.moduleSlug, approver: route.approver, second: route.second, escalateDays: route.escalateDays, escalateTo: route.escalateTo, overridden: route.overridden, why: route.why, blocks: route.blocks, open: views.filter((view) => view.item.type === route.type).length, avgDays: avg === null ? null : Math.round(avg * 10) / 10, locked: LOCKED_BULK.has(route.type), bulk: route.bulk && !LOCKED_BULK.has(route.type), evidence: route.evidence, who: route.who, notify: route.notify, enforces: { evidence: ENFORCED[route.type]?.evidence ?? false, who: ENFORCED[route.type]?.who ?? false } };
    });
    const slow = rows.filter((row) => row.avgDays !== null).sort((a, b) => (b.avgDays ?? 0) - (a.avgDays ?? 0))[0] ?? null;
    return {
      routes: rows,
      modules: Array.from(new Set(routes.map((route) => route.module))),
      approvers: APPROVER_LABELS,
      rules: rules.map((rule) => ({ id: rule.id, code: rule.code, name: rule.name, kind: rule.kind, fields: rule.fields, maxChars: rule.maxChars, state: rule.state, fired: rule.fired ?? 0, by: rule.createdBy, why: rule.why, at: rule.createdAt })),
      locked: rows.filter((row) => row.locked).map((row) => ({ name: row.name, why: row.why })),
      slowest: slow ? { name: slow.name, type: slow.type, avgDays: slow.avgDays } : null,
      options: { approvers: APPROVER_LABELS, escalateTo: ESCALATE_TO, who: WHO_MAY_SUBMIT, notify: NOTIFY, days: [1, 2, 3, 5, 7, 14], ruleFields: RULE_FIELDS },
    };
  }

  async route(session: SessionPayload, type: string) {
    const flow = await this.workflow(session);
    const route = flow.routes.find((entry) => entry.type === type);
    if (!route) throw new NotFoundException("That route is not one this school has.");
    const defaults = ROUTE_DEFAULTS.find((entry) => entry.type === type) as (typeof ROUTE_DEFAULTS)[number];
    const recent = (await loadDecided(session.schoolId, new Date(Date.now() - 365 * DAY))).filter((entry) => entry.type === type).sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime()).slice(0, 8);
    return {
      route,
      defaults: { approver: defaults.approver, second: defaults.second, escalateDays: defaults.escalateDays },
      config: await loadRoutes(session.schoolId).then((all) => all.find((entry) => entry.type === type) as Route),
      recent: recent.map((entry) => ({ key: entry.key, title: entry.title, by: entry.decidedByName, tookDays: Math.round(daysBetween(entry.raisedAt, entry.decidedAt) * 10) / 10, outcome: entry.outcome, note: entry.note, at: entry.decidedAt.toISOString() })),
      options: flow.options,
    };
  }

  async saveRoute(session: SessionPayload, type: string, body: unknown) {
    const defaults = ROUTE_DEFAULTS.find((entry) => entry.type === type);
    if (!defaults) throw new NotFoundException("That route is not one this school has.");
    const input = routeSchema.parse(body);
    const locked = LOCKED_BULK.has(defaults.type);
    const config = { approver: input.approver, second: input.second, escalateDays: input.escalateDays, escalateTo: input.escalateTo, evidence: input.evidence, bulk: locked ? false : /up to|unlimited/i.test(input.bulk), who: input.who, notify: input.notify };
    await new ConfigStore(session.schoolId, "approval-routes").put(type, defaults.name, config);
    await this.audit(session, AuditAction.UPDATE, "ApprovalRoute", type, { summary: `Approval route changed · ${defaults.name}`, ...config });
    return { fields: [["Route", defaults.name], ["Approver", input.approver + (input.second ? ` then ${input.second}` : "")], ["Escalates after", `${input.escalateDays} ${input.escalateDays === 1 ? "day" : "days"}, to ${input.escalateTo.replace(/^The /, "the ")}`], ["Items already waiting", "Keep deciding under the route you set — the queue reads the new one for what it shows from now"]] };
  }

  /** Several routes at once: the approver, the escalation period, or back to the default — each left alone where nothing is said. */
  async bulkRoutes(session: SessionPayload, body: unknown) {
    const input = z.object({
      types: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])),
      approver: z.string().optional(),
      escalateDays: z.coerce.number().int().min(1).max(30).optional(),
      reset: z.union([z.boolean(), z.string()]).optional().transform((value) => value === true || value === "true"),
    }).parse(body);
    if (!input.reset && !input.approver && !input.escalateDays) throw new BadRequestException("Say what to change.");
    if (input.approver && !APPROVER_LABELS.includes(input.approver)) throw new BadRequestException("Choose a role that decides this.");
    const routes = await loadRoutes(session.schoolId);
    let changed = 0;
    for (const type of input.types) {
      const route = routes.find((entry) => entry.type === type);
      if (!route) continue;
      if (input.reset) await this.resetRoute(session, type);
      else await this.saveRoute(session, type, { approver: input.approver ?? route.approver, second: route.second || "Not required", escalateDays: input.escalateDays ?? route.escalateDays, escalateTo: route.escalateTo, evidence: route.evidence, bulk: route.bulk ? "Up to 20 at a time" : "Never", who: route.who, notify: route.notify });
      changed += 1;
    }
    return { changed, fields: [["Routes changed", String(changed)], ["What changed", input.reset ? "Back to the default" : [input.approver ? `Approver: ${input.approver}` : "", input.escalateDays ? `Escalates after ${input.escalateDays} days` : ""].filter(Boolean).join(" · ")]] };
  }

  async resetRoute(session: SessionPayload, type: string) {
    const defaults = ROUTE_DEFAULTS.find((entry) => entry.type === type);
    if (!defaults) throw new NotFoundException("That route is not one this school has.");
    await new ConfigStore(session.schoolId, "approval-routes").remove(type);
    await this.audit(session, AuditAction.UPDATE, "ApprovalRoute", type, { summary: `Approval route reset to the default · ${defaults.name}` });
    return { fields: [["Route", defaults.name], ["Back to", `${defaults.approver}${defaults.second ? ` then ${defaults.second}` : ""}, escalating after ${defaults.escalateDays} days`]] };
  }

  async createRule(session: SessionPayload, body: unknown) {
    const input = ruleSchema.parse(body);
    const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const code = `rule-${Date.now().toString(36)}`;
    const data: StandingRule = { kind: "RECORD_CHANGE_SMALL", fields: input.fields, maxChars: input.maxChars, state: "Active", createdBy: actor ? `${actor.firstName} ${actor.lastName}` : "—", createdById: session.userId, createdAt: new Date().toISOString(), fired: 0, why: input.why };
    await new ConfigStore(session.schoolId, "standing-rules").put(code, input.name, data);
    await this.audit(session, AuditAction.CREATE, "StandingRule", code, { summary: `Standing rule created · ${input.name}`, ...data });
    return { code, fields: [["Rule", input.name], ["Applies to", `${input.fields.join(", ")} changes of ${input.maxChars} ${input.maxChars === 1 ? "character" : "characters"} or fewer`], ["Revocable", "Instantly, from this page"], ["Every firing", "Counted, and written to the audit log"]] };
  }

  async setRuleState(session: SessionPayload, code: string, state: "Active" | "Revoked") {
    const store = new ConfigStore(session.schoolId, "standing-rules");
    const row = await store.get<StandingRule>(code);
    if (!row) throw new NotFoundException("That rule is not one this school has.");
    await store.put(code, row.name, { ...row.data, state, ...(state === "Revoked" ? { revokedAt: new Date().toISOString() } : {}) });
    await this.audit(session, AuditAction.UPDATE, "StandingRule", code, { summary: `Standing rule ${state === "Active" ? "reinstated" : "revoked"} · ${row.name}` });
    return { state };
  }
}
