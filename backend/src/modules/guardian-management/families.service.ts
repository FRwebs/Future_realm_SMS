import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { PAYMENT_MODE } from "../fee-management/fees.shared";
import { loadConsentTypes } from "../student-records/consent.shared";
import { armName, currentTerm, daysSince, feeStateOf, gradeBands, gradeOf, initials, num, relevantInvoice, stateOf } from "../student-records/records.shared";
import { RELATIONS, VISIBILITY, deliveryOf, fullName, guardianPortal, normalPhone, notifyGuardian, validMobile } from "./guardians.shared";

/**
 * A family is not a row per child. Four children in three arms is ONE family, one login and one
 * set of notifications — so everything here is folded by guardian, and everything downstream
 * counts families rather than mappings.
 */

const NATURAL = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const addSchema = z.object({
  name: z.string().trim().min(3, "Give the guardian's full name."),
  relation: z.string().default("Mother"),
  order: z.string().default("Primary contact"),
  phone: z.string().trim().min(10, "A guardian needs a mobile number — it is their login."),
  email: z.string().optional(),
  secondName: z.string().optional(),
  secondPhone: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  language: z.string().default("English"),
  children: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : value ? [value] : [])).refine((value) => value.length > 0, "Map at least one child."),
  see: z.array(z.string()).default(["Results and report cards", "Attendance", "Fee amounts", "Announcements"]),
  consent: z.array(z.string()).default([]),
  collect: z.coerce.boolean().default(true),
  invite: z.coerce.boolean().default(true)
});

const contactSchema = z.object({
  name: z.string().trim().min(3),
  relation: z.string().optional(),
  order: z.string().optional(),
  phone: z.string().trim().min(10, "A wrong digit here silences a family — give the number in full."),
  email: z.string().optional(),
  secondName: z.string().optional(),
  secondPhone: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  language: z.string().optional(),
  tell: z.coerce.boolean().default(true)
});

const mapSchema = z.object({
  child: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  relation: z.string().default("Mother"),
  order: z.string().default("Primary contact"),
  see: z.array(z.string()).default(["Results and report cards", "Attendance", "Fee amounts", "Announcements"]),
  collect: z.coerce.boolean().default(true),
  tell: z.coerce.boolean().default(true)
});

const phoneOnlySchema = z.object({ reason: z.string().min(1), reach: z.string().default("SMS and a printed copy"), best: z.string().trim().min(10, "Give the best number to call."), time: z.string().default("Afternoon"), print: z.coerce.boolean().default(true) });

const mergeSchema = z.object({
  keep: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  merge: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  prefer: z.string().default("The surviving record's details"),
  reason: z.string().trim().min(8, "Say why these are the same family."),
  tell: z.coerce.boolean().default(false)
});

export type FamilyRow = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  email: string | null;
  occupation: string | null;
  portal: "Active" | "Invited" | "Not activated";
  delivery: "Delivered" | "Failing" | "No number";
  consent: "Complete" | "Gaps" | "None";
  consents: Record<string, string>;
  children: Array<{ id: string; name: string; arm: string; level: string }>;
  owes: number;
  amount: number;
  phoneOnly: boolean;
  second: boolean;
  language: string;
  joined: number;
  givenBy: string;
};

@Injectable()
export class FamiliesService {
  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "Guardian", entityId, metadata } });
  }

  /** Every family, with the one set of figures the list, the page and the debtor list all share. */
  async load(schoolId: string): Promise<{ rows: FamilyRow[]; types: Awaited<ReturnType<typeof loadConsentTypes>> }> {
    const term = await currentTerm(schoolId);
    const [guardians, types, invoices, consents] = await Promise.all([
      prisma.guardian.findMany({
        where: { schoolId, mergedIntoId: null },
        include: { user: { select: { lastLoginAt: true } }, students: { include: { student: { select: { id: true, firstName: true, lastName: true, status: true, currentClass: { select: { name: true, arm: true, classLevel: { select: { name: true } } } } } } } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      loadConsentTypes(schoolId),
      prisma.invoice.findMany({ where: { schoolId, status: { not: "VOID" } }, select: { studentId: true, balance: true, termId: true } }),
      prisma.familyConsent.findMany({ where: { schoolId }, select: { guardianId: true, typeCode: true, status: true, means: true } })
    ]);
    const owing = new Map<string, number>();
    for (const invoice of invoices.filter((entry) => relevantInvoice(entry, term?.id))) owing.set(invoice.studentId, (owing.get(invoice.studentId) ?? 0) + num(invoice.balance));
    const required = types.filter((type) => type.required);
    const byGuardian = new Map<string, typeof consents>();
    for (const row of consents) byGuardian.set(row.guardianId, [...(byGuardian.get(row.guardianId) ?? []), row]);

    const rows = guardians
      .filter((guardian) => guardian.students.length > 0)
      .map<FamilyRow>((guardian) => {
        const own = byGuardian.get(guardian.id) ?? [];
        const status: Record<string, string> = {};
        for (const type of types) status[type.code] = own.find((row) => row.typeCode === type.code)?.status ?? "NOT_GIVEN";
        const given = (code: string) => status[code] === "GIVEN";
        const coverage = required.every((type) => given(type.code)) && required.length ? "Complete" : types.some((type) => given(type.code)) ? "Gaps" : "None";
        const kids = guardian.students.filter((link) => link.student.status !== "WITHDRAWN");
        const balances = kids.map((link) => owing.get(link.studentId) ?? 0).filter((value) => value > 0);
        const means = own.find((row) => row.status === "GIVEN")?.means;
        return {
          id: guardian.id,
          name: fullName(guardian),
          relation: guardian.relationship,
          phone: guardian.phone,
          email: guardian.email,
          occupation: guardian.occupation,
          portal: guardianPortal(guardian.user),
          delivery: deliveryOf(guardian),
          consent: coverage,
          consents: status,
          children: kids.map((link) => ({ id: link.studentId, name: fullName(link.student), arm: link.student.currentClass ? armName(link.student.currentClass) : "No arm", level: link.student.currentClass?.classLevel?.name ?? "" })),
          owes: balances.length,
          amount: balances.reduce((sum, value) => sum + value, 0),
          phoneOnly: guardian.phoneOnly,
          second: Boolean(guardian.secondContactPhone?.trim()),
          language: guardian.language,
          joined: guardian.createdAt.getFullYear(),
          givenBy: means === "PORTAL" ? "In the portal" : means === "PAPER" ? "On paper" : means === "IN_PERSON" || means === "ENROLMENT" ? "In person" : "—"
        };
      })
      .filter((row) => row.children.length > 0);
    return { rows, types };
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const { rows } = await this.load(schoolId);
    const phoneGroups = new Map<string, FamilyRow[]>();
    const emailGroups = new Map<string, FamilyRow[]>();
    for (const row of rows) {
      const phone = normalPhone(row.phone);
      if (phone) phoneGroups.set(phone, [...(phoneGroups.get(phone) ?? []), row]);
      const email = row.email?.trim().toLowerCase();
      if (email) emailGroups.set(email, [...(emailGroups.get(email) ?? []), row]);
    }
    /** The name most of a group's records carry — they come first, so a merge offers two of the same family. */
    const group = (kind: string, key: string, members: FamilyRow[]) => {
      const counts = new Map<string, number>();
      for (const row of members) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
      const [dominant, share] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      const ordered = members.slice().sort((a, b) => Number(b.name === dominant) - Number(a.name === dominant));
      const names = Array.from(counts.keys());
      return { kind, key, ids: ordered.map((row) => row.id), label: `${key} appears on ${members.length} guardian records`, sub: `${names.slice(0, 3).join(", ")} · ${members.reduce((sum, row) => sum + row.children.length, 0)} children between them · merging keeps every child's link`, same: share / members.length >= 0.6 };
    };
    const duplicates = [
      ...Array.from(phoneGroups.entries()).filter(([, members]) => members.length > 1).map(([key, members]) => group("phone", key, members)),
      ...Array.from(emailGroups.entries()).filter(([, members]) => members.length > 1).map(([key, members]) => group("email", key, members))
    ].sort((a, b) => b.ids.length - a.ids.length);

    const considered = rows.filter((row) => !row.phoneOnly);
    const never = considered.filter((row) => row.portal !== "Active");
    const reachable = rows.filter((row) => row.delivery !== "No number").length;
    return {
      rows,
      totals: {
        families: rows.length,
        children: rows.reduce((sum, row) => sum + row.children.length, 0),
        active: rows.filter((row) => row.portal === "Active").length,
        never: never.length,
        neverChildren: never.reduce((sum, row) => sum + row.children.length, 0),
        failing: rows.filter((row) => row.delivery !== "Delivered").length,
        noPhone: rows.filter((row) => !row.phone?.trim()).length,
        phoneOnly: rows.filter((row) => row.phoneOnly).length,
        second: rows.filter((row) => row.second).length,
        reachable,
        otherLanguage: rows.filter((row) => row.language !== "English").length
      },
      duplicates,
      options: { levels: Array.from(new Set(rows.flatMap((row) => row.children.map((child) => child.level)).filter(Boolean))).sort(NATURAL), arms: Array.from(new Set(rows.flatMap((row) => row.children.map((child) => child.arm)))).sort(NATURAL) }
    };
  }

  async options(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [students, guardians, types] = await Promise.all([
      prisma.student.findMany({ where: { schoolId, status: { in: ["ACTIVE", "SUSPENDED"] } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } } }, orderBy: { admissionNumber: "asc" } }),
      this.load(schoolId),
      loadConsentTypes(schoolId)
    ]);
    return {
      students: students.map((student) => ({ id: student.id, name: fullName(student), adm: student.admissionNumber, arm: student.currentClass ? armName(student.currentClass) : "No arm" })),
      guardians: guardians.rows.map((row) => ({ id: row.id, name: row.name, phone: row.phone, children: row.children.length })),
      consents: types.map((type) => type.name),
      relations: RELATIONS,
      visibility: VISIBILITY
    };
  }

  /** One family: every child, what they owe, what has been sent, and where consent stands. */
  async family(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const guardian = await prisma.guardian.findFirst({
      where: { id, schoolId },
      include: { user: { select: { lastLoginAt: true } }, students: { include: { student: { include: { currentClass: { include: { classLevel: true } }, user: { select: { lastLoginAt: true } } } } } }, collectors: true }
    });
    if (!guardian) throw new NotFoundException("That family does not exist.");
    if (guardian.mergedIntoId) throw new NotFoundException("That record was merged into another. Open the family it was merged into.");
    const term = await currentTerm(schoolId);
    const kidIds = guardian.students.map((link) => link.studentId);
    const [{ rows, types }, bands, attendance, sheets, invoices, contacts, feeContacts, consents, payments] = await Promise.all([
      this.load(schoolId),
      gradeBands(schoolId),
      term ? prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId: term.id, studentId: { in: kidIds } }, _count: { _all: true } }) : Promise.resolve([]),
      term ? prisma.resultSheet.findMany({ where: { schoolId, termId: term.id, studentId: { in: kidIds } }, select: { studentId: true, averageScore: true, grade: true, position: true } }) : Promise.resolve([]),
      prisma.invoice.findMany({ where: { schoolId, studentId: { in: kidIds }, status: { not: "VOID" } }, include: { feeStructure: { select: { name: true } } } }).then((rows) => rows.filter((entry) => relevantInvoice(entry, term?.id))),
      prisma.guardianContact.findMany({ where: { schoolId, guardianId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.feeContact.findMany({ where: { schoolId, guardianId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.familyConsent.findMany({ where: { schoolId, guardianId: id } }),
      prisma.payment.findMany({ where: { schoolId, studentId: { in: kidIds }, status: "SUCCESS", isReversed: false }, select: { id: true } })
    ]);
    const row = rows.find((entry) => entry.id === id);
    const marked = new Map<string, { total: number; here: number }>();
    for (const entry of attendance) {
      const value = marked.get(entry.studentId) ?? { total: 0, here: 0 };
      value.total += entry._count._all;
      if (entry.status !== "ABSENT") value.here += entry._count._all;
      marked.set(entry.studentId, value);
    }
    const sheetOf = new Map(sheets.map((sheet) => [sheet.studentId, sheet]));
    const hostel = await prisma.hostelAllocation.findMany({ where: { schoolId, studentId: { in: kidIds }, OR: [{ endDate: null }, { endDate: { gt: new Date() } }] }, select: { studentId: true } });
    const boarders = new Set(hostel.map((entry) => entry.studentId));

    const children = guardian.students.map((link) => {
      const student = link.student;
      const mine = invoices.filter((invoice) => invoice.studentId === student.id);
      const billed = mine.reduce((sum, invoice) => sum + num(invoice.total), 0);
      const owing = mine.reduce((sum, invoice) => sum + num(invoice.balance), 0);
      const stats = marked.get(student.id);
      const sheet = sheetOf.get(student.id);
      return {
        id: student.id,
        name: fullName(student),
        gender: student.gender === "MALE" ? "Male" : student.gender === "FEMALE" ? "Female" : "Other",
        boarding: boarders.has(student.id) ? "Boarding" : "Day",
        adm: student.admissionNumber,
        arm: student.currentClass ? armName(student.currentClass) : "No arm",
        level: student.currentClass?.classLevel?.name ?? "",
        att: stats && stats.total ? Math.round((stats.here / stats.total) * 1000) / 10 : null,
        avg: sheet ? Math.round(sheet.averageScore * 10) / 10 : null,
        grade: sheet ? sheet.grade ?? gradeOf(bands, sheet.averageScore) : "—",
        pos: sheet?.position ?? null,
        fee: feeStateOf(mine),
        billed,
        paid: billed - owing,
        owing,
        structures: Array.from(new Set(mine.map((invoice) => invoice.feeStructure?.name).filter((name): name is string => Boolean(name)))),
        state: stateOf(student.status),
        primary: link.isPrimary,
        see: Array.isArray(link.visibility) ? (link.visibility as string[]) : VISIBILITY.slice(0, 4),
        collect: link.canCollect
      };
    });
    const rated = children.filter((child) => child.att !== null);
    const oldest = invoices.filter((invoice) => num(invoice.balance) > 0).sort((a, b) => a.issuedOn.getTime() - b.issuedOn.getTime())[0];
    const sent = [
      ...contacts.map((entry) => ({ at: entry.createdAt, label: entry.summary, sub: `${entry.channel ?? "In-app"} · ${entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`, pill: entry.kind === "INVITE" ? (guardian.user?.lastLoginAt ? "Accepted" : "Sent") : "Delivered" })),
      ...feeContacts.map((entry) => ({ at: entry.createdAt, label: entry.summary, sub: `${entry.channel ?? "In-app"} · ${entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`, pill: "Delivered" }))
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 12)
      .map(({ label, sub, pill }) => ({ label, sub, pill }));

    return {
      id: guardian.id,
      name: fullName(guardian),
      initials: initials(fullName(guardian)),
      relation: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email,
      occupation: guardian.occupation,
      address: guardian.address,
      language: guardian.language,
      secondName: guardian.secondContactName,
      secondPhone: guardian.secondContactPhone,
      canSms: guardian.canReceiveSms,
      canEmail: guardian.canReceiveEmail,
      phoneOnly: guardian.phoneOnly ? { reason: guardian.phoneOnlyReason, mode: guardian.phoneOnlyMode } : null,
      portal: guardianPortal(guardian.user),
      delivery: deliveryOf(guardian),
      invalidPhone: Boolean(guardian.phone) && !validMobile(guardian.phone),
      joined: guardian.createdAt.getFullYear(),
      children,
      owes: row?.owes ?? children.filter((child) => child.owing > 0).length,
      amount: children.reduce((sum, child) => sum + child.owing, 0),
      billed: children.reduce((sum, child) => sum + child.billed, 0),
      days: oldest ? daysSince(oldest.issuedOn) : 0,
      receipts: payments.length,
      attendance: rated.length ? Math.round(rated.reduce((sum, child) => sum + (child.att ?? 0), 0) / rated.length) : null,
      consent: row?.consent ?? "None",
      consents: types.map((type) => {
        const record = consents.find((entry) => entry.typeCode === type.code);
        return { code: type.code, name: type.name, required: type.required, blocks: type.blocks, status: record?.status ?? "NOT_GIVEN", means: record?.means ?? null, on: record?.recordedAt.toISOString() ?? null };
      }),
      collectors: guardian.collectors.map((entry) => ({ id: entry.id, name: entry.name, relation: entry.relation, phone: entry.phone, photo: Boolean(entry.photoFile) })),
      sent,
      familyHref: row ? `/fee-management/collections/families/${guardian.id}` : null,
      receiptsHint: PAYMENT_MODE.CASH
    };
  }

  /* ───────────────────────── changing a family ───────────────────────── */

  async add(session: SessionPayload, body: unknown) {
    const input = addSchema.parse(body);
    const schoolId = session.schoolId;
    const phone = normalPhone(input.phone);
    const clash = await prisma.guardian.findFirst({ where: { schoolId, mergedIntoId: null, phone: input.phone.trim() } });
    if (clash) throw new BadRequestException(`${input.phone.trim()} is already ${fullName(clash)}'s number. If this is the same family, link the child from the child's own record — that keeps one login.`);
    if (!validMobile(phone)) throw new BadRequestException("That does not look like a Nigerian mobile number.");
    const students = await prisma.student.findMany({ where: { schoolId, id: { in: input.children } }, select: { id: true } });
    if (students.length !== input.children.length) throw new BadRequestException("One of those children is not in this school.");
    const [first, ...rest] = input.name.split(/\s+/);
    const primary = input.order.startsWith("Primary");
    const created = await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.create({
        data: { schoolId, firstName: first, lastName: rest.join(" ") || "Guardian", phone: input.phone.trim(), email: input.email?.trim() || null, relationship: input.relation, occupation: input.occupation || null, address: input.address || null, language: input.language, secondContactName: input.secondName || null, secondContactPhone: input.secondPhone || null }
      });
      for (const student of students) {
        if (primary) await tx.studentGuardian.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } });
        await tx.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, isPrimary: primary, relation: input.relation, visibility: input.see, canCollect: input.collect } });
      }
      const types = await loadConsentTypes(schoolId);
      for (const label of input.consent) {
        const type = types.find((entry) => label.startsWith(entry.name));
        if (!type) continue;
        await tx.familyConsent.create({ data: { schoolId, guardianId: guardian.id, typeCode: type.code, status: "GIVEN", means: "IN_PERSON", recordedById: session.userId } });
      }
      if (input.invite) await tx.guardianContact.create({ data: { schoolId, guardianId: guardian.id, kind: "INVITE", channel: "SMS and email", summary: "Portal invitation sent", createdById: session.userId } });
      return guardian;
    });
    if (input.invite) await notifyGuardian(schoolId, created.id, "Your parent portal invitation", "Your school has created your parent portal account. Use the activation link to set a password. It is valid for 7 days.", ["SMS", "Email"]);
    await this.audit(session, AuditAction.CREATE, created.id, { summary: `Guardian created · ${fullName(created)} · ${students.length} children` });
    return { id: created.id, children: students.length };
  }

  async editContact(session: SessionPayload, id: string, body: unknown) {
    const input = contactSchema.parse(body);
    const schoolId = session.schoolId;
    const guardian = await prisma.guardian.findFirst({ where: { id, schoolId } });
    if (!guardian) throw new NotFoundException("That family does not exist.");
    if (input.phone.trim() !== guardian.phone) {
      const clash = await prisma.guardian.findFirst({ where: { schoolId, id: { not: id }, mergedIntoId: null, phone: input.phone.trim() } });
      if (clash) throw new BadRequestException(`${input.phone.trim()} already belongs to ${fullName(clash)}. If these are one family, merge the two records instead.`);
    }
    const [first, ...rest] = input.name.split(/\s+/);
    await prisma.guardian.update({
      where: { id },
      data: { firstName: first, lastName: rest.join(" ") || guardian.lastName, phone: input.phone.trim(), email: input.email?.trim() || null, relationship: input.relation || guardian.relationship, occupation: input.occupation || null, address: input.address || null, language: input.language || guardian.language, secondContactName: input.secondName || null, secondContactPhone: input.secondPhone || null }
    });
    if (input.order) {
      const primary = input.order.startsWith("Primary");
      await prisma.studentGuardian.updateMany({ where: { guardianId: id }, data: { isPrimary: primary } });
    }
    if (input.tell) await notifyGuardian(schoolId, id, "Your contact details were updated", "The school updated the contact details it holds for you. If this was not you, tell the school office.", ["In-app", "SMS", "Email"]);
    await this.audit(session, AuditAction.UPDATE, id, { summary: `Guardian contact updated · ${input.name}` });
    return { id };
  }

  async mapChild(session: SessionPayload, id: string, body: unknown) {
    const input = mapSchema.parse(body);
    const schoolId = session.schoolId;
    const guardian = await prisma.guardian.findFirst({ where: { id, schoolId } });
    if (!guardian) throw new NotFoundException("That family does not exist.");
    const student = await prisma.student.findFirst({ where: { id: input.child, schoolId } });
    if (!student) throw new BadRequestException("That child is not in this school.");
    if (await prisma.studentGuardian.findUnique({ where: { studentId_guardianId: { studentId: student.id, guardianId: id } } })) throw new BadRequestException(`${fullName(student)} is already mapped to this guardian.`);
    const primary = input.order.startsWith("Primary");
    if (primary) await prisma.studentGuardian.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } });
    await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: id, isPrimary: primary, relation: input.relation, visibility: input.see, canCollect: input.collect } });
    if (input.tell) await notifyGuardian(schoolId, id, "A child was added to your account", `${fullName(student)} is now on your parent account, and everything the school publishes about them reaches you.`, ["In-app", "SMS"]);
    await this.audit(session, AuditAction.UPDATE, id, { summary: `Child mapped · ${fullName(student)}` });
    return { id, child: student.id };
  }

  async phoneOnly(session: SessionPayload, id: string, body: unknown) {
    const input = phoneOnlySchema.parse(body);
    const guardian = await prisma.guardian.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!guardian) throw new NotFoundException("That family does not exist.");
    await prisma.guardian.update({ where: { id }, data: { phoneOnly: true, phoneOnlyReason: input.reason, phoneOnlyMode: input.reach, phone: guardian.phone } });
    await prisma.guardianContact.create({ data: { schoolId: session.schoolId, guardianId: id, kind: "PHONE_ONLY", channel: input.reach, summary: `Marked phone-only · ${input.reason}`, detail: { best: input.best, time: input.time, print: input.print }, createdById: session.userId } });
    await this.audit(session, AuditAction.UPDATE, id, { summary: `Family marked phone-only · ${input.reason}` });
    return { id };
  }

  async invite(session: SessionPayload, body: unknown) {
    const input = z.object({ families: z.array(z.string()).optional(), channels: z.array(z.string()).default(["SMS", "Email"]) }).parse(body ?? {});
    const schoolId = session.schoolId;
    const { rows } = await this.load(schoolId);
    const targets = rows.filter((row) => row.portal !== "Active" && !row.phoneOnly && (!input.families?.length || input.families.includes(row.id)));
    let reached = 0;
    let children = 0;
    for (const family of targets) {
      const result = await notifyGuardian(schoolId, family.id, "Your parent portal invitation", "Your school invites you to activate your parent portal. Use the new link — only the newest link works, and it is valid for 7 days.", input.channels);
      await prisma.guardianContact.create({ data: { schoolId, guardianId: family.id, kind: "INVITE", channel: result.sent.join(" and ") || "Printed", summary: "Portal invitation resent", createdById: session.userId } });
      if (result.sent.length) reached += 1;
      children += family.children.length;
    }
    await this.audit(session, AuditAction.UPDATE, schoolId, { summary: `Portal invitations resent · ${targets.length} families` });
    return { families: targets.length, reached, children, phoneOnlySkipped: rows.filter((row) => row.phoneOnly).length };
  }

  async merge(session: SessionPayload, body: unknown) {
    const input = mergeSchema.parse(body);
    const schoolId = session.schoolId;
    if (input.keep === input.merge) throw new BadRequestException("Choose two different records.");
    const [keep, away] = await Promise.all([
      prisma.guardian.findFirst({ where: { id: input.keep, schoolId, mergedIntoId: null }, include: { students: true } }),
      prisma.guardian.findFirst({ where: { id: input.merge, schoolId, mergedIntoId: null }, include: { students: true } })
    ]);
    if (!keep || !away) throw new BadRequestException("Both records must be open guardian records in this school.");
    const existing = new Set(keep.students.map((link) => link.studentId));
    const moved = away.students.filter((link) => !existing.has(link.studentId));
    const result = await prisma.$transaction(async (tx) => {
      for (const link of moved) await tx.studentGuardian.update({ where: { studentId_guardianId: { studentId: link.studentId, guardianId: away.id } }, data: { guardianId: keep.id } });
      await tx.studentGuardian.deleteMany({ where: { guardianId: away.id } });
      const have = new Set((await tx.familyConsent.findMany({ where: { guardianId: keep.id }, select: { typeCode: true } })).map((row) => row.typeCode));
      const theirs = await tx.familyConsent.findMany({ where: { guardianId: away.id } });
      for (const row of theirs) {
        if (have.has(row.typeCode)) await tx.familyConsent.delete({ where: { id: row.id } });
        else await tx.familyConsent.update({ where: { id: row.id }, data: { guardianId: keep.id } });
      }
      await tx.guardianSubmission.updateMany({ where: { guardianId: away.id }, data: { guardianId: keep.id } });
      await tx.guardianContact.updateMany({ where: { guardianId: away.id }, data: { guardianId: keep.id } });
      await tx.authorisedCollector.updateMany({ where: { guardianId: away.id }, data: { guardianId: keep.id } });
      await tx.feeContact.updateMany({ where: { guardianId: away.id }, data: { guardianId: keep.id } });
      if (!keep.userId && away.userId) {
        await tx.guardian.update({ where: { id: away.id }, data: { userId: null } });
        await tx.guardian.update({ where: { id: keep.id }, data: { userId: away.userId } });
      }
      if (input.prefer.startsWith("The merged")) await tx.guardian.update({ where: { id: keep.id }, data: { phone: away.phone, email: away.email ?? keep.email, address: away.address ?? keep.address, occupation: away.occupation ?? keep.occupation } });
      await tx.guardian.update({ where: { id: away.id }, data: { mergedIntoId: keep.id, mergedAt: new Date() } });
      await tx.guardianContact.create({ data: { schoolId, guardianId: keep.id, kind: "MERGE", summary: `Merged with a duplicate record · ${input.reason}`, detail: { from: away.id, children: moved.map((link) => link.studentId) }, createdById: session.userId } });
      return { moved: moved.length };
    });
    if (input.tell) await notifyGuardian(schoolId, keep.id, "Your records were combined", "The school found two records for your family and combined them. Nothing was lost.", ["In-app", "SMS"]);
    await this.audit(session, AuditAction.UPDATE, keep.id, { summary: `Guardians merged · ${fullName(away)} into ${fullName(keep)}`, moved: result.moved, reason: input.reason });
    return { kept: keep.id, moved: result.moved };
  }
}
