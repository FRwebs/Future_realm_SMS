import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ApiAccessController, ApiKeyGuard, OpenApiController } from "./api-access.controller";
import { ApiAccessService } from "./api-access.service";

@Module({ imports: [RolesManagementModule], controllers: [ApiAccessController, OpenApiController], providers: [ApiAccessService, ApiKeyGuard, PermissionsGuard], exports: [ApiAccessService] })
export class ApiAccessModule {}
