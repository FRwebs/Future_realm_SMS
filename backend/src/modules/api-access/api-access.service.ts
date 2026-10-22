import { createHash, randomBytes } from "node:crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { plansFeatures } from "../plans-features/plans-features.service";

/** What a key may read. Every one is read-only; nothing here writes to the school's record. */
export const API_SCOPES = [
  { key: "students.read", label: "Students", detail: "Admission number, name, class and status. No contact, medical or family details." },
  { key: "classes.read", label: "Classes", detail: "Each arm, its level and how many students it holds." },
  { key: "attendance.read", label: "Attendance", detail: "Daily totals for each arm — present, absent, late — never a child's name." }
] as const;
const SCOPE_KEYS = API_SCOPES.map((scope) => scope.key) as string[];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

const createSchema = z.object({ name: z.string().trim().min(3, "Name the key after what uses it."), scopes: z.array(z.string()).min(1, "Choose what the key may read.") });

/**
 * API access. A school's owner issues keys that read a small, deliberately boring slice of its record. A key is shown once and kept
 * only as a hash; it works only while the school's plan includes API access, checked on every call — so a downgrade ends it at once,
 * without anyone having to remember to revoke anything.
 */
@Injectable()
export class ApiAccessService {
  async overview(session: SessionPayload) {
    const entitled = await plansFeatures.entitled(session.schoolId, "integrations.api");
    const keys = await prisma.apiKey.findMany({ where: { schoolId: session.schoolId }, orderBy: { createdAt: "desc" }, take: 100 });
    const people = await prisma.user.findMany({ where: { id: { in: keys.map((key) => key.createdById ?? "").filter(Boolean) } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((person) => [person.id, `${person.firstName} ${person.lastName}`]));
    return {
      entitled: entitled.allowed, why: entitled.why, scopes: API_SCOPES,
      keys: keys.map((key) => ({ id: key.id, name: key.name, prefix: key.prefix ?? "", scopes: (key.scope as string[]) ?? [], createdAt: key.createdAt.toISOString(), by: key.createdById ? nameOf.get(key.createdById) ?? "" : "", lastUsedAt: key.lastUsedAt?.toISOString() ?? null, calls: key.calls, revoked: Boolean(key.revokedAt) }))
    };
  }

  async create(session: SessionPayload, body: unknown) {
    await plansFeatures.require(session.schoolId, "integrations.api");
    const input = createSchema.parse(body);
    const scopes = input.scopes.filter((scope) => SCOPE_KEYS.includes(scope));
    if (!scopes.length) throw new BadRequestException("Choose at least one of the things a key can read.");
    if ((await prisma.apiKey.count({ where: { schoolId: session.schoolId, revokedAt: null } })) >= 10) throw new BadRequestException("A school may hold ten live keys. Revoke one you no longer use first.");
    const secret = `frk_${randomBytes(24).toString("base64url")}`;
    const created = await prisma.apiKey.create({ data: { schoolId: session.schoolId, name: input.name, keyHash: sha(secret), scope: scopes, prefix: secret.slice(0, 10), createdById: session.userId } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "ApiKey", entityId: created.id, metadata: { summary: `API key created · ${input.name}`, scopes } } });
    // The only time the secret exists in the clear: the drawer reads `fields` and `note` from this and shows them once.
    return { id: created.id, fields: [["API key", secret]], note: "Copy it now — it is shown once and cannot be recovered. If it is lost, revoke it and make another." };
  }

  async revoke(session: SessionPayload, id: string) {
    const key = await prisma.apiKey.findFirst({ where: { id, schoolId: session.schoolId, revokedAt: null } });
    if (!key) throw new NotFoundException("That key is not live.");
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.DELETE, entityType: "ApiKey", entityId: id, metadata: { summary: `API key revoked · ${key.name}` } } });
    return { id };
  }

  /** Resolves a presented secret to a school, or says why not. Counts the call. */
  async authenticate(secret: string | undefined) {
    if (!secret || !secret.startsWith("frk_")) return { ok: false as const, status: 401, error: "Send a key as `Authorization: Bearer frk_…`." };
    const key = await prisma.apiKey.findFirst({ where: { keyHash: sha(secret), revokedAt: null } });
    if (!key || !key.schoolId) return { ok: false as const, status: 401, error: "That key is not valid, or has been revoked." };
    const entitled = await plansFeatures.entitled(key.schoolId, "integrations.api");
    if (!entitled.allowed) return { ok: false as const, status: 403, error: `This school's plan no longer includes API access. ${entitled.why}` };
    void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date(), calls: { increment: 1 } } }).catch(() => undefined);
    return { ok: true as const, schoolId: key.schoolId, keyId: key.id, scopes: (key.scope as string[]) ?? [] };
  }

  /* ───────────────────────── what a key reads ───────────────────────── */

  async students(schoolId: string, query: { page?: string; classId?: string }) {
    const take = 100;
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const where = { schoolId, status: "ACTIVE" as const, ...(query.classId ? { currentClassId: query.classId } : {}) };
    const [rows, total] = await Promise.all([
      prisma.student.findMany({ where, select: { id: true, admissionNumber: true, firstName: true, lastName: true, status: true, currentClass: { select: { id: true, name: true, arm: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], skip: (page - 1) * take, take }),
      prisma.student.count({ where })
    ]);
    return { page, pageSize: take, total, students: rows.map((row) => ({ id: row.id, admissionNumber: row.admissionNumber, firstName: row.firstName, lastName: row.lastName, status: row.status, class: row.currentClass ? { id: row.currentClass.id, name: row.currentClass.name, arm: row.currentClass.arm } : null })) };
  }

  async classes(schoolId: string) {
    const rooms = await prisma.classRoom.findMany({ where: { schoolId, deletedAt: null, isActive: true }, select: { id: true, name: true, arm: true, classLevel: { select: { name: true } }, _count: { select: { students: { where: { status: "ACTIVE" } } } } }, orderBy: { displayOrder: "asc" } });
    return { classes: rooms.map((room) => ({ id: room.id, name: room.name, arm: room.arm, level: room.classLevel.name, students: room._count.students })) };
  }

  async attendance(schoolId: string, dateText: string | undefined) {
    const day = dateText ? new Date(`${dateText}T00:00:00.000Z`) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    if (Number.isNaN(day.getTime())) throw new BadRequestException("Give the date as YYYY-MM-DD.");
    const groups = await prisma.studentAttendance.groupBy({ by: ["classId", "status"], where: { schoolId, date: day, subjectId: null }, _count: true });
    const rooms = await prisma.classRoom.findMany({ where: { id: { in: [...new Set(groups.map((group) => group.classId))] } }, select: { id: true, name: true, arm: true } });
    return {
      date: day.toISOString().slice(0, 10),
      classes: rooms.map((room) => {
        const own = groups.filter((group) => group.classId === room.id);
        const count = (status: string) => own.find((group) => group.status === status)?._count ?? 0;
        return { id: room.id, name: room.name, arm: room.arm, present: count("PRESENT"), absent: count("ABSENT"), late: count("LATE"), excused: count("EXCUSED") };
      })
    };
  }
}
