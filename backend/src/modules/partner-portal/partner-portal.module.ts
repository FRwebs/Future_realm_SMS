import { Module } from "@nestjs/common";

import { PartnerInviteController, PartnerPortalController } from "./partner-portal.controller";
import { PartnerPortalService } from "./partner-portal.service";

@Module({ controllers: [PartnerInviteController, PartnerPortalController], providers: [PartnerPortalService] })
export class PartnerPortalModule {}
