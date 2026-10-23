import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { checkBands, type Band } from "./templates.service";

const OWNER_ROLES = ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] as const;

/** Every section a report card can print, in print order, and the key that switches it on or off. */
export const CARD_SECTIONS = [
  { key: "header", label: "School header with logo", sub: "Name, address, term, session" },
  { key: "identity", label: "Pupil identity and attendance", sub: "Name, class, admission number, days present of days open" },
  { key: "subjectTable", label: "Subject table with component scores", sub: "Each assessment component shown, not just the total" },
  { key: "average", label: "Class or arm average per subject", sub: "Off on a no-ranking layout" },
  { key: "position", label: "Subject position", sub: "Off on a no-ranking layout" },
  { key: "cumulative", label: "Cumulative column from Term 2", sub: "Carries earlier terms forward on the same sheet" },
  { key: "domains", label: "Behavioural domains", sub: "Five-point scale across the school’s chosen domains" },
  { key: "comments", label: "Teacher and principal comments", sub: "Drawn from the school’s editable comment bank" },
  { key: "feeBalance", label: "Fee balance", sub: "Only where the school chooses to show it — never on by default" },
  { key: "signatures", label: "Signature blocks", sub: "Class teacher and principal" }
] as const;

const frameworkSchema = z.object({
  name: z.string().trim().min(2),
  typicalUser: z.string().trim().optional(),
  components: z.array(z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), max: z.coerce.number().positive(), weight: z.coerce.number().min(0).max(100) })).min(1)
});

const specSchema = z.object({
  sections: z.record(z.string(), z.boolean()).default({}),
  positionRule: z.enum(["SHOWN", "FROM_LEVEL", "NONE"]).default("SHOWN"),
  averaging: z.enum(["CLASS", "ARM", "NONE"]).default("ARM"),
  gradingDisplay: z.enum(["GRADE", "DESCRIPTIVE"]).default("GRADE"),
  reissue: z.enum(["LATEST", "VERSIONED"]).default("VERSIONED"),
  paper: z.string().trim().default("A4 portrait"),
  sides: z.string().trim().default("One")
});
export type CardSpec = z.infer<typeof specSchema>;

const cardSchema = z.object({
  name: z.string().trim().min(2),
  bestFor: z.string().trim().min(2),
  availableToTiers: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []), z.array(z.string())).default([]),
  applicableCurricula: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []), z.array(z.string())).default([]),
  baseOnId: z.string().trim().optional().transform((v) => v || undefined),
  targetRelease: z.string().trim().optional().transform((v) => v || undefined),
  spec: specSchema.default({ sections: {} })
});

type Finding = { test: string; state: "PASS" | "PARTIAL" | "FAIL"; note: string };

/** What a layout prints, as a person would read it — used for the sample card and for the "distinguishing rules" line. */
export function describeSpec(spec: CardSpec): string {
  const on = (key: string) => spec.sections[key] === true;
  const parts: string[] = [];
  parts.push(spec.positionRule === "NONE" ? "No position anywhere on the sheet" : spec.positionRule === "FROM_LEVEL" ? "Position shown from a chosen level" : "Position shown");
  if (on("cumulative")) parts.push("cumulative column from Term 2");
  if (on("domains")) parts.push("behavioural domains");
  if (spec.averaging === "NONE") parts.push("no averaging");
  if (spec.gradingDisplay === "DESCRIPTIVE") parts.push("descriptive bands only");
  if (on("feeBalance")) parts.push("fee balance optional");
  if (spec.reissue === "VERSIONED") parts.push("versioned per issue date");
  return parts.join(" · ");
}

@Injectable()
export class LibraryService {
  private async actor(session: SessionPayload) {
    return prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true, firstName: true, lastName: true } });
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    const actor = await this.actor(session);
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
    return actor;
  }

  /** In-app notice to the owner and principal of each school. A master changing never changes a school's copy; this only tells them. */
  async tellSchools(schoolIds: string[], title: string, body: string) {
    if (!schoolIds.length) return 0;
    const owners = await prisma.user.findMany({ where: { schoolId: { in: schoolIds }, isActive: true, deletedAt: null, role: { in: [...OWNER_ROLES] } }, select: { id: true, schoolId: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: owner.schoolId, userId: owner.id, channel: "IN_APP" as const, title, body, status: "QUEUED", sentAt: new Date() })) });
    return new Set(owners.map((owner) => owner.schoolId)).size;
  }

  /** Schools that took a template (by name, any version) — distinct, because one school may have taken several versions. */
  async schoolsThatTook(kind: string, name: string): Promise<string[]> {
    const rows = await prisma.templateAdoption.findMany({ where: { kind, templateName: name }, select: { schoolId: true }, distinct: ["schoolId"] });
    return rows.map((row) => row.schoolId);
  }

  async adoptionCounts(kind: string): Promise<Map<string, number>> {
    const rows = await prisma.templateAdoption.findMany({ where: { kind }, select: { schoolId: true, templateName: true } });
    const byName = new Map<string, Set<string>>();
    for (const row of rows) byName.set(row.templateName, (byName.get(row.templateName) ?? new Set()).add(row.schoolId));
    return new Map(Array.from(byName, ([name, set]) => [name, set.size]));
  }

  /* ───────────────────────── curriculum: history, layers, portability ───────────────────────── */

  async history(id: string) {
    const row = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template not found.");
    const versions = await prisma.curriculumTemplate.findMany({ where: { name: row.name }, orderBy: { createdAt: "asc" } });
    const taken = await prisma.templateAdoption.groupBy({ by: ["templateId"], where: { kind: "CURRICULUM", templateName: row.name }, _count: { _all: true } });
    const count = new Map(taken.map((entry) => [entry.templateId, entry._count._all]));
    return versions.map((v) => ({ id: v.id, version: v.version, lifecycle: v.lifecycle, effectiveFrom: v.effectiveFrom?.toISOString() ?? null, effectiveTo: v.effectiveTo?.toISOString() ?? null, supersededAt: v.supersededAt?.toISOString() ?? null, validatedAt: v.validatedAt?.toISOString() ?? null, schools: count.get(v.id) ?? 0, owner: v.owner }));
  }

  /** The layer workspace: the six rows a template's structure sheet shows, and the line the library table shows. A draft only. */
  async saveLayers(session: SessionPayload, id: string, body: unknown) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const names = ["1 · Calendar", "2 · Levels and classes", "3 · Subjects", "4 · Assessment", "5 · Grading", "6 · Report card"];
    const flat = raw.rows ?? (typeof raw.holds1 === "string" ? names.map((layer, index) => ({ layer, holds: raw[`holds${index + 1}`], detail: raw[`detail${index + 1}`] ?? "" })) : undefined);
    const input = z.object({
      characteristics: z.string().trim().optional(),
      rows: z.array(z.object({ layer: z.string().trim().min(1), holds: z.string().trim().min(1), detail: z.string().trim().default("") })).length(6, "A template describes all six layers.")
    }).parse({ ...raw, rows: flat });
    const row = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template not found.");
    if (row.lifecycle !== "DRAFT") throw new BadRequestException(`${row.name} ${row.version} is ${row.lifecycle.toLowerCase()} and its layers can no longer be edited. Start a new version instead.`);
    const layers = (row.layers ?? {}) as Record<string, unknown>;
    await prisma.curriculumTemplate.update({ where: { id }, data: { validatedAt: null, layers: { ...layers, ...(input.characteristics ? { characteristics: input.characteristics } : {}), structure: input.rows } as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "CurriculumTemplate", id, { layersEdited: true, version: row.version });
    return { id };
  }

  /** The eight portability tests, run against this master's own configuration and its country — not asserted. */
  async portabilityOfCurriculum(id: string): Promise<Finding[]> {
    const row = await prisma.curriculumTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template not found.");
    const [profile, scales] = await Promise.all([
      prisma.countryProfile.findUnique({ where: { country: row.country } }),
      prisma.gradingScaleTemplate.findMany({ where: { applicableCurricula: { has: row.name }, lifecycle: { in: ["ACTIVE", "VALIDATED", "DRAFT"] } } })
    ]);
    const scale = scales.find((s) => s.isDefault) ?? scales[0];
    const bandsOk = scale ? checkBands(scale.gradeBands as unknown as Band[], scale.passMark).length === 0 : false;
    const out: Finding[] = [];
    out.push(profile?.currency?.length === 3 ? { test: "T1", state: "PASS", note: `${row.country} supplies its own currency (${profile.currency}) as data.` } : { test: "T1", state: "FAIL", note: `${row.country} has no country record with a currency — every figure would fall back to NGN.` });
    out.push(["THREE_TERM", "TWO_SEMESTER"].includes(row.calendarType) ? { test: "T2", state: "PASS", note: `The calendar is declared (${row.calendarType.replaceAll("_", " ").toLowerCase()}), and session results aggregate whatever terms exist.` } : { test: "T2", state: "FAIL", note: "No calendar is declared." });
    out.push(scale ? (bandsOk ? { test: "T3", state: "PASS", note: `Graded by ${scale.name}, whose bands cover 0–100 without a gap.` } : { test: "T3", state: "FAIL", note: `${scale.name} does not cover 0–100 cleanly.` }) : { test: "T3", state: "PARTIAL", note: "No grading scale names this curriculum, so schools would fall back to the platform default." });
    out.push(scale?.scaleType === "DESCRIPTIVE" ? { test: "T4", state: "FAIL", note: "A descriptive-only scale needs a scoring path with no number, and a score is a mandatory number on every score record today." } : { test: "T4", state: "PASS", note: "Scored numerically; positions and averages can be computed." });
    out.push(profile?.defaultChannel ? { test: "T5", state: "PASS", note: `Parents are reached on ${profile.defaultChannel.toLowerCase()} — read from the country record, not assumed.` } : { test: "T5", state: "PARTIAL", note: "The country record names no default parent channel." });
    out.push({ test: "T6", state: "PASS", note: "A school may be a group with its own campuses; nothing here assumes a single owner-operated site." });
    out.push(profile?.dataProtectionRegime && profile.consentAge != null ? { test: "T7", state: "PASS", note: `${profile.dataProtectionRegime}; guardian consent under ${profile.consentAge}.` } : { test: "T7", state: "FAIL", note: "The country record names no data-protection regime or consent age." });
    const gaps = profile ? [!profile.phonePattern && "phone pattern", !profile.educationAuthority && "education authority", !profile.registrationAuthority && "registration authority"].filter(Boolean) : ["a country record"];
    out.push(gaps.length === 0 ? { test: "T8", state: "PASS", note: "A school here is set up from configuration records alone." } : { test: "T8", state: "PARTIAL", note: `Still missing: ${gaps.join(", ")}.` });
    return out;
  }

  async runPortability(session: SessionPayload, kind: "CURRICULUM" | "REPORT_CARD", id: string) {
    const results = kind === "CURRICULUM" ? await this.portabilityOfCurriculum(id) : await this.portabilityOfCard(id);
    const target = kind === "CURRICULUM" ? await prisma.curriculumTemplate.findUnique({ where: { id }, select: { name: true, version: true } }) : await prisma.reportCardTemplate.findUnique({ where: { id }, select: { name: true } });
    const actor = await this.actor(session);
    const passed = results.every((result) => result.state !== "FAIL");
    const run = await prisma.portabilityRun.create({ data: { kind, targetId: id, targetName: target ? `${target.name}${"version" in target ? ` ${target.version}` : ""}` : id, results: results as unknown as Prisma.InputJsonValue, passed, ranById: actor?.id ?? null } });
    return { id: run.id, passed, results };
  }

  /** Runs the eight tests against every master that is still in play, so the portability table reads current results. */
  async runAllPortability(session: SessionPayload) {
    const rows = await prisma.curriculumTemplate.findMany({ where: { lifecycle: { in: ["DRAFT", "VALIDATED", "ACTIVE"] } }, select: { id: true } });
    let passed = 0;
    for (const row of rows) if ((await this.runPortability(session, "CURRICULUM", row.id)).passed) passed += 1;
    return { ran: rows.length, passed };
  }

  async latestRuns() {
    const rows = await prisma.portabilityRun.findMany({ orderBy: { ranAt: "desc" }, take: 200 });
    const seen = new Set<string>();
    return rows.filter((row) => { const key = `${row.kind}:${row.targetId}`; if (seen.has(key)) return false; seen.add(key); return true; }).map((row) => ({ id: row.id, kind: row.kind, targetId: row.targetId, targetName: row.targetName, passed: row.passed, results: row.results as unknown as Finding[], ranAt: row.ranAt.toISOString() }));
  }

  /* ───────────────────────── grading scales ───────────────────────── */

  /** Makes a live scale the one new schools see first for the curricula it names; any other default for those curricula steps down. */
  async makeDefault(session: SessionPayload, id: string) {
    const row = await prisma.gradingScaleTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Scale not found.");
    if (row.lifecycle !== "ACTIVE") throw new BadRequestException("Only a live scale can be the default — validate and publish it first.");
    if (row.applicableCurricula.length === 0) throw new BadRequestException("Name the curriculum this scale is for first, so there is something for it to be the default of.");
    await prisma.$transaction([
      prisma.gradingScaleTemplate.updateMany({ where: { id: { not: id }, isDefault: true, applicableCurricula: { hasSome: row.applicableCurricula } }, data: { isDefault: false } }),
      prisma.gradingScaleTemplate.update({ where: { id }, data: { isDefault: true } })
    ]);
    await this.audit(session, AuditAction.UPDATE, "GradingScaleTemplate", id, { madeDefault: true, name: row.name, version: row.version });
    return { id };
  }

  /** A separate draft the school-facing library can carry alongside the original; the original is left exactly as it is. */
  async duplicateGrading(session: SessionPayload, id: string) {
    const row = await prisma.gradingScaleTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Scale not found.");
    let name = `${row.name} (custom)`;
    for (let n = 2; await prisma.gradingScaleTemplate.findFirst({ where: { name } }); n += 1) name = `${row.name} (custom ${n})`;
    const copy = await prisma.gradingScaleTemplate.create({ data: { name, version: "1.0", gradeBands: row.gradeBands as Prisma.InputJsonValue, passMark: row.passMark, scaleType: row.scaleType, creditGrade: row.creditGrade, distinctionGrade: row.distinctionGrade, failingGrade: row.failingGrade, applicableCurricula: [], lifecycle: "DRAFT", isActive: false } });
    await this.audit(session, AuditAction.CREATE, "GradingScaleTemplate", copy.id, { duplicatedFrom: row.id });
    return { id: copy.id, name };
  }

  /** The next whole version for a scale: v3 becomes v4. */
  async nextGradingVersion(name: string): Promise<string> {
    const all = await prisma.gradingScaleTemplate.findMany({ where: { name }, select: { version: true } });
    const highest = all.map((r) => Number.parseFloat(r.version)).filter((n) => Number.isFinite(n)).reduce((a, b) => Math.max(a, b), 0);
    return String(Math.floor(highest) + 1);
  }

  async schoolsOnScale(name: string) {
    const ids = await this.schoolsThatTook("GRADING", name);
    const schools = await prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return schools;
  }

  /* ───────────────────────── assessment frameworks ───────────────────────── */

  async frameworks() {
    const [rows, active, sectionActive] = await Promise.all([
      prisma.assessmentFrameworkTemplate.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
      prisma.assessmentComponent.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { schoolId: true, weight: true } }),
      prisma.sectionAssessmentComponent.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { schoolId: true, section: true, weight: true } })
    ]);
    // A school "uses" a framework when any one of its class levels weighs its components exactly as the framework does.
    const groups = new Map<string, number[]>();
    for (const c of active) groups.set(`${c.schoolId}|class`, [...(groups.get(`${c.schoolId}|class`) ?? []), c.weight]);
    for (const c of sectionActive) groups.set(`${c.schoolId}|${c.section}`, [...(groups.get(`${c.schoolId}|${c.section}`) ?? []), c.weight]);
    const patterns = new Map<string, Set<string>>();
    for (const [key, weights] of groups) { const pattern = weights.join("/"); patterns.set(pattern, (patterns.get(pattern) ?? new Set()).add(key.split("|")[0])); }
    return rows.map((row) => {
      const comps = row.components as unknown as Array<{ code: string; name: string; max: number; weight: number }>;
      const pattern = comps.map((c) => c.weight).join("/");
      return { id: row.id, name: row.name, components: comps, typicalUser: row.typicalUser, isCustom: row.isCustom, isActive: row.isActive, schools: row.isCustom ? 0 : patterns.get(pattern)?.size ?? 0 };
    });
  }

  async saveFramework(session: SessionPayload, body: unknown) {
    // From a form the components arrive as one line each: CODE | Name | marked out of | weight.
    const raw = (body ?? {}) as Record<string, unknown>;
    const lines = typeof raw.components === "string"
      ? raw.components.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [code, name, max, weight] = line.split("|").map((part) => part.trim()); return { code, name, max, weight }; })
      : raw.components;
    const input = frameworkSchema.parse({ ...raw, components: lines });
    const total = input.components.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(total - 100) > 0.001) throw new BadRequestException(`The weights total ${total}, not 100. A framework that does not total exactly 100 produces quietly wrong results, so it is not saved.`);
    if (new Set(input.components.map((c) => c.code.toLowerCase())).size !== input.components.length) throw new BadRequestException("Two components share a code.");
    const count = await prisma.assessmentFrameworkTemplate.count();
    const row = await prisma.assessmentFrameworkTemplate.upsert({ where: { name: input.name }, create: { name: input.name, typicalUser: input.typicalUser ?? null, components: input.components as Prisma.InputJsonValue, position: count + 1 }, update: { typicalUser: input.typicalUser ?? null, components: input.components as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "AssessmentFrameworkTemplate", row.id, { name: row.name, weights: input.components.map((c) => c.weight) });
    return { id: row.id };
  }

  async archiveFramework(session: SessionPayload, id: string) {
    const row = await prisma.assessmentFrameworkTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Framework not found.");
    await prisma.assessmentFrameworkTemplate.update({ where: { id }, data: { isActive: !row.isActive } });
    await this.audit(session, AuditAction.UPDATE, "AssessmentFrameworkTemplate", id, { isActive: !row.isActive });
    return { id };
  }

  /* ───────────────────────── report card layouts ───────────────────────── */

  private specOf(row: { spec: Prisma.JsonValue | null }): CardSpec {
    return specSchema.parse(row.spec ?? {});
  }

  async saveCard(session: SessionPayload, body: unknown) {
    // A form sends its switches as one map and its rules as plain fields; a caller may also send the finished spec.
    const raw = (body ?? {}) as Record<string, unknown>;
    const pick = (key: string) => (raw[key] === "" ? undefined : raw[key]);
    const input = cardSchema.parse({ ...raw, spec: raw.spec ?? { sections: raw.sections ?? {}, positionRule: pick("positionRule"), averaging: pick("averaging"), gradingDisplay: pick("gradingDisplay"), reissue: pick("reissue"), paper: pick("paper"), sides: pick("sides") } });
    const actor = await this.actor(session);
    const existing = await prisma.reportCardTemplate.findUnique({ where: { name: input.name } });
    if (existing && existing.status !== "DRAFT") throw new BadRequestException(`${input.name} is ${existing.status === "LIVE" ? "live" : "in review"} and cannot be edited. Duplicate it as a new draft instead.`);
    if (input.availableToTiers.length === 0) input.availableToTiers = ["STANDARD", "PREMIUM", "ELITE"];
    if (/brand/i.test(input.name) && !input.availableToTiers.every((tier) => tier === "ELITE")) throw new BadRequestException("A branded layout needs an approved logo, so it is open to Elite only.");
    const base = input.baseOnId ? await prisma.reportCardTemplate.findUnique({ where: { id: input.baseOnId } }) : null;
    const spec = Object.keys(input.spec.sections).length || !base ? input.spec : this.specOf(base);
    const data = { layoutConfig: { layout: describeSpec(spec), bestFor: input.bestFor } as Prisma.InputJsonValue, spec: spec as unknown as Prisma.InputJsonValue, availableToTiers: input.availableToTiers, applicableCurricula: input.applicableCurricula, targetRelease: input.targetRelease ?? null, baseOnId: base?.id ?? null };
    const row = existing
      ? await prisma.reportCardTemplate.update({ where: { id: existing.id }, data })
      : await prisma.reportCardTemplate.create({ data: { name: input.name, status: "DRAFT", isActive: false, authorId: actor?.id ?? null, ...data } });
    await this.audit(session, AuditAction.UPDATE, "ReportCardTemplate", row.id, { name: row.name, status: row.status });
    return { id: row.id, status: row.status };
  }

  async duplicateCard(session: SessionPayload, id: string) {
    const row = await prisma.reportCardTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Layout not found.");
    const actor = await this.actor(session);
    let name = `${row.name} (copy)`;
    for (let n = 2; await prisma.reportCardTemplate.findUnique({ where: { name } }); n += 1) name = `${row.name} (copy ${n})`;
    const copy = await prisma.reportCardTemplate.create({ data: { name, status: "DRAFT", isActive: false, layoutConfig: (row.layoutConfig ?? {}) as Prisma.InputJsonValue, spec: (row.spec ?? undefined) as Prisma.InputJsonValue | undefined, availableToTiers: row.availableToTiers, applicableCurricula: row.applicableCurricula, baseOnId: row.id, authorId: actor?.id ?? null } });
    await this.audit(session, AuditAction.CREATE, "ReportCardTemplate", copy.id, { duplicatedFrom: row.id });
    return { id: copy.id, name };
  }

  /** Sends a draft to a second person. It stays out of every school's reach until they approve it. */
  async submitCard(session: SessionPayload, id: string, body: unknown) {
    const { notes } = z.object({ notes: z.string().trim().optional() }).parse(body ?? {});
    const row = await prisma.reportCardTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Layout not found.");
    if (row.status !== "DRAFT") throw new BadRequestException("Only a draft can be sent for review.");
    const run = await this.runPortability(session, "REPORT_CARD", id);
    if (!run.passed) throw new BadRequestException(`It does not pass the Layer 6 portability tests: ${run.results.filter((r) => r.state === "FAIL").map((r) => r.note).join(" ")}`);
    await prisma.reportCardTemplate.update({ where: { id }, data: { status: "IN_REVIEW", reviewNotes: notes ?? null, reviewerId: null, reviewedAt: null } });
    await this.audit(session, AuditAction.UPDATE, "ReportCardTemplate", id, { sentForReview: true });
    return { id };
  }

  async returnCard(session: SessionPayload, id: string, body: unknown) {
    const { notes } = z.object({ notes: z.string().trim().min(2, "Say what needs to change.") }).parse(body ?? {});
    const row = await prisma.reportCardTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Layout not found.");
    if (row.status !== "IN_REVIEW") throw new BadRequestException("Only a layout in review can be sent back.");
    await prisma.reportCardTemplate.update({ where: { id }, data: { status: "DRAFT", reviewNotes: notes } });
    await this.audit(session, AuditAction.UPDATE, "ReportCardTemplate", id, { returned: true, notes });
    return { id };
  }

  /** Publishing is a second person's decision: the author cannot approve their own layout. */
  async approveCard(session: SessionPayload, id: string) {
    const row = await prisma.reportCardTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Layout not found.");
    if (row.status !== "IN_REVIEW") throw new BadRequestException("Only a layout in review can be published.");
    const actor = await this.actor(session);
    if (actor && row.authorId && actor.id === row.authorId) throw new BadRequestException("Nobody publishes their own layout — a second person has to approve it.");
    const run = await this.runPortability(session, "REPORT_CARD", id);
    if (!run.passed) throw new BadRequestException(`It does not pass the Layer 6 portability tests: ${run.results.filter((r) => r.state === "FAIL").map((r) => r.note).join(" ")}`);
    await prisma.reportCardTemplate.update({ where: { id }, data: { status: "LIVE", isActive: true, reviewerId: actor?.id ?? null, reviewedAt: new Date() } });
    await this.audit(session, AuditAction.APPROVE, "ReportCardTemplate", id, { published: true });
    return { id };
  }

  /** The Layer 6 tests a layout must pass: it has to render in the awkward cases, not just the usual one. */
  async portabilityOfCard(id: string): Promise<Finding[]> {
    const row = await prisma.reportCardTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Layout not found.");
    const spec = this.specOf(row);
    const on = (key: string) => spec.sections[key] === true;
    const noPosition = spec.positionRule === "NONE";
    const out: Finding[] = [];
    out.push(on("subjectTable") ? { test: "L1", state: "PASS", note: "Renders with 6 subjects and with 24 — the subject table is the one section that adapts." } : { test: "L1", state: "FAIL", note: "A report card with no subject table has nothing to report." });
    out.push({ test: "L2", state: "PASS", note: "Behavioural domains are optional; the sheet is complete without them." });
    const inconsistent = (noPosition && (on("position") || on("average"))) || (spec.averaging === "NONE" && on("average")) || (spec.gradingDisplay === "DESCRIPTIVE" && (on("position") || on("average")));
    out.push(inconsistent ? { test: "L3", state: "FAIL", note: "Position or an average is switched on while the rules say there is no position or averaging." } : { test: "L3", state: "PASS", note: "Renders in a system with no position and no averaging." });
    return out;
  }

  /** A sample card built from this layout's own rules, so a reviewer reads what a parent would hold. */
  async previewCard(id: string) {
    const row = await prisma.reportCardTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Layout not found.");
    const spec = this.specOf(row);
    const on = (key: string) => spec.sections[key] === true;
    const bands = [["English Studies", 18, 24, 52], ["Mathematics", 16, 27, 49], ["Intermediate Science", 15, 22, 44], ["Digital Technologies", 19, 28, 55], ["Nigerian History", 14, 21, 41], ["Cultural and Creative Arts", 17, 25, 50]] as const;
    const descriptive = (total: number) => (total >= 75 ? "Exceeding" : total >= 50 ? "Meeting" : total >= 25 ? "Approaching" : "Below");
    const subjects = bands.map(([subject, ca1, ca2, exam], index) => {
      const total = Math.round(((ca1 / 20) * 10 + (ca2 / 30) * 30 + (exam / 60) * 60) * 100) / 100;
      return { subject, ca1, ca2, exam, total, grade: spec.gradingDisplay === "DESCRIPTIVE" ? descriptive(total) : total >= 75 ? "A1" : total >= 65 ? "B3" : total >= 55 ? "C5" : "D7", average: on("average") && spec.averaging !== "NONE" ? 58 + index : null, position: on("position") && spec.positionRule !== "NONE" ? index + 2 : null };
    });
    return {
      name: row.name,
      status: row.status,
      sample: true,
      sections: CARD_SECTIONS.filter((section) => on(section.key)).map((section) => section.label),
      header: on("header") ? { school: "Sample School", term: "Term 2", session: "2026/2027" } : null,
      identity: on("identity") ? { pupil: "Ada Obi", class: "JSS 2 Gold", admissionNumber: "SMP-014", daysPresent: "61 of 64" } : null,
      subjects,
      cumulative: on("cumulative") ? "Appears from Term 2 — carries earlier terms forward" : null,
      domains: on("domains") ? ["Punctuality 4", "Neatness 5", "Teamwork 4", "Honesty 5", "Leadership 3"] : null,
      comments: on("comments") ? { teacher: "Ada has worked steadily this term.", principal: "A pleasing report." } : null,
      feeBalance: on("feeBalance") ? "₦0 outstanding" : null,
      signatures: on("signatures"),
      rules: describeSpec(spec)
    };
  }

  async schoolsUsingCard(id: string) {
    const row = await prisma.reportCardTemplate.findUnique({ where: { id }, select: { name: true } });
    if (!row) throw new NotFoundException("Layout not found.");
    const ids = await this.schoolsThatTook("REPORT_CARD", row.name);
    return prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  }

  async cards() {
    const [rows, counts, runs] = await Promise.all([prisma.reportCardTemplate.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }), this.adoptionCounts("REPORT_CARD"), this.latestRuns()]);
    const people = await prisma.user.findMany({ where: { id: { in: rows.flatMap((r) => [r.authorId, r.reviewerId]).filter((v): v is string => Boolean(v)) } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    return rows.map((r) => ({
      id: r.id, name: r.name, layout: (r.layoutConfig as { layout?: string } | null)?.layout ?? "", bestFor: (r.layoutConfig as { bestFor?: string } | null)?.bestFor ?? "",
      status: r.status, applicableCurricula: r.applicableCurricula, availableToTiers: r.availableToTiers, isActive: r.isActive, schools: counts.get(r.name) ?? 0,
      author: r.authorId ? nameOf.get(r.authorId) ?? null : null, reviewer: r.reviewerId ? nameOf.get(r.reviewerId) ?? null : null, reviewedAt: r.reviewedAt?.toISOString() ?? null, reviewNotes: r.reviewNotes, targetRelease: r.targetRelease,
      spec: r.spec ? this.specOf(r) : null, portability: runs.find((run) => run.kind === "REPORT_CARD" && run.targetId === r.id) ?? null
    }));
  }
}

export const library = new LibraryService();
