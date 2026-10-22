import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { AdmissionsModule } from "../admissions/admissions.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AdmissionsBoardService } from "./admissions-board.service";
import { ChangesService } from "./changes.service";
import { RecordService } from "./record.service";
import { SafeguardingService } from "./safeguarding.service";
import { SupportPlansService } from "./support-plans.service";
import { RegistryService } from "./registry.service";
import { StudentRecordsController } from "./student-records.controller";

@Module({
  imports: [AdmissionsModule, RolesManagementModule],
  controllers: [StudentRecordsController],
  providers: [RegistryService, RecordService, SupportPlansService, SafeguardingService, ChangesService, AdmissionsBoardService, PermissionsGuard],
  exports: [ChangesService, SupportPlansService, SafeguardingService]
})
export class StudentRecordsModule {}
