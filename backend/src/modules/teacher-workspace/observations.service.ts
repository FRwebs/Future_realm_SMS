import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";
import { store } from "../staff-access/staff-access.shared";
import { TeacherWorkspaceService } from "./workspace.service";

export const DEFAULT_AREAS = ["Communication and language", "Personal, social and emotional", "Physical development", "Literacy", "Mathematics", "Understanding the world", "Expressive arts and design"];
export const DEFAULT_BANDS = ["Emerging", "Developing", "Secure", "Exceeding"];
const DAY = 86_400_000;

const saveSchema = z.object({ areas: z.record(z.string()).default({}), note: z.string().trim().max(2000).optional(), photoA: z.string().optional(), photoB: z.string().optional() });
const MAX_PHOTO = 1_400_000;
const IMAGE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Early years: what a teacher saw, in words — never a score. An observation names the learning areas the teacher actually saw that
 * time and the descriptor for each, with a sentence of evidence. Nothing is averaged, ranked or summed; the class summary counts
 * children at each descriptor. The areas and descriptors are the school's own, so they come from its setting (these defaults until it
 * writes its own).
 */
@Injectable()
export class TeacherObservationsService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  private async framework(schoolId: string) {
    const saved = await store(schoolId, "early-years-framework").get<{ areas?: string[]; bands?: string[] }>("framework");
    return { areas: saved?.data.areas?.length ? saved.data.areas : DEFAULT_AREAS, bands: saved?.data.bands?.length ? saved.data.bands : DEFAULT_BANDS, own: Boolean(saved) };
  }

  /** The early-years arms this teacher is class teacher of — the only ones they observe. */
  private async arms(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no observation window.");
    const arms = me.formArms.filter((arm) => arm.earlyYears);
    if (!arms.length) throw new ForbiddenException("Observations are kept by the class teacher of an early-years class.");
    const term = await prisma.term.findUniqueOrThrow({ where: { id: me.term.id } });
    const middle = new Date(term.startDate.getTime() + (term.endDate.getTime() - term.startDate.getTime()) / 2);
    const half = Date.now() <= middle.getTime() ? 1 : 2;
    const closes = half === 1 ? middle : term.endDate;
    return { me, arms, term, half, closes };
  }

  async list(session: SessionPayload) {
    const { me, arms, term, half, closes } = await this.arms(session);
    const fw = await this.framework(session.schoolId);
    const out = [];
    for (const arm of arms) {
      const [students, observations] = await Promise.all([
        prisma.student.findMany({ where: { schoolId: session.schoolId, currentClassId: arm.id, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, admissionNumber: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
        prisma.childObservation.findMany({ where: { schoolId: session.schoolId, classId: arm.id, termId: term.id }, orderBy: { observedAt: "desc" } })
      ]);
      const children = students.map((student, index) => {
        const mine = observations.filter((entry) => entry.studentId === student.id);
        const thisHalf = mine.filter((entry) => entry.halfTerm === half);
        const latest: Record<string, string> = {};
        for (const entry of [...mine].reverse()) for (const [area, band] of Object.entries(entry.areas as Record<string, string>)) latest[area] = band;
        return { id: student.id, name: fullName(student), adm: student.admissionNumber, roll: index + 1, observed: thisHalf.length > 0, count: thisHalf.length, last: mine[0]?.observedAt.toISOString() ?? null, bands: latest, areasSeen: Object.keys(latest).length };
      });
      out.push({ id: arm.id, name: arm.name, roll: arm.roll, children, total: observations.filter((entry) => entry.halfTerm === half).length, photos: observations.filter((entry) => entry.halfTerm === half).reduce((sum, entry) => sum + entry.photos.length, 0) });
    }
    return { framework: fw, term: { name: me.term!.name, session: me.term!.session }, half, closes: closes.toISOString(), daysLeft: Math.max(0, Math.ceil((closes.getTime() - Date.now()) / DAY)), arms: out };
  }

  async child(session: SessionPayload, studentId: string) {
    const { arms, term, half, closes } = await this.arms(session);
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: session.schoolId, status: "ACTIVE", currentClassId: { in: arms.map((arm) => arm.id) } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClassId: true } });
    if (!student) throw new ForbiddenException("That child is not in an early-years class you teach.");
    const arm = arms.find((entry) => entry.id === student.currentClassId)!;
    const fw = await this.framework(session.schoolId);
    const [history, roster, marks] = await Promise.all([
      prisma.childObservation.findMany({ where: { schoolId: session.schoolId, studentId, termId: term.id }, orderBy: { observedAt: "desc" }, take: 30 }),
      prisma.student.findMany({ where: { schoolId: session.schoolId, currentClassId: arm.id, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId: session.schoolId, studentId, termId: term.id, subjectId: null }, _count: true })
    ]);
    const marked = marks.reduce((sum, entry) => sum + entry._count, 0);
    const present = marks.filter((entry) => entry.status === "PRESENT" || entry.status === "LATE").reduce((sum, entry) => sum + entry._count, 0);
    const latest: Record<string, string> = {};
    for (const entry of [...history].reverse()) for (const [area, band] of Object.entries(entry.areas as Record<string, string>)) latest[area] = band;
    const observedIds = new Set((await prisma.childObservation.findMany({ where: { schoolId: session.schoolId, classId: arm.id, termId: term.id, halfTerm: half }, select: { studentId: true } })).map((entry) => entry.studentId));
    const at = roster.findIndex((entry) => entry.id === studentId);
    const nextUnseen = roster.find((entry, index) => index > at && !observedIds.has(entry.id));
    const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(history.map((entry) => entry.observedById))] } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(authors.map((author) => [author.id, fullName(author)]));
    return {
      framework: fw, half, closes: closes.toISOString(), arm: { id: arm.id, name: arm.name },
      student: { id: student.id, name: fullName(student), adm: student.admissionNumber, position: at + 1, of: roster.length },
      peers: roster.map((entry, index) => ({ id: entry.id, name: fullName(entry), observed: observedIds.has(entry.id), now: entry.id === studentId, index })),
      nextUnseen: nextUnseen ? { id: nextUnseen.id, name: fullName(nextUnseen) } : null,
      observedThisHalf: observedIds.has(studentId), bands: latest, attendance: marked ? { pct: Math.round((present / marked) * 100), days: marked } : null,
      history: history.map((entry) => ({ id: entry.id, at: entry.observedAt.toISOString(), half: entry.halfTerm, areas: entry.areas as Record<string, string>, note: entry.note, by: nameOf.get(entry.observedById) ?? "", photos: entry.photos.length }))
    };
  }

  async save(session: SessionPayload, studentId: string, body: unknown) {
    const input = saveSchema.parse(body);
    const { arms, term, half } = await this.arms(session);
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: session.schoolId, status: "ACTIVE", currentClassId: { in: arms.map((arm) => arm.id) } }, select: { id: true, currentClassId: true, firstName: true, lastName: true } });
    if (!student) throw new ForbiddenException("That child is not in an early-years class you teach.");
    const fw = await this.framework(session.schoolId);
    const areas: Record<string, string> = {};
    for (const [area, band] of Object.entries(input.areas)) {
      if (!band) continue;
      if (!fw.areas.includes(area)) throw new BadRequestException(`${area} is not one of this school’s learning areas.`);
      if (!fw.bands.includes(band)) throw new BadRequestException(`${band} is not one of this school’s descriptors (${fw.bands.join(", ")}).`);
      areas[area] = band;
    }
    if (!Object.keys(areas).length) throw new BadRequestException("Choose a descriptor for at least one area you saw.");
    if (!input.note || input.note.length < 10) throw new BadRequestException("Write what you saw, in a sentence. The family reads it at the end of term.");
    const photos = [input.photoA, input.photoB].filter((value): value is string => Boolean(value && value.startsWith("data:")));
    for (const photo of photos) {
      if (photo.length > MAX_PHOTO) throw new BadRequestException("A photograph is too large. Use a smaller one — it is shrunk before it is sent, but this one is still over the limit.");
      if (!IMAGE.test(photo)) throw new BadRequestException("A photograph must be a picture (JPEG, PNG or WebP).");
    }
    const created = await prisma.childObservation.create({ data: { schoolId: session.schoolId, studentId, classId: student.currentClassId!, termId: term.id, halfTerm: half, areas, note: input.note, photos, observedById: session.userId } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "ChildObservation", entityId: created.id, metadata: { summary: `Observation recorded · ${fullName(student)}`, areas: Object.keys(areas).length } } });
    return { id: created.id };
  }

  /** One photograph, as the bytes — only to the class teacher of the arm the child is in. */
  async photo(session: SessionPayload, observationId: string, index: number) {
    const { arms } = await this.arms(session);
    const entry = await prisma.childObservation.findFirst({ where: { id: observationId, schoolId: session.schoolId, classId: { in: arms.map((arm) => arm.id) } }, select: { photos: true } });
    const data = entry?.photos[index];
    if (!data) throw new NotFoundException("That photograph does not exist, or is not one of your class’s.");
    const match = /^data:(image\/[a-z+.-]+);base64,(.*)$/.exec(data);
    if (!match) throw new NotFoundException("That photograph could not be read.");
    return { type: match[1]!, bytes: Buffer.from(match[2]!, "base64") };
  }

  /** Where the class stands in each area: counts of children at each descriptor, never an average. */
  async summary(session: SessionPayload) {
    const { arms, term, half } = await this.arms(session);
    const fw = await this.framework(session.schoolId);
    const out = [];
    for (const arm of arms) {
      const [students, observations] = await Promise.all([
        prisma.student.findMany({ where: { schoolId: session.schoolId, currentClassId: arm.id, status: "ACTIVE" }, select: { id: true } }),
        prisma.childObservation.findMany({ where: { schoolId: session.schoolId, classId: arm.id, termId: term.id }, orderBy: { observedAt: "asc" } })
      ]);
      const latest = new Map<string, Record<string, string>>();
      for (const entry of observations) latest.set(entry.studentId, { ...(latest.get(entry.studentId) ?? {}), ...(entry.areas as Record<string, string>) });
      const counts = fw.areas.map((area) => ({ area, counts: fw.bands.map((band) => [...latest.values()].filter((value) => value[area] === band).length), unseen: students.length - [...latest.values()].filter((value) => value[area]).length }));
      out.push({ id: arm.id, name: arm.name, roll: students.length, observed: new Set(observations.filter((entry) => entry.halfTerm === half).map((entry) => entry.studentId)).size, counts });
    }
    return { framework: fw, half, arms: out };
  }
}
