import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { ReportsService, type Definition } from "./reports.service";
import { isOwed } from "./schedule";

/**
 * Runs the saved reports whose schedule has come round.
 *
 * Each run goes through the same path as a hand-made one — archived with its CSV, written to the audit trail — under
 * the name of the person who saved the report, and tells them it is ready. `lastRunAt` is stored on the definition so
 * a restart never produces the same run twice. Switch off with REPORT_SCHEDULER=off.
 */
@Injectable()
export class ReportSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("ReportScheduler");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly reports: ReportsService) {}

  onModuleInit() {
    if (process.env.REPORT_SCHEDULER === "off") return;
    this.timer = setInterval(() => void this.tick().catch((error) => this.log.error(error)), 5 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over every school's saved reports. Returns how many it produced. */
  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let produced = 0;
    try {
      const items = await prisma.configurationItem.findMany({ where: { resource: "report-definitions", deletedAt: null } });
      for (const item of items) {
        const data = (item.data ?? {}) as Partial<Definition>;
        if (!data.schedule || data.schedule === "On demand" || !data.ownerId || !item.code) continue;
        const terms = data.schedule === "End of each term" ? await prisma.term.findMany({ where: { schoolId: item.schoolId }, select: { endDate: true } }) : [];
        const owed = isOwed(data.schedule, now, { createdAt: item.createdAt, lastRunAt: data.lastRunAt ? new Date(data.lastRunAt) : null, termEnds: terms.map((term) => term.endDate) });
        if (!owed) continue;
        // Claim the run first: a failure to produce is recorded, not retried every five minutes.
        await new ConfigStore(item.schoolId, "report-definitions").put(item.code, item.name, { ...data, lastRunAt: now.toISOString() });
        try {
          const made = await this.reports.generate({ schoolId: item.schoolId, userId: data.ownerId } as never, "custom", item.code);
          await prisma.notificationLog.create({ data: { schoolId: item.schoolId, userId: data.ownerId, channel: "IN_APP", title: `Scheduled report ready · ${item.name}`, body: `${made.rows} rows, kept in Analytics & Reports › Reports › Recent.`, status: "QUEUED", sentAt: now, metadata: { href: `/api/v1/analytics-reports/reports/archive/${made.id}` } } });
          produced++;
        } catch (error) {
          this.log.warn(`${item.name}: ${error instanceof Error ? error.message : "could not be produced"}`);
        }
      }
    } finally {
      this.running = false;
    }
    return produced;
  }
}
