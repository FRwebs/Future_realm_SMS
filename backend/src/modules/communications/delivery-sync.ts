import { MessageDeliveryStatus } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The carrier answered for one queued message: carry it back to the recipient's row on the send that made it, and keep that send's counts
 * true. A message is only "delivered" here once a carrier said so.
 */
export async function reflectCarrierAnswer(logId: string, status: "SENT" | "FAILED", reason?: string) {
  const delivery = await prisma.messageDelivery.findFirst({ where: { logId } });
  if (!delivery) return;
  await prisma.messageDelivery.update({
    where: { id: delivery.id },
    data: status === "SENT" ? { status: MessageDeliveryStatus.DELIVERED, deliveredAt: new Date(), failureReason: null } : { status: MessageDeliveryStatus.FAILED, failureReason: reason ?? "The carrier did not accept it." },
  });
  const counts = await prisma.messageDelivery.groupBy({ by: ["status"], where: { campaignId: delivery.campaignId }, _count: { _all: true } });
  const of = (state: MessageDeliveryStatus) => counts.find((row) => row.status === state)?._count._all ?? 0;
  await prisma.messageCampaign.update({ where: { id: delivery.campaignId }, data: { deliveredCount: of(MessageDeliveryStatus.DELIVERED), failedCount: of(MessageDeliveryStatus.FAILED) } });
}
