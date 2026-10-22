import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { readSpreadsheet, writeXlsx, type Cell } from "../../common/xlsx";

export const PLATFORM = "platform";
const HEADER = ["Curriculum", "Subject", "Stage", "Term", "Week", "Topic", "Sub-topics", "Assessment", "Source", "Book"] as const;
const PLATFORM_ROLES = new Set(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"]);
const SCHOOL_ROLES = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMINISTRATOR", "HEAD_OF_DEPARTMENT"]);

export type CatalogueTopic = { week: number; topic: string; subtopics: string[]; assessment: string | null };

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The term number a term name implies, or null when it names none ("Summer School"). */
export function termNumber(name: string): number | null {
  if (/first|1st|\b1\b/i.test(name)) return 1;
  if (/second|2nd|\b2\b/i.test(name)) return 2;
  if (/third|3rd|\b3\b/i.test(name)) return 3;
  return null;
}

const importSchema = z.object({ file: z.string().min(10, "Choose the file first."), name: z.string().optional() });

/**
 * The curriculum catalogue: a published curriculum's outline for each subject, stage and term, so a teacher begins a scheme of work
 * from the national topics instead of a blank page. The platform loads the catalogue for every school; a school may add its own.
 * Both load from the same Excel template. Nothing in the catalogue is ever invented here — it is exactly what was imported.
 */
@Injectable()
export class CurriculumCatalogueService {
  scopeOf(session: Pick<SessionPayload, "role" | "schoolId">, scope: "platform" | "school") {
    if (scope === "platform") {
      if (!PLATFORM_ROLES.has(session.role)) throw new ForbiddenException("Only the platform team loads the catalogue every school sees.");
      return { scopeKey: PLATFORM, schoolId: null as string | null };
    }
    if (!SCHOOL_ROLES.has(session.role)) throw new ForbiddenException("A curriculum is loaded by the school’s leadership or a head of department.");
    return { scopeKey: session.schoolId, schoolId: session.schoolId as string | null };
  }

  template() {
    const example: Cell[][] = [
      ["NERDC", "Mathematics", "JSS 1", 1, 1, "Whole numbers", "Counting in millions; Place value; Rounding off", "Class exercise", "The published curriculum this row comes from", ""],
      ["NERDC", "Mathematics", "JSS 1", 1, 2, "Fractions", "Equivalent fractions; Addition of fractions", "Quiz", "", ""],
    ];
    return { fileName: "curriculum-catalogue-template.xlsx", bytes: writeXlsx([[...HEADER], ...example], "Catalogue", [14, 24, 10, 7, 7, 30, 50, 16, 36, 24]) };
  }

  private decode(body: unknown) {
    const input = importSchema.parse(body);
    const base64 = input.file.includes(",") ? input.file.slice(input.file.indexOf(",") + 1) : input.file;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 6_000_000) throw new BadRequestException("That file is larger than 6 MB.");
    try {
      return readSpreadsheet(buffer);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "That file could not be read.");
    }
  }

  /** Reads the template into entries, and says what is wrong with it before anything is written. */
  private analyse(body: unknown) {
    const grid = this.decode(body);
    const headerAt = grid.findIndex((row) => row.some((cell) => /^curriculum$/i.test(String(cell ?? "").trim())));
    if (headerAt < 0) throw new BadRequestException("The first row must carry the template’s headings — Curriculum, Subject, Stage, Term, Week, Topic… Download the template.");
    const heads = grid[headerAt]!.map((cell) => String(cell ?? "").trim().toLowerCase());
    const at = (label: string) => heads.findIndex((head) => head === label.toLowerCase());
    const col = Object.fromEntries(HEADER.map((label) => [label, at(label)])) as Record<(typeof HEADER)[number], number>;
    for (const label of ["Curriculum", "Subject", "Stage", "Term", "Topic"] as const) if (col[label] < 0) throw new BadRequestException(`The template needs a “${label}” column.`);
    const entries = new Map<string, { curriculum: string; subject: string; stage: string; term: number; source: string | null; book: string | null; topics: CatalogueTopic[] }>();
    const problems: string[] = [];
    grid.slice(headerAt + 1).forEach((line, index) => {
      const get = (label: (typeof HEADER)[number]) => (col[label] >= 0 ? String(line[col[label]] ?? "").trim() : "");
      if (!line.some((cell) => cell !== null && String(cell).trim() !== "")) return;
      const row = headerAt + index + 2;
      const term = Number(get("Term"));
      const topic = get("Topic");
      const curriculum = get("Curriculum");
      const subject = get("Subject");
      const stage = get("Stage");
      if (!curriculum || !subject || !stage || !topic) { problems.push(`Row ${row}: curriculum, subject, stage and topic are all needed.`); return; }
      if (![1, 2, 3].includes(term)) { problems.push(`Row ${row}: Term must be 1, 2 or 3.`); return; }
      const key = [curriculum, subject, stage, term].map((part) => String(part).toLowerCase()).join("|");
      const entry = entries.get(key) ?? { curriculum, subject, stage, term, source: null, book: null, topics: [] };
      const week = get("Week") ? Number(get("Week")) : entry.topics.length + 1;
      if (!Number.isInteger(week) || week < 1 || week > 20) { problems.push(`Row ${row}: Week must be a whole number from 1 to 20.`); return; }
      if (entry.topics.some((existing) => existing.week === week)) { problems.push(`Row ${row}: week ${week} appears twice for ${subject} ${stage} term ${term}.`); return; }
      entry.topics.push({ week, topic, subtopics: get("Sub-topics").split(/[;\n]/).map((part) => part.trim()).filter(Boolean), assessment: get("Assessment") || null });
      entry.source = entry.source ?? (get("Source") || null);
      entry.book = entry.book ?? (get("Book") || null);
      entries.set(key, entry);
    });
    for (const entry of entries.values()) entry.topics.sort((a, b) => a.week - b.week);
    return { entries: [...entries.values()], problems };
  }

  async preview(session: SessionPayload, scope: "platform" | "school", body: unknown) {
    const target = this.scopeOf(session, scope);
    const { entries, problems } = this.analyse(body);
    const existing = await prisma.curriculumCatalogueEntry.findMany({ where: { scopeKey: target.scopeKey }, select: { curriculum: true, subject: true, stage: true, term: true } });
    const has = new Set(existing.map((row) => [row.curriculum, row.subject, row.stage, row.term].map((part) => String(part).toLowerCase()).join("|")));
    return {
      entries: entries.slice(0, 60).map((entry) => ({ curriculum: entry.curriculum, subject: entry.subject, stage: entry.stage, term: entry.term, topics: entry.topics.length, replaces: has.has([entry.curriculum, entry.subject, entry.stage, entry.term].map((part) => String(part).toLowerCase()).join("|")) })),
      entryCount: entries.length, topicCount: entries.reduce((sum, entry) => sum + entry.topics.length, 0), replaceCount: entries.filter((entry) => has.has([entry.curriculum, entry.subject, entry.stage, entry.term].map((part) => String(part).toLowerCase()).join("|"))).length,
      problems: problems.slice(0, 30), problemCount: problems.length, canApply: problems.length === 0 && entries.length > 0
    };
  }

  async apply(session: SessionPayload, scope: "platform" | "school", body: unknown) {
    const target = this.scopeOf(session, scope);
    const { entries, problems } = this.analyse(body);
    if (problems.length) throw new BadRequestException(`${problems.length} row${problems.length === 1 ? "" : "s"} cannot be imported. Fix the file and preview it again — nothing was written.`);
    if (!entries.length) throw new BadRequestException("The file has no topics in it.");
    for (const entry of entries) {
      const data = { schoolId: target.schoolId, source: entry.source, book: entry.book, topics: entry.topics as unknown as object, importedById: session.userId };
      await prisma.curriculumCatalogueEntry.upsert({
        where: { scopeKey_curriculum_subject_stage_term: { scopeKey: target.scopeKey, curriculum: entry.curriculum, subject: entry.subject, stage: entry.stage, term: entry.term } },
        update: data, create: { ...data, scopeKey: target.scopeKey, curriculum: entry.curriculum, subject: entry.subject, stage: entry.stage, term: entry.term }
      });
    }
    await prisma.auditLog.create({ data: { schoolId: target.schoolId ?? session.schoolId ?? null, actorId: session.userId, action: AuditAction.CREATE, entityType: "CurriculumCatalogue", entityId: target.scopeKey, metadata: { summary: `Curriculum catalogue imported · ${entries.length} outlines`, scope, topics: entries.reduce((sum, entry) => sum + entry.topics.length, 0) } } });
    return { entries: entries.length, topics: entries.reduce((sum, entry) => sum + entry.topics.length, 0) };
  }

  async list(schoolId: string | null, scope: "platform" | "school" | "both" = "both") {
    const keys = scope === "platform" ? [PLATFORM] : scope === "school" ? [schoolId ?? "-"] : [PLATFORM, ...(schoolId ? [schoolId] : [])];
    const rows = await prisma.curriculumCatalogueEntry.findMany({ where: { scopeKey: { in: keys } }, orderBy: [{ curriculum: "asc" }, { subject: "asc" }, { stage: "asc" }, { term: "asc" }], take: 2000 });
    return rows.map((row) => ({ id: row.id, curriculum: row.curriculum, subject: row.subject, stage: row.stage, term: row.term, source: row.source, book: row.book, topics: (row.topics as unknown as CatalogueTopic[]).length, own: row.scopeKey !== PLATFORM, updatedAt: row.updatedAt.toISOString() }));
  }

  async remove(session: SessionPayload, scope: "platform" | "school", id: string) {
    const target = this.scopeOf(session, scope);
    const row = await prisma.curriculumCatalogueEntry.findFirst({ where: { id, scopeKey: target.scopeKey } });
    if (!row) throw new BadRequestException("That outline is not in this catalogue.");
    await prisma.curriculumCatalogueEntry.delete({ where: { id } });
    return { id };
  }

  /** The outlines a teacher could start this subject from: same subject, same stage as one of its arms, same term — platform and the school's own. */
  async matching(schoolId: string, subjectName: string, stages: string[], term: number | null) {
    if (!term) return [];
    const wanted = norm(subjectName);
    const stageSet = new Set(stages.map(norm));
    const rows = await prisma.curriculumCatalogueEntry.findMany({ where: { scopeKey: { in: [PLATFORM, schoolId] }, term }, take: 500 });
    return rows
      .filter((row) => stageSet.has(norm(row.stage)) && (norm(row.subject) === wanted || norm(row.subject).includes(wanted) || wanted.includes(norm(row.subject))))
      .map((row) => ({ id: row.id, curriculum: row.curriculum, subject: row.subject, stage: row.stage, term: row.term, source: row.source, book: row.book, own: row.scopeKey !== PLATFORM, topics: row.topics as unknown as CatalogueTopic[] }));
  }

  async entry(schoolId: string, id: string) {
    const row = await prisma.curriculumCatalogueEntry.findFirst({ where: { id, scopeKey: { in: [PLATFORM, schoolId] } } });
    return row ? { ...row, topics: row.topics as unknown as CatalogueTopic[] } : null;
  }
}
