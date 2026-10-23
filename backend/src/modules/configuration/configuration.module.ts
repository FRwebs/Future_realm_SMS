import { Module } from "@nestjs/common";

import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ConfigurationController } from "./configuration.controller";
import { ConfigurationService } from "./configuration.service";
import { LibraryAdoptionService } from "./library-adoption.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ConfigurationController],
  providers: [ConfigurationService, LibraryAdoptionService]
})
export class ConfigurationModule {}
