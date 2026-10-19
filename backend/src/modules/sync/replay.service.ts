import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { Access, armName, dayOf, iso, longDay } from "../attendance-management/attendance.shared";
import { RegisterService } from "../attendance-management/register.service";
import { SheetsService } from "../score-results/sheets.service";
import { LEADERS } from "../student-records/records.shared";

/**
 * What happens when work captured on a device with no connection reaches the school's record.
 *
 * Each captured write arrives once, with an id the device made up, so a retry never applies it twice. Then:
 *  - nothing changed on the record since it was captured → it is applied exactly as if it had been typed on the day;
 *  - the record changed in the meantime and says something different → neither version is lost: both are kept as a
 *    conflict until a leader chooses;
 *  - the record refuses it (a closed window, a locked sheet, no permission) → it is kept with the reason, not retried.
 */

const MAX_AGE_DAYS = 14;

const entrySchema = z.object({
  clientId: z.string().min(8).max(80),
  kind: z.enum(["ATTENDANCE", "SCORE_ENTRY"]),
  classId: z.string().min(1),
  subjectId: z.string().optional(),
  capturedAt: z.string(),
  deviceLabel: z.string().max(80).optional(),
  body: z.record(z.string(), z.unknown()),
});
const replaySchema = z.object({ entries: z.array(entrySchema).min(1).max(50) });
const resolveSchema = z.object({ choice: z.enum(["school", "device"]), note: z.string().trim().max(300).optional() });

export type ReplayResult = { clientId: string; state: "APPLIED" | "CONFLICT" | "REJECTED"; message: string };

const counts = (statuses: string[]) => {
  const tally = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
  for (const status of statuses) tally[status] = (tally[status] ?? 0) + 1;
  return tally;
};
const sayCounts = (tally: Record<string, number>) => `${tally.PRESENT} present · ${tally.ABSENT} absent${tally.LATE ? ` · ${tally.LATE} late` : ""}${tally.EXCUSED ? ` · ${tally.EXCUSED} excused` : ""}`;
const person = (user: { firstName: string; lastName: string } | null | undefined) => (user ? `${user.firstName} ${user.lastName}`.trim() : "Someone");

@Injectable()
export class SyncReplayService {
  constructor(private readonly access: Access, private readonly register: RegisterService, private readonly sheets: SheetsService) {}

  async replay(session: SessionPayload, body: unknown): Promise<ReplayResult[]> {
    const { entries } = replaySchema.parse(body);
    const results: ReplayResult[] = [];
    for (const entry of entries) results.push(await this.one(session, entry));
    return results;
  }

  private async one(session: SessionPayload, entry: z.infer<typeof entrySchema>): Promise<ReplayResult> {
    const seen = await prisma.syncDraft.findUnique({ where: { userId_clientId: { userId: session.userId, clientId: entry.clientId } } });
    if (seen && seen.state !== "PENDING") return { clientId: entry.clientId, state: seen.state === "APPLIED" ? "APPLIED" : seen.state === "CONFLICT" || seen.state === "RESOLVED" ? "CONFLICT" : "REJECTED", message: seen.message ?? "Already received." };

    const capturedAt = new Date(entry.capturedAt);
    const now = Date.now();
    const draft = seen ?? await prisma.syncDraft.create({ data: { schoolId: session.schoolId, userId: session.userId, type: entry.kind, payload: entry as unknown as Prisma.InputJsonValue, clientId: entry.clientId, capturedAt: Number.isNaN(capturedAt.getTime()) ? null : capturedAt, deviceLabel: entry.deviceLabel ?? null } });
    const finish = async (state: ReplayResult["state"], message: string, conflict?: Prisma.InputJsonValue): Promise<ReplayResult> => {
      await prisma.syncDraft.update({ where: { id: draft.id }, data: { state, message, syncedAt: state === "APPLIED" ? new Date() : null, ...(conflict ? { conflict } : {}) } });
      return { clientId: entry.clientId, state, message };
    };

    if (Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > now + 5 * 60_000) return finish("REJECTED", "The device's clock said this was captured in the future, so it was not trusted.");
    if (now - capturedAt.getTime() > MAX_AGE_DAYS * 86_400_000) return finish("REJECTED", `It was captured more than ${MAX_AGE_DAYS} days ago. Enter it again, or ask a school administrator to.`);
    const key = entry.kind === "ATTENDANCE" ? "attendance.mark.create" : "score-entry-results.enter.create";
    if (!(await this.access.can(session, key))) return finish("REJECTED", "You no longer have permission to enter this.");

    try {
      return entry.kind === "ATTENDANCE" ? await this.attendance(session, entry, capturedAt, finish) : await this.scores(session, entry, capturedAt, finish);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The record refused it.";
      return finish("REJECTED", message.length > 240 ? `${message.slice(0, 237)}…` : message);
    }
  }

  private async attendance(session: SessionPayload, entry: z.infer<typeof entrySchema>, capturedAt: Date, finish: (state: ReplayResult["state"], message: string, conflict?: Prisma.InputJsonValue) => Promise<ReplayResult>) {
    const date = dayOf(String(entry.body.date ?? ""));
    const device = (Array.isArray(entry.body.entries) ? entry.body.entries : []) as Array<{ studentId: string; status: string }>;
    const room = await prisma.classRoom.findFirst({ where: { id: entry.classId, schoolId: session.schoolId, deletedAt: null }, select: { name: true, arm: true } });
    if (!room) return finish("REJECTED", "That arm is no longer in this school.");
    const [rows, register] = await Promise.all([
      prisma.studentAttendance.findMany({ where: { schoolId: session.schoolId, classId: entry.classId, date, subjectId: null }, select: { studentId: true, status: true, markedById: true, markedAt: true } }),
      prisma.attendanceRegister.findUnique({ where: { classId_date: { classId: entry.classId, date } } }),
    ]);
    const taken = register?.status === "SUBMITTED" || rows.length > 0;
    if (!taken) {
      await this.register.submit(session, entry.classId, entry.body, { capturedAt });
      return finish("APPLIED", `Register for ${armName(room)} on ${longDay(date)} reached the record.`);
    }
    const onRecord = new Map(rows.map((row) => [row.studentId, row.status]));
    const differing = device.filter((mark) => onRecord.get(mark.studentId) !== mark.status).length;
    if (!differing) return finish("APPLIED", "That register was already on the record, with the same marks.");
    const by = rows.length ? await prisma.user.findUnique({ where: { id: rows[0].markedById }, select: { firstName: true, lastName: true } }) : null;
    const at = register?.submittedAt ?? rows[0]?.markedAt ?? null;
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const conflict = {
      record: `Register · ${armName(room)} · ${iso(date)}`,
      school: { summary: sayCounts(counts(rows.map((row) => row.status))), by: person(by), at: at?.toISOString() ?? null },
      device: { summary: sayCounts(counts(device.map((mark) => mark.status))), by: person(me), at: capturedAt.toISOString() },
      differing,
    };
    return finish("CONFLICT", `${differing} of ${device.length} marks differ from the register already on the record.`, conflict as unknown as Prisma.InputJsonValue);
  }

  private async scores(session: SessionPayload, entry: z.infer<typeof entrySchema>, capturedAt: Date, finish: (state: ReplayResult["state"], message: string, conflict?: Prisma.InputJsonValue) => Promise<ReplayResult>) {
    if (!entry.subjectId) return finish("REJECTED", "Which subject these scores are for was not recorded.");
    const outcome = await this.sheets.replay(session, entry.classId, entry.subjectId, entry.body, capturedAt);
    if (!outcome.conflicts.length) return finish("APPLIED", `${outcome.applied} ${outcome.applied === 1 ? "mark" : "marks"} reached ${outcome.subject} · ${outcome.arm}.`);
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const first = outcome.conflicts[0];
    const conflict = {
      record: `Scores · ${outcome.subject} · ${outcome.arm}`,
      school: { summary: outcome.conflicts.slice(0, 3).map((item) => `${item.student.split(" ")[0]} ${item.column} ${item.school.value}`).join(" · ") + (outcome.conflicts.length > 3 ? ` · +${outcome.conflicts.length - 3} more` : ""), by: first.school.by, at: first.school.at },
      device: { summary: outcome.conflicts.slice(0, 3).map((item) => `${item.student.split(" ")[0]} ${item.column} ${item.device.text || "blank"}`).join(" · ") + (outcome.conflicts.length > 3 ? ` · +${outcome.conflicts.length - 3} more` : ""), by: person(me), at: capturedAt.toISOString() },
      differing: outcome.conflicts.length,
      items: outcome.conflicts.map((item) => ({ studentId: item.studentId, key: item.key, text: item.device.text })),
    };
    return finish("CONFLICT", `${outcome.applied} ${outcome.applied === 1 ? "mark" : "marks"} applied; ${outcome.conflicts.length} ${outcome.conflicts.length === 1 ? "differs" : "differ"} from what somebody entered since.`, conflict as unknown as Prisma.InputJsonValue);
  }

  /** A leader chooses which version stands. Both are kept in the audit trail either way. */
  async resolve(session: SessionPayload, id: string, body: unknown) {
    const input = resolveSchema.parse(body);
    if (!LEADERS.has(session.role)) throw new ForbiddenException("Only a school administrator chooses between two versions of a record.");
    const draft = await prisma.syncDraft.findFirst({ where: { id, schoolId: session.schoolId, state: "CONFLICT" } });
    if (!draft) throw new NotFoundException("That conflict has already been resolved, or does not exist.");
    const entry = entrySchema.parse(draft.payload);
    const capturedAt = draft.capturedAt ?? new Date();
    const record = String((draft.conflict as { record?: string } | null)?.record ?? "a record");

    if (input.choice === "device") {
      if (entry.kind === "ATTENDANCE") {
        await this.register.submit(session, entry.classId, entry.body, { capturedAt });
      } else {
        const items = ((draft.conflict as { items?: Array<{ studentId: string; key: string; text: string }> } | null)?.items ?? []);
        if (!items.length || !entry.subjectId) throw new BadRequestException("This conflict has nothing left to apply.");
        const rows = Array.from(items.reduce((map, item) => map.set(item.studentId, { ...(map.get(item.studentId) ?? {}), [item.key]: item.text }), new Map<string, Record<string, string>>()).entries()).map(([studentId, cells]) => ({ studentId, cells }));
        await this.sheets.save(session, entry.classId, entry.subjectId, { rows, note: input.note });
      }
    }
    await prisma.syncDraft.update({ where: { id }, data: { state: "RESOLVED", resolution: input.choice === "device" ? "DEVICE" : "SCHOOL", resolvedById: session.userId, resolvedAt: new Date(), syncedAt: new Date(), message: input.choice === "device" ? "The device's version was applied." : "The version already on the record was kept." } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "SyncDraft", entityId: id, metadata: { summary: `Offline conflict resolved · ${record} · ${input.choice === "device" ? "device version applied" : "record version kept"}`, note: input.note ?? null, author: draft.userId } as Prisma.InputJsonValue } });
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: draft.userId, channel: "IN_APP", title: "Your offline work was reviewed", body: `${record}: ${input.choice === "device" ? "your version was applied." : "the version already on the record was kept."}${input.note ? ` ${input.note}` : ""}`, status: "QUEUED", sentAt: new Date() } });
    return { resolved: true, fields: [["Record", record], ["Kept", input.choice === "device" ? "The device's version" : "The version on the record"], ["Told", "The person who captured it"]] };
  }
}
