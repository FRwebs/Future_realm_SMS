import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { isPlatformRole } from "../../../../src/lib/navigation/registry";
import { isSchoolStaffRole } from "../../../../src/lib/modules/school-access";
import { LEAVE_TYPE_DEFAULTS, PAYROLL_SETUP_DEFAULT, type BandAllowance, type BandStep, type LeaveTypePolicy, type PayrollSetup } from "../../../../src/lib/modules/staff-policy";
import { ClassStructureService } from "../class-structure/class-structure.service";
import { FlowsService } from "./flows.service";
import { fullName, store, templateName } from "./staff-access.shared";

/**
 * Pay: one structure, and every person mapped into it.
 *
 * A person is paid a band and a step — never a typed figure. The gross comes from the rung, the
 * allowances from the band, the proration from the leave register and the deductions from the
 * school's statutory profile. Everything on this service is computed from those, so two people
 * in the same job cannot be on different money by accident.
 */

const naira = (value: number) => Math.round(value);

export type BandRecord = {
  id: string;
  code: string;
  name: string;
  covers: string;
  coversGroup: string;
  steps: BandStep[];
  allowances: BandAllowance[];
  employerPension: number;
  nextReview: string | null;
  isOpen: boolean;
};

export type PayLine = {
  gross: number;
  allowances: Array<{ name: string; amount: number; treat: string; inPay: boolean }>;
  allowTotal: number;
  employerCost: number;
  taxable: number;
  paye: number;
  pension: number;
  nhf: number;
  deductions: number;
  net: number;
  prorate: number;
  unpaidDays: number;
};

type PersonFacts = { roleCode: UserRole; formClass: boolean; periods: number; startsThisMonth: Date | null };

const STATUS_FOR: Record<string, string> = {
  Paid: "PAID",
  "Awaiting approval": "AWAITING_APPROVAL",
  Approved: "APPROVED",
  Held: "HELD",
  "Returned to draft": "DRAFT"
};
const LABEL_FOR: Record<string, string> = { PAID: "Paid", AWAITING_APPROVAL: "Awaiting approval", APPROVED: "Approved", HELD: "Held", DRAFT: "Draft" };

const POST_HOLDERS = new Set<UserRole>(["HEAD_OF_DEPARTMENT", "EXAM_OFFICER", "PRINCIPAL", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION"] as UserRole[]);
const BOARDING = new Set<UserRole>(["HOSTEL_MASTER", "HOSTEL_MISTRESS"] as unknown as UserRole[]);

const bandSchema = z.object({
  name: z.string().trim().min(2, "Name the band."),
  code: z.string().trim().min(1, "Give it a short code.").max(8),
  coversGroup: z.string().default("Other"),
  covers: z.string().trim().min(2, "Say which roles sit on it."),
  stepCount: z.coerce.number().int().min(1).max(12).default(5),
  bottom: z.coerce.number().min(1, "Enter the bottom step's monthly gross."),
  shape: z.string().default("Even · 8% a step"),
  naming: z.string().default("Step 1 to Step N"),
  allowances: z.array(z.object({ name: z.string().trim().default(""), who: z.string().default("Everyone on the band"), basis: z.string().default("Flat monthly"), rate: z.coerce.number().default(0), treat: z.string().default("Taxable") })).default([]),
  employerPension: z.coerce.number().min(0).max(30).default(10),
  nextReview: z.string().optional(),
  isOpen: z.coerce.boolean().default(true)
});

@Injectable()
export class PayrollService {
  constructor(
    private readonly structure: ClassStructureService,
    private readonly flows: FlowsService
  ) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── the setup ───────────────────────── */

  async setup(schoolId: string): Promise<PayrollSetup> {
    const saved = await store(schoolId, "payroll-setup").get<Partial<PayrollSetup>>("setup");
    return { ...PAYROLL_SETUP_DEFAULT, ...(saved?.data ?? {}) };
  }

  async saveSetup(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        currency: z.string(),
        profile: z.string(),
        cycle: z.string(),
        payDate: z.string(),
        cutoff: z.string(),
        approver: z.string(),
        payslips: z.string(),
        visibleTo: z.array(z.string()).default([]),
        roundNet: z.coerce.boolean().default(false),
        holdFinal: z.coerce.boolean().default(true)
      })
      .parse(body);
    const current = await this.setup(session.schoolId);
    const next = { ...current, ...input };
    await store(session.schoolId, "payroll-setup").put("setup", "Payroll setup", next);
    await this.audit(session, AuditAction.UPDATE, "PayrollSetup", "setup", { summary: "Payroll setup saved", profile: next.profile });
    return next;
  }

  /** Who may see amounts: the school's own list, never everyone with the tab. */
  private canSeeAmounts(session: SessionPayload, setup: PayrollSetup): boolean {
    if (isPlatformRole(session.role as never)) return true;
    return setup.visibleTo.includes(templateName(session.role as UserRole)) || session.role === "SCHOOL_OWNER" || session.role === "PROPRIETOR";
  }

  /* ───────────────────────── bands ───────────────────────── */

  private toBand(row: { id: string; code: string; name: string; covers: string; coversGroup: string; steps: Prisma.JsonValue; allowances: Prisma.JsonValue; employerPension: number; nextReview: Date | null; isOpen: boolean }): BandRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      covers: row.covers,
      coversGroup: row.coversGroup,
      steps: (row.steps as unknown as BandStep[]) ?? [],
      allowances: (row.allowances as unknown as BandAllowance[]) ?? [],
      employerPension: row.employerPension,
      nextReview: row.nextReview?.toISOString() ?? null,
      isOpen: row.isOpen
    };
  }

  private ladder(input: z.infer<typeof bandSchema>): BandStep[] {
    const rate = /12%/.test(input.shape) ? 0.12 : /15%/.test(input.shape) ? 0.15 : /Flat/.test(input.shape) ? 0 : 0.08;
    const names = (index: number) =>
      /Probation/.test(input.naming) ? (index === 0 ? "Probation" : `Step ${index}`) : /Entry/.test(input.naming) ? ["Entry", "Confirmed", "Senior", "Lead"][index] ?? `Step ${index + 1}` : `Step ${index + 1}`;
    return Array.from({ length: input.stepCount }, (_, index) => ({ name: names(index), gross: naira(input.bottom * Math.pow(1 + rate, index)) }));
  }

  async createBand(session: SessionPayload, body: unknown) {
    const input = bandSchema.parse(body);
    if (await prisma.payBand.findFirst({ where: { schoolId: session.schoolId, code: input.code } })) throw new BadRequestException(`A band called ${input.code} already exists.`);
    const created = await prisma.payBand.create({
      data: {
        schoolId: session.schoolId,
        code: input.code,
        name: input.name,
        covers: input.covers,
        coversGroup: input.coversGroup,
        steps: this.ladder(input) as unknown as Prisma.InputJsonValue,
        allowances: input.allowances.filter((item) => item.name) as unknown as Prisma.InputJsonValue,
        employerPension: input.employerPension,
        nextReview: input.nextReview ? new Date(input.nextReview) : null,
        isOpen: input.isOpen
      }
    });
    await this.audit(session, AuditAction.CREATE, "PayBand", created.id, { summary: `Pay band created · ${input.code} · ${input.name}` });
    return { id: created.id };
  }

  async updateBand(session: SessionPayload, id: string, body: unknown) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const input = bandSchema.parse(body);
    const clash = await prisma.payBand.findFirst({ where: { schoolId: session.schoolId, code: input.code, id: { not: id } } });
    if (clash) throw new BadRequestException(`A band called ${input.code} already exists.`);
    // The ladder is rebuilt from the shape only when somebody asked for a shape; otherwise the rungs a school typed stay as typed.
    const rebuild = input.shape !== "I will set each step myself";
    const steps = rebuild ? this.ladder(input) : band.steps;
    await prisma.payBand.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        covers: input.covers,
        coversGroup: input.coversGroup,
        steps: steps as unknown as Prisma.InputJsonValue,
        allowances: input.allowances.filter((item) => item.name) as unknown as Prisma.InputJsonValue,
        employerPension: input.employerPension,
        nextReview: input.nextReview ? new Date(input.nextReview) : null,
        isOpen: input.isOpen
      }
    });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `Pay band changed · ${input.code}` });
    return { id };
  }

  async saveLadder(session: SessionPayload, id: string, body: unknown) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const input = z.object({ rows: z.array(z.object({ id: z.string().optional(), values: z.record(z.string(), z.string()) })) }).parse(body);
    const steps = input.rows.map((row, index) => ({
      name: (row.values.name ?? "").trim() || band.steps[index]?.name || `Step ${index + 1}`,
      gross: naira(Number(String(row.values.gross ?? "0").replace(/[^0-9.]/g, "")))
    }));
    steps.forEach((step, index) => {
      if (!step.gross) throw new BadRequestException(`${step.name} needs a monthly gross.`);
      if (index > 0 && step.gross < steps[index - 1].gross) throw new BadRequestException(`${step.name} pays less than the rung below it.`);
    });
    await prisma.payBand.update({ where: { id }, data: { steps: steps as unknown as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `Ladder changed · ${band.code}` });
    return { id };
  }

  async addStep(session: SessionPayload, id: string, body: unknown) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const input = z.object({ name: z.string().trim().optional(), gross: z.coerce.number().min(1, "Give the new rung a monthly gross.") }).parse(body);
    const top = band.steps[band.steps.length - 1]?.gross ?? 0;
    if (input.gross < top) throw new BadRequestException("A rung must never pay less than the one below it.");
    const steps = [...band.steps, { name: input.name || `Step ${band.steps.length + 1}`, gross: naira(input.gross) }];
    await prisma.payBand.update({ where: { id }, data: { steps: steps as unknown as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `Rung added · ${band.code}` });
    return { id };
  }

  async saveAllowances(session: SessionPayload, id: string, body: unknown) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const input = z.object({ rows: z.array(z.object({ id: z.string().optional(), values: z.record(z.string(), z.string()) })) }).parse(body);
    const allowances = band.allowances.map((item, index) => {
      const row = input.rows[index];
      if (!row) return item;
      return { ...item, name: (row.values.name ?? item.name).trim() || item.name, rate: Number(String(row.values.rate ?? item.rate).replace(/[^0-9.]/g, "")) || 0 };
    });
    await prisma.payBand.update({ where: { id }, data: { allowances: allowances as unknown as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `Allowances changed · ${band.code}` });
    return { id };
  }

  async addAllowance(session: SessionPayload, id: string, body: unknown) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const input = z.object({ name: z.string().trim().min(1, "Name the allowance."), rate: z.coerce.number().min(0) }).parse(body);
    const allowances = [...band.allowances, { name: input.name, who: "Everyone on the band", basis: "Flat monthly", rate: input.rate, treat: "Taxable" }];
    await prisma.payBand.update({ where: { id }, data: { allowances: allowances as unknown as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `Allowance added · ${band.code} · ${input.name}` });
    return { id };
  }

  async removeAllowance(session: SessionPayload, id: string, index: number) {
    const band = await this.bandOrThrow(session.schoolId, id);
    if (!band.allowances[index]) throw new NotFoundException("That allowance does not exist.");
    const allowances = band.allowances.filter((_, position) => position !== index);
    await prisma.payBand.update({ where: { id }, data: { allowances: allowances as unknown as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `Allowance removed · ${band.code}` });
    return { id };
  }

  async setBandOpen(session: SessionPayload, id: string, body: unknown) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const input = z.object({ open: z.coerce.boolean() }).parse(body);
    await prisma.payBand.update({ where: { id }, data: { isOpen: input.open } });
    await this.audit(session, AuditAction.UPDATE, "PayBand", id, { summary: `${band.code} ${input.open ? "opened to" : "closed to"} new staff` });
    return { id, open: input.open };
  }

  async deleteBand(session: SessionPayload, id: string) {
    const band = await this.bandOrThrow(session.schoolId, id);
    const people = await prisma.staffProfile.count({ where: { schoolId: session.schoolId, payBandId: id } });
    if (people) throw new BadRequestException(`${people} ${people === 1 ? "person is" : "people are"} on ${band.code}. Move them first, or close the band to new staff instead.`);
    await prisma.payBand.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "PayBand", id, { summary: `Pay band deleted · ${band.code}` });
    return { id };
  }

  private async bandOrThrow(schoolId: string, id: string): Promise<BandRecord> {
    const row = await prisma.payBand.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException("That band does not exist.");
    return this.toBand(row);
  }

  /* ───────────────────────── the calculation ───────────────────────── */

  private weekdaysIn(year: number, month: number): number {
    const days = new Date(year, month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= days; day += 1) {
      const weekday = new Date(year, month - 1, day).getDay();
      if (weekday !== 0 && weekday !== 6) count += 1;
    }
    return count;
  }

  private annualTax(annualTaxable: number, setup: PayrollSetup): number {
    let remaining = Math.max(0, annualTaxable);
    let lower = 0;
    let tax = 0;
    for (const band of setup.taxBands) {
      const width = band.upTo === null ? remaining : Math.max(0, band.upTo - lower);
      const slice = Math.min(remaining, width);
      tax += (slice * band.rate) / 100;
      remaining -= slice;
      lower = band.upTo ?? lower;
      if (remaining <= 0) break;
    }
    return tax;
  }

  /** One person's month, from their rung to their net. */
  line(band: BandRecord, step: number, facts: PersonFacts, setup: PayrollSetup, unpaidDays: number, workingDays: number): PayLine {
    const rung = band.steps[Math.min(Math.max(step, 1), band.steps.length) - 1];
    const prorate = workingDays ? Math.max(0, 1 - unpaidDays / workingDays) : 1;
    const full = rung?.gross ?? 0;
    const gross = naira(full * prorate);
    const draws = (who: string) =>
      who === "Everyone on the band" ||
      (who === "Form masters only" && facts.formClass) ||
      (who === "Post holders only" && POST_HOLDERS.has(facts.roleCode)) ||
      (who === "Heads of department only" && facts.roleCode === "HEAD_OF_DEPARTMENT") ||
      (who === "Boarding staff only" && BOARDING.has(facts.roleCode));
    const lines = band.allowances
      .filter((item) => draws(item.who))
      .map((item) => {
        const base = item.basis === "% of gross" ? (full * item.rate) / 100 : item.basis === "Per term" ? item.rate / 3 : item.basis === "Per period taught" ? item.rate * facts.periods * 4 : item.rate;
        const inPay = !/not pay/.test(item.treat);
        return { name: item.name, amount: naira(base * prorate), treat: item.treat, inPay, employer: /Employer cost/.test(item.treat) };
      });
    const allowTotal = lines.filter((item) => item.inPay).reduce((sum, item) => sum + item.amount, 0);
    const employerCost = lines.filter((item) => item.employer).reduce((sum, item) => sum + item.amount, 0) + naira((full * band.employerPension) / 100 * prorate);
    const taxableAllow = lines.filter((item) => item.inPay && item.treat === "Taxable").reduce((sum, item) => sum + item.amount, 0);
    const pension = naira((gross * setup.pensionRate) / 100);
    const nhf = naira((gross * setup.nhfRate) / 100);
    const taxable = gross + taxableAllow;
    const paye = naira(this.annualTax((taxable - pension - nhf) * 12, setup) / 12);
    const deductions = pension + nhf + paye;
    let net = gross + allowTotal - deductions;
    if (setup.roundNet) net = Math.round(net / 100) * 100;
    return {
      gross,
      allowances: lines.map(({ name, amount, treat, inPay }) => ({ name, amount, treat, inPay })),
      allowTotal,
      employerCost,
      taxable,
      paye,
      pension,
      nhf,
      deductions,
      net,
      prorate,
      unpaidDays
    };
  }

  /* ───────────────────────── the payroll ───────────────────────── */

  private month() {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear(), label: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), monthName: now.toLocaleDateString("en-GB", { month: "long" }) };
  }

  private async unpaidDays(schoolId: string, year: number, month: number): Promise<Map<string, number>> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const types = await store(schoolId, "leave-types").list<LeaveTypePolicy>();
    const unpaid = new Set((types.length ? types.map((item) => item.data) : LEAVE_TYPE_DEFAULTS).filter((item) => /Unpaid/.test(item.pay)).map((item) => item.name));
    if (!unpaid.size) return new Map();
    const requests = await prisma.leaveRequest.findMany({ where: { schoolId, status: "APPROVED", type: { in: Array.from(unpaid) }, startDate: { lte: end }, endDate: { gte: start } } });
    const out = new Map<string, number>();
    for (const request of requests) {
      const from = request.startDate > start ? request.startDate : start;
      const to = request.endDate < end ? request.endDate : end;
      let count = 0;
      for (let cursor = new Date(from); cursor <= to; cursor = new Date(cursor.getTime() + 86_400_000)) {
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) count += 1;
      }
      out.set(request.staffId, (out.get(request.staffId) ?? 0) + count);
    }
    return out;
  }

  private async gather(session: SessionPayload) {
    const schoolId = session.schoolId;
    const when = this.month();
    const [setup, bands, profiles, teaching, forms, unpaid, run] = await Promise.all([
      this.setup(schoolId),
      prisma.payBand.findMany({ where: { schoolId }, orderBy: { code: "asc" } }),
      prisma.staffProfile.findMany({
        where: { schoolId, user: { deletedAt: null, accountStatus: { not: "INACTIVE" } } },
        include: { user: true, department: { select: { name: true } } },
        orderBy: { user: { firstName: "asc" } }
      }),
      this.structure.teaching(session),
      prisma.classRoom.findMany({ where: { schoolId, deletedAt: null, classTeacherId: { not: null } }, select: { classTeacherId: true } }),
      this.unpaidDays(schoolId, when.year, when.month),
      prisma.payrollRun.findUnique({ where: { schoolId_month_year: { schoolId, month: when.month, year: when.year } }, include: { items: true } })
    ]);
    const periods = new Map(teaching.teachers.map((teacher) => [teacher.id, teacher.periods]));
    const formTeachers = new Set(forms.map((arm) => arm.classTeacherId));
    return { setup, bands: bands.map((row) => this.toBand(row)), profiles: profiles.filter((profile) => isSchoolStaffRole(profile.user.role)), periods, formTeachers, unpaid, run, when, ceiling: teaching.schoolCeiling };
  }

  async overview(session: SessionPayload) {
    const data = await this.gather(session);
    const { setup, bands, profiles, run, when } = data;
    const mask = !this.canSeeAmounts(session, setup);
    const working = this.weekdaysIn(when.year, when.month);
    const items = new Map((run?.items ?? []).map((item) => [item.staffId, item]));
    const byId = new Map(bands.map((band) => [band.id, band]));

    const rows = profiles.map((profile) => {
      const band = profile.payBandId ? byId.get(profile.payBandId) : undefined;
      const mapped = Boolean(band && profile.payStep);
      const facts: PersonFacts = { roleCode: profile.user.role, formClass: data.formTeachers.has(profile.userId), periods: data.periods.get(profile.userId) ?? 0, startsThisMonth: profile.employmentDate.getMonth() + 1 === when.month && profile.employmentDate.getFullYear() === when.year ? profile.employmentDate : null };
      const calc = mapped ? this.line(band!, profile.payStep!, facts, setup, data.unpaid.get(profile.id) ?? 0, working) : null;
      const item = items.get(profile.id);
      const state = !mapped ? "Not mapped" : item ? LABEL_FOR[item.status] ?? "Draft" : "Draft";
      const hide = (value: number | null) => (mask ? null : value);
      return {
        id: profile.id,
        userId: profile.userId,
        name: fullName(profile.user),
        role: templateName(profile.user.role),
        department: profile.department?.name ?? "No department",
        bandId: band?.id ?? null,
        band: band ? band.code : null,
        bandName: band?.name ?? null,
        step: mapped ? profile.payStep : null,
        stepName: mapped ? band!.steps[(profile.payStep ?? 1) - 1]?.name ?? null : null,
        steps: band?.steps.length ?? 0,
        method: profile.payMethod ?? "Bank transfer",
        state,
        reference: item?.reference ?? null,
        statusNote: item?.statusNote ?? null,
        paidAt: item?.paidAt?.toISOString() ?? null,
        gross: hide(calc?.gross ?? null),
        allowances: hide(calc?.allowTotal ?? null),
        deductions: hide(calc?.deductions ?? null),
        net: hide(calc?.net ?? null),
        slip: calc && !mask ? calc : null,
        unpaidDays: data.unpaid.get(profile.id) ?? 0,
        mappedAt: profile.payMappedAt?.toISOString() ?? null,
        startsThisMonth: Boolean(facts.startsThisMonth)
      };
    });

    const mappedRows = rows.filter((row) => row.state !== "Not mapped");
    const sum = (key: "gross" | "allowances" | "deductions" | "net") => (mask ? null : mappedRows.reduce((total, row) => total + (row[key] ?? 0), 0));
    const employer = mask
      ? null
      : profiles.reduce((total, profile) => {
          const band = profile.payBandId ? byId.get(profile.payBandId) : undefined;
          if (!band || !profile.payStep) return total;
          const facts: PersonFacts = { roleCode: profile.user.role, formClass: data.formTeachers.has(profile.userId), periods: data.periods.get(profile.userId) ?? 0, startsThisMonth: null };
          return total + this.line(band, profile.payStep, facts, setup, data.unpaid.get(profile.id) ?? 0, working).employerCost;
        }, 0);
    const gross = sum("gross");
    const allow = sum("allowances");

    const bandRows = bands.map((band) => {
      const on = rows.filter((row) => row.bandId === band.id);
      return {
        id: band.id,
        code: band.code,
        name: band.name,
        covers: band.covers,
        coversGroup: band.coversGroup,
        steps: band.steps.length,
        low: band.steps[0]?.gross ?? 0,
        high: band.steps[band.steps.length - 1]?.gross ?? 0,
        staff: on.length,
        allowances: band.allowances.map((item) => item.name),
        nextReview: band.nextReview,
        isOpen: band.isOpen
      };
    });

    const needing = rows.filter((row) => row.state === "Held" || row.state === "Awaiting approval").length;
    const flow = await this.flows.stages(session.schoolId, "payrun");
    const offCycle = await prisma.offCyclePayment.findMany({ where: { schoolId: session.schoolId, payOn: { gte: new Date(when.year, when.month - 1, 1), lt: new Date(when.year, when.month, 1) } }, include: { staff: { include: { user: true } } }, orderBy: { payOn: "asc" } });
    return {
      amountsHidden: mask,
      month: when,
      workingDays: working,
      setup,
      bands: bandRows,
      rows,
      totals: { people: mappedRows.length, of: rows.length, unmapped: rows.length - mappedRows.length, gross, allowances: allow, cost: mask ? null : (gross ?? 0) + (allow ?? 0) + (employer ?? 0), deductions: sum("deductions"), net: sum("net"), needing },
      run: run ? { id: run.id, status: run.status, stage: ((run.metadata ?? {}) as { stage?: string }).stage ?? "building", preparedBy: ((run.metadata ?? {}) as { preparedByName?: string }).preparedByName ?? null, approvedBy: ((run.metadata ?? {}) as { approvedByName?: string }).approvedByName ?? null } : null,
      offCycle: offCycle.map((item) => ({ id: item.id, name: fullName(item.staff.user), kind: item.kind, amount: mask ? null : Number(item.amount), payOn: item.payOn.toISOString(), status: item.status, reason: item.reason })),
      flow,
      variations: await this.variations(session, rows, data, profiles.length)
    };
  }

  /** What is different about this month: named, so a run is trusted because the differences are listed. */
  private async variations(session: SessionPayload, rows: Array<{ id: string; name: string; state: string; unpaidDays: number; startsThisMonth: boolean; gross: number | null; band: string | null }>, data: Awaited<ReturnType<PayrollService["gather"]>>, total: number) {
    const out: Array<{ kind: string; label: string; detail: string; tone: string; staffId?: string }> = [];
    const since = new Date(data.when.year, data.when.month - 1, 1);
    const moves = await prisma.auditLog.findMany({ where: { schoolId: session.schoolId, entityType: "PayMapping", createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 50 });
    for (const move of moves) {
      const meta = (move.metadata ?? {}) as { name?: string; from?: string; to?: string; reason?: string; staffId?: string };
      out.push({ kind: "Step change", label: `${meta.name ?? "Somebody"} moved ${meta.from ? `from ${meta.from} ` : ""}to ${meta.to ?? "a new step"}`, detail: meta.reason ?? "Recorded when they were mapped", tone: "positive", staffId: meta.staffId });
    }
    for (const row of rows.filter((item) => item.unpaidDays > 0)) {
      out.push({ kind: "Unpaid leave", label: `${row.name} · ${row.unpaidDays} ${row.unpaidDays === 1 ? "day" : "days"} unpaid leave`, detail: "From the leave register · prorated by working day", tone: "attention", staffId: row.id });
    }
    for (const row of rows.filter((item) => item.startsThisMonth)) {
      out.push({ kind: "New starter", label: `${row.name} joined this month`, detail: "Prorated from their first working day", tone: "progress", staffId: row.id });
    }
    const unmapped = rows.filter((item) => item.state === "Not mapped");
    for (const row of unmapped.slice(0, 5)) {
      out.push({ kind: "Not mapped", label: `${row.name} is not on a band`, detail: "Not paid by this run — this is a variation, not an omission", tone: "negative", staffId: row.id });
    }
    if (unmapped.length > 5) out.push({ kind: "Not mapped", label: `${unmapped.length - 5} more are not on a band`, detail: `${unmapped.length} of ${total} staff cannot be paid yet`, tone: "negative" });
    return out;
  }

  /* ───────────────────────── one band ───────────────────────── */

  async band(session: SessionPayload, id: string) {
    const record = await this.bandOrThrow(session.schoolId, id);
    const overview = await this.overview(session);
    const on = overview.rows.filter((row) => row.bandId === id);
    const setup = overview.setup;
    return { band: record, people: on, mask: overview.amountsHidden, setup, month: overview.month };
  }

  /** One person's pay: this month as it stands, every payment they have had, and every change to it. */
  async person(session: SessionPayload, staffId: string) {
    const overview = await this.overview(session);
    const row = overview.rows.find((item) => item.id === staffId);
    if (!row) throw new NotFoundException("That person is not on the staff.");
    const [items, changes, off] = await Promise.all([
      prisma.payrollItem.findMany({ where: { schoolId: session.schoolId, staffId }, include: { payrollRun: true }, orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }], take: 24 }),
      prisma.auditLog.findMany({ where: { schoolId: session.schoolId, entityType: "PayMapping", entityId: staffId }, orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.offCyclePayment.findMany({ where: { schoolId: session.schoolId, staffId }, orderBy: { payOn: "desc" }, take: 12 })
    ]);
    const mask = overview.amountsHidden;
    return {
      mask,
      row,
      setup: overview.setup,
      month: overview.month,
      payments: items.map((item) => ({
        id: item.id,
        label: new Date(item.payrollRun.year, item.payrollRun.month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        band: item.bandCode,
        step: item.step,
        gross: mask ? null : Number(item.basicSalary),
        net: mask ? null : Number(item.netSalary),
        method: item.method,
        status: LABEL_FOR[item.status] ?? item.status,
        reference: item.reference,
        paidAt: item.paidAt?.toISOString() ?? null,
        note: item.statusNote
      })),
      changes: changes.map((entry) => {
        const meta = (entry.metadata ?? {}) as { from?: string | null; to?: string; reason?: string };
        return { id: entry.id, at: entry.createdAt.toISOString(), from: meta.from ?? null, to: meta.to ?? "", reason: meta.reason ?? "" };
      }),
      offCycle: off.map((item) => ({ id: item.id, kind: item.kind, amount: mask ? null : Number(item.amount), payOn: item.payOn.toISOString(), status: item.status, reason: item.reason }))
    };
  }

  /* ───────────────────────── mapping and status ───────────────────────── */

  async mapStaff(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        staff: z.array(z.string()).min(1, "Choose who to map."),
        band: z.string().min(1, "Choose a band."),
        step: z.coerce.number().int().min(1),
        effective: z.string().optional(),
        reason: z.string().min(1, "Say why."),
        note: z.string().optional(),
        method: z.string().default("Bank transfer"),
        backdate: z.coerce.boolean().default(false)
      })
      .parse(body);
    const band = await this.bandOrThrow(session.schoolId, input.band);
    if (!band.isOpen) throw new BadRequestException(`${band.code} is closed to new staff.`);
    if (input.step > band.steps.length) throw new BadRequestException(`${band.code} has ${band.steps.length} steps.`);
    const profiles = await prisma.staffProfile.findMany({ where: { schoolId: session.schoolId, id: { in: input.staff } }, include: { user: true, payBand: true } });
    if (!profiles.length) throw new NotFoundException("Nobody you chose is on the staff.");
    for (const profile of profiles) {
      const from = profile.payBand ? `${profile.payBand.code} step ${profile.payStep}` : null;
      await prisma.staffProfile.update({ where: { id: profile.id }, data: { payBandId: band.id, payStep: input.step, payMethod: input.method, payMappedAt: input.effective ? new Date(input.effective) : new Date() } });
      await this.audit(session, AuditAction.UPDATE, "PayMapping", profile.id, {
        summary: `${fullName(profile.user)} mapped to ${band.code} step ${input.step}`,
        name: fullName(profile.user),
        staffId: profile.id,
        from,
        to: `${band.code} step ${input.step}`,
        reason: [input.reason, input.note].filter(Boolean).join(" · "),
        backdated: input.backdate
      });
    }
    return { mapped: profiles.length };
  }

  async moveStep(session: SessionPayload, body: unknown) {
    const input = z.object({ staff: z.array(z.string()).min(1), delta: z.number().int().min(-1).max(1).default(1), reason: z.string().optional() }).parse(body);
    const profiles = await prisma.staffProfile.findMany({ where: { schoolId: session.schoolId, id: { in: input.staff } }, include: { user: true, payBand: true } });
    let moved = 0;
    const skipped: string[] = [];
    for (const profile of profiles) {
      const band = profile.payBand ? this.toBand(profile.payBand) : null;
      if (!band || !profile.payStep) {
        skipped.push(`${fullName(profile.user)} is not on a band`);
        continue;
      }
      const next = profile.payStep + input.delta;
      if (next < 1 || next > band.steps.length) {
        skipped.push(`${fullName(profile.user)} is already at ${next < 1 ? "the bottom" : "the top"} of ${band.code}`);
        continue;
      }
      await prisma.staffProfile.update({ where: { id: profile.id }, data: { payStep: next, payMappedAt: new Date() } });
      await this.audit(session, AuditAction.UPDATE, "PayMapping", profile.id, { summary: `${fullName(profile.user)} moved to ${band.code} step ${next}`, name: fullName(profile.user), staffId: profile.id, from: `step ${profile.payStep}`, to: `step ${next}`, reason: input.reason ?? "Moved one step" });
      moved += 1;
    }
    return { moved, skipped };
  }

  /** Makes sure this month has a run, and that every mapped person has a line on it. */
  private async ensureRun(session: SessionPayload) {
    const data = await this.gather(session);
    const working = this.weekdaysIn(data.when.year, data.when.month);
    const run =
      data.run ??
      (await prisma.payrollRun.create({
        data: {
          schoolId: session.schoolId,
          month: data.when.month,
          year: data.when.year,
          status: "DRAFT",
          processedById: session.userId,
          metadata: { stage: "building", preparedById: session.userId, preparedByName: await this.actorName(session) } as unknown as Prisma.InputJsonValue
        },
        include: { items: true }
      }));
    const have = new Set(run.items.map((item) => item.staffId));
    const byId = new Map(data.bands.map((band) => [band.id, band]));
    for (const profile of data.profiles) {
      if (have.has(profile.id) || !profile.payBandId || !profile.payStep) continue;
      const band = byId.get(profile.payBandId);
      if (!band) continue;
      const calc = this.line(band, profile.payStep, { roleCode: profile.user.role, formClass: data.formTeachers.has(profile.userId), periods: data.periods.get(profile.userId) ?? 0, startsThisMonth: null }, data.setup, data.unpaid.get(profile.id) ?? 0, working);
      await prisma.payrollItem.create({
        data: {
          schoolId: session.schoolId,
          payrollRunId: run.id,
          staffId: profile.id,
          basicSalary: calc.gross,
          allowances: calc.allowances as unknown as Prisma.InputJsonValue,
          deductions: { paye: calc.paye, pension: calc.pension, nhf: calc.nhf } as unknown as Prisma.InputJsonValue,
          netSalary: calc.net,
          bandCode: band.code,
          step: profile.payStep,
          method: profile.payMethod ?? "Bank transfer",
          status: "DRAFT"
        }
      });
    }
    return prisma.payrollRun.findUniqueOrThrow({ where: { id: run.id }, include: { items: true } });
  }

  private async actorName(session: SessionPayload) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    return user ? fullName(user) : "Someone";
  }

  async setStatus(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        staff: z.array(z.string()).min(1, "Choose whose payment to change."),
        status: z.string().refine((value) => value in STATUS_FOR, "That is not a payment status."),
        why: z.string().trim().min(3, "Say why — whoever reviews pay in two years reads this."),
        reference: z.string().optional(),
        paidOn: z.string().optional(),
        tell: z.coerce.boolean().optional()
      })
      .parse(body);
    const run = await this.ensureRun(session);
    if (run.status === "REVERSED") throw new BadRequestException("This run was reversed; nothing on it can change.");
    const status = STATUS_FOR[input.status];
    let changed = 0;
    for (const staffId of input.staff) {
      const item = run.items.find((entry) => entry.staffId === staffId) ?? (await prisma.payrollItem.findFirst({ where: { payrollRunId: run.id, staffId } }));
      if (!item) continue;
      if (status === "PAID" && !input.reference?.trim() && item.method?.startsWith("Bank")) {
        throw new BadRequestException("A bank payment is marked paid against its bank reference.");
      }
      await prisma.payrollItem.update({
        where: { id: item.id },
        data: { status, statusNote: input.why, reference: status === "PAID" ? input.reference ?? item.reference : item.reference, paidAt: status === "PAID" ? (input.paidOn ? new Date(input.paidOn) : new Date()) : null }
      });
      changed += 1;
    }
    await this.audit(session, AuditAction.UPDATE, "PayrollItem", run.id, { summary: `${changed} ${changed === 1 ? "payment" : "payments"} set to ${input.status}`, why: input.why, reference: input.reference ?? null });
    return { changed };
  }

  async offCycle(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        staff: z.string().min(1, "Choose who it is for."),
        kind: z.string().min(1),
        amount: z.coerce.number().positive("Give the amount."),
        payOn: z.string().min(1, "Give the day it is paid."),
        reason: z.string().trim().min(5, "Say what is owed and how it was worked out."),
        recover: z.string().default("Not recoverable — this is owed"),
        statutory: z.coerce.boolean().default(true)
      })
      .parse(body);
    const profile = await prisma.staffProfile.findFirst({ where: { id: input.staff, schoolId: session.schoolId }, include: { user: true } });
    if (!profile) throw new NotFoundException("That person is not on the staff.");
    const created = await prisma.offCyclePayment.create({
      data: { schoolId: session.schoolId, staffId: profile.id, kind: input.kind, amount: input.amount, payOn: new Date(input.payOn), reason: input.reason, recover: input.recover, statutory: input.statutory, createdById: session.userId }
    });
    await this.audit(session, AuditAction.CREATE, "OffCyclePayment", created.id, { summary: `Off-cycle payment recorded · ${fullName(profile.user)} · ${input.kind}`, amount: input.amount });
    return { id: created.id };
  }

  /* ───────────────────────── the run ───────────────────────── */

  async openRun(session: SessionPayload) {
    await this.ensureRun(session);
    return this.overview(session);
  }

  async sendForApproval(session: SessionPayload) {
    const run = await this.ensureRun(session);
    if (run.status !== "DRAFT") throw new BadRequestException("This run has already left review.");
    const meta = (run.metadata ?? {}) as Record<string, unknown>;
    await prisma.payrollRun.update({ where: { id: run.id }, data: { metadata: { ...meta, stage: "approval", sentAt: new Date().toISOString(), sentById: session.userId } as unknown as Prisma.InputJsonValue } });
    await prisma.payrollItem.updateMany({ where: { payrollRunId: run.id, status: "DRAFT" }, data: { status: "AWAITING_APPROVAL" } });
    await this.audit(session, AuditAction.UPDATE, "PayrollRun", run.id, { summary: "Payroll run sent for approval" });
    return { id: run.id };
  }

  async approveRun(session: SessionPayload) {
    const run = await this.ensureRun(session);
    const meta = (run.metadata ?? {}) as { preparedById?: string; stage?: string };
    if (run.status !== "DRAFT") throw new BadRequestException("This run is already approved.");
    if (meta.stage !== "approval") throw new BadRequestException("Send the run for approval first.");
    if (meta.preparedById === session.userId) throw new ForbiddenException("Whoever prepared a run can never approve it.");
    const setup = await this.setup(session.schoolId);
    const may = isPlatformRole(session.role as never) || session.role === "SCHOOL_OWNER" || session.role === "PROPRIETOR" || (setup.approver !== "The Proprietor only" && (session.role === "PRINCIPAL" || session.role === "VICE_PRINCIPAL_ADMINISTRATION"));
    if (!may) throw new ForbiddenException(`${setup.approver} approves a run.`);
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "PROCESSED", processedAt: new Date(), metadata: { ...meta, stage: "approved", approvedById: session.userId, approvedByName: await this.actorName(session), approvedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue }
    });
    await prisma.payrollItem.updateMany({ where: { payrollRunId: run.id, status: "AWAITING_APPROVAL" }, data: { status: "APPROVED" } });
    await this.audit(session, AuditAction.APPROVE, "PayrollRun", run.id, { summary: "Payroll run approved" });
    return { id: run.id };
  }

  async releaseHeld(session: SessionPayload) {
    const run = await this.ensureRun(session);
    const result = await prisma.payrollItem.updateMany({ where: { payrollRunId: run.id, status: "HELD" }, data: { status: "AWAITING_APPROVAL", statusNote: "Released" } });
    await this.audit(session, AuditAction.UPDATE, "PayrollRun", run.id, { summary: `${result.count} held ${result.count === 1 ? "payment" : "payments"} released` });
    return { released: result.count };
  }
}
