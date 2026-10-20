import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { SuperAdminService } from "./super-admin.service";

/** Sends the campaigns whose time has come — scheduled once, or the next run of a weekly or monthly one. Switch off with CAMPAIGN_SCHEDULER=off. */
@Injectable()
export class CampaignSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("CampaignScheduler");
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly admin: SuperAdminService) {}

  onModuleInit() {
    if (process.env.CAMPAIGN_SCHEDULER === "off") return;
    this.timer = setInterval(() => void this.admin.runDueCampaigns().then((sent) => sent.length && this.log.log(`Sent ${sent.join(", ")}`)).catch((error) => this.log.error(error)), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
