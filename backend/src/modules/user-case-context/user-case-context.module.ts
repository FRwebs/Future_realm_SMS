import { Module } from "@nestjs/common";

import { UserCaseContextController } from "./user-case-context.controller";
import { UserCaseContextService } from "./user-case-context.service";

@Module({
  controllers: [UserCaseContextController],
  providers: [UserCaseContextService]
})
export class UserCaseContextModule {}
