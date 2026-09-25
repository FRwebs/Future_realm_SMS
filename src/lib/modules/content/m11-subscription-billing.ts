import {
  armsCovered,
  channels,
  currentPlan,
  invoices,
  planComparison,
  planRates,
  planRenewal,
  ratePerMessage,
  runningItems,
  smsChannel,
  studentsBilled,
  termCost,
  topUps,
  walletValue,
  whatsappChannel,
  type ChannelBalance,
} from "@/lib/modules/billing-data";
import { naira, schoolFees } from "@/lib/modules/fees-data";
import {
  mark,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M11 · Subscription & Billing — "What this costs, and where the account
 * stands."
 *
 * A plan is billed per student per term, counted at term start, so the billed
 * figure is the same roll every other module reports. A child who joins
 * mid-term is billed pro rata at the next renewal, never retrospectively.
 */

const fees = schoolFees();

/* -------------------------------------------------------------------- Plan */

function topUpDrawer(channel: ChannelBalance): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Credits",
    title: `Top up ${channel.name}`,
    sub: `${channel.left.toLocaleString("en-NG")} credits left, at ${ratePerMessage(channel.rate)} each.`,
    tone: channel.left < 1500 ? "attention" : undefined,
    facts: [
      ["Channel", channel.name, channel.note],
      ["Balance now", channel.left.toLocaleString("en-NG"), `Worth ${naira(channel.worth)}`],
      ["Rate", `${ratePerMessage(channel.rate)} each`],
      ["Base this term", channel.base.toLocaleString("en-NG"), "Granted with the plan · does not roll over"],
      ["Topped up", channel.topped.toLocaleString("en-NG"), "Never expires, and survives a plan change"],
      ["Volume discount", "3% at 10,000 · 6% at 25,000", "Applied automatically at top-up"],
      ["When credits land", "Immediately, on a card payment"],
      ["Free alternatives", "Email and in-app", "Unlimited on every tier, and cost nothing to fall back on"],
    ],
    commitLabel: `Top up ${channel.name}`,
    commitDone: `${channel.name} topped up`,
    commitDoneBody: "The credits are on the wallet now. Topped-up credits never expire.",
  };
}

const renewDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Subscription",
  title: "Renew for next term",
  sub: `${planRenewal.term} 2026/2027, on the ${currentPlan} plan.`,
  facts: [
    ["Plan", currentPlan, `${naira(planRates[currentPlan])} per student, per term`],
    ["Students", studentsBilled.toLocaleString("en-NG"), "Counted at term start"],
    ["This term", naira(termCost)],
    ["Renews", planRenewal.date, `${planRenewal.days} days · ${planRenewal.term}`],
    ["Arms covered", String(armsCovered), "Every arm in the school"],
    ["Mid-term joiners", "Billed pro rata at the next renewal", "Never retrospectively"],
  ],
  commitLabel: "Renew the plan",
  commitDone: "Plan renewed",
  commitDoneBody: `${currentPlan} continues into ${planRenewal.term}. An invoice follows within the hour.`,
};

const switchPlanDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Subscription",
  title: "Switch plan",
  sub: "Switching takes effect next term. Nothing changes this term.",
  facts: [
    ["On today", currentPlan, `${naira(planRates[currentPlan])} per student, per term`],
    ["Standard", `${naira(studentsBilled * planRates.Standard)} a term`, "No guardian portal, no report builder"],
    ["Premium", `${naira(studentsBilled * planRates.Premium)} a term`, "Guardian portal and report builder"],
    ["Elite", `${naira(studentsBilled * planRates.Elite)} a term`, "Adds rich messaging and a named Account Manager"],
    ["Takes effect", `${planRenewal.term}, from ${planRenewal.date}`, "This term is unaffected"],
    ["Topped-up credits", "Survive a plan change", "Only base credits change with the tier"],
  ],
  commitLabel: "Switch the plan",
  commitDone: "Plan change scheduled",
  commitDoneBody: `It takes effect from ${planRenewal.date}. This term is billed as it stands.`,
};

const downloadInvoiceDrawer: DrawerSpec = {
  kicker: "Subscription",
  title: "Download an invoice",
  sub: "Every invoice Future Realm has issued to this school.",
  facts: [
    ["Latest", invoices[0]!.number, "Second Term 2026/2027"],
    ["Amount", naira(invoices[0]!.amount)],
    ["State", invoices[0]!.state, `Settled ${planRenewal.settled}`],
    ["Format", "PDF"],
  ],
};

const planTab: TabContent = {
  title: "Plan",
  desc: "What Nooria costs at your current roll, and how to change it.",
  primary: { label: "Renew for next term", drawer: renewDrawer },
  launchers: [
    { label: "Switch plan", drawer: switchPlanDrawer },
    {
      label: "Pay by card",
      drawer: {
        kicker: "Subscription",
        title: "Pay by card",
        sub: "Card details are entered on the payment page, never here.",
        facts: [
          ["Outstanding", naira(planRenewal.outstanding), `Settled ${planRenewal.settled}`],
          ["Next due", planRenewal.date, `${planRenewal.term}`],
          ["Cards on file", "Mastercard ·4417 · Verve ·2210"],
          ["Where details are entered", "On the payment page", "Nooria never holds a card number"],
        ],
      },
    },
    { label: "Download an invoice", drawer: downloadInvoiceDrawer },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 6,
        cards: [
          {
            label: "This term",
            value: naira(termCost),
            sub: `${studentsBilled.toLocaleString("en-NG")} students · ${naira(planRates[currentPlan])} each`,
          },
          { label: "Plan", value: currentPlan, sub: "Per student, per term", tone: "positive" },
          { label: "Students billed", value: studentsBilled.toLocaleString("en-NG"), sub: "Counted at term start" },
          {
            label: "Renews",
            value: planRenewal.date,
            sub: `${planRenewal.days} days · ${planRenewal.term}`,
            tone: "neutral",
          },
          { label: "Account state", value: "Good standing", sub: "Paid and current", tone: "positive" },
          {
            label: "Outstanding",
            value: naira(planRenewal.outstanding),
            sub: `Settled ${planRenewal.settled}`,
            tone: "positive",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "What is running on this account",
        tag: "2 active",
        tagTone: "positive",
        sub: "Everything currently billed to this school, and when each of them renews.",
        meta: `${currentPlan} · per student per term · next renewal ${planRenewal.date}`,
        noun: "item",
        nounPlural: "items",
        acts: [
          { label: "Switch plan", drawer: switchPlanDrawer },
          { label: "Renew for next term", primary: true, drawer: renewDrawer },
        ],
        head: ["What is running", "Basis", "Units", "Rate", "This term", "Renews", "State", ""],
        rows: runningItems.map(
          (item): TableRow => ({
            cells: [
              text(item.name, { strong: true }),
              text(item.basis),
              text(item.units, { mono: true }),
              item.rate === null
                ? text("—")
                : text(
                    item.rateUnit === "message" ? ratePerMessage(item.rate) : naira(item.rate),
                    { mono: true },
                  ),
              item.thisTerm === null
                ? text("From the wallet")
                : typeof item.thisTerm === "string"
                  ? text(item.thisTerm)
                  : text(naira(item.thisTerm), { mono: true, strong: true }),
              text(item.renews),
              pill(
                item.state,
                item.state === "Active" ? "positive" : item.state === "Low" ? "attention" : "neutral",
              ),
              item.name === "Elite plan"
                ? { kind: "action", label: "Switch", drawer: switchPlanDrawer }
                : item.name === "SMS credits"
                  ? { kind: "action", label: "Top up", drawer: topUpDrawer(smsChannel) }
                  : item.name === "WhatsApp credits"
                    ? { kind: "action", label: "Top up", drawer: topUpDrawer(whatsappChannel) }
                    : text("—"),
            ],
            keywords: item.basis,
          }),
        ),
        foot: "A plan is billed per student per term, counted at term start. A child who joins mid-term is billed pro rata at the next renewal, never retrospectively.",
      },
    ]),
    row("1fr", [
      {
        type: "facts",
        title: "Value this session",
        tag: "Presented without spin",
        tagTone: "neutral",
        sub: "What the school actually got for what it pays each term.",
        meta: "2026/2027 · to date",
        per: 5,
        facts: [
          ["Report cards generated", "1,240"],
          ["Notifications delivered", "4,120", "96% delivery rate"],
          ["Attendance records", "38,000"],
          ["Fees tracked", naira(fees.collected), `Of ${naira(fees.billed)} billed`],
          ["Guardian portal logins", "8,940", "1,161 activated families"],
          ["Score entries", "52,180"],
          ["Approvals decided", "207", "Average 2.4 days"],
          ["Exports taken", "14", "Every one logged"],
          ["Support tickets", "6", "Median first response 3.1 working hours"],
          ["Offline sessions", "1,204", "Every one synced without loss"],
        ],
      },
    ]),
    row("1.05fr 1fr", [
      {
        type: "table",
        title: "Invoices from Future Realm",
        noun: "invoice",
        nounPlural: "invoices",
        filters: [
          { label: "Kind", value: "All", options: ["All", "Term", "Credit top-up", "Migration"], column: 1 },
          { label: "State", value: "All", options: ["All", "Paid", "Outstanding"], column: 4 },
        ],
        head: ["Invoice", "Period", "Amount", "Issued", "State", "Get"],
        rows: invoices.map(
          (invoice): TableRow => ({
            cells: [
              text(invoice.number, { strong: true }),
              text(invoice.period),
              text(naira(invoice.amount), { mono: true }),
              text(invoice.issued),
              pill(invoice.state, invoice.state === "Paid" ? "positive" : "attention"),
              {
                kind: "action",
                label: "Download",
                drawer: {
                  kicker: "Invoice",
                  title: invoice.number,
                  sub: invoice.period,
                  readOnly: true,
                  readOnlyNote: "An invoice is a record of what was billed. It is never edited.",
                  facts: [
                    ["Invoice", invoice.number],
                    ["Period", invoice.period],
                    ["Amount", naira(invoice.amount)],
                    ["Issued", invoice.issued],
                    ["State", invoice.state],
                    ["Format", "PDF"],
                  ],
                },
              },
            ],
            keywords: invoice.period,
          }),
        ),
      },
      {
        type: "table",
        title: "Plan comparison",
        sub: `At ${studentsBilled.toLocaleString("en-NG")} students, per term. Switching takes effect next term.`,
        meta: `Per student, per term · you are on ${currentPlan}`,
        noun: "capability",
        nounPlural: "capabilities",
        per: 10,
        acts: [{ label: "Switch plan", primary: true, drawer: switchPlanDrawer }],
        head: ["Capability", "Standard", "Premium", "Elite"],
        rows: planComparison.map(
          (capability): TableRow => ({
            cells: [
              text(capability.label, { strong: Boolean(capability.money) }),
              capability.money
                ? text(naira(capability.money.Standard), { mono: true })
                : mark(capability.included!.Standard),
              capability.money
                ? text(naira(capability.money.Premium), { mono: true })
                : mark(capability.included!.Premium),
              capability.money
                ? text(naira(capability.money.Elite), { mono: true })
                : mark(capability.included!.Elite),
            ],
          }),
        ),
      },
    ]),
  ],
};

/* ----------------------------------------------------------------- Credits */

const creditsTab: TabContent = {
  title: "Credits",
  desc: "What is left on the channels that cost money, and how to put more on.",
  primary: { label: "Top up", drawer: topUpDrawer(smsChannel) },
  launchers: [
    { label: "Top up WhatsApp", drawer: topUpDrawer(whatsappChannel) },
    {
      label: "Set an automatic top-up",
      drawer: {
        mode: "commit",
        kicker: "Credits",
        title: "Set an automatic top-up",
        sub: "Credits are bought for you when a channel falls below a threshold you set.",
        facts: [
          ["Channel", "SMS, WhatsApp, or both"],
          ["Threshold", "The balance that triggers a top-up"],
          ["Amount", "How many credits to buy each time"],
          ["Card", "Mastercard ·4417", "Charged automatically, and a receipt is sent"],
          ["Ceiling", "A monthly limit you set", "Nothing is bought above it without you"],
        ],
        commitLabel: "Set the automatic top-up",
        commitDone: "Automatic top-up set",
        commitDoneBody: "Credits are bought when the balance falls below your threshold, up to your monthly ceiling.",
      },
    },
    { label: "Open the plan", href: "/subscription-billing/plan" },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: channels.map((channel) =>
          channel.paid
            ? {
                label: channel.name,
                value: channel.left.toLocaleString("en-NG"),
                unit: "left",
                sub: `${channel.base.toLocaleString("en-NG")} base · ${channel.topped.toLocaleString("en-NG")} topped up`,
                tone: (channel.left < 1500
                  ? "negative"
                  : channel.left < 3000
                    ? "attention"
                    : "positive") as PanelTone,
                link: "Top up",
                drawer: topUpDrawer(channel),
              }
            : {
                label: channel.name,
                value: "Free",
                sub: `${channel.used.toLocaleString("en-NG")} sent this term`,
                tone: "positive" as PanelTone,
              },
        ),
      },
    ]),
    ...(whatsappChannel.left < 1500
      ? [
          row("1fr", [
            {
              type: "note" as const,
              tone: "attention" as PanelTone,
              title: `WhatsApp is down to ${whatsappChannel.left.toLocaleString("en-NG")} credits`,
              body: "About three weeks at the current rate. Email and in-app are free and cost nothing to fall back on.",
              acts: [
                { label: "Top up WhatsApp", drawer: topUpDrawer(whatsappChannel) },
                {
                  label: "Top up automatically when low",
                  drawer: {
                    mode: "commit" as const,
                    kicker: "Credits",
                    title: "Top up WhatsApp automatically when low",
                    sub: "Credits are bought for you when the balance falls below a threshold you set.",
                    facts: [
                      ["Channel", "WhatsApp"],
                      ["Balance now", whatsappChannel.left.toLocaleString("en-NG")],
                      ["Card", "Mastercard ·4417", "Charged automatically, and a receipt is sent"],
                      ["Ceiling", "A monthly limit you set"],
                    ],
                    commitLabel: "Set it up",
                    commitDone: "Automatic top-up set",
                    commitDoneBody: "WhatsApp tops up when it falls below your threshold, up to your monthly ceiling.",
                  },
                },
              ],
            },
          ]),
        ]
      : []),
    row("1fr", [
      {
        type: "table",
        title: "Every channel",
        tag: `${naira(walletValue)} on the wallet`,
        tagTone: "neutral",
        sub: "Base credits come with the plan each term. Anything beyond them is topped up.",
        meta: "Second Term 2026/2027 · base credits reset each term · topped-up credits never expire",
        noun: "channel",
        nounPlural: "channels",
        head: ["Channel", "Base this term", "Topped up", "Used", "Balance", "Rate", "Worth", ""],
        rows: channels.map(
          (channel): TableRow => ({
            cells: [
              text(channel.name, { strong: true }),
              channel.paid ? text(channel.base.toLocaleString("en-NG"), { mono: true }) : text("Included"),
              channel.paid ? text(channel.topped.toLocaleString("en-NG"), { mono: true }) : text("—"),
              text(channel.used.toLocaleString("en-NG"), { mono: true }),
              channel.paid
                ? text(channel.left.toLocaleString("en-NG"), {
                    mono: true,
                    strong: true,
                    tone: channel.left < 1500 ? "negative" : channel.left < 3000 ? "attention" : "positive",
                  })
                : pill("Unlimited", "positive"),
              channel.paid ? text(`${ratePerMessage(channel.rate)} each`, { mono: true }) : text("Free"),
              channel.paid ? text(naira(channel.worth), { mono: true }) : text("—"),
              channel.paid
                ? { kind: "action", label: "Top up", drawer: topUpDrawer(channel) }
                : text("—"),
            ],
            keywords: channel.note,
          }),
        ),
        foot: "Email and in-app are free on every tier. SMS and WhatsApp are paid because the networks charge for them.",
      },
    ]),
    row("1.15fr 1fr", [
      {
        type: "table",
        title: "Top-up history",
        sub: "Every purchase, what it cost and what paid for it.",
        meta: `${topUps.length} top-ups · ${naira(topUps.reduce((total, entry) => total + entry.amount, 0))} this session`,
        noun: "top-up",
        nounPlural: "top-ups",
        filters: [
          { label: "Channel", value: "All", options: ["All", "SMS", "WhatsApp"], column: 1 },
          { label: "Paid by", value: "All", options: ["All", "Mastercard ·4417", "Verve ·2210", "Bank transfer"], column: 4 },
        ],
        acts: [{ label: "Top up", primary: true, drawer: topUpDrawer(smsChannel) }],
        head: ["Date", "Channel", "Credits", "Amount", "Paid by", "Invoice", ""],
        rows: topUps.map(
          (entry): TableRow => ({
            cells: [
              text(entry.date, { strong: true }),
              pill(entry.channel, entry.channel === "SMS" ? "progress" : "submitted"),
              text(entry.credits.toLocaleString("en-NG"), { mono: true }),
              text(naira(entry.amount), { mono: true, strong: true }),
              text(entry.paidBy),
              text(entry.invoice, { mono: true }),
              {
                kind: "action",
                label: "Receipt",
                drawer: {
                  kicker: "Top-up receipt",
                  title: `${entry.credits.toLocaleString("en-NG")} ${entry.channel} credits`,
                  sub: `${entry.date} · ${naira(entry.amount)}.`,
                  readOnly: true,
                  readOnlyNote: "A receipt is a record of a payment. It is never edited.",
                  facts: [
                    ["Date", entry.date],
                    ["Channel", entry.channel],
                    ["Credits", entry.credits.toLocaleString("en-NG")],
                    ["Amount", naira(entry.amount)],
                    ["Paid by", entry.paidBy],
                    ["Invoice", entry.invoice],
                    ["Expiry", "Never", "Topped-up credits survive a plan change"],
                  ],
                },
              },
            ],
            keywords: `${entry.channel} ${entry.paidBy}`,
          }),
        ),
        foot: "Topped-up credits never expire and survive a plan change. Base credits are granted per term and do not roll over.",
      },
      {
        type: "facts",
        title: "What each channel costs",
        tag: "Shown transparently",
        tagTone: "positive",
        meta: "Top up by card and the credits land immediately",
        per: 1,
        acts: [
          { label: "Top up WhatsApp", drawer: topUpDrawer(whatsappChannel) },
          { label: "Top up SMS", primary: true, drawer: topUpDrawer(smsChannel) },
        ],
        facts: [
          ["SMS · Nigeria", `${ratePerMessage(3.8)} each`, "A short sender name saves money on every send"],
          ["SMS · international", `${ratePerMessage(11.2)} each`, "Kenya, Ghana, South Africa and the UK"],
          ["WhatsApp", `${ratePerMessage(4.4)} each`, "Billed by the conversation, not the message"],
          ["Email", "Free", "Unlimited on every tier"],
          ["In-app", "Free", "Reaches activated families only"],
          ["Base credits", "4,000 SMS and 1,500 WhatsApp", "Granted each term with the plan"],
          ["Volume discount", "3% at 10,000 · 6% at 25,000", "Applied automatically at top-up"],
          ["Expiry", "Topped-up credits never expire", "They survive a plan change"],
        ],
      },
    ]),
  ],
};

/* ----------------------------------------------------------------- Account */

const accountTab: TabContent = {
  title: "Account",
  desc: "The rare, consequential settings.",
  primary: {
    label: "Save settings",
    drawer: {
      mode: "commit",
      kicker: "Account",
      title: "Save account settings",
      sub: "Contacts, communications preferences and the web address.",
      facts: [
        ["Billing contact", "Dr Emmanuel Nwosu · Proprietor", "Who Future Realm writes to about money"],
        ["School contact", "Adaeze Nwosu · Principal"],
        ["Future Realm communications", "Product and billing only", "Marketing declined"],
        ["Takes effect", "Immediately"],
      ],
      commitLabel: "Save settings",
      commitDone: "Account settings saved",
      commitDoneBody: "Future Realm writes to the contacts you named, about what you allowed.",
    },
  },
  launchers: [
    {
      label: "Transfer ownership",
      drawer: {
        mode: "commit",
        kicker: "F10 · ownership transfer",
        title: "Transfer ownership",
        sub: "A transfer creates a new account for the incoming owner.",
        facts: [
          ["Outgoing owner", "Dr Emmanuel Nwosu · Proprietor"],
          [
            "The incoming owner",
            "Gets a new account of their own",
            "They never receive the outgoing owner's login",
          ],
          [
            "Why",
            "Handing over a login destroys the audit trail",
            "Every action either owner took would become indistinguishable",
          ],
          ["Outgoing access", "Revoked when the transfer completes"],
          ["The record", "Kept in full", "Who owned the account, and when"],
        ],
        commitLabel: "Start the transfer",
        commitDone: "Transfer started",
        commitDoneBody: "The incoming owner has been invited to their own account. Nothing is revoked until they accept.",
      },
    },
  ],
  rows: [
    row("1.1fr 1fr", [
      {
        type: "facts",
        title: "Data processing agreement",
        tag: "Accepted",
        tagTone: "positive",
        sub: "Version, acceptance record and full text, readable here.",
        per: 2,
        acts: [
          {
            label: "Read full text",
            drawer: {
              kicker: "Data processing agreement",
              title: "Version 4.0 · issued 1 July 2026",
              sub: "What Future Realm may do with this school's data, and what it may not.",
              readOnly: true,
              readOnlyNote: "The agreement is a record of what was accepted. It is not edited here.",
              facts: [
                ["Data controller", "Grace International Academy", "The school decides what is collected and why"],
                ["Processor", "Future Realm Agency Ltd", "Acts only on the school's instructions"],
                ["Hosting country", "Nigeria · Lagos region"],
                ["Retention on closure", "90 days, then permanent deletion"],
                ["Data Protection Officer", "Mrs Chinelo Obi · dpo@graceacademy.ng"],
                ["Accepted on", "8 July 2026, 10:42", "By Dr Emmanuel Nwosu · Proprietor"],
              ],
            },
          },
        ],
        facts: [
          ["Version", "4.0 · issued 1 July 2026"],
          ["Accepted on", "8 July 2026, 10:42"],
          ["Accepting officer", "Dr Emmanuel Nwosu · Proprietor"],
          ["Hosting country", "Nigeria · Lagos region"],
          ["Retention on closure", "90 days, then permanent deletion"],
          ["Data Protection Officer", "Mrs Chinelo Obi · dpo@graceacademy.ng"],
        ],
      },
      {
        type: "facts",
        title: "Contacts and web address",
        sub: "Who Future Realm writes to, and where your school lives.",
        per: 2,
        facts: [
          ["Billing contact", "Dr Emmanuel Nwosu · Proprietor"],
          ["School contact", "Adaeze Nwosu · Principal"],
          ["Account Manager", "Tobi Aluko · Future Realm"],
          ["Future Realm communications", "Product and billing only", "Marketing declined"],
          ["Web address", "graceacademy.nooria.app", "Issued 11 March 2024"],
          ["Change of address", "By request", "Old links keep working for 12 months"],
        ],
      },
    ]),
    row("1fr 1fr", [
      {
        type: "note",
        tone: "sensitive",
        icon: "M9.5 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1.2A4.6 4.6 0 0 1 7.6 14h3.8a4.6 4.6 0 0 1 4.6 4.8V20",
        title: "Ownership transfer creates a new account for the incoming owner",
        body: "The incoming owner never receives the outgoing owner's login. Handing over a login destroys the audit trail that protects the school — every action either owner took would become indistinguishable.",
        acts: [
          {
            label: "Start a transfer",
            drawer: {
              mode: "commit",
              kicker: "F10 · ownership transfer",
              title: "Transfer ownership",
              sub: "A transfer creates a new account for the incoming owner.",
              facts: [
                ["Outgoing owner", "Dr Emmanuel Nwosu · Proprietor"],
                ["The incoming owner", "Gets a new account of their own"],
                ["Outgoing access", "Revoked when the transfer completes"],
              ],
              commitLabel: "Start the transfer",
              commitDone: "Transfer started",
              commitDoneBody: "The incoming owner has been invited to their own account.",
            },
          },
        ],
      },
      {
        type: "note",
        tone: "negative",
        title: "Closure is blocked until a full export has been delivered",
        body: "Only the Proprietor can request closure, and the request cannot proceed until a full-school export has been generated and downloaded.",
        acts: [
          {
            label: "Generate a full export",
            drawer: {
              mode: "commit",
              kicker: "F11 · full export",
              title: "Generate a full-school export",
              sub: "Everything this school holds, in a format it can read without Nooria.",
              facts: [
                ["What is in it", "Students, staff, attendance, scores, cards, fees, messages, audit"],
                ["Format", "CSV per table, plus PDFs of every issued report card"],
                ["Who may take it", "The Proprietor only", "Re-authentication and a code to his phone"],
                ["Logged", "Yes", "Every export is on the audit record"],
                ["How long", "Up to an hour", "You are told when it is ready"],
              ],
              commitLabel: "Generate the export",
              commitDone: "Export started",
              commitDoneBody: "You will be told when it is ready. The export is logged against your name.",
            },
          },
          {
            label: "About closure",
            drawer: {
              kicker: "Account",
              title: "How closure works",
              sub: "What has to happen before an account can be closed, and what happens after.",
              readOnly: true,
              readOnlyNote: "Closure is requested from here once a full export has been delivered.",
              facts: [
                ["Who may request it", "The Proprietor only"],
                ["Blocked until", "A full export has been generated and downloaded"],
                ["Notice", "30 days", "The school can cancel at any point inside it"],
                ["Retention after closure", "90 days, then permanent deletion"],
                ["Report cards already issued", "Stay with the families who hold them"],
                ["Reversible", "Within the notice period only"],
              ],
            },
          },
        ],
      },
    ]),
  ],
};

export const subscriptionBillingContent: ModuleContent = {
  plan: planTab,
  credits: creditsTab,
  account: accountTab,
};
