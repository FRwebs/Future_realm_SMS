import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { FinanceModule } from "../finance/finance.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { CollectionsService } from "./collections.service";
import { FeeManagementController } from "./fee-management.controller";
import { HistoryService } from "./history.service";
import { ReviewService } from "./review.service";
import { StructuresService } from "./structures.service";

@Module({
  imports: [FinanceModule, RolesManagementModule],
  controllers: [FeeManagementController],
  providers: [CollectionsService, StructuresService, ReviewService, HistoryService, PermissionsGuard],
  exports: [ReviewService]
})
export class FeeManagementModule {}
