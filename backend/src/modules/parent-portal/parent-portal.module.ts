import { Module } from "@nestjs/common";

import { FamilyInboxService } from "./family-inbox.service";
import { ParentPortalController } from "./parent-portal.controller";
import { ParentPortalService } from "./parent-portal.service";
import { ParentWorkspaceController } from "./parent-workspace.controller";
import { ParentWorkspaceService } from "./parent-workspace.service";

@Module({
  controllers: [ParentPortalController, ParentWorkspaceController],
  providers: [ParentPortalService, FamilyInboxService, ParentWorkspaceService]
})
export class ParentPortalModule {}
