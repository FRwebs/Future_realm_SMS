import { Module } from "@nestjs/common";

import { CsrfGuard } from "./csrf.guard";
import { RolesGuard } from "./roles.guard";
import { SessionGuard } from "./session.guard";

@Module({
  providers: [SessionGuard, RolesGuard, CsrfGuard],
  exports: [SessionGuard, RolesGuard, CsrfGuard]
})
export class AuthModule {}
