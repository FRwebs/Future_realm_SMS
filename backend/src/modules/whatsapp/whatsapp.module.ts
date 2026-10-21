import { Module } from "@nestjs/common";

import { WhatsAppAdminController, WhatsAppWebhookController } from "./whatsapp.controller";
import { WhatsAppService } from "./whatsapp.service";

@Module({ controllers: [WhatsAppWebhookController, WhatsAppAdminController], providers: [WhatsAppService] })
export class WhatsAppModule {}
