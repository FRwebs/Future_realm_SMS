import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { checkBands, type Band } from "../config-library/templates.service";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { ConfigurationService } from "./configuration.service";

import { type AdoptedLayout, REPORT_LAYOUT } from "./report-layout";

const adoptSchema = z.object({
  curriculumId: z.string().trim().min(1, "Choose a curriculum."),
  /** A scale from the library, or "keep" to leave the school's own grading as it is. */
  gradingScaleId: z.string().trim().default("keep"),
  frameworkId: z.string().trim().default("keep"),
  /** A layout from the library, or "none" to leave the school's report cards as they are. */
  layoutId: z.string().trim().default("none"),
  addSubjects: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  /** NEXT_TERM and NOW put it in force; DRAFT keeps it as the school's own draft to look over first. */
  effectiveFrom: z.enum(["NEXT_TERM", "NOW", "DRAFT"]).default("NEXT_TERM")
});

const slug = (value: string) => value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();

type Component = { name: string; max: number; weight: number };
type BandRow = { grade: string; lo: number; hi: number; label: string; points: number };

@Injectable()
export class LibraryAdoptionService {
  constructor(private readonly configuration: ConfigurationService) {}

  private async school(schoolId: string) {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, country: true } });
    if (!school) throw new BadRequestException("This school could not be found.");
    return school;
  }

  private async tierOf(schoolId: string): Promise<string> {
    const subscription = await prisma.schoolSubscription.findUnique({ where: { schoolId }, select: { tier: true } });
    return subscription?.tier ?? "STANDARD";
  }

  /** Bands the way a school's own curriculum record keeps them. */
  private toBands(bands: Band[]): BandRow[] {
    return [...bands].sort((a, b) => b.min - a.min).map((band, index) => ({ grade: band.grade, lo: band.min, hi: band.max, label: band.remark || band.grade, points: index + 1 }));
  }

  /** What this school can adopt from the platform library, for its own country. */
  async available(session: SessionPayload) {
    await this.configuration.assertPermission(session, "curricula", "view");
    const school = await this.school(session.schoolId);
    const tier = await this.tierOf(school.id);
    const [profile, curricula, scales, frameworks, layouts, adoptions, inForce, scored, records] = await Promise.all([
      prisma.countryProfile.findUnique({ where: { country: school.country } }),
      prisma.curriculumTemplate.findMany({ where: { country: { equals: school.country, mode: "insensitive" }, lifecycle: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
      prisma.gradingScaleTemplate.findMany({ where: { lifecycle: "ACTIVE" }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
      prisma.assessmentFrameworkTemplate.findMany({ where: { isActive: true, isCustom: false }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
      prisma.reportCardTemplate.findMany({ where: { status: "LIVE", isActive: true }, orderBy: { createdAt: "asc" } }),
      prisma.templateAdoption.findMany({ where: { schoolId: school.id }, orderBy: { adoptedAt: "desc" } }),
      prisma.configurationItem.findFirst({ where: { schoolId: school.id, resource: "curricula", status: "ACTIVE", deletedAt: null }, select: { id: true, name: true } }),
      prisma.scoreEntry.count({ where: { schoolId: school.id, isDraft: false } }),
      prisma.configurationItem.findMany({ where: { schoolId: school.id, resource: "curricula", deletedAt: null }, select: { id: true, name: true, status: true, data: true } })
    ]);

    const adoptedLayout = await new ConfigStore(school.id, REPORT_LAYOUT.resource).get<AdoptedLayout>(REPORT_LAYOUT.code);
    const mine = new Map(records.map((record) => [record.id, record]));

    return {
      country: school.country,
      countryKnown: Boolean(profile),
      tier,
      hasScores: scored > 0,
      inForce: inForce ? { id: inForce.id, name: inForce.name } : null,
      layoutInUse: adoptedLayout ? { name: adoptedLayout.data.name, version: adoptedLayout.data.version } : null,
      curricula: curricula.map((c) => {
        const layers = (c.layers ?? {}) as { characteristics?: string; market?: string; structure?: Array<{ layer: string; holds: string; detail: string }>; assessment?: { components?: Component[] }; default?: boolean };
        const named = scales.filter((s) => s.applicableCurricula.includes(c.name));
        const open = scales.filter((s) => s.applicableCurricula.length === 0);
        const taken = adoptions.filter((a) => a.kind === "CURRICULUM" && a.templateName === c.name);
        const latest = taken[0];
        const record = latest ? Array.from(mine.values()).find((r) => ((r.data ?? {}) as { source?: { templateId?: string; version?: string } }).source?.templateId === latest.templateId && ((r.data ?? {}) as { source?: { version?: string } }).source?.version === latest.version) : undefined;
        const templateWeights = (layers.assessment?.components ?? []).map((component) => component.weight).join("/");
        return {
          id: c.id,
          name: c.name,
          version: c.version,
          market: layers.market ?? c.country,
          characteristics: layers.characteristics ?? `${c.subjects.length} subjects · ${c.calendarType.replaceAll("_", " ").toLowerCase()}`,
          isDefault: Boolean(layers.default),
          language: c.language,
          calendar: c.calendarType,
          subjectCount: c.subjects.length,
          structure: layers.structure ?? [],
          scales: [...named, ...open].map((s) => ({ id: s.id, name: s.name, version: s.version, isDefault: s.isDefault, passMark: s.passMark, bands: (s.gradeBands as unknown as Band[]).map((b) => `${b.grade} ${b.min}–${b.max}`).join(" · "), recommended: named.some((n) => n.id === s.id) })),
          frameworks: frameworks.map((f) => {
            const components = f.components as unknown as Component[];
            return { id: f.id, name: f.name, components: components.map((x) => `${x.name} ${x.weight}`).join(" / "), recommended: components.map((x) => x.weight).join("/") === templateWeights };
          }),
          adopted: latest ? { version: latest.version, at: latest.adoptedAt.toISOString(), recordId: record?.id ?? null, inForce: record ? record.status === "ACTIVE" : false } : null,
          newerVersion: Boolean(latest && latest.version !== c.version)
        };
      }),
      layouts: layouts.map((l) => {
        const tiers = l.availableToTiers;
        return { id: l.id, name: l.name, version: l.version, bestFor: (l.layoutConfig as { bestFor?: string } | null)?.bestFor ?? "", rules: (l.layoutConfig as { layout?: string } | null)?.layout ?? "", locked: tiers.length > 0 && !tiers.includes(tier), availableTo: tiers.length === 0 || tiers.length >= 3 ? "All plans" : `${tiers.map((t) => t.charAt(0) + t.slice(1).toLowerCase()).join(" and ")} only`, current: adoptedLayout?.data.layoutId === l.id };
      })
    };
  }

  /**
   * Takes a library curriculum into this school as a record of its own.
   *
   * The school gets a copy it owns: edit it, keep it as a draft, or put it in force. A later change to the master never reaches the
   * copy; the library only tells the owner that a newer version exists. Nothing live changes until it is put in force, and that step
   * keeps the existing rule — never swapped under scores already entered this term.
   */
  async adopt(session: SessionPayload, body: unknown) {
    await this.configuration.assertPermission(session, "curricula", "manage");
    const input = adoptSchema.parse(body);
    const school = await this.school(session.schoolId);
    const tier = await this.tierOf(school.id);

    const template = await prisma.curriculumTemplate.findUnique({ where: { id: input.curriculumId } });
    if (!template || template.lifecycle !== "ACTIVE") throw new BadRequestException("That curriculum is not published in the library.");
    if (template.country.toLowerCase() !== school.country.toLowerCase()) throw new BadRequestException(`That curriculum is for ${template.country}. The library offers ${school.country} schools the curricula published for ${school.country}.`);
    const already = await prisma.templateAdoption.findFirst({ where: { schoolId: school.id, kind: "CURRICULUM", templateName: template.name, version: template.version } });
    if (already) {
      const existing = await prisma.configurationItem.findFirst({ where: { schoolId: school.id, resource: "curricula", deletedAt: null, data: { path: ["source", "templateId"], equals: template.id } } });
      if (existing) throw new BadRequestException(`${template.name} ${template.version} is already in this school’s curricula — open it there instead of adopting it again.`);
    }

    // The grading scale.
    let scale: Awaited<ReturnType<typeof prisma.gradingScaleTemplate.findUnique>> = null;
    let bands: BandRow[];
    if (input.gradingScaleId === "keep") {
      const current = await prisma.gradingScheme.findFirst({ where: { schoolId: school.id, isActive: true }, include: { bands: { orderBy: { minScore: "desc" } } } });
      if (!current?.bands.length) throw new BadRequestException("This school has no grading scale of its own to keep, so choose one from the library.");
      bands = current.bands.map((band, index) => ({ grade: band.label, lo: band.minScore, hi: band.maxScore, label: band.remark || band.label, points: index + 1 }));
    } else {
      scale = await prisma.gradingScaleTemplate.findUnique({ where: { id: input.gradingScaleId } });
      if (!scale || scale.lifecycle !== "ACTIVE") throw new BadRequestException("That grading scale is not published in the library.");
      const problems = checkBands(scale.gradeBands as unknown as Band[], scale.passMark);
      if (problems.length) throw new BadRequestException(`${scale.name} does not check out and cannot be adopted: ${problems.join(" ")}`);
      bands = this.toBands(scale.gradeBands as unknown as Band[]);
    }

    // The assessment components.
    let framework: Awaited<ReturnType<typeof prisma.assessmentFrameworkTemplate.findUnique>> = null;
    let components: Component[];
    if (input.frameworkId === "keep") {
      const current = await prisma.sectionAssessmentComponent.findMany({ where: { schoolId: school.id, isActive: true }, orderBy: [{ section: "asc" }, { order: "asc" }] });
      const first = current[0]?.section;
      components = current.filter((row) => row.section === first).map((row) => ({ name: row.name, max: row.maxScore, weight: row.weight }));
      if (!components.length) components = ((template.layers as { assessment?: { components?: Component[] } } | null)?.assessment?.components ?? []).map((c) => ({ name: c.name, max: c.max, weight: c.weight }));
      if (!components.length) throw new BadRequestException("This school has no assessment components to keep, so choose a framework from the library.");
    } else {
      framework = await prisma.assessmentFrameworkTemplate.findUnique({ where: { id: input.frameworkId } });
      if (!framework || !framework.isActive || framework.isCustom) throw new BadRequestException("That assessment framework is not offered.");
      components = (framework.components as unknown as Array<{ name: string; max: number; weight: number }>).map((c) => ({ name: c.name, max: c.max, weight: c.weight }));
    }
    const total = Number(components.reduce((sum, c) => sum + c.weight, 0).toFixed(2));
    if (Math.abs(total - 100) > 0.01) throw new BadRequestException(`The assessment weights total ${total}, not 100.`);

    // The report card layout.
    let layout: Awaited<ReturnType<typeof prisma.reportCardTemplate.findUnique>> = null;
    if (input.layoutId !== "none") {
      layout = await prisma.reportCardTemplate.findUnique({ where: { id: input.layoutId } });
      if (!layout || layout.status !== "LIVE" || !layout.isActive) throw new BadRequestException("That report card layout is not published in the library.");
      if (layout.availableToTiers.length && !layout.availableToTiers.includes(tier)) throw new BadRequestException(`${layout.name} is not part of this school’s plan.`);
    }

    // Its own name: never collides with something the school already built.
    let name = template.name;
    if (await prisma.configurationItem.findFirst({ where: { schoolId: school.id, resource: "curricula", name } })) name = `${template.name} · v${template.version}`;
    let code = slug(name).slice(0, 24);
    for (let n = 2; await prisma.configurationItem.findFirst({ where: { schoolId: school.id, resource: "curricula", code } }); n += 1) code = `${slug(name).slice(0, 20)}-${n}`;

    const layers = (template.layers ?? {}) as { characteristics?: string; structure?: Array<{ layer: string; holds: string; detail: string }> };
    const subjectsText = template.subjects.join("\n");
    const adoptedAt = new Date().toISOString();
    const data = {
      identity: { "Curriculum name": name, "Region or awarding basis": template.country, "Language of instruction": template.language ?? "", "Short description": layers.characteristics ?? "" },
      levels: Object.fromEntries((layers.structure ?? []).filter((row) => row.layer.startsWith("2")).map((row) => ["Stages operated", row.holds])),
      subjects: { "Subject catalogue": subjectsText },
      report: { "Layout": layout?.name ?? "The school’s own" },
      rollout: { "Put it in force": input.effectiveFrom === "DRAFT" ? "Not yet — save as a draft" : input.effectiveFrom === "NOW" ? "Now" : "From next term" },
      assessment: { components, weightTotal: total },
      grading: { bands, contiguous: true },
      sectionsComplete: 7,
      builtAt: adoptedAt,
      source: {
        origin: "LIBRARY",
        templateId: template.id,
        templateName: template.name,
        version: template.version,
        gradingScale: scale ? { id: scale.id, name: scale.name, version: scale.version } : null,
        framework: framework ? { id: framework.id, name: framework.name } : null,
        layout: layout ? { id: layout.id, name: layout.name, version: layout.version } : null,
        adoptedAt
      }
    };

    const record = await prisma.configurationItem.create({ data: { schoolId: school.id, resource: "curricula", name, code, description: layers.characteristics ?? null, status: "INACTIVE", data: data as unknown as Prisma.InputJsonValue } });

    // Subjects the school does not already teach.
    let subjectsAdded = 0;
    if (input.addSubjects) {
      const have = new Set((await prisma.subject.findMany({ where: { schoolId: school.id, deletedAt: null }, select: { name: true } })).map((s) => s.name.trim().toLowerCase()));
      const usedCodes = new Set((await prisma.subject.findMany({ where: { schoolId: school.id }, select: { code: true } })).map((s) => s.code));
      const core = new Set(((template.layers as { junior?: { subjects?: Array<{ name: string; category: string }> } } | null)?.junior?.subjects ?? []).filter((s) => s.category === "Core").map((s) => s.name.toLowerCase()));
      for (const subjectName of template.subjects) {
        if (have.has(subjectName.trim().toLowerCase())) continue;
        let subjectCode = slug(subjectName).replace(/-/g, "").slice(0, 6) || "SUBJ";
        for (let n = 2; usedCodes.has(subjectCode); n += 1) subjectCode = `${slug(subjectName).replace(/-/g, "").slice(0, 5)}${n}`;
        usedCodes.add(subjectCode);
        await prisma.subject.create({ data: { schoolId: school.id, name: subjectName.trim(), code: subjectCode, isCore: core.has(subjectName.toLowerCase()), description: `Added from the ${template.name} library curriculum.` } });
        subjectsAdded += 1;
      }
    }

    // A layout is the school's choice of how its report cards read; the report card reads it from here.
    if (layout) {
      await new ConfigStore(school.id, REPORT_LAYOUT.resource).put(REPORT_LAYOUT.code, layout.name, { layoutId: layout.id, name: layout.name, version: layout.version, adoptedAt, spec: (layout.spec ?? {}) as AdoptedLayout["spec"] } satisfies AdoptedLayout);
    }

    await prisma.templateAdoption.createMany({
      data: [
        { schoolId: school.id, kind: "CURRICULUM", templateId: template.id, templateName: template.name, version: template.version },
        ...(scale ? [{ schoolId: school.id, kind: "GRADING", templateId: scale.id, templateName: scale.name, version: scale.version }] : []),
        ...(framework ? [{ schoolId: school.id, kind: "ASSESSMENT", templateId: framework.id, templateName: framework.name, version: "1" }] : []),
        ...(layout ? [{ schoolId: school.id, kind: "REPORT_CARD", templateId: layout.id, templateName: layout.name, version: String(layout.version) }] : [])
      ]
    });
    await prisma.auditLog.create({ data: { schoolId: school.id, actorId: session.userId, action: AuditAction.CREATE, entityType: "ConfigurationItem", entityId: record.id, metadata: { adoptedFromLibrary: template.name, version: template.version, scale: scale?.name ?? "kept", framework: framework?.name ?? "kept", layout: layout?.name ?? "none", subjectsAdded } } });

    let applied = false;
    let reason: string | null = null;
    if (input.effectiveFrom !== "DRAFT") {
      try {
        await this.configuration.applyCurriculum(session, record.id, { effectiveFrom: input.effectiveFrom });
        applied = true;
      } catch (error) {
        reason = error instanceof Error ? error.message : "It could not be put in force.";
      }
    }

    return { recordId: record.id, name, applied, reason, subjectsAdded, effectiveFrom: input.effectiveFrom, layout: layout?.name ?? null };
  }
}
