import { Module } from "@nestjs/common";

import {
  FrontDeskPortalController,
  HostelPortalController,
  LibraryPortalController,
  NursePortalController,
  TransportPortalController,
} from "./support-portals.controller";
import { SupportPortalsService } from "./support-portals.service";

@Module({
  controllers: [
    NursePortalController,
    LibraryPortalController,
    FrontDeskPortalController,
    HostelPortalController,
    TransportPortalController,
  ],
  providers: [SupportPortalsService],
})
export class SupportPortalsModule {}
