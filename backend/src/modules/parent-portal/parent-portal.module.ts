import { Module } from "@nestjs/common";

import { FamilyInboxService } from "./family-inbox.service";
import { ParentPortalController } from "./parent-portal.controller";
import { ParentPortalService } from "./parent-portal.service";

@Module({
  controllers: [ParentPortalController],
  providers: [ParentPortalService, FamilyInboxService]
})
export class ParentPortalModule {}
