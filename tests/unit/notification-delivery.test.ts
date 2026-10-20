import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Array<Record<string, unknown>> = [];
const state = { sms: 1, ledger: [] as Array<Record<string, unknown>>, user: { email: "a@b.co", phone: "08031112223" } as { email: string; phone: string } | null };

vi.mock("../../src/lib/db/prisma", () => ({
  prisma: {
    notificationLog: {
      findMany: async () => rows.filter((row) => ["QUEUED", "HELD"].includes(String(row.status))),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((row) => row.id === where.id)!, data),
      groupBy: async () => [],
      count: async () => 0,
    },
    user: { findUnique: async () => state.user },
    notificationWallet: {
      updateMany: async ({ data }: { data: { smsBalance: { decrement?: number; increment?: number } } }) => {
        if (data.smsBalance.decrement) {
          if (state.sms <= 0) return { count: 0 };
          state.sms -= 1;
        } else state.sms += data.smsBalance.increment ?? 0;
        return { count: 1 };
      },
    },
    creditLedger: { create: async ({ data }: { data: Record<string, unknown> }) => state.ledger.push(data) },
  },
}));

vi.mock("../../backend/src/modules/platform-policy/policy.service", () => ({ platformPolicy: { get: async () => ({ messaging: { quietFrom: "21:00", quietTo: "06:00", quietHoursOn: false, dailyCapPerRecipient: 0, maxAttempts: 3 } }) } }));

import { DeliveryService } from "../../backend/src/modules/notification-delivery/delivery.service";
import { msisdn } from "../../backend/src/modules/notification-delivery/providers";

const queue = (over: Record<string, unknown> = {}) => rows.push({ id: `r${rows.length}`, schoolId: "s1", userId: "u1", channel: "SMS", title: "Fees", body: "Pay", status: "QUEUED", metadata: { phone: "08031112223" }, sentAt: new Date(), ...over });
const answer = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

beforeEach(() => {
  rows.length = 0;
  state.sms = 1;
  state.ledger = [];
  process.env.TERMII_API_KEY = "k";
  process.env.TERMII_SENDER_ID = "FRealm";
  process.env.DELIVERY_SINCE = "2020-01-01";
});

describe("msisdn", () => {
  it("turns the ways a Nigerian number is written into one", () => {
    expect(msisdn("0803 111 2223")).toBe("2348031112223");
    expect(msisdn("+234 803 111 2223")).toBe("2348031112223");
    expect(msisdn("8031112223")).toBe("2348031112223");
    expect(msisdn("12")).toBeNull();
  });
});

describe("delivery run", () => {
  it("marks a row SENT only after the carrier accepted it, and takes one credit", async () => {
    queue();
    answer(200, { message_id: "m-1" });
    const result = await new DeliveryService().run();
    expect(result).toEqual({ sent: 1, failed: 0, held: 0 });
    expect(rows[0]!.status).toBe("SENT");
    expect(state.sms).toBe(0);
    expect(state.ledger[0]).toMatchObject({ kind: "USED", credits: -1 });
  });

  it("holds an SMS when the school has no credits, and never calls the carrier", async () => {
    state.sms = 0;
    queue();
    answer(200, { message_id: "m-1" });
    const result = await new DeliveryService().run();
    expect(result.held).toBe(1);
    expect(rows[0]!.status).toBe("HELD");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails a refused message with the carrier's words and gives the credit back", async () => {
    queue();
    answer(400, { message: "Invalid sender" });
    const result = await new DeliveryService().run();
    expect(result.failed).toBe(1);
    expect(rows[0]).toMatchObject({ status: "FAILED", metadata: expect.objectContaining({ error: "Invalid sender" }) });
    expect(state.sms).toBe(1);
    expect(state.ledger.at(-1)).toMatchObject({ kind: "REFUND" });
  });

  it("keeps a message queued through a carrier outage, then gives up after three tries", async () => {
    queue();
    answer(503, { message: "down" });
    const service = new DeliveryService();
    await service.run();
    expect(rows[0]!.status).toBe("QUEUED");
    await service.run();
    await service.run();
    expect(rows[0]!.status).toBe("FAILED");
  });

  it("leaves everything queued when no carrier has keys", async () => {
    delete process.env.TERMII_API_KEY;
    queue();
    answer(200, {});
    await new DeliveryService().run();
    expect(rows[0]!.status).toBe("QUEUED");
    expect(fetch).not.toHaveBeenCalled();
  });
});
