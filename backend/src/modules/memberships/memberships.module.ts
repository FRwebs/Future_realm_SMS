import { Module } from "@nestjs/common";

import { MembershipsController } from "./memberships.controller";
import { MembershipsService, memberships } from "./memberships.service";

@Module({ controllers: [MembershipsController], providers: [{ provide: MembershipsService, useValue: memberships }] })
export class MembershipsModule {}
