import { prisma } from "../../../../src/lib/db/prisma";
import { TRIGGERS, TRIGGER_KEYS, type TriggerKey } from "../../../../src/lib/domain/message-triggers";

export { TRIGGERS, TRIGGER_KEYS };
export type { TriggerKey };

export const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => (name in vars ? String(vars[name]) : whole));

/** The wording for a trigger: the approved template attached to it, else what the code would have said. */
export async function renderTrigger(key: TriggerKey, vars: Record<string, string | number>, fallback: { subject: string; body: string }) {
  const template = await prisma.messageTemplate.findFirst({ where: { triggerKey: key, retiredAt: null, approvalStatus: "APPROVED" }, orderBy: { updatedAt: "desc" } });
  if (!template) return { ...fallback, templateId: null as string | null };
  return { subject: template.name, body: fill(template.body, vars), templateId: template.id as string | null };
}
