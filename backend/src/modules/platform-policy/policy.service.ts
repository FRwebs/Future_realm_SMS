import { BadRequestException, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { z } from "zod";
import { AuditAction, type Prisma } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { setPricingSnapshot } from "./pricing-snapshot";
import { setPlatformIdentity } from "../../../../src/lib/platform-identity";
import { DEFAULT_POLICY, mergePolicy, policyPatchSchema, roundAmount, type Policy } from "./policy.shared";

let cache: { at: number; policy: Policy } | null = null;
const TTL_MS = 30_000;

/** Reads the platform policy for any code that enforces it (cached for half a minute), and writes it for the Settings page. */
@Injectable()
export class PolicyService implements OnApplicationBootstrap {
  /** Read the policy once at start so the mailer knows the platform's name before anyone has opened Settings. */
  async onApplicationBootstrap() {
    await this.get().catch(() => undefined);
  }

  async get(): Promise<Policy> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.policy;
    const row = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" }, select: { policies: true } });
    let policy = DEFAULT_POLICY;
    try {
      policy = mergePolicy(row?.policies);
    } catch {
      policy = DEFAULT_POLICY; // a stored policy that no longer validates must not stop the platform
    }
    cache = { at: Date.now(), policy };
    setPlatformIdentity(policy.identity);
    setPricingSnapshot(policy.pricing);
    return policy;
  }

  /**
   * The Settings forms send flat fields — `trial_readOnlyDays`, `messaging_quietHoursOn` — because a form field has one
   * name. Nest them, and turn the text a form sends back into the numbers and switches the policy is made of.
   */
  private nest(payload: unknown) {
    if (!payload || typeof payload !== "object") return {};
    const out: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const match = /^(trial|dormancy|invoice|messaging|pricing|identity)_(\w+)$/.exec(key);
      if (!match) {
        if (value && typeof value === "object" && ["trial", "dormancy", "invoice", "messaging", "pricing", "identity"].includes(key)) out[key] = { ...(out[key] ?? {}), ...(value as Record<string, unknown>) };
        continue;
      }
      const raw = typeof value === "string" ? value.trim() : value;
      if (raw === "") continue;
      const parsed = raw === "true" ? true : raw === "false" ? false : typeof raw === "string" && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      out[match[1]] = { ...(out[match[1]] ?? {}), [match[2]]: parsed };
    }
    return out;
  }

  async update(session: SessionPayload, payload: unknown) {
    const patch = policyPatchSchema.parse(this.nest(payload));
    const row = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (!row) throw new BadRequestException("The platform settings record does not exist yet.");
    let next: Policy;
    try {
      next = mergePolicy(row.policies, patch);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "That policy is not valid.");
    }
    const before = await this.get();
    await prisma.platformSetting.update({ where: { id: row.id }, data: { policies: next as unknown as Prisma.InputJsonValue } });
    cache = null;
    setPlatformIdentity(next.identity);
    setPricingSnapshot(next.pricing);
    await prisma.auditLog.create({ data: { schoolId: null, actorId: session.userId, action: AuditAction.SETTINGS_UPDATE, entityType: "PlatformPolicy", entityId: row.id, metadata: { summary: "Platform policy changed", before, after: next } as unknown as Prisma.InputJsonValue } as never });
    return next;
  }

  /** Save part of the pricing policy, with the reason on the record. */
  async setPricing(session: SessionPayload | null, patch: Partial<Policy["pricing"]>, summary: string, extra: Record<string, unknown> = {}) {
    const row = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (!row) throw new BadRequestException("The platform settings record does not exist yet.");
    const next = mergePolicy(row.policies, { pricing: patch });
    await prisma.platformSetting.update({ where: { id: row.id }, data: { policies: next as unknown as Prisma.InputJsonValue } });
    cache = null;
    setPricingSnapshot(next.pricing);
    await prisma.auditLog.create({ data: { schoolId: null, actorId: session?.userId ?? null, action: AuditAction.SETTINGS_UPDATE, entityType: "PlatformPolicy", entityId: row.id, metadata: { summary, ...extra } as Prisma.InputJsonValue } });
    return next.pricing;
  }

  /** Switch platform notices on or off, with the reason on the record. The school's state still moves; only the message is held back. */
  async setTriggers(session: SessionPayload, payload: unknown) {
    const input = z.object({ keys: z.preprocess((v) => (typeof v === "string" && v.startsWith("[") ? JSON.parse(v) : v), z.array(z.string()).min(1, "Choose at least one notice.")), enabled: z.coerce.boolean(), reason: z.string().trim().min(5, "Say why — the reason goes in the audit log.") }).parse(payload);
    const row = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (!row) throw new BadRequestException("The platform settings record does not exist yet.");
    const policy = await this.get();
    const off = new Set(policy.messaging.disabledTriggers);
    for (const key of input.keys) {
      if (input.enabled) off.delete(key);
      else off.add(key);
    }
    const next = mergePolicy(row.policies, { messaging: { disabledTriggers: Array.from(off) } });
    await prisma.platformSetting.update({ where: { id: row.id }, data: { policies: next as unknown as Prisma.InputJsonValue } });
    cache = null;
    await prisma.auditLog.create({ data: { schoolId: null, actorId: session.userId, action: AuditAction.SETTINGS_UPDATE, entityType: "PlatformPolicy", entityId: row.id, metadata: { summary: `${input.enabled ? "Switched on" : "Switched off"} ${input.keys.length} platform notice${input.keys.length === 1 ? "" : "s"}`, keys: input.keys, reason: input.reason } as Prisma.InputJsonValue } });
    return next;
  }

  /** A platform invoice's due date and amount, as the policy says. */
  async invoiceTerms(amount: number, from = new Date()) {
    const policy = await this.get();
    return { amount: roundAmount(amount, policy.invoice.rounding), dueAt: new Date(from.getTime() + policy.invoice.netDays * 86_400_000), netDays: policy.invoice.netDays };
  }
}

/** For the code that is not built through Nest's injection (helpers and shared modules). The cache is module-level, so it is the same policy. */
export const platformPolicy = new PolicyService();
