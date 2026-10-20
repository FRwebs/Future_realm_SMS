import { Module } from "@nestjs/common";

import { BackupService } from "./backup.service";
import { CampaignSchedulerService } from "./campaign-scheduler.service";
import { ConcessionsController } from "./concessions.controller";
import { ConcessionsService } from "./concessions.service";
import { SuperAdminController } from "./super-admin.controller";
import { SuperAdminService } from "./super-admin.service";

@Module({
  controllers: [SuperAdminController, ConcessionsController],
  providers: [SuperAdminService, ConcessionsService, CampaignSchedulerService, BackupService],
  exports: [SuperAdminService]
})
export class SuperAdminModule {}
