import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName } from "../fee-management/fees.shared";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { ANSWERS, FORMS, FORM_KINDS, factsFrom, reaches, type Answer, type FormData } from "./forms.shared";

const createSchema = z.object({
  title: z.string().trim().min(4, "Give the form a title families will recognise."),
  kind: z.enum(FORM_KINDS).default("Other"),
  who: z.string().default("Every family"),
  classes: z.array(z.string()).default([]),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Say the day families should reply by.").optional().or(z.literal("")),
  details: z.string().trim().min(8, "Say what the form is asking, in the school's own words."),
  ask: z.string().trim().max(160).optional().or(z.literal("")),
  yes: z.string().trim().min(2).max(60).default("I agree"),
  no: z.string().trim().min(2).max(60).default("I do not agree"),
});

/** The school's side of forms: write one, see who has answered, close it. */
@Injectable()
export class FormsService {
  private async audit(session: SessionPayload, action: AuditAction, entityId: string, summary: string) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "FamilyForm", entityId, metadata: { summary } as Prisma.InputJsonValue } });
  }

  /** The families a form goes to, with the children it concerns. */
  private async audience(schoolId: string, form: FormData) {
    const links = await prisma.studentGuardian.findMany({
      where: { student: { schoolId, status: "ACTIVE", ...(form.classIds.length ? { currentClassId: { in: form.classIds } } : {}) }, guardian: { mergedIntoId: null, safeguardingRestrictedAt: null } },
      select: { guardianId: true, guardian: { select: { id: true, firstName: true, lastName: true, userId: true } }, student: { select: { firstName: true } } },
    });
    const families = new Map<string, { id: string; name: string; userId: string | null; children: string[] }>();
    for (const link of links) {
      const family = families.get(link.guardianId) ?? { id: link.guardian.id, name: `${link.guardian.firstName} ${link.guardian.lastName}`, userId: link.guardian.userId, children: [] };
      family.children.push(link.student.firstName);
      families.set(link.guardianId, family);
    }
    return [...families.values()];
  }

  /** Every form, newest first, with who has answered what. */
  async overview(session: SessionPayload) {
    const [forms, answers, classes] = await Promise.all([
      new ConfigStore(session.schoolId, FORMS).list<FormData>(),
      new ConfigStore(session.schoolId, ANSWERS).list<Answer & { formId: string; guardianId: string }>(),
      prisma.classRoom.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null }, select: { id: true, name: true, arm: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
    ]);
    const rows = await Promise.all(forms.map(async (form) => {
      const audience = await this.audience(session.schoolId, form.data);
      const own = answers.filter((answer) => answer.data.formId === form.code);
      const byGuardian = new Map(own.map((answer) => [answer.data.guardianId, answer.data]));
      return {
        id: form.code ?? form.id, title: form.data.title, kind: form.data.kind, audience: form.data.audience, due: form.data.due, status: form.data.status,
        facts: form.data.facts, ask: form.data.ask, yes: form.data.yes, no: form.data.no, createdAt: form.data.createdAt, createdBy: form.data.createdBy,
        families: audience.length,
        yesCount: own.filter((answer) => answer.data.decision === "YES").length, noCount: own.filter((answer) => answer.data.decision === "NO").length,
        answers: audience.slice(0, 400).map((family) => { const a = byGuardian.get(family.id); return { family: family.name, children: family.children, decision: a?.decision ?? null, text: a?.text ?? "", at: a?.at ?? null }; }),
      };
    }));
    return { forms: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), classes: classes.map((room) => ({ id: room.id, name: armName(room) })), kinds: [...FORM_KINDS] };
  }

  async create(session: SessionPayload, body: unknown) {
    const input = createSchema.parse(body);
    const rooms = await prisma.classRoom.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null }, select: { id: true, name: true, arm: true } });
    const chosen = input.who === "Chosen classes" ? rooms.filter((room) => input.classes.includes(armName(room))) : [];
    if (input.who === "Chosen classes" && !chosen.length) throw new BadRequestException("Choose at least one class this form goes to.");
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const id = randomUUID().slice(0, 12);
    const data: FormData = {
      title: input.title, kind: input.kind, classIds: chosen.map((room) => room.id),
      audience: chosen.length ? chosen.map((room) => armName(room)).join(", ") : "Every family",
      due: input.due || null, facts: factsFrom(input.details), ask: input.ask || null, yes: input.yes, no: input.no,
      status: "OPEN", createdAt: new Date().toISOString(), createdBy: me ? `${me.firstName} ${me.lastName}` : "The school",
    };
    await new ConfigStore(session.schoolId, FORMS).put(id, data.title, data);
    // Families are told in their portal the moment it goes out.
    const audience = await this.audience(session.schoolId, data);
    const rowsToTell = audience.filter((family) => family.userId).map((family) => ({
      schoolId: session.schoolId, userId: family.userId!, channel: "IN_APP" as const, status: "SENT" as const, sentAt: new Date(),
      title: `A form needs your answer: ${data.title}`, body: `${data.due ? `Please reply by ${data.due}. ` : ""}Open Forms and consents in the parent portal.`,
    }));
    if (rowsToTell.length) await prisma.notificationLog.createMany({ data: rowsToTell });
    await this.audit(session, AuditAction.CREATE, id, `Form sent · ${data.title} · ${data.audience} · ${audience.length} families`);
    return { id, families: audience.length };
  }

  async close(session: SessionPayload, id: string) {
    const store = new ConfigStore(session.schoolId, FORMS);
    const form = await store.get<FormData>(id);
    if (!form) throw new NotFoundException("That form is not one of this school's.");
    if (form.data.status === "CLOSED") return { id, status: "CLOSED" };
    await store.put(id, form.name, { ...form.data, status: "CLOSED" });
    await this.audit(session, AuditAction.UPDATE, id, `Form closed · ${form.data.title}`);
    return { id, status: "CLOSED" };
  }
}

export { reaches };
