import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { platformPolicy } from "../platform-policy/policy.service";
import { inQuietHours } from "../platform-policy/policy.shared";
import { CARRIERS } from "./providers";

/**
 * Takes what the school queued and hands it to a carrier.
 *
 * Every module that "sends" writes a NotificationLog row with status QUEUED; this is what finally sends it. Four rules
 * keep it honest:
 *  - a row is only SENT after the carrier accepted it, and FAILED (with the carrier's words) when it refused;
 *  - only rows queued since delivery was switched on (DELIVERY_SINCE, default: when this process started) are sent, so
 *    switching it on never replays old demo traffic to real phones;
 *  - an SMS is paid for from the school's wallet, one credit each, with a ledger row — no credits, no send;
 *  - in-app rows are left alone: being in the table is how they are delivered.
 */

const BATCH = 50;

type Meta = Record<string, unknown>;

export type DeliveryStatus = {
  enabled: boolean;
  since: string;
  carriers: Array<{ channel: string; provider: string; configured: boolean }>;
  queued: { SMS: number; EMAIL: number };
  sent: number;
  failed: number;
  held: number;
  lastRunAt: string | null;
  lastRun: { sent: number; failed: number; held: number } | null;
};

@Injectable()
export class DeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Delivery");
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly startedAt = new Date();
  private lastRunAt: Date | null = null;
  private lastRun: DeliveryStatus["lastRun"] = null;

  private get since() {
    const raw = process.env.DELIVERY_SINCE?.trim();
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : this.startedAt;
  }

  private get enabled() {
    return process.env.DELIVERY_ENABLED === "true";
  }

  onModuleInit() {
    if (!this.enabled) return;
    const configured = Object.values(CARRIERS).filter((carrier) => carrier.configured());
    if (!configured.length) {
      this.log.warn("DELIVERY_ENABLED is on but no carrier has keys; queued messages stay queued.");
      return;
    }
    this.timer = setInterval(() => void this.run().catch((error) => this.log.error(error)), Number(process.env.DELIVERY_INTERVAL_SECONDS || 60) * 1000);
    this.timer.unref();
    this.log.log(`Delivering ${configured.map((carrier) => carrier.provider).join(" + ")} messages queued since ${this.since.toISOString()}`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async status(schoolId: string): Promise<DeliveryStatus> {
    const since = this.since;
    const where = { schoolId, sentAt: { gte: since }, channel: { in: ["SMS", "EMAIL"] as Array<"SMS" | "EMAIL"> } };
    const [queued, sent, failed, held] = await Promise.all([
      prisma.notificationLog.groupBy({ by: ["channel"], where: { ...where, status: "QUEUED" }, _count: { _all: true } }),
      prisma.notificationLog.count({ where: { ...where, status: "SENT" } }),
      prisma.notificationLog.count({ where: { ...where, status: "FAILED" } }),
      prisma.notificationLog.count({ where: { ...where, status: "HELD" } }),
    ]);
    const queuedOf = (channel: string) => queued.find((row) => row.channel === channel)?._count._all ?? 0;
    return {
      enabled: this.enabled && Object.values(CARRIERS).some((carrier) => carrier.configured()),
      since: since.toISOString(),
      carriers: Object.values(CARRIERS).map((carrier) => ({ channel: carrier.channel, provider: carrier.provider, configured: carrier.configured() })),
      queued: { SMS: queuedOf("SMS"), EMAIL: queuedOf("EMAIL") },
      sent, failed, held,
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastRun: this.lastRun,
    };
  }

  /** One pass over the queue. Safe to call while a pass is running — it returns what the running pass has done. */
  async run(schoolId?: string) {
    if (this.running) return this.lastRun ?? { sent: 0, failed: 0, held: 0 };
    this.running = true;
    const result = { sent: 0, failed: 0, held: 0 };
    try {
      const policy = (await platformPolicy.get()).messaging;
      // Quiet hours hold everything: the messages stay queued and go out when the hours end.
      if (inQuietHours(policy)) return result;
      const rows = await prisma.notificationLog.findMany({
        where: { status: { in: ["QUEUED", "HELD"] }, channel: { in: ["SMS", "EMAIL", "WHATSAPP"] }, sentAt: { gte: this.since }, ...(schoolId ? { schoolId } : {}) },
        orderBy: { sentAt: "asc" },
        take: BATCH,
      });
      for (const row of rows) {
        const carrier = CARRIERS[row.channel];
        if (!carrier?.configured()) continue;
        const meta = (row.metadata ?? {}) as Meta;
        const user = row.userId ? await prisma.user.findUnique({ where: { id: row.userId }, select: { email: true, phone: true } }) : null;
        const to = row.channel === "EMAIL" ? String(meta.email ?? user?.email ?? "") : String(meta.phone ?? user?.phone ?? "");
        if (!to) {
          await this.mark(row.id, meta, "FAILED", { error: "No address to send to" });
          result.failed++;
          continue;
        }
        if (policy.dailyCapPerRecipient > 0 && (await this.sentToday(to, row.channel)) >= policy.dailyCapPerRecipient) {
          await this.mark(row.id, meta, "HELD", { held: `Daily cap of ${policy.dailyCapPerRecipient} reached for this recipient` });
          result.held++;
          continue;
        }
        const platformBilled = meta.billing === "PLATFORM";
        const credited = row.channel === "SMS" || row.channel === "WHATSAPP";
        if (credited && !platformBilled && !(await this.spend(row.schoolId, row.channel as "SMS" | "WHATSAPP", row.title))) {
          await this.mark(row.id, meta, "HELD", { held: `The school has no ${row.channel === "SMS" ? "SMS" : "WhatsApp"} credits left` });
          result.held++;
          continue;
        }
        const publicApi = (process.env.PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
        const outcome = await carrier.send(to, row.title, row.body, row.channel === "EMAIL" && publicApi ? { openPixelUrl: `${publicApi}/api/v1/track/open/${row.id}.gif` } : row.channel === "WHATSAPP" ? { template: meta.template as { name: string; language?: string; params: string[] } | undefined } : undefined);
        if (outcome.ok) {
          await this.mark(row.id, meta, "SENT", { to, provider: carrier.provider, ref: outcome.ref, deliveredAt: new Date().toISOString(), held: undefined });
          result.sent++;
          continue;
        }
        // The credit was taken before the attempt; a refused message gives it back.
        if (credited && !platformBilled) await this.refund(row.schoolId, row.channel as "SMS" | "WHATSAPP", row.title);
        const attempts = Number(meta.attempts ?? 0) + 1;
        const final = !outcome.retry || attempts >= policy.maxAttempts;
        await this.mark(row.id, meta, final ? "FAILED" : "QUEUED", { attempts, error: outcome.error, provider: carrier.provider });
        if (final) result.failed++;
      }
    } finally {
      this.running = false;
      this.lastRunAt = new Date();
      this.lastRun = result;
    }
    return result;
  }

  /** Messages already delivered to this address in the last 24 hours. */
  private async sentToday(to: string, channel: string) {
    const since = new Date(Date.now() - 86_400_000);
    return prisma.notificationLog.count({ where: { channel: channel as "SMS" | "EMAIL", status: "SENT", sentAt: { gte: since }, metadata: { path: ["to"], equals: to } } });
  }

  private async mark(id: string, meta: Meta, status: string, patch: Meta) {
    const next: Meta = { ...meta, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    await prisma.notificationLog.update({ where: { id }, data: { status, metadata: next as Prisma.InputJsonValue } });
  }

  /** One credit on the channel, taken atomically: the update only matches while a credit remains. */
  private async spend(schoolId: string, channel: "SMS" | "WHATSAPP", title: string) {
    const field = channel === "SMS" ? "smsBalance" : "whatsappBalance";
    const taken = await prisma.notificationWallet.updateMany({ where: { schoolId, [field]: { gt: 0 } }, data: { [field]: { decrement: 1 } } });
    if (!taken.count) return false;
    await prisma.creditLedger.create({ data: { schoolId, channel, kind: "USED", credits: -1, note: title.slice(0, 120) } });
    return true;
  }

  private async refund(schoolId: string, channel: "SMS" | "WHATSAPP", title: string) {
    const field = channel === "SMS" ? "smsBalance" : "whatsappBalance";
    await prisma.notificationWallet.updateMany({ where: { schoolId }, data: { [field]: { increment: 1 } } });
    await prisma.creditLedger.create({ data: { schoolId, channel, kind: "REFUND", credits: 1, note: `Not accepted by the carrier · ${title.slice(0, 90)}` } });
  }
}
