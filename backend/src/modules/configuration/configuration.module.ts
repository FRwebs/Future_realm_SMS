import { Module } from "@nestjs/common";

import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ConfigurationController } from "./configuration.controller";
import { ConfigurationService } from "./configuration.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ConfigurationController],
  providers: [ConfigurationService]
})
export class ConfigurationModule {}
