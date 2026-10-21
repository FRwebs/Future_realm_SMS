import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, type Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { msisdn } from "../../../../src/lib/integrations/carriers";

const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

function assertPlatformRole(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

const userContextSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  schoolId: true,
  accountStatus: true,
  isActive: true,
  suspendedAt: true,
  passwordResetRequired: true,
  lastLoginAt: true,
  mfaEnabled: true,
  role: true,
  school: { select: { name: true } }
} as const;

/** The roles that confirm every sign-in with an emailed code. */
const EMAIL_MFA_ROLES = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "BURSAR", "PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER", "SUPPORT_AGENT", "SALES_MANAGER", "DEVELOPER"]);
const mfaOf = (user: { mfaEnabled: boolean; role: string }) => (user.mfaEnabled ? "Authenticator app on" : EMAIL_MFA_ROLES.has(user.role) ? "Emailed code at every sign-in (role requires it)" : "Not enabled — password only");

const contactSchema = z.object({ flagId: z.string().min(1), schoolId: z.string().min(1), how: z.enum(["Phone", "Email", "In person", "In-app message"]), note: z.string().trim().min(5, "Say what was said, and to whom.") });

/**
 * Read-only enrichment for the Super Admin "Reviews & Cases" case-review board (Users page).
 * Adds real, previously-unexposed fields (school name, account status, recent login attempts)
 * to the same open suspicious-activity flags, pending duplicate flags, and recovery records the
 * existing super-admin endpoints already list — no new writes, no new data sources invented.
 */
@Injectable()
export class UserCaseContextService {
  async getCaseReviewContext(session: SessionPayload) {
    assertPlatformRole(session);

    const [suspiciousFlags, duplicateFlags, recoveryRecords] = await Promise.all([
      prisma.suspiciousActivityFlag.findMany({
        where: { resolvedAt: null },
        include: { user: { select: userContextSelect } },
        orderBy: { detectedAt: "desc" }
      }),
      prisma.duplicateFlag.findMany({
        where: { status: "PENDING" },
        include: {
          userA: { select: userContextSelect },
          userB: { select: userContextSelect }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.accountRecoveryRecord.findMany({
        include: { user: { select: userContextSelect } },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);

    const flaggedUserIds = Array.from(new Set(suspiciousFlags.map((flag) => flag.userId)));
    const loginAttemptsByUser = new Map<string, Array<{ success: boolean; reason: string | null; ipAddress: string | null; device: string | null; createdAt: string }>>();
    if (flaggedUserIds.length > 0) {
      const attempts = await prisma.loginAttempt.findMany({
        where: { userId: { in: flaggedUserIds } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { userId: true, success: true, reason: true, ipAddress: true, device: true, createdAt: true }
      });
      for (const attempt of attempts) {
        if (!attempt.userId) continue;
        const list = loginAttemptsByUser.get(attempt.userId) ?? [];
        if (list.length < 5) list.push({ success: attempt.success, reason: attempt.reason, ipAddress: attempt.ipAddress, device: attempt.device, createdAt: attempt.createdAt.toISOString() });
        loginAttemptsByUser.set(attempt.userId, list);
      }
    }

    // Who has been in touch with the school about each flag, from the notes support wrote.
    const contactNotes = await prisma.auditLog.findMany({ where: { entityType: "CaseContact", entityId: { in: suspiciousFlags.map((flag) => flag.id) } }, orderBy: { createdAt: "desc" }, select: { entityId: true, createdAt: true, metadata: true, actor: { select: { firstName: true, lastName: true } } } });
    const contacted = new Map<string, { at: string; by: string; how: string; note: string }>();
    for (const row of contactNotes) {
      if (contacted.has(row.entityId)) continue;
      const meta = (row.metadata ?? {}) as { how?: string; note?: string };
      contacted.set(row.entityId, { at: row.createdAt.toISOString(), by: row.actor ? `${row.actor.firstName} ${row.actor.lastName}`.trim() : "Support", how: meta.how ?? "", note: meta.note ?? "" });
    }

    return {
      ok: true,
      data: {
        suspicious: suspiciousFlags.map((flag) => ({
          flagId: flag.id,
          schoolId: flag.user.schoolId,
          schoolName: flag.user.school.name,
          accountStatus: flag.user.accountStatus,
          isActive: flag.user.isActive,
          suspendedAt: flag.user.suspendedAt?.toISOString() ?? null,
          passwordResetRequired: flag.user.passwordResetRequired,
          lastLoginAt: flag.user.lastLoginAt?.toISOString() ?? null,
          mfa: mfaOf(flag.user),
          contacted: contacted.get(flag.id) ?? null,
          loginAttempts: loginAttemptsByUser.get(flag.userId) ?? []
        })),
        duplicates: duplicateFlags.map((flag) => ({
          flagId: flag.id,
          sameSchool: flag.userA.schoolId === flag.userB.schoolId,
          userA: { schoolId: flag.userA.schoolId, schoolName: flag.userA.school.name, accountStatus: flag.userA.accountStatus, isActive: flag.userA.isActive, mfa: mfaOf(flag.userA) },
          userB: { schoolId: flag.userB.schoolId, schoolName: flag.userB.school.name, accountStatus: flag.userB.accountStatus, isActive: flag.userB.isActive, mfa: mfaOf(flag.userB) }
        })),
        recovery: recoveryRecords.map((record) => ({
          recordId: record.id,
          schoolId: record.user.schoolId,
          schoolName: record.user.school.name,
          accountStatus: record.user.accountStatus,
          isActive: record.user.isActive
        }))
      }
    };
  }

  /** Support records that it got in touch with the school, so "school contacted" is a fact on the case and not a tick-box. */
  async recordContact(session: SessionPayload, body: unknown) {
    assertPlatformRole(session);
    const input = contactSchema.parse(body);
    await prisma.auditLog.create({ data: { schoolId: input.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "CaseContact", entityId: input.flagId, metadata: { summary: `School contacted about a flagged account · ${input.how}`, how: input.how, note: input.note } as Prisma.InputJsonValue } });
    return { ok: true, data: { recorded: true } };
  }

  /**
   * Guardians a school cannot reach, school by school — the correction queue. A phone that is not a number a carrier can
   * take, an email that is not an address, the same phone on several guardians, and what the delivery worker has already
   * failed to send, with the carrier's reason.
   */
  async contactQuality(session: SessionPayload) {
    assertPlatformRole(session);
    const [guardians, failed] = await Promise.all([
      prisma.guardian.findMany({ select: { id: true, schoolId: true, phone: true, email: true, canReceiveSms: true, canReceiveEmail: true, phoneOnly: true, school: { select: { name: true } } }, take: 20000 }),
      prisma.notificationLog.findMany({ where: { status: "FAILED", sentAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, channel: { in: ["SMS", "EMAIL"] } }, select: { schoolId: true, metadata: true }, take: 5000 }),
    ]);
    type Row = { schoolId: string; school: string; guardians: number; badPhone: number; badEmail: number; sharedPhone: number; failed: number; reasons: Map<string, number> };
    const bySchool = new Map<string, Row>();
    const row = (schoolId: string, school: string): Row => {
      const existing = bySchool.get(schoolId) ?? { schoolId, school, guardians: 0, badPhone: 0, badEmail: 0, sharedPhone: 0, failed: 0, reasons: new Map<string, number>() };
      bySchool.set(schoolId, existing);
      return existing;
    };
    const phones = new Map<string, number>();
    for (const guardian of guardians) { const key = `${guardian.schoolId}:${(msisdn(guardian.phone) ?? guardian.phone).trim()}`; phones.set(key, (phones.get(key) ?? 0) + 1); }
    for (const guardian of guardians) {
      const entry = row(guardian.schoolId, guardian.school.name);
      entry.guardians += 1;
      if (guardian.canReceiveSms && !msisdn(guardian.phone)) entry.badPhone += 1;
      if (guardian.canReceiveEmail && guardian.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardian.email)) entry.badEmail += 1;
      if ((phones.get(`${guardian.schoolId}:${(msisdn(guardian.phone) ?? guardian.phone).trim()}`) ?? 0) > 1) entry.sharedPhone += 1;
    }
    const names = new Map(Array.from(bySchool.values()).map((entry) => [entry.schoolId, entry.school]));
    for (const message of failed) {
      const entry = row(message.schoolId, names.get(message.schoolId) ?? "A school");
      entry.failed += 1;
      const reason = String(((message.metadata ?? {}) as { error?: string }).error ?? "No reason recorded");
      entry.reasons.set(reason, (entry.reasons.get(reason) ?? 0) + 1);
    }
    const rows = Array.from(bySchool.values()).map((entry) => ({ schoolId: entry.schoolId, school: entry.school, guardians: entry.guardians, badPhone: entry.badPhone, badEmail: entry.badEmail, sharedPhone: entry.sharedPhone, failed: entry.failed, topReason: Array.from(entry.reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, problems: entry.badPhone + entry.badEmail + entry.failed })).filter((entry) => entry.problems > 0 || entry.sharedPhone > 0).sort((a, b) => b.problems - a.problems);
    return { ok: true, data: { rows, totals: { schools: rows.length, badPhone: rows.reduce((sum, entry) => sum + entry.badPhone, 0), badEmail: rows.reduce((sum, entry) => sum + entry.badEmail, 0), failed: rows.reduce((sum, entry) => sum + entry.failed, 0) } } };
  }

  /** The repair queue as the Users page shows it: the counts per school plus how long it has been failing, on which channel, and what has been done about it. */
  async repairQueue(session: SessionPayload) {
    const base = (await this.contactQuality(session)).data;
    const since = new Date(Date.now() - 30 * 86_400_000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [failed, history, schools, corrected] = await Promise.all([
      prisma.notificationLog.findMany({ where: { status: "FAILED", sentAt: { gte: since }, channel: { in: ["SMS", "EMAIL"] } }, select: { schoolId: true, channel: true, sentAt: true } }),
      prisma.auditLog.findMany({ where: { entityType: "CaseContact", schoolId: { in: base.rows.map((r) => r.schoolId) } }, select: { schoolId: true, metadata: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
      prisma.school.findMany({ where: { id: { in: base.rows.map((r) => r.schoolId) } }, select: { id: true, accountManagerId: true } }),
      prisma.auditLog.count({ where: { entityType: "Guardian", action: AuditAction.UPDATE, createdAt: { gte: monthStart }, schoolId: { in: base.rows.map((r) => r.schoolId) } } })
    ]);
    const bySchool = (id: string) => failed.filter((f) => f.schoolId === id);
    const rows = base.rows.map((row) => {
      const failures = bySchool(row.schoolId);
      const channels = new Set<string>(failures.map((f) => f.channel));
      if (row.badPhone) channels.add("SMS");
      if (row.badEmail) channels.add("EMAIL");
      const events = history.filter((h) => h.schoolId === row.schoolId).map((h) => String(((h.metadata ?? {}) as { summary?: string }).summary ?? ""));
      const state = events.some((e) => /account manager/i.test(e)) ? "AM_NOTIFIED" : events.some((e) => /asked to correct/i.test(e)) ? "ROUTED" : "OPEN";
      const unreachable = row.badPhone + row.badEmail;
      const first = failures.map((f) => f.sentAt?.getTime() ?? Infinity).sort((a, b) => a - b)[0];
      return { ...row, unreachable, sharePct: row.guardians ? Math.round((unreachable / row.guardians) * 1000) / 10 : 0, channels: Array.from(channels).sort(), firstFailed: Number.isFinite(first) ? new Date(first).toISOString() : null, state, hasManager: Boolean(schools.find((x) => x.id === row.schoolId)?.accountManagerId) };
    });
    const guardianTotal = rows.reduce((sum, r) => sum + r.guardians, 0);
    return {
      rows,
      kpis: {
        unreachable: rows.reduce((sum, r) => sum + r.unreachable, 0),
        unreachablePct: guardianTotal ? Math.round((rows.reduce((sum, r) => sum + r.unreachable, 0) / guardianTotal) * 1000) / 10 : 0,
        schoolsAffected: rows.filter((r) => r.problems > 0).length,
        routed: rows.filter((r) => r.state !== "OPEN").length,
        corrected,
        above15: rows.filter((r) => r.sharePct >= 15).length
      }
    };
  }

  /** Asks several schools at once, and tells each school's Account Manager when asked to. */
  async routeMany(session: SessionPayload, body: unknown) {
    const input = z.object({ schoolIds: z.array(z.string()).min(1), notifyManagers: z.boolean().default(false) }).parse(body);
    let asked = 0;
    for (const id of input.schoolIds) {
      try { await this.askSchoolToFix(session, id); asked += 1; } catch { /* a school with nothing to fix is skipped */ }
    }
    let managers = 0;
    if (input.notifyManagers) {
      const quality = (await this.contactQuality(session)).data.rows;
      const schools = await prisma.school.findMany({ where: { id: { in: input.schoolIds }, accountManagerId: { not: null } }, select: { id: true, name: true, accountManagerId: true } });
      for (const school of schools) {
        const row = quality.find((q) => q.schoolId === school.id);
        await prisma.notificationLog.create({ data: { schoolId: school.id, userId: school.accountManagerId, channel: "IN_APP", title: `${school.name}: guardians cannot be reached`, body: `${row ? row.badPhone + row.badEmail : 0} guardians have an unreachable phone or email and ${row?.failed ?? 0} messages failed in 30 days. The school has been asked to correct them.`, status: "QUEUED", sentAt: new Date() } });
        await prisma.auditLog.create({ data: { schoolId: school.id, actorId: session.userId, action: AuditAction.UPDATE, entityType: "CaseContact", entityId: school.id, metadata: { summary: "Account Manager notified of unreachable guardians" } } });
        managers += 1;
      }
    }
    return { asked, managers };
  }

  /** A CSV of the affected guardians for the schools chosen — name, school, the contact that fails and why. */
  async exportContacts(session: SessionPayload, schoolIds: string[]) {
    assertPlatformRole(session);
    const guardians = await prisma.guardian.findMany({ where: { schoolId: { in: schoolIds } }, select: { firstName: true, lastName: true, phone: true, email: true, canReceiveSms: true, canReceiveEmail: true, school: { select: { name: true } } }, take: 50000 });
    const bad = guardians.filter((g) => (g.canReceiveSms && !msisdn(g.phone)) || (g.canReceiveEmail && g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email)));
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    await prisma.auditLog.create({ data: { actorId: session.userId, action: AuditAction.EXPORT, entityType: "GuardianContacts", entityId: "repair-queue", metadata: { rowCount: bad.length, schools: schoolIds.length } as Prisma.InputJsonValue } });
    return ["School,Guardian,Phone,Email,Problem", ...bad.map((g) => [g.school.name, `${g.firstName} ${g.lastName}`, g.phone, g.email ?? "", g.canReceiveSms && !msisdn(g.phone) ? "Phone no carrier can reach" : "Invalid email address"].map(esc).join(","))].join("\n");
  }

  /** Asks the school to correct its own guardians' contacts — it is their record, so the fix is theirs. */
  async askSchoolToFix(session: SessionPayload, schoolId: string) {
    assertPlatformRole(session);
    const quality = (await this.contactQuality(session)).data.rows.find((entry) => entry.schoolId === schoolId);
    if (!quality) throw new BadRequestException("This school has no contact problems to report.");
    const owners = await prisma.user.findMany({ where: { schoolId, isActive: true, deletedAt: null, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "ADMINISTRATOR", "ADMIN_OFFICER"] } }, select: { id: true } });
    const body = `${quality.badPhone} guardian${quality.badPhone === 1 ? " has" : "s have"} a phone number no carrier can reach, ${quality.badEmail} an invalid email address, and ${quality.failed} message${quality.failed === 1 ? "" : "s"} could not be delivered in the last 30 days${quality.topReason ? ` (most often: ${quality.topReason})` : ""}. Correct them in Parents & Guardians so your messages reach every family.`;
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId, userId: owner.id, channel: "IN_APP" as const, title: "Some families cannot be reached", body, status: "QUEUED", sentAt: new Date() })) });
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "CaseContact", entityId: schoolId, metadata: { summary: "School asked to correct guardian contacts", how: "In-app message", note: body } as Prisma.InputJsonValue } });
    return { ok: true, data: { told: owners.length } };
  }
}
