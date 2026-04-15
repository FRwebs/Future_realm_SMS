import { Module } from "@nestjs/common";

import { TeacherPortalController } from "./teacher-portal.controller";
import { TeacherPortalService } from "./teacher-portal.service";

@Module({
  controllers: [TeacherPortalController],
  providers: [TeacherPortalService]
})
export class TeacherPortalModule {}
