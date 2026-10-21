import { Module } from "@nestjs/common";

import { AdminViewsController } from "./admin-views.controller";
import { AdminViewsService } from "./admin-views.service";

@Module({ controllers: [AdminViewsController], providers: [AdminViewsService] })
export class AdminViewsModule {}
