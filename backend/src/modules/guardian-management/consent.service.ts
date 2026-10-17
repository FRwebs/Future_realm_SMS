import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { CONSENT_DEFAULTS, loadConsentTypes, type ConsentType } from "../student-records/consent.shared";
import { FamiliesService } from "./families.service";
import { notifyGuardian } from "./guardians.shared";

/**
 * Consent is the evidence a school produces when a regulator asks on what basis it holds a
 * child's data. A consent is recorded against the FAMILY, never the child — one guardian answers
 * once, however many children they have here — and every grant and withdrawal names who
 * recorded it and by what means.
 */

const typeSchema = z.object({
  name: z.string().trim().min(3, "Name the consent."),
  short: z.string().optional(),
  who: z.string().default("Every guardian"),
  standing: z.string().default("Required"),
  covers: z.string().trim().min(3, "Say what it covers."),
  blocks: z.string().trim().min(3, "Say what a gap blocks."),
  means: z.array(z.string()).default([]),
  askNow: z.coerce.boolean().default(false)
});

const recordSchema = z.object({ answers: z.record(z.string(), z.string()), date: z.string().optional(), tell: z.coerce.boolean().default(false), note: z.string().optional() });

const requestSchema = z.object({
  ask: z.array(z.string()).min(1, "Choose what to ask for."),
  mode: z.string().default("Only what they are missing"),
  channels: z.array(z.string()).min(1, "Choose how to ask."),
  noPortal: z.string().default("Send a printed form"),
  message: z.string().optional(),
  remind: z.string().optional(),
  withdrawn: z.coerce.boolean().default(false),
  families: z.array(z.string()).optional()
});

const NATURAL = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const MEANS: Record<string, string> = { "Given · in the portal": "PORTAL", "Given · in person": "IN_PERSON", "Given · on paper": "PAPER" };

@Injectable()
export class ConsentService {
  constructor(private readonly families: FamiliesService) {}

  private store(schoolId: string) {
    return new ConfigStore(schoolId, "consent-types");
  }

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "Consent", entityId, metadata } });
  }

  /** A school that has not yet defined its own list starts from the five, written down so they can be edited. */
  private async seeded(schoolId: string) {
    const store = this.store(schoolId);
    if ((await store.list()).length) return store;
    let order = 0;
    for (const type of CONSENT_DEFAULTS) {
      await store.put(type.code, type.name, { short: type.short, who: type.who, required: type.required, covers: type.covers, blocks: type.blocks }, order++);
    }
    return store;
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const { rows, types } = await this.families.load(schoolId);
    const given = (family: (typeof rows)[number], code: string) => family.consents[code] === "GIVEN";
    const coverage = types.map((type) => {
      const have = rows.filter((family) => given(family, type.code)).length;
      const withdrawn = rows.filter((family) => family.consents[type.code] === "WITHDRAWN").length;
      return { ...type, given: have, gaps: rows.length - have, withdrawn };
    });
    const gapFamilies = rows.filter((family) => types.some((type) => !given(family, type.code)));
    const noCore = rows.filter((family) => !given(family, "core"));
    const withdrawals = await prisma.familyConsent.findMany({ where: { schoolId, status: "WITHDRAWN" }, include: { guardian: { select: { firstName: true, lastName: true } } }, orderBy: { recordedAt: "desc" }, take: 40 });
    const byType = new Map<string, number>();
    for (const row of withdrawals) byType.set(row.typeCode, (byType.get(row.typeCode) ?? 0) + 1);
    return {
      types: coverage,
      rows,
      totals: { families: rows.length, complete: rows.length - gapFamilies.length, gaps: gapFamilies.length, noCore: noCore.length, noCoreChildren: noCore.reduce((sum, family) => sum + family.children.length, 0), required: types.filter((type) => type.required).length, optional: types.filter((type) => !type.required).length, noPortal: gapFamilies.filter((family) => family.portal !== "Active").length },
      withdrawals: Array.from(byType.entries()).map(([code, count]) => ({ code, name: types.find((type) => type.code === code)?.name ?? code, count, latest: withdrawals.find((row) => row.typeCode === code)?.recordedAt.toISOString() ?? null, who: withdrawals.filter((row) => row.typeCode === code).slice(0, 2).map((row) => `${row.guardian.firstName} ${row.guardian.lastName}`) })),
      options: { levels: Array.from(new Set(rows.flatMap((family) => family.children.map((child) => child.level)).filter(Boolean))).sort(NATURAL), arms: Array.from(new Set(rows.flatMap((family) => family.children.map((child) => child.arm)))).sort(NATURAL) }
    };
  }

  async saveType(session: SessionPayload, body: unknown, code?: string) {
    const input = typeSchema.parse(body);
    const schoolId = session.schoolId;
    const store = await this.seeded(schoolId);
    const slug = code ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!code && (await store.get(slug))) throw new BadRequestException("A consent with that name already exists.");
    const list = await store.list();
    await store.put(slug, input.name, { short: input.short || input.name.split(/\s+/)[0], who: input.who, required: input.standing === "Required", covers: input.covers, blocks: input.blocks, means: input.means }, list.findIndex((row) => row.code === slug) >= 0 ? list.findIndex((row) => row.code === slug) : list.length);
    let asked = 0;
    if (!code && input.askNow) {
      const result = await this.request(session, { ask: [input.name], mode: "Only what they are missing", channels: ["In-app · free", "SMS with a consent link · 1 credit each"], noPortal: "SMS only" });
      asked = result.asked;
    }
    await this.audit(session, code ? AuditAction.UPDATE : AuditAction.CREATE, slug, { summary: `${code ? "Consent type edited" : "Consent type defined"} · ${input.name}` });
    return { code: slug, asked };
  }

  async removeType(session: SessionPayload, code: string) {
    const store = await this.seeded(session.schoolId);
    if (!(await store.get(code))) throw new NotFoundException("That consent type does not exist.");
    await store.remove(code);
    await this.audit(session, AuditAction.DELETE, code, { summary: `Consent type removed · ${code}` });
    return { code };
  }

  /** One family, every consent, in one action — and the family told in the same breath. */
  async recordFamily(session: SessionPayload, guardianId: string, body: unknown) {
    const input = recordSchema.parse(body);
    const schoolId = session.schoolId;
    const guardian = await prisma.guardian.findFirst({ where: { id: guardianId, schoolId } });
    if (!guardian) throw new NotFoundException("That family does not exist.");
    const types = await loadConsentTypes(schoolId);
    const when = input.date ? new Date(input.date) : new Date();
    let changed = 0;
    for (const type of types) {
      const answer = input.answers[type.name] ?? input.answers[type.code];
      if (!answer) continue;
      const status = answer.startsWith("Given") ? "GIVEN" : answer === "Withdrawn" ? "WITHDRAWN" : "NOT_GIVEN";
      const existing = await prisma.familyConsent.findUnique({ where: { guardianId_typeCode: { guardianId, typeCode: type.code } } });
      if ((existing?.status ?? "NOT_GIVEN") === status && (status !== "GIVEN" || existing?.means === (MEANS[answer] ?? "IN_PERSON"))) continue;
      await prisma.familyConsent.upsert({
        where: { guardianId_typeCode: { guardianId, typeCode: type.code } },
        update: { status, means: status === "GIVEN" ? MEANS[answer] ?? "IN_PERSON" : existing?.means ?? null, recordedById: session.userId, recordedAt: when, note: input.note || null },
        create: { schoolId, guardianId, typeCode: type.code, status, means: status === "GIVEN" ? MEANS[answer] ?? "IN_PERSON" : null, recordedById: session.userId, recordedAt: when, note: input.note || null }
      });
      changed += 1;
    }
    if (input.tell && changed) await notifyGuardian(schoolId, guardianId, "Your consent record was updated", "The school updated what it holds on your consent. Open the app to review it.", ["In-app", "SMS"]);
    await this.audit(session, AuditAction.UPDATE, guardianId, { summary: `Consent recorded · ${changed} changes`, note: input.note });
    return { changed };
  }

  /** Ask each family only for what it is missing — never for something it already gave. */
  async request(session: SessionPayload, body: unknown) {
    const input = requestSchema.parse(body);
    const schoolId = session.schoolId;
    const { rows, types } = await this.families.load(schoolId);
    const wanted: ConsentType[] = types.filter((type) => input.ask.some((label) => label.startsWith(type.name)));
    if (!wanted.length) throw new BadRequestException("Choose at least one consent to ask for.");
    const message = input.message || "Dear parent, the school needs your consent on a small number of items so we can hold and publish your child's records correctly. Please open the link to review and respond.";
    let asked = 0;
    let printed = 0;
    let credits = 0;
    const skipped: string[] = [];
    for (const family of rows) {
      if (input.families?.length && !input.families.includes(family.id)) continue;
      const missing = wanted.filter((type) => {
        const status = family.consents[type.code];
        if (status === "GIVEN") return input.mode.startsWith("Everything") ? true : false;
        if (status === "WITHDRAWN") return input.withdrawn;
        return true;
      });
      if (!missing.length) continue;
      const channels = input.channels.filter((channel) => (family.portal === "Active" ? true : !/In-app/i.test(channel)));
      if (family.portal !== "Active" && input.noPortal.startsWith("Skip")) {
        skipped.push(`${family.name} has not activated the portal`);
        continue;
      }
      const body0 = `${message} Needed: ${missing.map((type) => type.name).join(", ")}.`;
      const result = channels.length ? await notifyGuardian(schoolId, family.id, "The school needs your consent", body0, channels) : { sent: [] as string[], skipped: [] as string[] };
      const wantsPrint = input.channels.some((channel) => /Printed/i.test(channel)) || (family.portal !== "Active" && input.noPortal.startsWith("Send a printed")) || result.sent.length === 0 || family.phoneOnly;
      if (wantsPrint) printed += 1;
      if (result.sent.includes("SMS")) credits += 1;
      await prisma.guardianContact.create({ data: { schoolId, guardianId: family.id, kind: "CONSENT_REQUEST", channel: [...result.sent, ...(wantsPrint ? ["Printed form"] : [])].join(" and ") || "Printed form", summary: `Consent requested · ${missing.map((type) => type.short).join(", ")}`, detail: { types: missing.map((type) => type.code), remind: input.remind ?? null }, createdById: session.userId } });
      asked += 1;
    }
    await this.audit(session, AuditAction.CREATE, schoolId, { summary: `Consent requested · ${asked} families`, types: wanted.map((type) => type.code) });
    return { asked, printed, credits, skipped };
  }
}
