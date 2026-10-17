import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, FeeComponentType, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { toMoney } from "../../../../src/lib/domain/finance";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { currentTerm, num } from "./fees.shared";

/**
 * Structures: what each group of classes is charged, item by item, and the adjustment rules that
 * sit around it. Creating a structure never bills anybody — publishing does, and publishing says
 * first exactly whom it will bill and for how much.
 */

const KINDS = ["Day", "Boarding supplement", "Concession", "Transport", "One-off"];

const lineSchema = z.object({
  name: z.string().trim().min(1, "Every fee item needs a name."),
  type: z.string().default("Mandatory"),
  freq: z.string().default("Termly"),
  amt: z.preprocess((value) => (typeof value === "string" ? value.replace(/[^0-9.]/g, "") : value), z.coerce.number().min(0, "An amount cannot be negative."))
});

const createSchema = z.object({
  name: z.string().trim().min(3, "Name the structure."),
  ref: z.string().trim().optional(),
  kind: z.string().default("Day"),
  classes: z.array(z.string()).default([]),
  items: z.array(lineSchema).default([]),
  from: z.string().optional(),
  draft: z.coerce.boolean().default(true)
});

const itemsSchema = z.object({
  items: z.array(lineSchema).min(1, "A structure charges at least one item."),
  takesEffect: z.string().default("The next invoice run"),
  reason: z.string().optional(),
  tell: z.coerce.boolean().default(true)
});

const ruleSchema = z.object({
  name: z.string().trim().min(3, "Name the rule."),
  appliesTo: z.string().default("Second child onward"),
  valueIs: z.string().default("A percentage"),
  value: z.coerce.number().positive("Give the value."),
  items: z.array(z.string()).default(["Tuition"]),
  stacks: z.string().default("No · the largest applies"),
  until: z.string().default("I remove it"),
  endDate: z.string().optional(),
  visible: z.coerce.boolean().default(true)
});

const LABEL_COMPONENT: Array<[RegExp, FeeComponentType]> = [
  [/tuition/i, "TUITION"],
  [/development/i, "DEVELOPMENT_LEVY"],
  [/exam|waec|neco/i, "EXAM_FEE"],
  [/ict|computer/i, "ICT_FEE"],
  [/pta/i, "PTA_FEE"],
  [/transport|bus/i, "TRANSPORT"],
  [/board|hostel|feeding|laundry/i, "HOSTEL"],
  [/book|stationery/i, "BOOKS"],
  [/uniform|sports/i, "UNIFORM"]
];

export const componentOfLabel = (label: string): FeeComponentType => LABEL_COMPONENT.find(([pattern]) => pattern.test(label))?.[1] ?? "OTHER";

const stateOf = (structure: { listState: string; deletedAt: Date | null }) => (structure.listState === "DRAFT" ? "Draft" : structure.listState === "ARCHIVED" ? "Archived" : "Published");

type StructureRow = Prisma.FeeStructureGetPayload<{ include: { items: true; levels: { include: { classLevel: true } }; classRoom: { include: { classLevel: true } } } }>;

@Injectable()
export class StructuresService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  private rules(schoolId: string) {
    return new ConfigStore(schoolId, "fee-adjustment-rules");
  }

  private classesOf(structure: StructureRow): string[] {
    if (structure.allClasses) return ["All classes"];
    if (structure.levels.length) return structure.levels.map((level) => level.classLevel.name);
    if (structure.classRoom) return [structure.classRoom.classLevel?.name ?? structure.classRoom.name];
    return [];
  }

  /** Mandatory, termly items: what a family on this structure is actually asked for each term. */
  private termly(structure: StructureRow): number {
    return structure.items.filter((item) => item.isActive && item.itemType === "Mandatory" && item.frequency === "Termly").reduce((sum, item) => sum + num(item.amount), 0);
  }

  private async billedStudents(schoolId: string): Promise<Map<string, number>> {
    const rows = await prisma.invoice.groupBy({ by: ["feeStructureId"], where: { schoolId, status: { not: "VOID" }, feeStructureId: { not: null } }, _count: { studentId: true } });
    return new Map(rows.map((row) => [row.feeStructureId as string, row._count.studentId]));
  }

  private mapStructure(structure: StructureRow, students: number) {
    const termly = this.termly(structure);
    return {
      id: structure.id,
      ref: structure.ref ?? `FS-${structure.id.slice(-5).toUpperCase()}`,
      name: structure.name,
      kind: structure.kind,
      state: stateOf(structure),
      classes: this.classesOf(structure),
      mapped: structure.allClasses || structure.levels.length > 0 || Boolean(structure.classRoom),
      items: structure.items.filter((item) => item.isActive).length,
      students,
      termly,
      expected: students ? termly * students : 0,
      term: structure.termId,
      session: structure.academicSessionId
    };
  }

  /* ───────────────────────── the list ───────────────────────── */

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [structures, billed, rules, levels, families, discount] = await Promise.all([
      prisma.feeStructure.findMany({ where: { schoolId, deletedAt: null }, include: { items: true, levels: { include: { classLevel: true } }, classRoom: { include: { classLevel: true } } }, orderBy: [{ listState: "asc" }, { name: "asc" }] }),
      this.billedStudents(schoolId),
      this.rules(schoolId).list<z.infer<typeof ruleSchema>>(),
      prisma.classLevel.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
      this.siblingFamilies(schoolId),
      prisma.invoice.aggregate({ where: { schoolId, status: { not: "VOID" } }, _sum: { discount: true } })
    ]);
    const rows = structures.map((structure) => this.mapStructure(structure, stateOf(structure) === "Draft" ? 0 : billed.get(structure.id) ?? 0));
    const live = rows.filter((row) => row.state === "Published");
    const expected = live.reduce((sum, row) => sum + row.expected, 0);
    const mappedLevels = new Set(
      structures
        .filter((structure) => structure.kind === "Day" && stateOf(structure) === "Published")
        .flatMap((structure) => [...structure.levels.map((level) => level.classLevelId), ...(structure.classRoom?.classLevelId ? [structure.classRoom.classLevelId] : [])])
    );
    const term = await currentTerm(schoolId);
    return {
      term: term ? { id: term.id, label: `${term.name} ${term.academicSession?.name ?? ""}`.trim() } : null,
      structures: rows,
      totals: {
        count: rows.length,
        published: live.length,
        draft: rows.length - live.length,
        expected,
        classesMapped: mappedLevels.size,
        classes: levels.length,
        placements: live.reduce((sum, row) => sum + row.students, 0),
        boarders: rows.filter((row) => row.kind === "Boarding supplement").reduce((sum, row) => sum + row.students, 0),
        rules: rules.length,
        discount: num(discount._sum.discount)
      },
      rules: rules.map((rule) => ({ code: rule.code ?? rule.id, ...rule.data, families: /Second child/.test(rule.data.appliesTo) ? families.second : /Every family/.test(rule.data.appliesTo) ? families.all : null })),
      levels,
      unmappedStructures: rows.filter((row) => !row.mapped && row.state === "Published").length
    };
  }

  private async siblingFamilies(schoolId: string) {
    const links = await prisma.studentGuardian.groupBy({ by: ["guardianId"], where: { guardian: { schoolId }, student: { status: "ACTIVE" } }, _count: { studentId: true } });
    return { all: links.length, second: links.filter((link) => link._count.studentId > 1).reduce((sum, link) => sum + link._count.studentId - 1, 0) };
  }

  /* ───────────────────────── one structure ───────────────────────── */

  private async structureOrThrow(schoolId: string, id: string): Promise<StructureRow> {
    const structure = await prisma.feeStructure.findFirst({ where: { id, schoolId, deletedAt: null }, include: { items: true, levels: { include: { classLevel: true } }, classRoom: { include: { classLevel: true } } } });
    if (!structure) throw new NotFoundException("That fee structure does not exist.");
    return structure;
  }

  async detail(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const structure = await this.structureOrThrow(schoolId, id);
    const billed = await this.billedStudents(schoolId);
    const students = stateOf(structure) === "Draft" ? 0 : billed.get(structure.id) ?? 0;
    const invoices = await prisma.invoice.findMany({
      where: { schoolId, feeStructureId: id, status: { not: "VOID" } },
      include: { items: true, payments: { where: { status: "SUCCESS", isReversed: false }, select: { amount: true } }, student: { select: { currentClass: { select: { classLevelId: true, classLevel: { select: { name: true } } } } } } }
    });
    const itemRows = structure.items
      .filter((item) => item.isActive)
      .map((item) => {
        const takers = item.itemType === "Mandatory" ? students : invoices.filter((invoice) => invoice.items.some((line) => line.description === item.label)).length;
        let collected = 0;
        for (const invoice of invoices) {
          const received = invoice.payments.reduce((sum, payment) => sum + num(payment.amount), 0);
          const share = num(invoice.total) > 0 ? received / num(invoice.total) : 0;
          const line = invoice.items.find((entry) => entry.description === item.label);
          if (line) collected += num(line.amount) * line.quantity * share;
        }
        const expected = num(item.amount) * takers;
        return { id: item.id, name: item.label, type: item.itemType, freq: item.frequency, amount: num(item.amount), takers, expected, collected: Math.round(collected), pct: expected ? Math.round((collected / expected) * 100) : null };
      });
    // A structure mapped the old way — to one class room — still charges that class's level.
    const mappedLevels = structure.levels.length
      ? structure.levels.map((level) => ({ classLevelId: level.classLevelId, classLevel: level.classLevel }))
      : structure.classRoom?.classLevel
        ? [{ classLevelId: structure.classRoom.classLevel.id, classLevel: structure.classRoom.classLevel }]
        : [];
    const perLevel = mappedLevels.map((level) => {
      // With one class mapped, every invoice on the structure belongs to it — even where a student has since moved.
      const rows = mappedLevels.length === 1 ? invoices : invoices.filter((invoice) => invoice.student.currentClass?.classLevelId === level.classLevelId);
      const billedTotal = rows.reduce((sum, invoice) => sum + num(invoice.total), 0);
      const paid = rows.reduce((sum, invoice) => sum + invoice.payments.reduce((inner, payment) => inner + num(payment.amount), 0), 0);
      return { id: level.classLevelId, name: level.classLevel.name, students: rows.length, billed: billedTotal, pct: billedTotal ? Math.round((paid / billedTotal) * 100) : null };
    });
    const rules = await this.rules(schoolId).list<z.infer<typeof ruleSchema>>();
    const levels = await prisma.classLevel.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } });
    const term = structure.termId ? await prisma.term.findUnique({ where: { id: structure.termId }, include: { academicSession: true } }) : null;
    return {
      ...this.mapStructure(structure, students),
      items: itemRows,
      levels: perLevel,
      allLevels: levels,
      publishedOn: structure.updatedAt.toISOString(),
      termLabel: term ? `${term.name} ${term.academicSession?.name ?? ""}`.trim() : null,
      termlyAll: itemRows.filter((row) => row.freq === "Termly").reduce((sum, row) => sum + row.amount, 0),
      sessional: itemRows.filter((row) => row.freq === "Sessional").reduce((sum, row) => sum + row.amount, 0),
      rules: rules.map((rule) => ({ name: rule.name, appliesTo: rule.data.appliesTo, valueIs: rule.data.valueIs, value: rule.data.value })),
      owner: structure.ownerName,
      note: structure.familyNote
    };
  }

  /* ───────────────────────── making and changing ───────────────────────── */

  private async termFor(schoolId: string, from?: string) {
    const terms = await prisma.term.findMany({ where: { schoolId }, include: { academicSession: true }, orderBy: { startDate: "asc" } });
    if (from) {
      const found = terms.find((term) => `${term.name} ${term.academicSession?.name ?? ""}`.trim() === from.trim());
      if (found) return found;
    }
    return terms.find((term) => term.isCurrent) ?? terms[terms.length - 1] ?? null;
  }

  async options(session: SessionPayload) {
    const terms = await prisma.term.findMany({ where: { schoolId: session.schoolId }, include: { academicSession: true }, orderBy: { startDate: "desc" }, take: 9 });
    return { terms: terms.map((term) => `${term.name} ${term.academicSession?.name ?? ""}`.trim()), kinds: KINDS };
  }

  private async mapLevelsInternal(schoolId: string, structureId: string, kind: string, names: string[]) {
    const levels = await prisma.classLevel.findMany({ where: { schoolId, name: { in: names } } });
    const removed: string[] = [];
    for (const level of levels) {
      const others = await prisma.feeStructureLevel.findMany({ where: { classLevelId: level.id, kind, feeStructureId: { not: structureId } }, include: { feeStructure: { select: { name: true } } } });
      for (const other of others) removed.push(`${level.name} left ${other.feeStructure.name}`);
      await prisma.feeStructureLevel.deleteMany({ where: { classLevelId: level.id, kind, feeStructureId: { not: structureId } } });
      await prisma.feeStructureLevel.upsert({ where: { feeStructureId_classLevelId: { feeStructureId: structureId, classLevelId: level.id } }, update: { kind }, create: { feeStructureId: structureId, classLevelId: level.id, kind } });
    }
    return { mapped: levels.map((level) => level.name), removed, unknown: names.filter((name) => !levels.some((level) => level.name === name)) };
  }

  async create(session: SessionPayload, body: unknown) {
    const input = createSchema.parse(body);
    if (!KINDS.includes(input.kind)) throw new BadRequestException("That is not a kind of structure.");
    if (!input.items.length) throw new BadRequestException("A structure charges at least one item.");
    const schoolId = session.schoolId;
    const term = await this.termFor(schoolId, input.from);
    const ref = input.ref || `FS-${input.name.split(/\s+/).map((word) => word[0]).join("").toUpperCase().slice(0, 6)}-${Math.floor(Math.random() * 90 + 10)}`;
    if (await prisma.feeStructure.findFirst({ where: { schoolId, ref, deletedAt: null } })) throw new BadRequestException(`The reference ${ref} is already in use.`);
    const created = await prisma.feeStructure.create({
      data: {
        schoolId,
        name: input.name,
        ref,
        kind: input.kind,
        allClasses: input.classes.includes("All classes"),
        academicSessionId: term?.academicSessionId ?? null,
        termId: term?.id ?? null,
        createdById: session.userId,
        listState: input.draft ? "DRAFT" : "PUBLISHED",
        isActive: !input.draft,
        items: { create: input.items.map((item) => this.itemData(item)) }
      }
    });
    const mapping = await this.mapLevelsInternal(schoolId, created.id, input.kind, input.classes.filter((name) => name !== "All classes"));
    await this.audit(session, AuditAction.CREATE, "FeeStructure", created.id, { summary: `Fee structure created · ${input.name}`, ref });
    return { id: created.id, ref, ...mapping };
  }

  private itemData(item: z.infer<typeof lineSchema>) {
    return {
      label: item.name,
      componentType: componentOfLabel(item.name),
      amount: item.amt,
      unitAmount: item.amt,
      quantity: 1,
      itemType: item.type,
      frequency: item.freq,
      isOptional: item.type === "Optional"
    };
  }

  async saveItems(session: SessionPayload, id: string, body: unknown) {
    const input = itemsSchema.parse(body);
    const schoolId = session.schoolId;
    const structure = await this.structureOrThrow(schoolId, id);
    const published = stateOf(structure) === "Published";
    if (published && !input.reason?.trim()) throw new BadRequestException("A change to a published structure restates invoices — say why, so the families can be told.");
    await prisma.$transaction([prisma.feeStructureItem.deleteMany({ where: { feeStructureId: id } }), prisma.feeStructureItem.createMany({ data: input.items.map((item) => ({ feeStructureId: id, ...this.itemData(item) })) })]);
    let restated = 0;
    if (published && /Immediately/.test(input.takesEffect)) restated = await this.restate(schoolId, id);
    await this.audit(session, AuditAction.UPDATE, "FeeStructure", id, { summary: `Fee items changed · ${structure.name}`, reason: input.reason, restated });
    return { items: input.items.length, restated };
  }

  /** Rebuilds the lines of every invoice that has not been settled, from the structure as it now stands. */
  private async restate(schoolId: string, structureId: string): Promise<number> {
    const structure = await prisma.feeStructure.findUniqueOrThrow({ where: { id: structureId }, include: { items: true } });
    const invoices = await prisma.invoice.findMany({ where: { schoolId, feeStructureId: structureId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { items: true, payments: { where: { status: "SUCCESS", isReversed: false }, select: { amount: true } } } });
    let count = 0;
    for (const invoice of invoices) {
      const kept = new Set(invoice.items.map((line) => line.description));
      const lines = structure.items.filter((item) => item.isActive && (item.itemType === "Mandatory" || kept.has(item.label)));
      const subtotal = toMoney(lines.reduce((sum, item) => sum + num(item.amount), 0));
      const total = toMoney(Math.max(subtotal - num(invoice.discount) + num(invoice.fine), 0));
      const received = invoice.payments.reduce((sum, payment) => sum + num(payment.amount), 0);
      const balance = toMoney(Math.max(total - received, 0));
      await prisma.$transaction([
        prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } }),
        prisma.invoiceItem.createMany({ data: lines.map((item) => ({ invoiceId: invoice.id, description: item.label, amount: item.amount, quantity: 1 })) }),
        prisma.invoice.update({ where: { id: invoice.id }, data: { subtotal, total, balance, status: balance <= 0 ? "PAID" : received > 0 ? "PARTIALLY_PAID" : invoice.status } })
      ]);
      count += 1;
    }
    return count;
  }

  async mapLevels(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ classes: z.array(z.string()).min(1, "Choose the classes."), from: z.string().optional(), tell: z.coerce.boolean().optional() }).parse(body);
    const structure = await this.structureOrThrow(session.schoolId, id);
    const result = await this.mapLevelsInternal(session.schoolId, id, structure.kind, input.classes);
    if (input.classes.includes("All classes")) await prisma.feeStructure.update({ where: { id }, data: { allClasses: true } });
    await this.audit(session, AuditAction.UPDATE, "FeeStructure", id, { summary: `Classes mapped · ${structure.name}`, ...result });
    return result;
  }

  async unmapLevel(session: SessionPayload, id: string, levelId: string) {
    const structure = await this.structureOrThrow(session.schoolId, id);
    await prisma.feeStructureLevel.deleteMany({ where: { feeStructureId: id, classLevelId: levelId } });
    if (!structure.levels.some((level) => level.classLevelId !== levelId) && structure.classRoom?.classLevel?.id === levelId) await prisma.feeStructure.update({ where: { id }, data: { classId: null } });
    await this.audit(session, AuditAction.UPDATE, "FeeStructure", id, { summary: `A class was unmapped · ${structure.name}` });
    return { id };
  }

  async remove(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ reason: z.string().trim().min(5, "Say why it is being deleted.") }).parse(body);
    const schoolId = session.schoolId;
    const structure = await this.structureOrThrow(schoolId, id);
    const students = (await this.billedStudents(schoolId)).get(id) ?? 0;
    if (students) throw new BadRequestException(`${students} ${students === 1 ? "student is" : "students are"} billed on it. Map their classes to another structure first.`);
    await prisma.feeStructure.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit(session, AuditAction.DELETE, "FeeStructure", id, { summary: `Fee structure deleted · ${structure.name}`, reason: input.reason });
    return { id };
  }

  async duplicate(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        from: z.string().min(1, "Choose the structure to copy."),
        name: z.string().trim().min(3, "Name the copy."),
        forTerm: z.string().optional(),
        raise: z.coerce.number().min(0).max(100).default(0),
        copy: z.array(z.string()).default(["Fee items", "Class mapping"]),
        draft: z.coerce.boolean().default(true)
      })
      .parse(body);
    const schoolId = session.schoolId;
    const source = await this.structureOrThrow(schoolId, input.from);
    const term = await this.termFor(schoolId, input.forTerm);
    const factor = 1 + input.raise / 100;
    const copyItems = input.copy.includes("Fee items");
    const created = await prisma.feeStructure.create({
      data: {
        schoolId,
        name: input.name,
        ref: `${source.ref ?? "FS"}-C${Math.floor(Math.random() * 90 + 10)}`,
        kind: source.kind,
        allClasses: input.copy.includes("Class mapping") ? source.allClasses : false,
        academicSessionId: term?.academicSessionId ?? source.academicSessionId,
        termId: term?.id ?? null,
        createdById: session.userId,
        listState: input.draft ? "DRAFT" : "PUBLISHED",
        isActive: !input.draft,
        items: copyItems
          ? {
              create: source.items
                .filter((item) => item.isActive && (input.copy.includes("Optional items") || item.itemType !== "Optional"))
                .map((item) => ({ label: item.label, componentType: item.componentType, amount: Math.round(num(item.amount) * factor), unitAmount: Math.round(num(item.amount) * factor), quantity: 1, itemType: item.itemType, frequency: item.frequency, isOptional: item.isOptional }))
            }
          : undefined
      }
    });
    // A copy never takes a class from the structure it was copied from: two structures of one kind cannot both charge a class.
    await this.audit(session, AuditAction.CREATE, "FeeStructure", created.id, { summary: `Fee structure duplicated · ${source.name} → ${input.name}`, raise: input.raise });
    return { id: created.id, mappingNote: input.copy.includes("Class mapping") ? "Classes are mapped when the copy is published, so the original is never left unbilled." : undefined };
  }

  async raise(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        scope: z.string().default("One structure"),
        structure: z.string().optional(),
        percent: z.coerce.number().positive().max(100),
        items: z.array(z.string()).min(1, "Choose which items."),
        round: z.string().default("The nearest ₦1,000"),
        effective: z.string().optional(),
        reason: z.string().trim().min(5, "Say why — it is usually quoted to the parent body."),
        notify: z.coerce.boolean().optional()
      })
      .parse(body);
    const schoolId = session.schoolId;
    const where: Prisma.FeeStructureWhereInput = { schoolId, deletedAt: null, ...(input.scope === "One structure" ? { id: input.structure ?? "" } : input.scope === "Every published structure" ? { listState: "PUBLISHED" } : {}) };
    const structures = await prisma.feeStructure.findMany({ where, include: { items: true } });
    if (!structures.length) throw new BadRequestException("Choose a structure to raise.");
    const step = /1,000/.test(input.round) ? 1000 : /500/.test(input.round) ? 500 : 1;
    const every = input.items.includes("Every item");
    const wanted = input.scope === "Tuition across every structure" ? ["Tuition"] : input.items;
    let touched = 0;
    for (const structure of structures) {
      for (const item of structure.items) {
        if (!every && !wanted.some((label) => item.label.toLowerCase().includes(label.toLowerCase()))) continue;
        const next = Math.round((num(item.amount) * (1 + input.percent / 100)) / step) * step;
        await prisma.feeStructureItem.update({ where: { id: item.id }, data: { amount: next, unitAmount: next } });
        touched += 1;
      }
    }
    await this.audit(session, AuditAction.UPDATE, "FeeStructure", structures[0].id, { summary: `Fees raised by ${input.percent}% · ${touched} items across ${structures.length} structures`, reason: input.reason });
    return { structures: structures.length, items: touched, billedNote: "Nothing already billed has changed. The new amounts apply from the next invoice run." };
  }

  /* ───────────────────────── adjustment rules ───────────────────────── */

  async saveRule(session: SessionPayload, code: string | null, body: unknown) {
    const input = ruleSchema.parse(body);
    const key = code ?? `rule-${Date.now().toString(36)}`;
    await this.rules(session.schoolId).put(key, input.name, input);
    await this.audit(session, code ? AuditAction.UPDATE : AuditAction.CREATE, "FeeAdjustmentRule", key, { summary: `Adjustment rule ${code ? "changed" : "added"} · ${input.name}` });
    return { code: key };
  }

  async removeRule(session: SessionPayload, code: string) {
    await this.rules(session.schoolId).remove(code);
    await this.audit(session, AuditAction.DELETE, "FeeAdjustmentRule", code, { summary: "Adjustment rule removed" });
    return { code };
  }

  /* ───────────────────────── publishing ───────────────────────── */

  private async studentsFor(schoolId: string, structure: StructureRow) {
    if (structure.kind === "Concession") return [];
    const levelIds = structure.levels.map((level) => level.classLevelId);
    if (!structure.allClasses && !levelIds.length && !structure.classId) return [];
    return prisma.student.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        ...(structure.allClasses ? {} : structure.classId ? { currentClassId: structure.classId } : { currentClass: { classLevelId: { in: levelIds } } }),
        ...(structure.kind === "Boarding supplement" ? { hostelAllocation: { some: { endDate: null } } } : {})
      },
      include: { guardians: { include: { guardian: true } }, currentClass: true }
    });
  }

  async preview(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const structure = await this.structureOrThrow(schoolId, id);
    const students = await this.studentsFor(schoolId, structure);
    const existing = await prisma.invoice.findMany({ where: { schoolId, feeStructureId: id, status: { not: "VOID" } }, select: { studentId: true } });
    const done = new Set(existing.map((invoice) => invoice.studentId));
    const fresh = students.filter((student) => !done.has(student.id));
    const mandatory = structure.items.filter((item) => item.isActive && item.itemType === "Mandatory").reduce((sum, item) => sum + num(item.amount), 0);
    const rules = await this.rules(schoolId).list<z.infer<typeof ruleSchema>>();
    const noPhone = fresh.filter((student) => !student.guardians.some((link) => link.guardian.phone && link.guardian.canReceiveSms)).length;
    const noGuardian = fresh.filter((student) => !student.guardians.length).length;
    const families = new Set(fresh.map((student) => student.guardians.find((link) => link.isPrimary)?.guardianId ?? student.guardians[0]?.guardianId ?? student.id));
    const mapped = structure.allClasses || structure.levels.length > 0 || Boolean(structure.classId);
    return {
      id,
      name: structure.name,
      state: stateOf(structure),
      mapped,
      kind: structure.kind,
      invoices: fresh.length,
      alreadyBilled: done.size,
      perStudent: mandatory,
      total: fresh.length * mandatory,
      families: families.size,
      noPhone,
      noGuardian,
      rules: rules.map((rule) => ({ name: rule.data.appliesTo.startsWith("Second child") || rule.data.appliesTo === "Every family" ? `${rule.name} · applied automatically` : `${rule.name} · applied by hand`, auto: rule.data.appliesTo.startsWith("Second child") || rule.data.appliesTo === "Every family" })),
      concession: structure.kind === "Concession" ? "A concession bills nobody by itself — it replaces the structure a staff child would otherwise be on." : null
    };
  }

  async publish(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ applyRules: z.coerce.boolean().default(true), notify: z.array(z.string()).default(["In-app"]), dueOn: z.string().optional() }).parse(body);
    const schoolId = session.schoolId;
    const structure = await this.structureOrThrow(schoolId, id);
    if (stateOf(structure) === "Archived") throw new ForbiddenException("An archived structure cannot be published.");
    const preview = await this.preview(session, id);
    if (!preview.mapped && structure.kind !== "Concession") throw new BadRequestException("Map at least one class to this structure first — publishing bills the classes mapped to it.");
    const term = structure.termId ? await prisma.term.findUnique({ where: { id: structure.termId } }) : await currentTerm(schoolId);
    const dueOn = input.dueOn ? new Date(input.dueOn) : structure.dueDate ?? new Date(Date.now() + 14 * 86_400_000);
    const students = await this.studentsFor(schoolId, structure);
    const existing = new Set((await prisma.invoice.findMany({ where: { schoolId, feeStructureId: id, status: { not: "VOID" } }, select: { studentId: true } })).map((invoice) => invoice.studentId));
    const lines = structure.items.filter((item) => item.isActive && item.itemType === "Mandatory");
    const subtotal = toMoney(lines.reduce((sum, item) => sum + num(item.amount), 0));
    const rules = input.applyRules ? (await this.rules(schoolId).list<z.infer<typeof ruleSchema>>()).map((rule) => rule.data).filter((rule) => rule.appliesTo.startsWith("Second child") || rule.appliesTo === "Every family") : [];

    // Within a family, the second child onward is ordered by when they joined — across every class the
    // family has children in, not only the classes this structure charges.
    const guardianIds = Array.from(new Set(students.flatMap((student) => student.guardians.map((link) => link.guardianId))));
    const siblings = guardianIds.length
      ? await prisma.studentGuardian.findMany({ where: { guardianId: { in: guardianIds }, student: { status: "ACTIVE", schoolId } }, include: { student: { select: { id: true, admissionDate: true } } } })
      : [];
    const familyOrder = new Map<string, string[]>();
    for (const link of [...siblings].sort((a, b) => a.student.admissionDate.getTime() - b.student.admissionDate.getTime())) {
      familyOrder.set(link.guardianId, [...(familyOrder.get(link.guardianId) ?? []), link.student.id]);
    }
    let created = 0;
    let discounted = 0;
    const notified = new Set<string>();
    for (const student of students) {
      if (existing.has(student.id)) continue;
      const key = student.guardians.find((link) => link.isPrimary)?.guardianId ?? student.guardians[0]?.guardianId ?? student.id;
      const position = familyOrder.has(key) ? (familyOrder.get(key) ?? []).indexOf(student.id) : 0;
      let discount = 0;
      const applied: Array<{ name: string; amount: number; value: number; percentage: boolean }> = [];
      for (const rule of rules) {
        if (rule.appliesTo.startsWith("Second child") && position < 1) continue;
        const base = rule.items.includes("Every item") ? subtotal : lines.filter((item) => rule.items.some((label) => item.label.toLowerCase().includes(label.toLowerCase()))).reduce((sum, item) => sum + num(item.amount), 0);
        const amount = toMoney(/percentage/i.test(rule.valueIs) ? (base * rule.value) / 100 : Math.min(base, rule.value));
        if (/largest/i.test(rule.stacks) && applied.length) {
          if (amount <= applied[0].amount) continue;
          applied.length = 0;
          discount = 0;
        }
        if (amount > 0) {
          applied.push({ name: rule.name, amount, value: rule.value, percentage: /percentage/i.test(rule.valueIs) });
          discount = toMoney(discount + amount);
        }
      }
      const total = toMoney(Math.max(subtotal - discount, 0));
      const number = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${String(created).padStart(3, "0")}`;
      const invoice = await prisma.invoice.create({
        data: {
          schoolId,
          studentId: student.id,
          classId: student.currentClassId,
          academicSessionId: student.currentSessionId,
          termId: term?.id ?? null,
          feeStructureId: id,
          createdById: session.userId,
          invoiceNumber: number,
          issuedOn: new Date(),
          dueOn,
          subtotal,
          discount,
          fine: 0,
          total,
          balance: total,
          status: "ISSUED",
          items: { create: lines.map((item) => ({ description: item.label, amount: item.amount, quantity: 1 })) }
        }
      });
      for (const line of applied) {
        await prisma.invoiceAdjustment.create({ data: { schoolId, invoiceId: invoice.id, appliedById: session.userId, approvedById: session.userId, type: "DISCOUNT", valueType: line.percentage ? "PERCENTAGE" : "FIXED", value: line.value, amount: line.amount, reason: `${line.name} · applied automatically at publication` } });
      }
      if (discount > 0) discounted += 1;
      created += 1;
      const guardian = student.guardians.find((link) => link.isPrimary)?.guardian ?? student.guardians[0]?.guardian;
      if (guardian && !notified.has(guardian.id)) {
        notified.add(guardian.id);
        const rows: Prisma.NotificationLogCreateManyInput[] = [];
        if (input.notify.some((channel) => /In-app/i.test(channel)) && guardian.userId) rows.push({ schoolId, userId: guardian.userId, channel: "IN_APP", title: "Fees invoice issued", body: `${structure.name}: your invoice has been issued.`, status: "QUEUED", sentAt: new Date() });
        if (input.notify.some((channel) => /SMS/i.test(channel)) && guardian.canReceiveSms && guardian.phone) rows.push({ schoolId, userId: guardian.userId ?? undefined, channel: "SMS", title: "Fees invoice issued", body: `${structure.name}: your invoice has been issued.`, status: "QUEUED", metadata: { phone: guardian.phone } as Prisma.InputJsonValue, sentAt: new Date() });
        if (input.notify.some((channel) => /Email/i.test(channel)) && guardian.canReceiveEmail && guardian.email) rows.push({ schoolId, userId: guardian.userId ?? undefined, channel: "EMAIL", title: "Fees invoice issued", body: `${structure.name}: your invoice has been issued.`, status: "QUEUED", metadata: { email: guardian.email } as Prisma.InputJsonValue, sentAt: new Date() });
        if (rows.length) await prisma.notificationLog.createMany({ data: rows });
      }
    }
    await prisma.feeStructure.update({ where: { id }, data: { listState: "PUBLISHED", isActive: true, termId: structure.termId ?? term?.id ?? null, academicSessionId: structure.academicSessionId ?? term?.academicSessionId ?? null } });
    await this.audit(session, AuditAction.CREATE, "Invoice", id, { summary: `Fee structure published · ${structure.name} · ${created} invoices`, rules: rules.length });
    return { invoices: created, discounted, families: notified.size, byHand: (await this.rules(schoolId).list<z.infer<typeof ruleSchema>>()).filter((rule) => !(rule.data.appliesTo.startsWith("Second child") || rule.data.appliesTo === "Every family")).map((rule) => rule.name) };
  }
}
