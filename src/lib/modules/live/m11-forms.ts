import { area, checks, choice, fixed, select, text, toggle } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import type { Account, Credits, InvoiceRow, Plan } from "@/lib/modules/live/m11-types";
import type { DrawerSpec } from "@/lib/modules/panels";

/** Every modal in Subscription & Billing, as data. */

export const SB = "/api/v1/subscription-billing";
export const naira = (value: number | null | undefined): string => (value === null || value === undefined ? "—" : `₦${Math.round(value).toLocaleString("en-NG")}`);
export const rate2 = (value: number): string => `₦${value.toFixed(2)}`;
const day = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

const TIER_LABEL = (name: string, rate: number) => `${name} · ${naira(rate)} each`;

/* ───────────────────────── the plan ───────────────────────── */

export function renewDrawer(p: Plan): DrawerSpec {
  const f = p.renewal;
  const now = f.startsNow;
  const target = f.target ?? f.next;
  const label = target?.label ?? "the next term";
  const estimateOptions = now ? [`Today's roll · ${f.roll}`, "A number I will type"] : [`Today's roll · ${f.roll}`, `Roll plus accepted, less leavers · ${f.suggest}`, "A number I will type"];
  const sessionLabel = f.restOfSession > 1 ? `The rest of this session · ${f.restOfSession} terms` : "The rest of this session · 1 term";
  const planOptions = f.tiers.map((tier) => TIER_LABEL(tier.name, tier.rate));
  const current = f.tiers.find((tier) => tier.key === f.tier);
  const onlyLabel = now ? "This term only" : "Next term only";
  return {
    mode: "form",
    kicker: now ? "Subscription · you are on a trial" : "Subscription · per student per term",
    title: now ? `Pay for ${label}` : `Renew for ${label}`,
    sub: now ? "You are in this term already, so paying starts it today — you are not booked for the term after." : "You are billed for the number of students you expect, not the number you have today.",
    commitLabel: "Issue the invoice",
    commitDone: now ? "Invoice issued" : "Renewal invoiced",
    commitDoneBody: now ? "Pay it now, or by bank transfer quoting its number. The trial ends and the plan you chose starts the moment it is paid." : "The invoice is issued. Pay it now, or by bank transfer quoting its number — the term is applied when it is paid.",
    reviewNote: "The count is trued up at term start, and a difference either way appears on the next invoice. Paying a session in advance is the only discount offered, and it is 5%.",
    fields: [
      fixed(now ? "Paying for" : "Renewing", `${f.tierName} · ${label}`, { hint: target ? (now ? `Starts today and runs to ${day(target.end)}` : `Runs ${day(target.start)} to ${day(target.end)}`) : "No later term is set up yet" }),
      ...(now ? [select("Plan", planOptions, { value: current ? TIER_LABEL(current.name, current.rate) : planOptions[0], hint: "Chosen now, and applies from today. You can switch later; a switch never lands mid-term." })] : [fixed("Rate", `${naira(f.rate)} per student, per term`, { hint: f.switching ? `Your scheduled switch to ${f.tierName} applies from this term.` : "Your current rate. Switching plan changes it — do that first if you intend to." })]),
      text(now ? "Students to bill for" : "Students you expect next term", { required: true, span: 2, value: String(f.suggest), unit: "students", hint: now ? `You have ${f.roll} on the roll today — that is who is billed for a term already running.` : `You have ${f.roll} on the roll today, ${f.accepted} applicants accepted${f.leavers ? ` and ${f.leavers} leaving from ${f.leaversLevel}` : ""}. A sensible estimate is ${f.suggest}.` }),
      choice("Estimate from", estimateOptions, { span: 2, value: estimateOptions[now ? 0 : 1] }),
      fixed("Estimated cost", naira(f.suggest * f.rate), { hint: `${f.suggest} students × ${naira(f.rate)} per student per term, before VAT${now ? ", at the plan above" : ""}` }),
      choice("Renew for", [onlyLabel, sessionLabel, "A full session in advance · 3 terms · 5% off"], { span: 2, value: onlyLabel, hint: "Paying a session in advance is the only discount offered, and it is 5%." }),
      choice("Pay by", ["Card · now", "Bank transfer · invoice issued"], { span: 2, value: "Card · now" }),
      toggle("Renew automatically each term", p.preferences.autoRenew, "Noted — an invoice is raised 14 days before each term", "I will renew each term myself", { span: 2 }),
      select("Remind me before the term starts", ["No reminder", "7 days before", "14 days before", "30 days before"], { value: `${p.preferences.remindDays} days before` }),
      text("Email the receipt to", { value: p.preferences.receiptEmail ?? "", optional: true, placeholder: "bursary@school.ng" }),
      select("Invoice to", ["The Proprietor", "The Principal", "The Bursar"], { value: p.preferences.invoiceTo ?? "The Proprietor" }),
    ],
    submit: { endpoint: `${SB}/plan/renew`, method: "POST", map: { "Students you expect next term": "students", "Students to bill for": "students", Plan: "plan", "Estimate from": "estimateFrom", "Renew for": "renewFor", "Pay by": "payBy", "Renew automatically each term": "autoRenew", "Remind me before the term starts": "remind", "Email the receipt to": "email", "Invoice to": "invoiceTo" } },
  };
}

export function switchDrawer(p: Plan): DrawerSpec {
  const options = p.comparison.tiers.map((tier) => TIER_LABEL(tier.name, tier.rate));
  const target = p.comparison.tiers.find((tier) => tier.key !== p.tier) ?? p.comparison.tiers[0];
  return {
    mode: "form",
    kicker: "Subscription",
    title: "Switch plan",
    sub: p.pending ? `A switch to ${p.pending.tier} is already scheduled from ${day(p.pending.from)}. Choosing again replaces it.` : "A switch never takes effect mid-term.",
    commitLabel: "Schedule the switch",
    commitDone: "Plan switch scheduled",
    commitDoneBody: "It takes effect at the start of the term you chose. Nothing changes for the rest of this term.",
    reviewNote: "You keep what you paid for until the term ends, and the new rate applies from the next one.",
    fields: [
      fixed("Currently on", `${p.tierName} · ${naira(p.rate)} per student per term`, { hint: `${naira(p.thisTerm.amount)} this term at ${p.roll.toLocaleString("en-NG")} students` }),
      choice("Switch to", options, { span: 2, required: true, value: TIER_LABEL(target.name, target.rate) }),
      ...p.comparison.tiers.filter((tier) => tier.key !== p.tier).map((tier) => ({ ...fixed(`What ${tier.name} costs you`, `${naira(tier.term)} a term`, { hint: tier.term < p.thisTerm.amount ? `Saves ${naira(p.thisTerm.amount - tier.term)} a term at your current roll` : `${naira(tier.term - p.thisTerm.amount)} more a term at your current roll` }), when: { field: "Switch to", includes: tier.name } })),
      choice("Takes effect", ["Start of next term", "Start of next session"], { span: 2, value: "Start of next term" }),
      select("Reason for the switch", ["Cost", "We do not use the extra features", "Roll is falling", "Roll is growing", "Moving to a higher tier", "Other"], { span: 2, value: "Cost", hint: "Used only to improve the product — it never changes what you are charged." }),
      toggle("Keep the credits already bought", true, "Kept · credits never expire with a plan change", "Refund them to the account", { span: 2 }),
    ],
    submit: { endpoint: `${SB}/plan/switch`, method: "POST", map: { "Switch to": "to", "Takes effect": "effective", "Reason for the switch": "reason", "Keep the credits already bought": "keepCredits" } },
  };
}

export function cancelSwitchDrawer(p: Plan): DrawerSpec {
  return { mode: "commit", kicker: "Subscription", title: "Withdraw the scheduled switch", sub: `The school stays on ${p.tierName}.`, facts: [["Scheduled", p.pending?.tier ?? "—", day(p.pending?.from)], ["After withdrawing", `${p.tierName} continues`, "Nothing is charged for withdrawing"]], commitLabel: "Withdraw it", commitDone: "Switch withdrawn", commitDoneBody: `The school stays on ${p.tierName}.`, submit: { endpoint: `${SB}/plan/switch/cancel`, method: "POST" } };
}

export function payInvoiceDrawer(p: Plan, pre?: InvoiceRow): DrawerSpec {
  const open = p.invoices.filter((invoice) => invoice.state !== "Paid");
  const labels = open.map((invoice) => `${invoice.no} · ${naira(invoice.total)} · ${invoice.period}`);
  const chosen = pre ? labels[open.findIndex((invoice) => invoice.id === pre.id)] : labels[0];
  return {
    mode: "form",
    kicker: "Subscription · payment",
    title: open.length ? `Pay ${naira(pre?.total ?? open[0].total)} by card` : "Pay by card",
    sub: open.length ? "Nothing is charged until you confirm on the payment provider's page." : "There is no unpaid invoice.",
    commitLabel: "Continue to payment",
    commitDone: "Payment started",
    commitDoneBody: "Continue to the payment provider to finish. The invoice is marked paid when the payment clears.",
    reviewNote: "Your card number is entered on the payment provider's page — never here. If the payment fails nothing is charged and the account stays exactly as it is.",
    fields: open.length
      ? [
          select("Paying for", labels, { required: true, span: 2, value: chosen, hint: "The invoice is issued to the contact named on it." }),
          text("Email the receipt to", { value: p.preferences.receiptEmail ?? "", placeholder: "bursary@school.ng" }),
          toggle("Keep this card on file", false, "Used for automatic top-ups, and removable any time", "Do not keep it", { span: 2 }),
          fixed("Next step", "The payment provider asks for your card, and your bank for a one-time code", { span: 2 }),
        ]
      : [fixed("Paying for", "Nothing — every invoice is paid", { span: 2 })],
    ...(open.length ? { submit: { endpoint: `${SB}/invoices/__id__/pay`, method: "POST" as const, map: { "Email the receipt to": "email", "Keep this card on file": "saveCard" }, body: { method: "Card" } } } : {}),
  };
}

/** One drawer per unpaid invoice, so the endpoint carries the invoice's own id. */
export function payOneDrawer(invoice: InvoiceRow, p: Plan): DrawerSpec {
  const base = payInvoiceDrawer(p, invoice);
  return { ...base, title: `Pay ${naira(invoice.total)} by card`, fields: [fixed("Paying for", `${invoice.no} · ${invoice.period}`, { span: 2, hint: `${naira(invoice.amount)} plus ${naira(invoice.tax)} VAT` }), text("Email the receipt to", { value: p.preferences.receiptEmail ?? "", placeholder: "bursary@school.ng" }), fixed("Next step", "The payment provider asks for your card, and your bank for a one-time code", { span: 2 })], submit: { endpoint: `${SB}/invoices/${invoice.id}/pay`, method: "POST", body: { method: "Card" }, map: { "Email the receipt to": "email" } } };
}

export function invoiceDrawer(invoice: InvoiceRow): DrawerSpec {
  return {
    mode: "output",
    kicker: "Subscription",
    title: `Download ${invoice.no}`,
    facts: [["Invoice", invoice.no, invoice.kindLabel], ["For", invoice.period], ["Amount", naira(invoice.total), `${naira(invoice.amount)} plus ${naira(invoice.tax)} VAT`], ["State", invoice.state, invoice.paidAt ? `Settled ${day(invoice.paidAt)}` : `Due ${day(invoice.due)}`], ["Format", "Printable page", "Save as PDF from the print dialog"]],
    readOnly: true,
    readOnlyNote: "Open the invoice to print it or save it as a PDF.",
  };
}

/* ───────────────────────── credits ───────────────────────── */

export function topUpDrawer(c: Credits, channel: "SMS" | "WhatsApp" = "SMS"): DrawerSpec {
  const wa = channel === "WhatsApp";
  const rate = wa ? c.pricing.whatsapp : c.pricing.sms;
  const row = c.channels.find((entry) => entry.name === channel);
  const opt = (n: number, off?: string) => `${n.toLocaleString("en-NG")} · ${naira(Math.round(n * rate * (off === "3" ? 0.97 : off === "6" ? 0.94 : 1) * 100) / 100)}${off ? ` · ${off}% off` : ""}`;
  const options = [opt(2500), opt(5000), opt(10000, "3"), opt(25000, "6"), "A number I will type"];
  return {
    mode: "form",
    kicker: "Subscription · credits",
    title: "Top up credits",
    sub: "Pick the channel, pick the quantity, pay by card.",
    commitLabel: "Issue the invoice",
    commitDone: "Top-up invoiced",
    commitDoneBody: "Pay it now, or by transfer. The credits are on the wallet the moment the payment clears.",
    reviewNote: "Topped-up credits never expire and survive a plan change. Email and in-app cost nothing. Prices shown are before VAT.",
    fields: [
      choice("Channel", ["SMS", "WhatsApp"], { span: 2, required: true, value: channel, hint: "Email and in-app are free — there is nothing to top up." }),
      fixed("Balance now", `${(row?.balance ?? 0).toLocaleString("en-NG")} ${channel} credits`, { hint: !c.configured ? "This school has no messaging wallet yet — the first top-up creates it." : c.guardians && channel === "SMS" ? `Covers about ${row?.sendsCovered ?? 0} school-wide sends to ${c.guardians} guardians` : "" }),
      fixed("Base this term", `${(wa ? c.pricing.baseWhatsapp : c.pricing.baseSms).toLocaleString("en-NG")} credits`, { hint: "Granted with the plan each term. It does not roll over." }),
      choice("How many credits", options, { span: 2, required: true, value: options[2] }),
      text("Custom amount", { optional: true, unit: "credits", hint: "Only used if you chose to type a number." }),
      fixed("Rate", `${rate2(rate)} per recipient`, { hint: wa ? "Billed by the conversation" : "160 characters a message" }),
      choice("Pay by", ["Card · now", "Bank transfer · invoice issued"], { span: 2, value: "Card · now" }),
      toggle("Top up automatically when low", c.settings.auto, "The card you pay with now is kept and charged when the balance runs low", "I will top up myself", { span: 2 }),
      select("Warn me at", ["1,000 credits", "2,000 credits", "5,000 credits"], { value: `${c.settings.warnAt.toLocaleString("en-NG")} credits` }),
      select("Who is warned", ["Me only", "The Bursar", "The Proprietor", "Everyone who can send messages"], { value: c.settings.warnWho }),
      text("Email the receipt to", { optional: true, placeholder: "bursary@school.ng" }),
    ],
    submit: { endpoint: `${SB}/credits/top-up`, method: "POST", map: { Channel: "channel", "How many credits": "quantity", "Custom amount": "custom", "Pay by": "payBy", "Top up automatically when low": "auto", "Warn me at": "warnAt", "Who is warned": "warnWho", "Email the receipt to": "email" } },
  };
}

export function creditSettingsDrawer(c: Credits): DrawerSpec {
  return {
    mode: "form",
    kicker: "Subscription · credits",
    title: "Set an automatic top-up",
    sub: "How the school wants to be warned, and what it would buy.",
    commitLabel: "Save the settings",
    commitDone: "Credit settings saved",
    commitDoneBody: "The warning applies from now. When the balance passes the threshold the card on file is charged for the same quantity; with no card on file, an invoice is issued and you are told. After three unpaid attempts it stops and asks a person to step in.",
    reviewNote: "Nothing is charged by saving this. Pay one top-up by card with \"Keep this card on file\" switched on to put a card on file.",
    fields: [
      toggle("Top up automatically when low", c.settings.auto, "Buys the same quantity when the balance passes the threshold", "I will top up myself", { span: 2 }),
      choice("Channel", ["SMS", "WhatsApp"], { span: 2, value: c.settings.autoChannel === "WHATSAPP" ? "WhatsApp" : "SMS" }),
      select("Quantity", ["2,500", "5,000", "10,000", "25,000"], { value: c.settings.autoQuantity.toLocaleString("en-NG") }),
      select("Warn me at", ["1,000 credits", "2,000 credits", "5,000 credits"], { value: `${c.settings.warnAt.toLocaleString("en-NG")} credits` }),
      select("Who is warned", ["Me only", "The Bursar", "The Proprietor", "Everyone who can send messages"], { value: c.settings.warnWho, span: 2 }),
    ],
    submit: { endpoint: `${SB}/credits/settings`, method: "PUT", map: { "Top up automatically when low": "auto", Channel: "channel", Quantity: "quantity", "Warn me at": "warnAt", "Who is warned": "warnWho" } },
  };
}

export function receiptDrawer(topUp: Credits["topUps"][number]): DrawerSpec {
  return { mode: "output", kicker: "Subscription · credits", title: `Receipt · ${topUp.invoice ?? "top-up"}`, facts: [["Date", day(topUp.at)], ["Channel", topUp.channel], ["Credits", topUp.credits.toLocaleString("en-NG")], ["Amount", naira(topUp.amount), "Before VAT"], ["Paid by", topUp.method], ["Invoice", topUp.invoice ?? "—"]], readOnly: true, readOnlyNote: "Open the invoice for the printable document." };
}

/* ───────────────────────── the account ───────────────────────── */

export function agreementDrawer(a: Account): DrawerSpec {
  return {
    mode: "form",
    kicker: "Account · agreement",
    title: "Accept the data processing agreement",
    sub: "Future Realm holds a school's records only on the basis of this agreement.",
    commitLabel: "Accept it",
    commitDone: "Agreement accepted",
    commitDoneBody: "Your name, the version and the time are on the account's record.",
    reviewNote: "Only the Proprietor can accept it, and the acceptance is permanent.",
    fields: [
      fixed("Version", a.agreement.current ?? "4.0", { hint: "The version Future Realm currently issues" }),
      fixed("Hosting", a.agreement.hosting ?? "As set out in the agreement", { hint: "Read it with your Account Manager before you accept" }),
      toggle("I have read the agreement", false, "Read and understood", "Not yet", { span: 2 }),
    ],
    submit: { endpoint: `${SB}/account/agreement`, method: "POST", body: { version: "4.0" }, map: { "I have read the agreement": "understood" } },
  };
}

export function agreementReadDrawer(a: Account): DrawerSpec {
  return {
    mode: "view",
    kicker: "Account",
    title: "Data processing agreement",
    sub: a.agreement.status === "SIGNED" ? "Accepted." : "Not yet accepted.",
    facts: [["Status", a.agreement.status === "SIGNED" ? "Accepted" : "Pending"], ["Version", a.agreement.version ?? "Not recorded"], ["Accepted on", a.agreement.acceptedAt ? day(a.agreement.acceptedAt) : "Not recorded", a.agreement.by ?? "The acceptance record was made before versions were kept"], ["Hosting", a.agreement.hosting ?? "As set out in the agreement"], ["Retention on closure", `${a.agreement.retentionDays} days, then permanent deletion`, a.agreement.retentionDefault ? "The platform default" : "Agreed for this school"]],
    readOnly: true,
    readOnlyNote: "The full legal text is issued by Future Realm with the agreement — ask your Account Manager for a copy.",
  };
}

export function preferencesDrawer(a: Account): DrawerSpec {
  return {
    mode: "form",
    kicker: "Account",
    title: "Edit contacts and preferences",
    sub: "Who Future Realm writes to, and what about.",
    commitLabel: "Save",
    commitDone: "Saved",
    commitDoneBody: "Invoices and notices go to the new contact from now on.",
    fields: [
      text("Billing contact", { required: true, span: 2, value: a.contacts.billing ?? "" }),
      text("Billing email", { required: true, value: a.contacts.billingEmail ?? "" }),
      text("School contact", { optional: true, value: a.contacts.school ?? "" }),
      text("Data Protection Officer", { optional: true, value: a.agreement.dpo?.name ?? "" }),
      text("Data Protection Officer's email", { optional: true, value: a.agreement.dpo?.email ?? "" }),
      choice("Future Realm communications", ["Product and billing only", "Product, billing and marketing"], { span: 2, value: a.contacts.productOnly ? "Product and billing only" : "Product, billing and marketing" }),
    ],
    submit: { endpoint: `${SB}/account/preferences`, method: "PUT", map: { "Billing contact": "billingContact", "Billing email": "billingEmail", "School contact": "schoolContact", "Data Protection Officer": "dpoName", "Data Protection Officer's email": "dpoEmail", "Future Realm communications": "comms" } },
  };
}

export function transferDrawer(a: Account): DrawerSpec {
  return {
    mode: "form",
    kicker: "Account · ownership",
    title: "Start an ownership transfer",
    sub: "Evidence, notice, then dual approval by Future Realm.",
    commitLabel: "Send the request",
    commitDone: "Transfer requested",
    commitDoneBody: "Future Realm reviews the evidence, gives notice, and approves in two steps. Nothing changes until then.",
    reviewNote: "The incoming owner gets a new account with a new sign-in. A login is never handed over — doing so destroys the audit trail that protects the school.",
    steps: [
      { title: "Evidence", hint: "Why ownership is changing.", fields: [select("Basis for the transfer", ["Sale of the school", "Inheritance", "Court order", "Restructure"], { required: true, span: 2 }), text("Document", { required: true, span: 2, placeholder: "transfer-deed-2026.pdf", hint: "Reviewed by Future Realm before approval." }), area("Summary for the record", { span: 2, required: true })] },
      { title: "Incoming owner", hint: "Who will own the school.", fields: [text("Full name", { required: true, span: 2 }), text("Email", { required: true }), text("Phone number", { required: true }), fixed("They receive", "A new account with a new User ID", { span: 2, hint: `${a.school.ownerName ?? "The outgoing owner"}'s login is retired, and its history preserved. Notice period: 14 days.` })] },
    ],
    submit: { endpoint: `${SB}/account/ownership-transfer`, method: "POST", map: { "Basis for the transfer": "basis", Document: "document", "Summary for the record": "summary", "Full name": "name", Email: "email", "Phone number": "phone" } },
  };
}

export function exportDrawer(a: Account): DrawerSpec {
  const total = Object.values(a.counts).reduce((sum, n) => sum + n, 0);
  return {
    mode: "form",
    kicker: "Account · full export",
    title: "Generate a full export",
    sub: "Re-authentication and a code, then notice to the Proprietor and Principal.",
    commitLabel: "Generate the export",
    commitDone: "Export generated",
    commitDoneBody: "Open the export to download each dataset. It is logged, the leadership has been told, and it expires in 24 hours.",
    reviewNote: "This export contains every student, guardian, score, payment and audit entry in the school. Available on every tier, in CSV that Excel opens — never PDF.",
    steps: [
      { title: "Scope", hint: `${total.toLocaleString("en-NG")} rows across ${a.datasets.length} datasets.`, fields: [checks("Datasets", a.datasets.map((name) => `${name}`), a.datasets.map((name) => name), { span: 2, required: true, hint: "Each is a separate CSV file." })] },
      { title: "Re-authenticate", hint: "One compromised account must not extract every child's record.", fields: [text("Your password", { required: true, span: 2, type: "password", placeholder: "Enter your password to continue" }), ...(a.userMfa ? [text("Six-digit code", { required: true, placeholder: "000000", hint: "From your authenticator app, or a backup code." })] : [fixed("Two-factor", "Not set up on this account", { hint: "Turn on two-factor sign-in in your profile to require a code here too." })])] },
    ],
    submit: { endpoint: `${SB}/account/export`, method: "POST", map: { Datasets: "datasets", "Your password": "password", "Six-digit code": "code" } },
  };
}

export function closureDrawer(a: Account): DrawerSpec {
  return {
    mode: "form",
    kicker: "Account · closure",
    title: "Request closure of the account",
    sub: a.exportDelivered ? "A full export has been downloaded, so closure can be requested." : "Closure is blocked until a full export has been downloaded.",
    commitLabel: "Request closure",
    commitDone: "Closure requested",
    commitDoneBody: "Future Realm will confirm. The school's data is kept for 90 days, then permanently deleted.",
    reviewNote: "Only the Proprietor can request closure. Nothing is deleted today.",
    fields: a.exportDelivered
      ? [area("Why the school is closing its account", { span: 2, required: true }), toggle("I understand closure", false, "Understood — data is kept 90 days, then deleted", "Not yet", { span: 2 })]
      : [fixed("What is needed first", "A full-school export, generated and downloaded", { span: 2, hint: "Use “Generate a full export”, then download each dataset." })],
    ...(a.exportDelivered ? { submit: { endpoint: `${SB}/account/closure`, method: "POST" as const, map: { "Why the school is closing its account": "reason", "I understand closure": "confirm" } } } : { readOnly: true, readOnlyNote: "Generate and download a full export first." }),
  };
}

export const countText = (n: number) => plural(n, "row");

export function removeCardDrawer(card: { id: string; brand: string | null; last4: string }): DrawerSpec {
  return { mode: "commit", kicker: "Subscription · credits", title: "Remove the card on file", sub: `${card.brand ?? "Card"} ending ${card.last4}`, facts: [["Automatic top-up", "Stops charging this card", "An invoice is issued instead, and you are told"]], commitLabel: "Remove the card", commitDone: "Card removed", commitDoneBody: "It will not be charged again.", submit: { endpoint: `${SB}/card/${card.id}/remove`, method: "POST" } };
}
