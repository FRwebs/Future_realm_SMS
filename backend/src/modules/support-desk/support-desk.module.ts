import { Module } from "@nestjs/common";

import { SupportDeskController } from "./support-desk.controller";
import { SupportDeskService, supportDesk } from "./support-desk.service";

@Module({ controllers: [SupportDeskController], providers: [{ provide: SupportDeskService, useValue: supportDesk }] })
export class SupportDeskModule {}
