import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, PermissionsGuard],
  exports: [DeliveryService],
})
export class NotificationDeliveryModule {}
