import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { library } from "./library.service";

const bandSchema = z.object({ grade: z.string().trim().min(1), min: z.coerce.number(), max: z.coerce.number(), remark: z.string().trim().optional() });
export type Band = z.infer<typeof bandSchema>;

const csvList = z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []), z.array(z.string()));
const dateOrUndefined = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());

const curriculumSchema = z.object({
  name: z.string().trim().min(2),
  country: z.string().trim().min(2),
  subjects: csvList.default([]),
  calendarType: z.enum(["THREE_TERM", "TWO_SEMESTER"]).default("THREE_TERM"),
  version: z.string().trim().min(1).default("1.0"),
  effectiveFrom: dateOrUndefined,
  language: z.string().trim().optional().transform((v) => v || undefined),
  baseOnId: z.string().trim().optional().transform((v) => v || undefined)
});
const gradingSchema = z.object({
  name: z.string().trim().min(2),
  gradeBands: z.array(bandSchema).min(1),
  passMark: z.coerce.number().min(0).max(100).default(40),
  applicableCurricula: csvList.default([]),
  /** Left blank, the next whole version is taken: v3 becomes v4. */
  version: z.string().trim().optional().transform((v) => v || undefined),
  scaleType: z.enum(["PERCENTAGE", "LETTER", "POINTS", "DESCRIPTIVE"]).default("PERCENTAGE"),
  creditGrade: z.string().trim().optional().transform((v) => v || undefined),
  distinctionGrade: z.string().trim().optional().transform((v) => v || undefined),
  failingGrade: z.string().trim().optional().transform((v) => v || undefined)
});
const mappingSchema = z.object({
  fromTemplateId: z.string().min(1),
  toTemplateId: z.string().min(1),
  fromSubject: z.string().trim().min(1),
  toSubject: z.string().trim().min(1),
  relationship: z.enum(["RENAMED", "MERGED", "SPLIT"]).default("RENAMED")
});
const profileSchema = z.object({
  country: z.string().trim().min(2),
  currency: z.string().trim().length(3, "Use the three-letter currency code, e.g. NGN."),
  phonePattern: z.string().trim().optional().transform((v) => v || undefined),
  phonePrefixes: csvList.default([]),
  educationAuthority: z.string().trim().optional().transform((v) => v || undefined),
  registrationAuthority: z.string().trim().optional().transform((v) => v || undefined),
  defaultChannel: z.enum(["SMS", "EMAIL", "WHATSAPP", ""]).optional().transform((v) => v || undefined),
  consentAge: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(25).optional()),
  dataProtectionRegime: z.string().trim().optional().transform((v) => v || undefined),
  verificationSources: csvList.default([]),
  isLive: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false)
});

/** Grade bands that cover 0–100 once, in order, without a gap or an overlap — and a pass mark that sits on a boundary. */
export function checkBands(bands: Band[], passMark: number): string[] {
  const problems: string[] = [];
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (new Set(bands.map((b) => b.grade.toLowerCase())).size !== bands.length) problems.push("Two bands share a grade label.");
  for (const band of sorted) if (band.min > band.max) problems.push(`Band ${band.grade} runs from ${band.min} down to ${band.max}.`);
  if (sorted[0].min !== 0) problems.push(`The lowest band starts at ${sorted[0].min}; it must start at 0.`);
  if (sorted[sorted.length - 1].max < 100) problems.push(`The highest band ends at ${sorted[sorted.length - 1].max}; it must reach 100.`);
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].min - sorted[i - 1].max;
    // Scores are held to two decimals, so a band may start at the next whole mark (74 → 75) or at the same decimal step.
    if (gap > 1) problems.push(`There is a gap between ${sorted[i - 1].grade} (ends ${sorted[i - 1].max}) and ${sorted[i].grade} (starts ${sorted[i].min}).`);
    if (gap < 0) problems.push(`${sorted[i - 1].grade} and ${sorted[i].grade} overlap.`);
  }
  if (!sorted.some((band) => band.min === passMark || (band.min < passMark && band.max >= passMark))) problems.push(`The pass mark ${passMark} falls outside every band.`);
  return problems;
}

const platformSubjectKey = (value: string) => value.trim().toLowerCase();

const assignSchema = z.object({
  classId: z.string().trim().min(1, "Choose a class."),
  templateId: z.string().trim().min(1, "Choose a template version."),
});

@Injectable()
export class TemplatesService {
  private async audit(session: SessionPayload | null, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true, firstName: true, lastName: true } }) : null;
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
    return actor ? `${actor.firstName} ${actor.lastName}` : null;
  }

  private async ownerName(session: SessionPayload) {
    const user = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { firstName: true, lastName: true } });
    return user ? `${user.firstName} ${user.lastName}` : "Super Admin";
  }

  /* ───────────────────────── curricula ───────────────────────── */

  /** Creates a template — or, when based on another, a copy of it — as a draft. A name and version that exist already are edited, but only while still a draft. */
  async saveCurriculum(session: SessionPayload, body: unknown) {
    const input = curriculumSchema.parse(body);
    const base = input.baseOnId ? await prisma.curriculumTemplate.findUnique({ where: { id: input.baseOnId } }) : null;
    if (input.baseOnId && !base) throw new BadRequestException("The template to base this on no longer exists.");
    const subjects = Array.from(new Map((input.subjects.length ? input.subjects : base?.subjects ?? []).map((s) => [platformSubjectKey(s), s.trim()])).values());
    const existing = await prisma.curriculumTemplate.findUnique({ where: { name_version: { name: input.name, version: input.version } } });
    if (existing && existing.lifecycle !== "DRAFT") throw new BadRequestException(`${input.name} ${input.version} is ${existing.lifecycle.toLowerCase()} and can no longer be edited. Start a new version instead.`);
    const data = { country: input.country, subjects, calendarType: input.calendarType, effectiveFrom: input.effectiveFrom ?? null, language: input.language ?? base?.language ?? null, baseOnId: input.baseOnId ?? null, owner: await this.ownerName(session) };
    const row = existing
      ? await prisma.curriculumTemplate.update({ where: { id: existing.id }, data: { ...data, validatedAt: null } })
      : await prisma.curriculumTemplate.create({ data: { name: input.name, version: input.version, lifecycle: "DRAFT", isActive: false, ...data } });
    await this.audit(session, AuditAction.UPDATE, "CurriculumTemplate", row.id, { name: row.name, version: row.version, country: row.country, lifecycle: row.lifecycle });
    return { id: row.id, lifecycle: row.lifecycle };
  }

  /** The next version of a template, as an editable copy. */
  async newVersion(session: SessionPayload, id: string, body: unknown) {
    const { version } = z.object({ version: z.string().trim().min(1) }).parse(body);
    const from = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!from) throw new NotFoundException("Template not found.");
    if (await prisma.curriculumTemplate.findUnique({ where: { name_version: { name: from.name, version } } })) throw new BadRequestException(`Version ${version} of ${from.name} already exists.`);
    const row = await prisma.curriculumTemplate.create({ data: { name: from.name, country: from.country, subjects: from.subjects, classStructure: from.classStructure ?? undefined, calendarType: from.calendarType, language: from.language, version, lifecycle: "DRAFT", isActive: false, baseOnId: from.id, owner: await this.ownerName(session) } });
    await this.audit(session, AuditAction.CREATE, "CurriculumTemplate", row.id, { name: row.name, version, basedOn: from.version });
    return { id: row.id };
  }

  async validateCurriculum(session: SessionPayload, id: string) {
    const row = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template not found.");
    if (row.lifecycle !== "DRAFT") throw new BadRequestException("Only a draft can be validated.");
    const problems: string[] = [];
    if (row.subjects.length < 1) problems.push("The template has no subjects.");
    if (row.subjects.some((s) => s.length < 2)) problems.push("A subject name is too short to be real.");
    const profile = await prisma.countryProfile.findUnique({ where: { country: row.country } });
    if (!profile) problems.push(`${row.country} has no country profile — add one under Country Settings first.`);
    if (problems.length) throw new BadRequestException(problems.join(" "));
    // The gate is technical: a template that fails one of the eight portability tests is not validated, whoever asks.
    const run = await library.runPortability(session, "CURRICULUM", id);
    if (!run.passed) throw new BadRequestException(`It does not pass the portability tests — ${run.results.filter((result) => result.state === "FAIL").map((result) => `${result.test}: ${result.note}`).join(" ")}`);
    await prisma.curriculumTemplate.update({ where: { id }, data: { lifecycle: "VALIDATED", validatedAt: new Date() } });
    await this.audit(session, AuditAction.UPDATE, "CurriculumTemplate", id, { validated: true });
    return { id };
  }

  /** Publishing makes a validated version the one schools are given, and retires the one it replaces. */
  async publishCurriculum(session: SessionPayload, id: string) {
    const row = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template not found.");
    if (row.lifecycle !== "VALIDATED") throw new BadRequestException("Validate the template before publishing it.");
    const when = row.effectiveFrom && row.effectiveFrom > new Date() ? row.effectiveFrom : new Date();
    await prisma.$transaction([
      prisma.curriculumTemplate.updateMany({ where: { name: row.name, country: row.country, lifecycle: "ACTIVE", id: { not: id } }, data: { lifecycle: "SUPERSEDED", isActive: false, supersededAt: new Date(), effectiveTo: when } }),
      prisma.curriculumTemplate.update({ where: { id }, data: { lifecycle: "ACTIVE", isActive: true, effectiveFrom: row.effectiveFrom ?? when, effectiveTo: null } })
    ]);
    const told = await library.tellSchools(await library.schoolsThatTook("CURRICULUM", row.name), `${row.name} has a new version`, `Future Realm published version ${row.version} of ${row.name}, effective ${when.toISOString().slice(0, 10)}. Nothing is applied automatically — your school keeps the version it took, and your classes carry on as they are until you choose otherwise.`);
    await this.audit(session, AuditAction.APPROVE, "CurriculumTemplate", id, { published: true, version: row.version, schoolsTold: told });
    return { id, schoolsTold: told };
  }

  async archiveCurriculum(session: SessionPayload, id: string) {
    const row = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template not found.");
    if (row.lifecycle === "ARCHIVED") throw new BadRequestException("Already archived.");
    await prisma.curriculumTemplate.update({ where: { id }, data: { lifecycle: "ARCHIVED", isActive: false } });
    await this.audit(session, AuditAction.UPDATE, "CurriculumTemplate", id, { archived: true });
    return { id };
  }

  /* ───────────────────────── grading scales ───────────────────────── */

  async saveGrading(session: SessionPayload, body: unknown) {
    const input = gradingSchema.parse(body);
    const version = input.version ?? (await library.nextGradingVersion(input.name));
    const known = new Set(input.gradeBands.map((band) => band.grade));
    for (const [label, grade] of [["credit", input.creditGrade], ["distinction", input.distinctionGrade], ["failing", input.failingGrade]] as const) {
      if (grade && !known.has(grade)) throw new BadRequestException(`The ${label} band “${grade}” is not one of the bands.`);
    }
    const existing = await prisma.gradingScaleTemplate.findUnique({ where: { name_version: { name: input.name, version } } });
    if (existing && existing.lifecycle !== "DRAFT") throw new BadRequestException(`${input.name} ${version} is ${existing.lifecycle.toLowerCase()} and can no longer be edited. Save it under a new version.`);
    const data = { gradeBands: input.gradeBands as Prisma.InputJsonValue, passMark: input.passMark, applicableCurricula: input.applicableCurricula, scaleType: input.scaleType, creditGrade: input.creditGrade ?? null, distinctionGrade: input.distinctionGrade ?? null, failingGrade: input.failingGrade ?? null };
    const row = existing
      ? await prisma.gradingScaleTemplate.update({ where: { id: existing.id }, data: { ...data, validatedAt: null } })
      : await prisma.gradingScaleTemplate.create({ data: { name: input.name, version, lifecycle: "DRAFT", isActive: false, ...data } });
    await this.audit(session, AuditAction.UPDATE, "GradingScaleTemplate", row.id, { name: row.name, version: row.version });
    return { id: row.id, version: row.version, problems: checkBands(input.gradeBands, input.passMark) };
  }

  async validateGrading(session: SessionPayload, id: string) {
    const row = await prisma.gradingScaleTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Scale not found.");
    if (row.lifecycle !== "DRAFT") throw new BadRequestException("Only a draft can be validated.");
    const problems = checkBands(z.array(bandSchema).parse(row.gradeBands), row.passMark);
    if (problems.length) throw new BadRequestException(problems.join(" "));
    await prisma.gradingScaleTemplate.update({ where: { id }, data: { lifecycle: "VALIDATED", validatedAt: new Date() } });
    await this.audit(session, AuditAction.UPDATE, "GradingScaleTemplate", id, { validated: true });
    return { id };
  }

  async publishGrading(session: SessionPayload, id: string) {
    const row = await prisma.gradingScaleTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Scale not found.");
    if (row.lifecycle !== "VALIDATED") throw new BadRequestException("Validate the scale before publishing it.");
    const before = await prisma.gradingScaleTemplate.findMany({ where: { name: row.name, lifecycle: "ACTIVE", id: { not: id } } });
    const wasDefault = before.some((scale) => scale.isDefault);
    await prisma.$transaction([
      prisma.gradingScaleTemplate.updateMany({ where: { name: row.name, lifecycle: "ACTIVE", id: { not: id } }, data: { lifecycle: "SUPERSEDED", isActive: false, supersededAt: new Date(), isDefault: false } }),
      prisma.gradingScaleTemplate.update({ where: { id }, data: { lifecycle: "ACTIVE", isActive: true, ...(wasDefault ? { isDefault: true } : {}) } })
    ]);
    // A school keeps the copy it took, so a new version changes nothing for it — but it is told that one exists.
    const told = await library.tellSchools(await library.schoolsThatTook("GRADING", row.name), `The ${row.name} grading scale has a new version`, `Future Realm published version ${row.version} of the ${row.name} scale. Your school keeps its own scale exactly as it is — nothing has changed in your account, and you can compare it with the new version whenever you like.`);
    await this.audit(session, AuditAction.APPROVE, "GradingScaleTemplate", id, { published: true, version: row.version, schoolsTold: told });
    return { id, schoolsTold: told };
  }

  async archiveGrading(session: SessionPayload, id: string) {
    const row = await prisma.gradingScaleTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Scale not found.");
    await prisma.gradingScaleTemplate.update({ where: { id }, data: { lifecycle: "ARCHIVED", isActive: false } });
    await this.audit(session, AuditAction.UPDATE, "GradingScaleTemplate", id, { archived: true });
    return { id };
  }

  /* ───────────────────────── subject mapping ───────────────────────── */

  async addMapping(session: SessionPayload, body: unknown) {
    const input = mappingSchema.parse(body);
    const [from, to] = await Promise.all([prisma.curriculumTemplate.findUnique({ where: { id: input.fromTemplateId } }), prisma.curriculumTemplate.findUnique({ where: { id: input.toTemplateId } })]);
    if (!from || !to) throw new BadRequestException("Both templates must exist.");
    if (from.id === to.id) throw new BadRequestException("A mapping goes from one version to a different one.");
    if (from.name !== to.name) throw new BadRequestException("Mappings are between versions of the same template.");
    if (!from.subjects.some((s) => platformSubjectKey(s) === platformSubjectKey(input.fromSubject))) throw new BadRequestException(`${input.fromSubject} is not a subject in version ${from.version}.`);
    if (!to.subjects.some((s) => platformSubjectKey(s) === platformSubjectKey(input.toSubject))) throw new BadRequestException(`${input.toSubject} is not a subject in version ${to.version}.`);
    const row = await prisma.templateSubjectMapping.upsert({
      where: { fromTemplateId_toTemplateId_fromSubject_toSubject: { fromTemplateId: from.id, toTemplateId: to.id, fromSubject: input.fromSubject, toSubject: input.toSubject } },
      create: { ...input, createdById: session.userId },
      update: { relationship: input.relationship }
    });
    await this.audit(session, AuditAction.CREATE, "TemplateSubjectMapping", row.id, { from: `${from.name} ${from.version}`, to: to.version, fromSubject: input.fromSubject, toSubject: input.toSubject });
    return { id: row.id };
  }

  async removeMapping(session: SessionPayload, id: string) {
    const row = await prisma.templateSubjectMapping.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Mapping not found.");
    await prisma.templateSubjectMapping.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "TemplateSubjectMapping", id, { fromSubject: row.fromSubject, toSubject: row.toSubject });
    return { id };
  }

  /* ───────────────────────── country profiles ───────────────────────── */

  async saveProfile(session: SessionPayload, body: unknown) {
    const input = profileSchema.parse(body);
    if (input.phonePattern) {
      try { new RegExp(input.phonePattern); } catch { throw new BadRequestException("The phone pattern is not a valid regular expression."); }
    }
    const row = await prisma.countryProfile.upsert({ where: { country: input.country }, create: input, update: input });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "CountryProfile", row.id, { country: row.country, isLive: row.isLive });
    return { id: row.id };
  }

  /* ───────────────────────── the read side ───────────────────────── */

  async overview() {
    const [cards, frameworks, runs] = await Promise.all([library.cards(), library.frameworks(), library.latestRuns()]);
    const [curricula, grading, , mappings, profiles, adoptions, schoolsByCountry, recent] = await Promise.all([
      prisma.curriculumTemplate.findMany({ orderBy: [{ name: "asc" }, { createdAt: "desc" }] }),
      prisma.gradingScaleTemplate.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.reportCardTemplate.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.templateSubjectMapping.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.countryProfile.findMany({ orderBy: { country: "asc" } }),
      prisma.templateAdoption.groupBy({ by: ["templateId"], _count: { _all: true } }),
      prisma.school.groupBy({ by: ["country"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.templateAdoption.findMany({ orderBy: { adoptedAt: "desc" }, take: 30 })
    ]);
    const schoolNames = new Map((await prisma.school.findMany({ where: { id: { in: recent.map((row) => row.schoolId) } }, select: { id: true, name: true } })).map((row) => [row.id, row.name]));
    const used = new Map(adoptions.map((row) => [row.templateId, row._count._all]));
    const byId = new Map(curricula.map((row) => [row.id, row]));
    return {
      curricula: curricula.map((c) => ({ id: c.id, name: c.name, country: c.country, subjects: c.subjects, subjectCount: c.subjects.length, calendarType: c.calendarType, version: c.version, isActive: c.isActive, lifecycle: c.lifecycle, owner: c.owner, effectiveFrom: c.effectiveFrom?.toISOString() ?? null, effectiveTo: c.effectiveTo?.toISOString() ?? null, language: c.language, layers: c.layers ?? null, basedOn: c.baseOnId ? (byId.get(c.baseOnId) ? `${byId.get(c.baseOnId)!.name} ${byId.get(c.baseOnId)!.version}` : "A removed template") : null, validatedAt: c.validatedAt?.toISOString() ?? null, schools: used.get(c.id) ?? 0 })),
      gradingScales: grading.map((g) => ({ id: g.id, name: g.name, version: g.version, scaleType: g.scaleType, isDefault: g.isDefault, creditGrade: g.creditGrade, distinctionGrade: g.distinctionGrade, failingGrade: g.failingGrade, lifecycle: g.lifecycle, gradeBands: g.gradeBands, bandCount: Array.isArray(g.gradeBands) ? (g.gradeBands as unknown[]).length : 0, passMark: g.passMark, applicableCurricula: g.applicableCurricula, isActive: g.isActive, schools: used.get(g.id) ?? 0, problems: (() => { try { return checkBands(z.array(bandSchema).parse(g.gradeBands), g.passMark); } catch { return ["The bands are not in a readable form."]; } })() })),
      reportCards: cards,
      frameworks,
      portabilityRuns: runs,
      mappings: mappings.map((m) => ({ id: m.id, template: byId.get(m.fromTemplateId)?.name ?? "A removed template", fromVersion: byId.get(m.fromTemplateId)?.version ?? "?", toVersion: byId.get(m.toTemplateId)?.version ?? "?", fromSubject: m.fromSubject, toSubject: m.toSubject, relationship: m.relationship, at: m.createdAt.toISOString() })),
      profiles: profiles.map((p) => ({ ...p, createdAt: undefined, updatedAt: p.updatedAt.toISOString(), schools: schoolsByCountry.find((row) => row.country === p.country)?._count._all ?? 0 })),
      adoptions: recent.map((row) => ({ id: row.id, school: schoolNames.get(row.schoolId) ?? "A removed school", kind: row.kind, template: row.templateName, version: row.version, at: row.adoptedAt.toISOString() })),
      unprofiled: schoolsByCountry.filter((row) => !profiles.some((p) => p.country === row.country)).map((row) => ({ country: row.country, schools: row._count._all }))
    };
  }

  async gradingName(id: string): Promise<string> {
    const row = await prisma.gradingScaleTemplate.findUnique({ where: { id }, select: { name: true } });
    if (!row) throw new NotFoundException("Scale not found.");
    return row.name;
  }

  /** What a new school in a country is given: the active curriculum, and the active scale made for it. Null when nothing has been published. */
  async forCountry(country: string) {
    // Several curricula can be live in one country (a British or American variant beside the national one). A new school is given the
    // one the library marks as the country's default; with none marked, the most recently changed.
    const live = await prisma.curriculumTemplate.findMany({ where: { country: { equals: country, mode: "insensitive" }, lifecycle: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
    const curriculum = live.find((row) => (row.layers as { default?: boolean } | null)?.default) ?? live[0];
    if (!curriculum) return { curriculum: null, grading: null };
    const grading = await prisma.gradingScaleTemplate.findFirst({ where: { lifecycle: "ACTIVE", applicableCurricula: { has: curriculum.name } }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
    return { curriculum, grading };
  }

  async recordAdoption(schoolId: string, rows: Array<{ kind: "GRADING" | "CURRICULUM" | "REPORT_CARD"; templateId: string; templateName: string; version: string }>) {
    if (rows.length) await prisma.templateAdoption.createMany({ data: rows.map((row) => ({ schoolId, ...row })) });
  }

  /* ─────────────────── assignment per class ─────────────────── */

  /**
   * Which template version each class is running.
   *
   * A school adopts a template as a whole, which is fine until a school is
   * mid-change: the leaving year sits an examination against the syllabus it
   * was taught, while the intake below it starts on the new one. Without a row
   * per class the only answer available is "whatever the school adopted", and
   * the two cohorts cannot be told apart. A class with no row runs the school's
   * own adoption, so nothing has to be assigned for a school to work.
   */
  async classAssignments(schoolId?: string) {
    const rows = await prisma.classTemplateAssignment.findMany({
      where: schoolId ? { schoolId } : {},
      orderBy: { assignedAt: "desc" },
      take: 300,
    });
    const [schools, classes] = await Promise.all([
      prisma.school.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.schoolId))] } }, select: { id: true, name: true } }),
      prisma.classRoom.findMany({ where: { id: { in: rows.map((r) => r.classId) } }, select: { id: true, name: true, arm: true } }),
    ]);
    const schoolName = new Map(schools.map((row) => [row.id, row.name]));
    const className = new Map(classes.map((row) => [row.id, row.arm ? `${row.name} ${row.arm}` : row.name]));
    return rows.map((row) => ({
      id: row.id,
      schoolId: row.schoolId,
      school: schoolName.get(row.schoolId) ?? "A removed school",
      classId: row.classId,
      className: className.get(row.classId) ?? "A removed class",
      templateId: row.templateId,
      template: row.templateName,
      version: row.version,
      assignedAt: row.assignedAt.toISOString(),
    }));
  }

  /**
   * Every class that could be pinned, labelled by its school.
   *
   * Flat rather than school-then-class because the control that uses it is a
   * single select; a deployment with enough schools to make this unwieldy wants
   * a search, which this list is the data behind either way.
   */
  async classOptions() {
    const rows = await prisma.classRoom.findMany({
      where: { isActive: true, deletedAt: null, school: { deletedAt: null } },
      select: { id: true, name: true, arm: true, school: { select: { name: true } } },
      orderBy: [{ school: { name: "asc" } }, { displayOrder: "asc" }, { name: "asc" }],
      take: 500,
    });
    return rows.map((row) => ({
      value: row.id,
      label: `${row.school.name} · ${row.arm ? `${row.name} ${row.arm}` : row.name}`,
    }));
  }

  /** Put one class on a named template version. Re-assigning replaces the row. */
  async assignClass(session: SessionPayload, body: unknown) {
    const input = assignSchema.parse(body);
    const klass = await prisma.classRoom.findUnique({ where: { id: input.classId }, select: { id: true, name: true, arm: true, schoolId: true } });
    if (!klass) throw new NotFoundException("That class does not exist.");
    const template = await prisma.curriculumTemplate.findUnique({ where: { id: input.templateId }, select: { id: true, name: true, version: true, lifecycle: true } });
    if (!template) throw new NotFoundException("That template version does not exist.");
    // A draft has not been checked yet; putting a class on one would mean
    // teaching against a syllabus nobody has validated.
    if (template.lifecycle === "DRAFT") throw new BadRequestException("A draft cannot be assigned to a class. Validate and publish it first.");
    const row = await prisma.classTemplateAssignment.upsert({
      where: { classId: input.classId },
      create: {
        schoolId: klass.schoolId,
        classId: klass.id,
        templateId: template.id,
        templateName: template.name,
        version: template.version,
        assignedById: session.userId,
      },
      update: { templateId: template.id, templateName: template.name, version: template.version, assignedById: session.userId, assignedAt: new Date() },
    });
    await this.audit(session, "UPDATE", "ClassTemplateAssignment", row.id, { class: klass.arm ? `${klass.name} ${klass.arm}` : klass.name, template: template.name, version: template.version });
    return { id: row.id, className: klass.arm ? `${klass.name} ${klass.arm}` : klass.name, template: template.name, version: template.version };
  }

  /** Put the class back on whatever its school adopted. */
  async clearClassAssignment(session: SessionPayload, classId: string) {
    const row = await prisma.classTemplateAssignment.findUnique({ where: { classId } });
    if (!row) throw new NotFoundException("That class is not on a version of its own.");
    await prisma.classTemplateAssignment.delete({ where: { classId } });
    await this.audit(session, "DELETE", "ClassTemplateAssignment", row.id, { cleared: true, template: row.templateName, version: row.version });
    return { classId, cleared: true };
  }

  /**
   * The version a class is actually running — its own if it has one, else the
   * school's adoption. This is the function anything computing results against
   * a syllabus should ask.
   */
  async versionForClass(classId: string) {
    const own = await prisma.classTemplateAssignment.findUnique({ where: { classId } });
    if (own) return { templateId: own.templateId, template: own.templateName, version: own.version, source: "class" as const };
    const klass = await prisma.classRoom.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!klass) return null;
    const adopted = await prisma.templateAdoption.findFirst({ where: { schoolId: klass.schoolId, kind: "CURRICULUM" }, orderBy: { adoptedAt: "desc" } });
    if (!adopted) return null;
    return { templateId: adopted.templateId, template: adopted.templateName, version: adopted.version, source: "school" as const };
  }

  /** Every school running a given template, for the template's own row. */
  async schoolsUsing(templateId: string) {
    const [adoptions, classRows] = await Promise.all([
      prisma.templateAdoption.findMany({ where: { templateId }, orderBy: { adoptedAt: "desc" } }),
      prisma.classTemplateAssignment.findMany({ where: { templateId } }),
    ]);
    const ids = [...new Set([...adoptions.map((r) => r.schoolId), ...classRows.map((r) => r.schoolId)])];
    const schools = await prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, plan: true } });
    return schools.map((school) => {
      const adopted = adoptions.find((row) => row.schoolId === school.id);
      const classes = classRows.filter((row) => row.schoolId === school.id).length;
      return {
        schoolId: school.id,
        school: school.name,
        plan: school.plan as string,
        adoptedAt: adopted?.adoptedAt.toISOString() ?? null,
        classesPinned: classes,
        how: adopted && classes ? "Adopted, with classes pinned to it" : adopted ? "Adopted at setup" : "Pinned on individual classes only",
      };
    });
  }
}

export const templates = new TemplatesService();
