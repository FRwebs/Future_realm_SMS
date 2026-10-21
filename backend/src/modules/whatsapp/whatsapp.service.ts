import { createHmac, timingSafeEqual } from "crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const env = (key: string) => (process.env[key] ?? "").trim();
const API = () => `https://graph.facebook.com/${env("WHATSAPP_API_VERSION") || "v21.0"}`;

/** Meta wants lower-case letters, digits and underscores. */
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "template";

type StatusEvent = { id?: string; status?: string; errors?: Array<{ code?: number; title?: string; message?: string }> };
type Change = { field?: string; value?: { statuses?: StatusEvent[]; event?: string; message_template_name?: string; reason?: string } };

@Injectable()
export class WhatsAppService {
  configured() {
    return Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID"));
  }

  /** What an administrator is told about the connection: which keys are present and what Meta will call back with. */
  status() {
    return {
      sending: this.configured(),
      templates: Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_BUSINESS_ID")),
      webhook: Boolean(env("WHATSAPP_VERIFY_TOKEN")),
      signed: Boolean(env("WHATSAPP_APP_SECRET")),
      callback: `${(env("PUBLIC_API_URL") || "https://your-api-host").replace(/\/$/, "")}/api/v1/webhooks/whatsapp`
    };
  }

  /** Meta checks a callback address by asking for a challenge back. */
  verify(mode: string | undefined, token: string | undefined, challenge: string | undefined) {
    if (mode !== "subscribe" || !env("WHATSAPP_VERIFY_TOKEN") || token !== env("WHATSAPP_VERIFY_TOKEN")) throw new BadRequestException("That is not the verify token this platform expects.");
    return challenge ?? "";
  }

  signatureOk(raw: Buffer, header: string | undefined): boolean {
    const secret = env("WHATSAPP_APP_SECRET");
    if (!secret) return true; // unsigned until the app secret is set; the status page says so
    if (!header?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const given = header.slice(7);
    return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  }

  /** What Meta tells us afterwards: a message was delivered, read, or refused; a template was approved or rejected. */
  async handle(body: { entry?: Array<{ changes?: Change[] }> }) {
    let statuses = 0;
    let templates = 0;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "message_template_status_update" && change.value?.message_template_name) {
          const approved = change.value.event === "APPROVED";
          const rejected = change.value.event === "REJECTED";
          if (!approved && !rejected) continue;
          const updated = await prisma.messageTemplate.updateMany({ where: { metaTemplateId: change.value.message_template_name, retiredAt: null }, data: { approvalStatus: approved ? "APPROVED" : "REJECTED", reviewNote: rejected ? change.value.reason ?? "Rejected by Meta" : null } });
          templates += updated.count;
          continue;
        }
        for (const status of change.value?.statuses ?? []) {
          if (!status.id) continue;
          const row = await prisma.notificationLog.findFirst({ where: { channel: "WHATSAPP", metadata: { path: ["ref"], equals: status.id } } });
          if (!row) continue;
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          const stamp = new Date().toISOString();
          if (status.status === "delivered") await prisma.notificationLog.update({ where: { id: row.id }, data: { metadata: { ...meta, whatsapp: "delivered", deliveredAt: stamp } as Prisma.InputJsonValue } });
          else if (status.status === "read") await prisma.notificationLog.update({ where: { id: row.id }, data: { metadata: { ...meta, whatsapp: "read", readAt: stamp } as Prisma.InputJsonValue } });
          else if (status.status === "failed") {
            await prisma.notificationLog.update({ where: { id: row.id }, data: { status: "FAILED", metadata: { ...meta, whatsapp: "failed", error: status.errors?.[0]?.message ?? status.errors?.[0]?.title ?? "WhatsApp could not deliver it" } as Prisma.InputJsonValue } });
            // The credit was taken when it was sent; a message that never arrived gives it back.
            if (meta.billing !== "PLATFORM" && row.status === "SENT") {
              await prisma.notificationWallet.updateMany({ where: { schoolId: row.schoolId }, data: { whatsappBalance: { increment: 1 } } });
              await prisma.creditLedger.create({ data: { schoolId: row.schoolId, channel: "WHATSAPP", kind: "REFUND", credits: 1, note: `Not delivered by WhatsApp · ${row.title.slice(0, 80)}` } });
            }
          }
          statuses += 1;
        }
      }
    }
    return { statuses, templates };
  }

  /** Send a template to Meta for approval. The answer comes back through the webhook; until then it waits. */
  async submitTemplate(session: SessionPayload, templateId: string) {
    if (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_BUSINESS_ID")) throw new BadRequestException("WhatsApp is not connected: set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ID.");
    const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.retiredAt) throw new NotFoundException("That template does not exist, or has been replaced by a newer version.");
    if (template.channel !== "WHATSAPP") throw new BadRequestException("Only a WhatsApp template goes to Meta.");
    if (template.approvalStatus === "APPROVED" && template.metaTemplateId) throw new BadRequestException("Meta has already approved it.");
    const fields = Array.from(new Set(Array.from(template.body.matchAll(/{{\s*(\w+)\s*}}/g)).map((m) => m[1])));
    const text = fields.reduce((out, field, index) => out.replaceAll(new RegExp(`{{\\s*${field}\\s*}}`, "g"), `{{${index + 1}}}`), template.body);
    const name = template.metaTemplateId || `${slug(template.name)}_v${template.version}`;
    const response = await fetch(`${API()}/${env("WHATSAPP_BUSINESS_ID")}/message_templates`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env("WHATSAPP_TOKEN")}` },
      body: JSON.stringify({
        name,
        language: env("WHATSAPP_LANGUAGE") || "en",
        category: /(commercial|promo|marketing)/i.test(template.category) ? "MARKETING" : "UTILITY",
        components: [{ type: "BODY", text, ...(fields.length ? { example: { body_text: [fields.map((field) => (/school/i.test(field) ? "Greenfield College" : "Ada"))] } } : {}) }]
      }),
      signal: AbortSignal.timeout(20_000)
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string; error_user_msg?: string } };
    if (!response.ok) throw new BadRequestException(payload.error?.error_user_msg ?? payload.error?.message ?? `Meta answered ${response.status}.`);
    await prisma.messageTemplate.update({ where: { id: template.id }, data: { metaTemplateId: name, approvalStatus: payload.status === "APPROVED" ? "APPROVED" : "PENDING_META_APPROVAL", reviewNote: null } });
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    await prisma.auditLog.create({ data: { schoolId: null, actorId: actor?.id ?? null, action: AuditAction.UPDATE, entityType: "MessageTemplate", entityId: template.id, metadata: { summary: "Template submitted to Meta", name, status: payload.status ?? "PENDING" } } });
    return { name, status: payload.status ?? "PENDING" };
  }
}
