import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { accountTab } from "@/lib/modules/live/m11-account";
import { creditsTab } from "@/lib/modules/live/m11-credits";
import { agreementDrawer, cancelSwitchDrawer, closureDrawer, creditSettingsDrawer, exportDrawer, payOneDrawer, renewDrawer, switchDrawer, topUpDrawer, transferDrawer } from "@/lib/modules/live/m11-forms";
import { planTab } from "@/lib/modules/live/m11-plan";
import type { Account, Credits, Plan } from "@/lib/modules/live/m11-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/lib/api/server", () => ({ apiGet: async () => ({}) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

function plan(over: Partial<Plan> = {}): Plan {
  return {
    school: { name: "Greenfield College", currency: "NGN", billingStatus: "ACTIVE", status: "ACTIVE", trialEndsAt: null },
    term: { id: "t-2", label: "Second Term 2025/2026" },
    next: { id: "t-3", label: "Third Term 2025/2026", start: "2027-01-02T00:00:00.000Z", end: "2027-04-08T00:00:00.000Z" },
    daysToRenew: 77,
    tier: "ELITE", tierName: "Elite", rate: 1200, roll: 185,
    thisTerm: { amount: 222000, students: 185, billed: false, invoice: null },
    account: { state: "Paid and current", outstanding: 0, outstandingCount: 0, lastSettled: "2026-04-01T00:00:00.000Z" },
    running: [
      { name: "Elite plan", basis: "Per student, per term", units: 185, rate: 1200, thisTerm: 222000, renews: "2027-01-02T00:00:00.000Z", state: "Active", action: "Switch" },
      { name: "SMS credits", basis: "4,000 base, then pay as you go", units: 1840, rate: 3.8, thisTerm: null, renews: null, state: "Low", action: "Top up SMS" },
    ],
    value: [["Report cards generated", "10", ""], ["Fees tracked", "₦160,000", "Payments received and recorded"]],
    invoices: [{ id: "i-1", no: "FR-INV-2026-0001", kind: "ONE_OFF", kindLabel: "One-off", period: "Plan · monthly", amount: 250000, tax: 18750, total: 268750, issued: "2026-04-01T00:00:00.000Z", due: "2026-04-07T00:00:00.000Z", paidAt: "2026-04-02T00:00:00.000Z", state: "Paid", termLabel: null }],
    comparison: { roll: 185, tiers: [{ key: "STANDARD", name: "Standard", rate: 600, term: 111000, session: 333000 }, { key: "PREMIUM", name: "Premium", rate: 900, term: 166500, session: 499500 }, { key: "ELITE", name: "Elite", rate: 1200, term: 222000, session: 666000 }], capabilities: [{ label: "Guardian portal", standard: false, premium: true, elite: true }] },
    pending: null,
    renewal: { current: "Second Term 2025/2026", next: { id: "t-3", label: "Third Term 2025/2026", start: "2027-01-02T00:00:00.000Z", end: "2027-04-08T00:00:00.000Z" }, restOfSession: 1, roll: 185, accepted: 3, leavers: 10, leaversLevel: "SSS 3", suggest: 178, rate: 1200, tier: "ELITE", tierName: "Elite", switching: false },
    preferences: { autoRenew: false, remindDays: 14, invoiceTo: null, receiptEmail: null },
    gateway: "test",
    ...over,
  };
}

function credits(over: Partial<Credits> = {}): Credits {
  return {
    configured: true, term: "Second Term 2025/2026", guardians: 91, threshold: 320, lastToppedUpAt: null,
    channels: [
      { key: "SMS", name: "SMS", paid: true, rate: 3.8, base: 4000, topped: 0, used: 399, balance: 1840, note: "160 characters a message", sendsCovered: 20 },
      { key: "WHATSAPP", name: "WhatsApp", paid: true, rate: 4.4, base: 1500, topped: 0, used: 0, balance: 320, note: "" },
      { key: "EMAIL", name: "Email", paid: false, rate: 0, base: 0, topped: 0, used: 2, balance: 0, note: "" },
      { key: "IN_APP", name: "In-app", paid: false, rate: 0, base: 0, topped: 0, used: 0, balance: 0, note: "" },
    ],
    topUps: [], pricing: { sms: 3.8, whatsapp: 4.4, smsInternational: 11.2, baseSms: 4000, baseWhatsapp: 1500 },
    settings: { auto: false, autoChannel: "SMS", autoQuantity: 10000, warnAt: 2000, warnWho: "The Bursar" }, gateway: "test",
    ...over,
  };
}

function account(over: Partial<Account> = {}): Account {
  return {
    school: { name: "Greenfield College", ownerName: "Olubunmi Akinyele", ownerEmail: "proprietor@greenfieldcollege.ng", country: "Nigeria" },
    agreement: { status: "SIGNED", version: null, acceptedAt: null, by: null, hosting: null, retentionDays: 90, retentionDefault: true, dpo: null },
    contacts: { billing: "Olubunmi Akinyele", billingEmail: null, school: "Tunde Adeyemi · Principal", manager: "Nosa Igbinovia", managerEmail: "sales@futurerealm.sms", productOnly: true },
    address: { subdomain: "greenfield-college", issued: "2026-10-07T00:00:00.000Z" },
    tier: "ELITE", transfer: null, transfers: [], exports: [], exportDelivered: false, closure: null,
    counts: { Students: 185, Staff: 30 }, datasets: ["Students", "Staff"], canOwn: true, userMfa: false,
    ...over,
  };
}

describe("M11 Plan", () => {
  it("works the cost out from the roll, and says when it is only an estimate", () => {
    const html = markup(planTab(plan(), credits()));
    expect(html).toContain("₦222,000");
    expect(html).toContain("185 students · ₦1,200 each · estimate");
  });

  it("says a term has begun rather than counting a negative number of days", () => {
    const html = markup(planTab(plan({ daysToRenew: -161 }), credits()));
    expect(html).toContain("Began 161 days ago");
  });

  it("flags a low wallet on the line that sells the credits", () => {
    expect(markup(planTab(plan(), credits()))).toContain("Low");
  });

  it("offers to pay an unpaid invoice and shows an overdue one as such", () => {
    const unpaid = { id: "i-2", no: "FR-INV-2026-0002", kind: "TERMLY" as const, kindLabel: "Termly plan", period: "Third Term · 175 students", amount: 210000, tax: 15750, total: 225750, issued: "2026-10-01T00:00:00.000Z", due: "2026-04-01T00:00:00.000Z", paidAt: null, state: "Overdue" as const, termLabel: "Third Term" };
    const html = markup(planTab(plan({ invoices: [unpaid], account: { state: "Overdue", outstanding: 225750, outstandingCount: 1, lastSettled: null } }), credits()));
    expect(html).toContain("An invoice is overdue");
    expect(html).toContain("₦225,750");
  });

  it("announces a scheduled switch and lets it be withdrawn", () => {
    const p = plan({ pending: { tier: "Premium", from: "2027-01-02T00:00:00.000Z", reason: "Cost" } });
    expect(markup(planTab(p, credits()))).toContain("A switch to Premium is scheduled");
    expect(cancelSwitchDrawer(p).submit?.endpoint).toBe("/api/v1/subscription-billing/plan/switch/cancel");
  });

  it("says plainly that a trial is a trial", () => {
    expect(markup(planTab(plan({ school: { name: "G", currency: "NGN", billingStatus: "TRIAL", status: "TRIAL", trialEndsAt: "2026-12-01T00:00:00.000Z" } }), credits()))).toContain("This account is on a trial");
  });
});

describe("M11 forms", () => {
  it("does the renewal arithmetic where the school can see it", () => {
    const spec = renewDrawer(plan());
    const cost = spec.fields?.find((field) => field.label === "Estimated cost");
    expect(cost && "value" in cost ? cost.value : "").toBe("₦213,600");
    expect(spec.fields?.find((field) => field.label === "Students you expect next term")).toMatchObject({ value: "178", required: true });
    expect(spec.submit?.endpoint).toBe("/api/v1/subscription-billing/plan/renew");
  });

  it("offers only the one discount there is", () => {
    const renew = renewDrawer(plan()).fields?.find((field) => field.label === "Renew for");
    expect(renew && "options" in renew ? renew.options.join(" ") : "").toContain("5% off");
  });

  it("shows what each other plan would cost at the current roll", () => {
    const fields = switchDrawer(plan()).fields ?? [];
    expect(fields.filter((field) => field.label.startsWith("What ")).map((field) => field.label)).toEqual(["What Standard costs you", "What Premium costs you"]);
  });

  it("pays an invoice at its own address, with the card entered on the provider's page", () => {
    const invoice = plan().invoices[0];
    const spec = payOneDrawer({ ...invoice, state: "Outstanding" }, plan());
    expect(spec.submit?.endpoint).toBe("/api/v1/subscription-billing/invoices/i-1/pay");
    expect(spec.reviewNote).toContain("never here");
  });

  it("prices a top-up with the volume discount and says VAT is extra", () => {
    const spec = topUpDrawer(credits(), "SMS");
    const quantity = spec.fields?.find((field) => field.label === "How many credits");
    expect(quantity && "options" in quantity ? quantity.options.join(" | ") : "").toContain("10,000 · ₦36,860 · 3% off");
    expect(spec.reviewNote).toContain("before VAT");
  });

  it("says what an automatic top-up does: charges the card on file, else invoices, and stops after three", () => {
    expect(creditSettingsDrawer(credits()).commitDoneBody).toContain("After three unpaid attempts it stops");
  });

  it("asks for the password, and for a code only where the account has one", () => {
    const without = exportDrawer(account()).steps?.[1].fields.map((field) => field.label);
    const withMfa = exportDrawer(account({ userMfa: true })).steps?.[1].fields.map((field) => field.label);
    expect(without).toContain("Your password");
    expect(without).not.toContain("Six-digit code");
    expect(withMfa).toContain("Six-digit code");
  });

  it("will not offer closure before an export has been delivered", () => {
    expect(closureDrawer(account()).submit).toBeUndefined();
    expect(closureDrawer(account({ exportDelivered: true })).submit?.endpoint).toBe("/api/v1/subscription-billing/account/closure");
  });

  it("never hands over a login in an ownership transfer", () => {
    const spec = transferDrawer(account());
    expect(spec.reviewNote).toContain("never handed over");
    expect(spec.steps?.length).toBe(2);
  });

  it("makes accepting the agreement a deliberate act", () => {
    expect(agreementDrawer(account()).fields?.find((field) => field.label === "I have read the agreement")).toMatchObject({ kind: "toggle", on: false });
  });
});

describe("M11 Credits", () => {
  it("says there is no wallet rather than showing zeros as if there were one", () => {
    expect(markup(creditsTab(credits({ configured: false })))).toContain("This school has no messaging wallet yet");
  });

  it("warns on a channel that has fallen below the school's own threshold", () => {
    const html = markup(creditsTab(credits()));
    expect(html).toContain("SMS is down to 1,840 credits");
    expect(html).toContain("WhatsApp is down to 320 credits");
  });

  it("does not warn when the balance is above the threshold", () => {
    const rows = credits();
    rows.channels[0].balance = 9000;
    rows.channels[1].balance = 9000;
    expect(markup(creditsTab(rows))).not.toContain("is down to");
  });

  it("calls email and in-app free", () => {
    expect(markup(creditsTab(credits()))).toContain("Unlimited");
  });
});

describe("M11 Account", () => {
  it("does not invent an acceptance record it does not have", () => {
    const html = markup(accountTab(account()));
    expect(html).toContain("Signed before versions were kept");
  });

  it("is critical about an agreement nobody has accepted", () => {
    const html = markup(accountTab(account({ agreement: { ...account().agreement, status: "PENDING" } })));
    expect(html).toContain("has not been accepted");
  });

  it("says closure is blocked until a full export has been delivered", () => {
    expect(markup(accountTab(account()))).toContain("Closure is blocked until a full export has been delivered");
    expect(markup(accountTab(account({ exportDelivered: true })))).toContain("closure can be requested");
  });

  it("shows a transfer in progress instead of offering another", () => {
    const html = markup(accountTab(account({ transfer: { id: "t-1", status: "NOTICE_SENT", createdAt: "2026-10-01T00:00:00.000Z", holdExpiresAt: null } })));
    expect(html).toContain("An ownership transfer is in progress");
    expect(html).not.toContain("Start a transfer");
  });

  it("keeps ownership actions away from anyone who is not the Proprietor", () => {
    const html = markup(accountTab(account({ canOwn: false, agreement: { ...account().agreement, status: "PENDING" } })));
    expect(html).not.toContain("Accept the agreement");
  });
});
