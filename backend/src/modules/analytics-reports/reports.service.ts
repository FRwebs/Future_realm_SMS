import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName } from "../attendance-management/attendance.shared";
import { GovernanceService } from "../audit/governance.service";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { DATASETS, STANDARD, toCsv, type Sheet } from "./catalogue";
import { SCHEDULES } from "./schedule";

const MAX_ARCHIVE = 6_000_000;

const definitionSchema = z.object({
  name: z.string().trim().min(5, "Name the report so it can be found again."),
  dataset: z.string().refine((code) => DATASETS.some((dataset) => dataset.code === code), "Choose what it is built from."),
  groupBy: z.string().trim().optional(),
  filterColumn: z.string().trim().optional(),
  filterValue: z.string().trim().optional(),
  schedule: z.string().refine((value) => (SCHEDULES as readonly string[]).includes(value), "Choose when it runs.").default("On demand"),
});

export type Definition = z.infer<typeof definitionSchema> & { ownerId: string; owner: string; createdAt: string; lastRunAt?: string };

const who = (user: { firstName: string; lastName: string } | null | undefined) => (user ? `${user.firstName} ${user.lastName}`.trim() : null);

/** A saved definition is a dataset, narrowed and grouped: run it and the answer is a table of counts. */
function shape(sheet: Sheet, definition: Pick<Definition, "groupBy" | "filterColumn" | "filterValue">): Sheet {
  let rows = sheet.rows;
  if (definition.filterColumn && definition.filterValue) {
    const index = sheet.head.indexOf(definition.filterColumn);
    if (index >= 0) rows = rows.filter((row) => String(row[index] ?? "").toLowerCase().includes((definition.filterValue as string).toLowerCase()));
  }
  const group = definition.groupBy ? sheet.head.indexOf(definition.groupBy) : -1;
  if (group < 0) return { head: sheet.head, rows };
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(String(row[group] ?? "—") || "—", (counts.get(String(row[group] ?? "—") || "—") ?? 0) + 1);
  return { head: [definition.groupBy as string, "Count"], rows: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]) };
}

@Injectable()
export class ReportsService {
  constructor(private readonly governance: GovernanceService) {}

  private async record(session: SessionPayload, o: { kind: string; code: string; title: string; format: string; scope?: string; sheet: Sheet }) {
    const content = toCsv(o.sheet);
    const stored = content.length <= MAX_ARCHIVE ? content : null;
    const row = await prisma.generatedReport.create({ data: { schoolId: session.schoolId, kind: o.kind, code: o.code, title: o.title, format: o.format, scope: o.scope ?? null, rowCount: o.sheet.rows.length, sizeBytes: Buffer.byteLength(content), generatedById: session.userId, content: stored } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.EXPORT, entityType: "GeneratedReport", entityId: row.id, metadata: { summary: `${o.title} · ${o.sheet.rows.length} rows`, kind: o.kind, code: o.code } as never } });
    return { id: row.id, content, rows: o.sheet.rows.length };
  }

  /* ───────────────────────── the page ───────────────────────── */

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: { select: { startDate: true } } } });
    const since = term?.academicSession?.startDate ?? new Date(Date.now() - 180 * 86_400_000);
    const [runs, definitions, sessionRuns] = await Promise.all([
      prisma.generatedReport.findMany({ where: { schoolId, code: { not: null } }, orderBy: { generatedAt: "desc" }, take: 400, include: { generatedBy: { select: { firstName: true, lastName: true } } } }),
      new ConfigStore(schoolId, "report-definitions").list<Definition>(),
      prisma.generatedReport.count({ where: { schoolId, generatedAt: { gte: since } } }),
    ]);
    const last = (code: string) => runs.find((run) => run.code === code);
    const counts = await Promise.all(DATASETS.map((dataset) => dataset.count(schoolId)));
    return {
      kpis: { standard: STANDARD.length, custom: definitions.length, scheduled: definitions.filter((entry) => entry.data.schedule !== "On demand").length, datasets: DATASETS.length, exports: sessionRuns },
      standard: STANDARD.map((report) => { const run = last(`STANDARD:${report.code}`); return { code: report.code, name: report.name, answers: report.answers, covers: report.covers, lastAt: run?.generatedAt.toISOString() ?? null, lastBy: who(run?.generatedBy) }; }),
      definitions: definitions.map((entry) => { const run = last(`CUSTOM:${entry.code}`); return { ...entry.data, code: entry.code ?? entry.id, name: entry.name, datasetName: DATASETS.find((dataset) => dataset.code === entry.data.dataset)?.name ?? entry.data.dataset, lastAt: run?.generatedAt.toISOString() ?? null }; }),
      datasets: DATASETS.map((dataset, index) => { const run = last(`DATASET:${dataset.code}`); return { code: dataset.code, name: dataset.name, rows: counts[index], lastAt: run?.generatedAt.toISOString() ?? null, lastBy: who(run?.generatedBy) }; }),
      recent: runs.slice(0, 8).map((run) => ({ id: run.id, title: run.title, kind: run.kind, rows: run.rowCount, by: who(run.generatedBy), at: run.generatedAt.toISOString(), kept: Boolean(run.content) })),
      schedules: [...SCHEDULES],
      datasetOptions: DATASETS.map((dataset) => ({ code: dataset.code, name: dataset.name, columns: dataset.columns })),
    };
  }

  /* ───────────────────────── producing ───────────────────────── */

  async generate(session: SessionPayload, kind: string, code: string) {
    if (kind === "standard") {
      const report = STANDARD.find((entry) => entry.code === code);
      if (!report) throw new NotFoundException("That report is not one this school can generate.");
      return this.record(session, { kind: "STANDARD", code: `STANDARD:${code}`, title: report.name, format: "CSV", sheet: await report.run(session.schoolId) }).then((made) => ({ ...made, name: report.name }));
    }
    if (kind === "dataset") {
      const dataset = DATASETS.find((entry) => entry.code === code);
      if (!dataset) throw new NotFoundException("That dataset is not one this school can export.");
      return this.record(session, { kind: "DATASET", code: `DATASET:${code}`, title: dataset.name, format: "CSV", sheet: await dataset.run(session.schoolId) }).then((made) => ({ ...made, name: dataset.name }));
    }
    if (kind === "custom") {
      const store = new ConfigStore(session.schoolId, "report-definitions");
      const definition = await store.get<Definition>(code);
      if (!definition) throw new NotFoundException("That saved report does not exist.");
      const dataset = DATASETS.find((entry) => entry.code === definition.data.dataset);
      if (!dataset) throw new BadRequestException("The data this report was built from is no longer kept.");
      return this.record(session, { kind: "CUSTOM", code: `CUSTOM:${code}`, title: definition.name, format: "CSV", scope: definition.data.dataset, sheet: shape(await dataset.run(session.schoolId), definition.data) }).then((made) => ({ ...made, name: definition.name }));
    }
    throw new NotFoundException("That kind of document is not kept here.");
  }

  /** Producing from a form: the file is made and kept, and the person is handed the link to it. */
  async run(session: SessionPayload, body: unknown) {
    const input = z.object({ report: z.string().min(3, "Choose what to produce.") }).parse(body);
    const [kind, code] = input.report.split(":");
    const made = await this.generate(session, kind, code);
    return { href: `/api/v1/analytics-reports/reports/archive/${made.id}`, hrefLabel: "Download the file", fields: [["Produced", made.name], ["Rows", String(made.rows)], ["Kept", "Archived with your name and the time"]] };
  }

  /** Exactly what was produced, as it was produced — never rebuilt from today's data. */
  async archived(session: SessionPayload, id: string) {
    const row = await prisma.generatedReport.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row?.content) throw new NotFoundException("That copy was not kept.");
    return { name: row.title, content: row.content };
  }

  async columnsOf(session: SessionPayload, dataset: string) {
    const found = DATASETS.find((entry) => entry.code === dataset);
    if (!found) throw new NotFoundException("That dataset is not kept here.");
    return { columns: (await found.run(session.schoolId)).head };
  }

  async saveDefinition(session: SessionPayload, body: unknown) {
    const input = definitionSchema.parse(body);
    const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const code = `def-${Date.now().toString(36)}`;
    const data: Definition = { ...input, ownerId: session.userId, owner: who(actor) ?? "—", createdAt: new Date().toISOString() };
    await new ConfigStore(session.schoolId, "report-definitions").put(code, input.name, data);
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "ReportDefinition", entityId: code, metadata: { summary: `Saved report defined · ${input.name}` } as never } });
    return { code, fields: [["Report", input.name], ["Built from", DATASETS.find((dataset) => dataset.code === input.dataset)?.name ?? input.dataset], ["Runs", input.schedule], ["Where", "Under Custom reports — run it any time"]] };
  }

  async deleteDefinition(session: SessionPayload, code: string) {
    await new ConfigStore(session.schoolId, "report-definitions").remove(code);
    return { removed: true };
  }

  /* ───────────────────────── compliance ───────────────────────── */

  /** What a return is built from: each one reads live tables, and says so when what it needs is not kept. */
  private async returnSheet(schoolId: string, name: string): Promise<Sheet> {
    const standard = (code: string) => (STANDARD.find((entry) => entry.code === code) as (typeof STANDARD)[number]).run(schoolId);
    if (/census|enrolment/i.test(name)) return standard("enrolment-return");
    if (/qualification/i.test(name)) return standard("staff-list");
    if (/attendance/i.test(name)) {
      const marks = await prisma.studentAttendance.groupBy({ by: ["classId", "status"], where: { schoolId, subjectId: null }, _count: { _all: true } });
      const rooms = new Map((await prisma.classRoom.findMany({ where: { schoolId }, select: { id: true, name: true, arm: true } })).map((room) => [room.id, armName(room)]));
      const tally = new Map<string, { total: number; absent: number }>();
      for (const row of marks) { const entry = tally.get(row.classId) ?? { total: 0, absent: 0 }; entry.total += row._count._all; if (row.status === "ABSENT") entry.absent += row._count._all; tally.set(row.classId, entry); }
      return { head: ["Arm", "Marks taken", "Absences", "Attendance %"], rows: Array.from(tally.entries()).map(([id, entry]) => [rooms.get(id) ?? id, entry.total, entry.absent, entry.total ? Math.round(((entry.total - entry.absent) / entry.total) * 1000) / 10 : ""]) };
    }
    if (/examination/i.test(name)) {
      const students = await prisma.student.findMany({ where: { schoolId, status: "ACTIVE", currentClass: { name: { contains: "SSS 3" } } }, select: { admissionNumber: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, photoUrl: true, currentClass: { select: { name: true, arm: true } } } });
      return { head: ["Admission no", "Surname", "Given names", "Gender", "Date of birth", "Arm", "Photograph on file"], rows: students.map((row) => [row.admissionNumber, row.lastName, row.firstName, row.gender, row.dateOfBirth.toISOString().slice(0, 10), row.currentClass ? armName(row.currentClass) : "", row.photoUrl ? "Yes" : "No"]) };
    }
    if (/data protection/i.test(name)) return standard("consent-coverage");
    if (/financial/i.test(name)) {
      const [invoices, adjustments] = await Promise.all([prisma.invoice.aggregate({ where: { schoolId, status: { notIn: ["VOID", "DRAFT"] } }, _sum: { total: true, balance: true, discount: true }, _count: { _all: true } }), prisma.invoiceAdjustment.groupBy({ by: ["type"], where: { schoolId }, _sum: { amount: true } })]);
      const billed = Number(invoices._sum.total ?? 0);
      return { head: ["Line", "Amount"], rows: [["Invoices issued", invoices._count._all], ["Fees billed", billed], ["Fees collected", billed - Number(invoices._sum.balance ?? 0)], ["Fees outstanding", Number(invoices._sum.balance ?? 0)], ...adjustments.map((row) => [`Adjustments · ${row.type.toLowerCase()}`, Number(row._sum.amount ?? 0)])] };
    }
    // The safeguarding audit asks for checks this system does not keep: it says so on the file rather than inventing them.
    const staff = await standard("staff-list");
    return { head: [...staff.head, "Safeguarding check on file"], rows: staff.rows.map((row) => [...row, "Not recorded in this system"]) };
  }

  async compliance(session: SessionPayload) {
    const [base, archive] = await Promise.all([
      this.governance.complianceReturns(session),
      prisma.generatedReport.findMany({ where: { schoolId: session.schoolId, kind: "RETURN" }, orderBy: { generatedAt: "desc" }, take: 40, include: { generatedBy: { select: { firstName: true, lastName: true } } } }),
    ]);
    return { ...base, archive: archive.map((row) => ({ id: row.id, returnId: (row.code ?? "").replace("RETURN:", ""), title: row.title, rows: row.rowCount, by: who(row.generatedBy), at: row.generatedAt.toISOString(), kept: Boolean(row.content) })) };
  }

  /** The same, from the drawer: the copy is made and kept, and the person is handed the link to it. */
  async runReturn(session: SessionPayload, id: string) {
    const made = await this.generateReturn(session, id);
    return { href: `/api/v1/analytics-reports/reports/archive/${made.id}`, hrefLabel: "Download the file", fields: [["Produced", made.name], ["Rows", String(made.rows)], ["Kept", "Archived with your name and the time"]] };
  }

  async generateReturn(session: SessionPayload, id: string) {
    const row = await prisma.complianceReturn.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That return is not tracked for this school.");
    const { returns } = await this.governance.complianceReturns(session);
    const current = returns.find((item) => item.id === id);
    if (current && !current.ready) throw new BadRequestException(`This return cannot be produced yet — ${current.blocker}. Fix the records first.`);
    const made = await this.record(session, { kind: "RETURN", code: `RETURN:${id}`, title: `${row.name} · ${row.period}`, format: "CSV", scope: row.body, sheet: await this.returnSheet(session.schoolId, row.name) });
    if (row.status === "NOT_STARTED") await prisma.complianceReturn.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    return { ...made, name: row.name };
  }
}
