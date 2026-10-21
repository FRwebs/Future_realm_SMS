import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { msisdn } from "../../../../src/lib/integrations/carriers";

const DAY = 86_400_000;
const OWNER_ROLES = new Set<string>(["SCHOOL_OWNER", "PROPRIETOR"]);
const TEACHER_ROLES = new Set<string>(["SUBJECT_TEACHER", "CLASS_TEACHER", "HEAD_OF_DEPARTMENT"]);
const GUARDIAN_ROLES = new Set<string>(["PARENT", "GUARDIAN"]);
const normName = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const pretty = (role: string) => role.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

const bulkSchema = z.object({
  teacherIds: z.array(z.string()).min(1, "Choose at least one teacher."),
  channel: z.enum(["EMAIL", "SMS"]).default("EMAIL"),
  subject: z.string().trim().min(3),
  body: z.string().trim().min(10, "Write the message — and end it with a question, not a booking.")
});
const approachSchema = z.object({ schoolName: z.string().trim().min(2), teacherIds: z.array(z.string()).default([]), note: z.string().trim().optional() });
const routeSchema = z.object({ approachId: z.string().min(1), dealId: z.string().min(1) });

@Injectable()
export class UserInsightsService {
  /* ───────────────────────── one person, several schools ───────────────────────── */

  /** People who hold an account at more than one school, found by the phone number they share — each account keeps its own role and permissions. */
  async memberships() {
    const users = await prisma.user.findMany({
      where: { deletedAt: null, phone: { not: null }, school: { deletedAt: null, isPersonalWorkspace: false } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, lastLoginAt: true, isActive: true, school: { select: { id: true, name: true } } },
      take: 30000
    });
    const people = new Map<string, typeof users>();
    for (const user of users) {
      const key = msisdn(user.phone ?? "") ?? "";
      if (!key) continue;
      people.set(key, [...(people.get(key) ?? []), user]);
    }
    const multi = Array.from(people.values()).filter((group) => new Set(group.map((u) => u.school.id)).size >= 2);
    const accounts = users.length;
    const rows = multi
      .map((group) => {
        const lead = group[0];
        const last = group.map((u) => u.lastLoginAt?.getTime() ?? 0).sort((a, b) => b - a)[0];
        return { id: lead.id, name: `${lead.firstName} ${lead.lastName}`, contact: lead.email, memberships: new Set(group.map((u) => u.school.id)).size, roles: group.map((u) => `${pretty(u.role)} — ${u.school.name}`), lastActive: last ? new Date(last).toISOString() : null };
      })
      .sort((a, b) => b.memberships - a.memberships)
      .slice(0, 50);
    const count = (predicate: (roles: string[]) => boolean) => multi.filter((group) => predicate(group.map((u) => u.role))).length;
    const owners = multi.filter((group) => new Set(group.filter((u) => OWNER_ROLES.has(u.role)).map((u) => u.school.id)).size >= 2).length;
    return {
      kpis: {
        multi: multi.length, multiPct: accounts ? Math.round((multi.length / accounts) * 1000) / 10 : 0,
        guardians: count((roles) => roles.some((r) => GUARDIAN_ROLES.has(r))),
        teachers: multi.filter((group) => new Set(group.filter((u) => TEACHER_ROLES.has(u.role)).map((u) => u.school.id)).size >= 2).length,
        owners,
        examiners: 0
      },
      rows
    };
  }

  /* ───────────────────────── teachers using Nooria on their own ───────────────────────── */

  private async independents() {
    const workspaces = await prisma.school.findMany({ where: { isPersonalWorkspace: true, deletedAt: null }, select: { id: true, createdAt: true, users: { where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, city: true, country: true, jobTitle: true, role: true, lastLoginAt: true } } } });
    const ids = workspaces.flatMap((w) => w.users.map((u) => u.id));
    const [signups, logins, consent, outreach, schools] = await Promise.all([
      prisma.auditLog.findMany({ where: { entityType: "School", entityId: { in: workspaces.map((w) => w.id) }, action: AuditAction.CREATE }, select: { entityId: true, metadata: true } }),
      prisma.loginAttempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, success: true, createdAt: { gte: new Date(Date.now() - 30 * DAY) } }, _count: { _all: true } }),
      prisma.consentRecord.findMany({ where: { userId: { in: ids }, channel: "WHATSAPP", optedIn: true }, select: { userId: true } }),
      prisma.notificationLog.findMany({ where: { userId: { in: ids }, metadata: { path: ["kind"], equals: "TEACHER_OUTREACH" } }, select: { userId: true, sentAt: true }, orderBy: { sentAt: "desc" } }),
      prisma.school.findMany({ where: { isPersonalWorkspace: false, deletedAt: null }, select: { id: true, name: true, plan: true, city: true } })
    ]);
    const meta = new Map(signups.map((row) => [row.entityId, (row.metadata ?? {}) as { claimedSchoolName?: string; subjects?: string[]; levels?: string[] }]));
    const loginCount = new Map(logins.map((row) => [row.userId as string, row._count._all]));
    const optedIn = new Set(consent.map((row) => row.userId));
    const lastOutreach = new Map<string, Date>();
    for (const row of outreach) if (row.userId && row.sentAt && !lastOutreach.has(row.userId)) lastOutreach.set(row.userId, row.sentAt);
    const teachers = workspaces.flatMap((workspace) => workspace.users.map((user) => {
      const info = meta.get(workspace.id) ?? {};
      const logs = loginCount.get(user.id) ?? 0;
      const activity = logs >= 8 ? "High" : logs >= 3 ? "Medium" : "Low";
      return { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone, role: user.jobTitle ?? pretty(user.role), school: info.claimedSchoolName?.trim() || null, city: user.city, subjects: info.subjects ?? [], levels: info.levels ?? [], activity, logins30d: logs, whatsapp: optedIn.has(user.id), contacted: lastOutreach.get(user.id)?.toISOString() ?? null, joined: workspace.createdAt.toISOString() };
    }));
    return { teachers, schools };
  }

  async teachers() {
    const { teachers, schools } = await this.independents();
    const deals = await prisma.partnerDeal.findMany({ where: { status: { in: ["REGISTERED", "CONVERTED"] } }, select: { id: true, prospectSchoolName: true, status: true, partner: { select: { name: true } } } });
    const approaches = await prisma.teacherApproach.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const groups = new Map<string, typeof teachers>();
    for (const teacher of teachers) if (teacher.school) groups.set(normName(teacher.school), [...(groups.get(normName(teacher.school)) ?? []), teacher]);
    const score = (activity: string) => (activity === "High" ? 90 : activity === "Medium" ? 55 : 20);
    const clusters = Array.from(groups.entries()).map(([key, group]) => {
      const name = group[0].school as string;
      const platform = schools.find((s) => normName(s.name) === key);
      const deal = deals.find((d) => normName(d.prospectSchoolName) === key);
      const approach = approaches.find((a) => normName(a.schoolName) === key);
      const combined = Math.round(group.reduce((sum, t) => sum + score(t.activity), 0) / group.length);
      return {
        name, location: group.find((t) => t.city)?.city ?? null, teachers: group.length, activityScore: combined, activity: combined >= 70 ? "High" : combined >= 45 ? "Medium" : "Low",
        onPlatform: platform ? `Yes — ${platform.plan.toLowerCase()}` : "No",
        deal: deal ? { id: deal.id, label: `${deal.status === "CONVERTED" ? "Converted" : "Registered"} — ${deal.partner.name}` } : null,
        approach: approach ? { id: approach.id, status: approach.status } : null,
        teacherIds: group.map((t) => t.id)
      };
    }).sort((a, b) => b.teachers - a.teachers || b.activityScore - a.activityScore);
    const whatsapp = teachers.filter((t) => t.whatsapp).length;
    return { clusters, teachers, counts: { accounts: teachers.length, schoolsNamed: groups.size, whatsapp, neverContacted: teachers.filter((t) => !t.contacted).length }, approaches: approaches.map((a) => ({ id: a.id, schoolName: a.schoolName, status: a.status, teachers: a.teacherIds.length, note: a.note, createdAt: a.createdAt.toISOString() })), deals: deals.map((d) => ({ id: d.id, label: `${d.prospectSchoolName} — ${d.partner.name}` })) };
  }

  /** Writes to individual teachers personally, by email or SMS. WhatsApp is not connected, so a teacher's opt-in is recorded but nothing is sent on it. */
  async bulkMessage(session: SessionPayload, body: unknown) {
    const input = bulkSchema.parse(body);
    const { teachers } = await this.independents();
    const chosen = teachers.filter((t) => input.teacherIds.includes(t.id));
    if (!chosen.length) throw new BadRequestException("None of those teachers is an individual account.");
    const reachable = chosen.filter((t) => (input.channel === "SMS" ? Boolean(t.phone) : Boolean(t.email)));
    const skipped = chosen.length - reachable.length;
    if (!reachable.length) throw new BadRequestException("None of the selected teachers can be reached on that channel.");
    const workspaces = await prisma.user.findMany({ where: { id: { in: reachable.map((t) => t.id) } }, select: { id: true, schoolId: true } });
    const school = new Map(workspaces.map((u) => [u.id, u.schoolId]));
    await prisma.notificationLog.createMany({ data: reachable.map((t) => ({ schoolId: school.get(t.id) as string, userId: t.id, channel: input.channel, title: input.subject, body: input.body, status: "QUEUED", sentAt: new Date(), metadata: { kind: "TEACHER_OUTREACH", billing: "PLATFORM", ...(input.channel === "EMAIL" ? { email: t.email } : { phone: t.phone }) } as Prisma.InputJsonValue })) });
    await prisma.auditLog.create({ data: { actorId: session.userId, action: AuditAction.CREATE, entityType: "TeacherOutreach", entityId: "bulk", metadata: { channel: input.channel, sent: reachable.length, skipped, subject: input.subject } as Prisma.InputJsonValue } });
    return { queued: reachable.length, skipped };
  }

  async addToApproachList(session: SessionPayload, body: unknown) {
    const input = approachSchema.parse(body);
    const existing = await prisma.teacherApproach.findFirst({ where: { schoolName: { equals: input.schoolName, mode: "insensitive" } } });
    const row = existing
      ? await prisma.teacherApproach.update({ where: { id: existing.id }, data: { teacherIds: Array.from(new Set([...existing.teacherIds, ...input.teacherIds])), note: input.note ?? existing.note } })
      : await prisma.teacherApproach.create({ data: { schoolName: input.schoolName, teacherIds: input.teacherIds, note: input.note, createdById: session.userId } });
    return { id: row.id };
  }

  /** Ticked teachers go onto the approach list under the school each of them named. */
  async approachSelected(session: SessionPayload, body: unknown) {
    const { teacherIds } = z.object({ teacherIds: z.array(z.string()).min(1) }).parse(body);
    const { teachers } = await this.independents();
    const bySchool = new Map<string, string[]>();
    for (const teacher of teachers.filter((t) => teacherIds.includes(t.id) && t.school)) bySchool.set(teacher.school as string, [...(bySchool.get(teacher.school as string) ?? []), teacher.id]);
    if (!bySchool.size) throw new BadRequestException("None of the ticked teachers named a school.");
    for (const [schoolName, ids] of bySchool) await this.addToApproachList(session, { schoolName, teacherIds: ids });
    return { schools: bySchool.size };
  }

  /** Routing happens only under a registered deal, so attribution is settled before the introduction. */
  async routeToPartner(session: SessionPayload, body: unknown) {
    const input = routeSchema.parse(body);
    const [approach, deal] = await Promise.all([prisma.teacherApproach.findUnique({ where: { id: input.approachId } }), prisma.partnerDeal.findUnique({ where: { id: input.dealId } })]);
    if (!approach || !deal) throw new BadRequestException("Choose a school on the approach list and a registered deal.");
    if (deal.status !== "REGISTERED" && deal.status !== "CONVERTED") throw new BadRequestException("Only a registered deal can carry an introduction.");
    if (normName(deal.prospectSchoolName) !== normName(approach.schoolName)) throw new BadRequestException(`That deal is for ${deal.prospectSchoolName}, not ${approach.schoolName}.`);
    await prisma.teacherApproach.update({ where: { id: approach.id }, data: { status: "ROUTED", dealId: deal.id } });
    await prisma.auditLog.create({ data: { actorId: session.userId, action: AuditAction.UPDATE, entityType: "TeacherApproach", entityId: approach.id, metadata: { routedTo: deal.id } as Prisma.InputJsonValue } });
    return { id: approach.id };
  }
}

export const userInsights = new UserInsightsService();
export type { UserRole };
