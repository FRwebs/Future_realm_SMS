import { Module } from "@nestjs/common";

import { TemplatesController } from "./templates.controller";
import { TemplatesService, templates } from "./templates.service";

@Module({ controllers: [TemplatesController], providers: [{ provide: TemplatesService, useValue: templates }], exports: [TemplatesService] })
export class TemplatesModule {}
