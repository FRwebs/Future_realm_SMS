import { apiGet } from "@/lib/api/server";
import { deliveryRow, type DeliveryStatus } from "@/lib/modules/live/m12-delivery";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type PanelTone,
  type TabContent,
  type TableRow,
  type TileItem,
} from "@/lib/modules/panels";

/**
 * M12 Communication Center, read from `/v1/communication-center`.
 *
 * The rule the mockup repeats and this module keeps: the number you approve is
 * the number that gets delivered. Every count here is reach — people who can
 * actually be contacted — never the size of the audience before the ones with
 * no phone number are taken out.
 */

const BASE = "/api/v1/communication-center";

type Audience = {
  key: string;
  matched: number;
  unreachable: number;
  reach: number;
  credits: number;
  naira: number;
  description: string;
};

type Campaign = {
  id: string;
  name: string;
  channel: string;
  audienceLabel: string;
  status: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  creditsUsed: number;
  thresholdAt: number | null;
  decisionNote: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  senderName: string;
  senderRole: string | null;
  approvedBy: string | null;
};

type Failure = {
  id: string;
  recipientName: string;
  destination: string | null;
  campaignName: string;
  reason: string | null;
  at: string;
};

type CampaignsPayload = {
  threshold: number | null;
  wallet: { sms: number; low: boolean } | null;
  stats: {
    campaigns: number;
    creditsUsed: number;
    naira: number;
    awaiting: number;
    failed: number;
    scheduled: number;
  };
  campaigns: Campaign[];
  failures: Failure[];
};

type Rule = {
  id: string;
  name: string;
  channel: string;
  timing: string | null;
  audience: string;
  isActive: boolean;
  isMandatory: boolean;
  lockedReason: string | null;
  lastRunAt: string | null;
  sendCount: number;
};

type RulesPayload = {
  stats: { total: number; enabled: number; mandatory: number };
  rules: Rule[];
};

type Template = {
  id: string;
  name: string;
  channel: string;
  owner: string;
  version: number;
  variables: string[];
  body: string;
  lastUsedAt: string | null;
};

/* The mockup's own glyphs, kept so the tiles read as the same control. */
const ICON = {
  person: "M9.5 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1.2A4.6 4.6 0 0 1 7.6 14h3.8a4.6 4.6 0 0 1 4.6 4.8V20",
  tick: "M5 12.5l4.5 4.5 9-10",
  envelope: "M4 5.5h16v13H4zM4 6l8 6 8-6",
  staff: "M6.5 20v-1.2A4.6 4.6 0 0 1 11 14h2a4.6 4.6 0 0 1 4.5 4.8V20M12 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  globe: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M3.5 12h17M12 3.5a13 13 0 0 1 0 17a13 13 0 0 1 0-17",
  coins: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M9.5 9.6h5M9.5 14.4h5M12 6.8v10.4",
  warn: "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z",
  bell: "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5z",
  mail: "M2.5 6h19v12h-19zM2.5 6l9.5 7 9.5-7",
  sms: "M4 5.5h16v10.5H9l-5 4z",
  rich: "M4 5.5h16v13H4zM8 10h8M8 14h5",
  gear: "M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4M12 3.6v2M12 19v2M5.4 7.4l1.7 1M16.9 15.6l1.7 1",
};

const AUDIENCE_ICON: Record<string, string> = {
  "One person": ICON.person,
  "Selected people": ICON.tick,
  Guardians: ICON.envelope,
  Staff: ICON.staff,
  Everyone: ICON.globe,
};

const STATUS_TONE: Record<string, PanelTone> = {
  DRAFT: "neutral",
  AWAITING_APPROVAL: "submitted",
  SCHEDULED: "progress",
  SENT: "positive",
  CANCELLED: "withheld",
  RETURNED: "attention",
};

function statusLabel(status: string): string {
  if (status === "AWAITING_APPROVAL") return "Awaiting";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function naira(value: number): string {
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function channelLabel(channel: string): string {
  if (channel === "IN_APP") return "In-app";
  if (channel === "SMS") return "SMS";
  if (channel === "EMAIL") return "Email";
  if (channel === "PUSH") return "Rich messaging";
  return channel;
}

/* ───────────────────────── Compose ───────────────────────── */

function composeTab(audiences: Audience[], to: string): TabContent {
  const chosen = audiences.find((item) => item.key === to) ?? audiences[2] ?? audiences[0];
  const staffTo = chosen.key === "Staff";
  const oneTo = chosen.key === "One person" || chosen.key === "Selected people";

  const tiles: TileItem[] = audiences.map((item) => ({
    label: item.key,
    sub:
      item.key === chosen.key
        ? item.description
        : `${item.matched}${item.key === "One person" ? " at a time" : " people"}`,
    tone: item.key === chosen.key ? "progress" : "neutral",
    icon: AUDIENCE_ICON[item.key],
    // The picker is a link rather than a callback: the content is written on
    // the server, so the chosen audience travels in the URL and everything
    // below recomputes against it.
    href: `/communication-center/compose?to=${encodeURIComponent(item.key)}`,
  }));

  return {
    title: "Compose",
    desc: "Write it once, see what it costs, send.",
    launchers: [
      { label: "Use a template", href: "/communication-center/automation" },
      { label: "Everything sent so far", href: "/communication-center/sent" },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "tiles",
            title: "Who is this going to",
            tag: chosen.key,
            tagTone: "progress",
            per: 5,
            tiles,
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: chosen.reach > 500 ? "attention" : "progress",
            icon: ICON.coins,
            title: `This send will reach ${chosen.reach} ${chosen.reach === 1 ? "person" : "people"} and cost ${chosen.credits} SMS credits · ${naira(chosen.naira)}`,
            body: `${chosen.matched} match, ${chosen.unreachable} cannot be reached and are excluded before this count, so ${chosen.reach} will actually receive it. The number you approve is the number that gets delivered — never an optimistic one.`,
            acts: [
              ...(chosen.unreachable
                ? [
                    {
                      label: `See the ${chosen.unreachable} who cannot be reached`,
                      href: "/parents-guardians/guardians",
                    },
                  ]
                : []),
              { label: "Switch to in-app · free", href: "/communication-center/compose?to=" + encodeURIComponent(chosen.key) },
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          oneTo
            ? {
                type: "form",
                title: chosen.key === "One person" ? "Who it goes to" : "Pick the people",
                tag: chosen.key === "One person" ? "1 recipient" : "Pick by hand",
                tagTone: "positive",
                sub: "Search the whole school — guardians and staff in one list.",
                meta: "One guardian account covers every child they have here",
                fields: [
                  { label: "Look in", kind: "choice", value: "Guardians", options: ["Guardians", "Staff", "Both"] },
                  {
                    label: "About which child",
                    kind: "select",
                    value: "Not about a specific child",
                    options: ["Not about a specific child", "Their eldest", "Choose a child"],
                    hint: "Used for merge fields like the child's first name.",
                  },
                  {
                    label: "Reachable",
                    kind: "static",
                    value: "Checked before the send unlocks",
                    hint: "Their phone number and portal state are checked before the send unlocks.",
                  },
                ],
                formNote: "A message to one person still shows its cost before it sends.",
                actions: [{ label: "Clear" }, { label: "Preview the message", primary: true }],
              }
            : {
                type: "form",
                title: "Audience",
                tag: `${chosen.reach} will receive`,
                tagTone: "positive",
                sub: staffTo
                  ? "Filter the staff list by role, department or account state."
                  : "Filters with a live count — saved as criteria, never as a frozen list.",
                meta: `${chosen.matched} matched · ${chosen.unreachable} cannot be reached · ${chosen.reach} will receive`,
                fields: staffTo
                  ? [
                      { label: "Teaching or not", kind: "select", value: "Everyone", options: ["Everyone", "Teaching staff only", "Non-teaching staff only"] },
                      { label: "Account state", kind: "select", value: "Any", options: ["Any", "Active", "Never activated", "Dormant"] },
                      {
                        label: "Cannot be reached",
                        kind: "static",
                        value: `${chosen.unreachable} excluded before the count`,
                        hint: "An account that is not active is never sent to.",
                      },
                    ]
                  : [
                      { label: "Fee status", kind: "select", value: "Any", options: ["Any", "Outstanding", "Part paid", "Paid"] },
                      { label: "Portal state", kind: "select", value: "Any", options: ["Any", "Activated", "Never activated"] },
                      { label: "Delivery health", kind: "select", value: "Reachable", options: ["Reachable", "Failing", "No number on file"] },
                      {
                        label: "Only families who consented to notifications",
                        kind: "toggle",
                        on: true,
                        onLabel: "Consent required",
                        offLabel: "Ignore consent · emergencies only",
                      },
                      {
                        label: "Cannot be reached",
                        kind: "static",
                        value: `${chosen.unreachable} excluded before the count`,
                        hint: "Listed by name so you can print for them instead. The number you approve is the number delivered.",
                      },
                    ],
                formNote: staffTo
                  ? "Staff are messaged in-app first — they all have an account, so SMS is rarely needed."
                  : "A saved segment re-runs its criteria every time, so a family who clears their fees drops out on its own.",
                actions: [
                  { label: `Preview the ${chosen.reach} recipients` },
                  { label: "Save this segment", primary: true },
                ],
              },
          {
            type: "form",
            title: "Message",
            tag: "SMS · 1 credit each",
            sub: "Merge fields resolve against a real record before you can send.",
            meta: `Sent as ${chosen.key} · ${chosen.reach} will receive`,
            per: 1,
            fields: [
              { label: "Name this send", kind: "text", value: "", placeholder: "Fee reminder · second" },
              {
                label: "Channel",
                kind: "choice",
                value: "SMS · ₦3.80 each",
                options: ["In-app · free", "SMS · ₦3.80 each", "Email", "Rich messaging"],
              },
              {
                label: "Sender",
                kind: "static",
                value: "This school's own name",
                hint: "Always the school's own name — never Future Realm, never a staff member.",
              },
              {
                label: "Message",
                kind: "area",
                value: "",
                placeholder:
                  "Dear {{guardian_title}} {{guardian_surname}}, {{student_first_name}}'s balance is now overdue. Kindly settle at the bursary.",
              },
              {
                label: "Send",
                kind: "select",
                value: "Inside the contact window · 07:00–19:00 WAT",
                options: [
                  "Inside the contact window · 07:00–19:00 WAT",
                  "Immediately, ignoring the window",
                  "Schedule a date and time",
                ],
              },
            ],
            // The cost is shown above and approved here — the send is created
            // against the audience chosen in the picker.
            submit: {
              endpoint: `${BASE}/campaigns?to=${encodeURIComponent(chosen.key)}`,
              method: "POST",
              map: { "Name this send": "name", Message: "body" },
              done: `Queued for ${chosen.reach} recipients.`,
              clearOnSuccess: ["Name this send", "Message"],
            },
            formNote: "The cost is shown and approved before anything sends — without exception.",
            actions: [
              { label: "Preview on a phone" },
              { label: `See the cost and send · ${naira(chosen.naira)}`, primary: true },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "tiles",
            title: "Channels",
            per: 4,
            tiles: [
              { label: "In-app · free", sub: "Pinning and acknowledgement tracking", icon: ICON.bell },
              { label: "Email · free on Elite", sub: "Full formatting, for families with an email on file", icon: ICON.mail },
              {
                label: "SMS · ₦3.80 each",
                sub: "160 characters · the only channel that always arrives",
                icon: ICON.sms,
                tone: "attention",
              },
              { label: "Rich messaging · ₦2.10 each", sub: "Images and attachments, for families with the app", icon: ICON.rich },
            ],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────── Sent ───────────────────────── */

function campaignDrawer(campaign: Campaign, threshold: number | null): DrawerSpec {
  const awaiting = campaign.status === "AWAITING_APPROVAL";

  return {
    kicker: channelLabel(campaign.channel),
    title: campaign.name,
    sub: `${campaign.recipientCount} recipients · ${statusLabel(campaign.status)}`,
    tone: STATUS_TONE[campaign.status] ?? "neutral",
    facts: [
      ["Audience", campaign.audienceLabel],
      ["Channel", channelLabel(campaign.channel)],
      ["Recipients", String(campaign.recipientCount)],
      ["Delivered", String(campaign.deliveredCount)],
      ["Failed", String(campaign.failedCount)],
      ["Credits used", String(campaign.creditsUsed)],
      ["Cost", naira(Math.round(campaign.creditsUsed * 3.8 * 100) / 100)],
      ["Sender", `${campaign.senderName}${campaign.senderRole ? ` · ${campaign.senderRole}` : ""}`],
      ["Raised", whenLabel(campaign.createdAt)],
      ["Scheduled", whenLabel(campaign.scheduledAt)],
      ["Sent", whenLabel(campaign.sentAt)],
      ...(campaign.thresholdAt
        ? ([["Threshold", `Above ${campaign.thresholdAt} recipients`]] as [string, string][])
        : []),
      ...(campaign.approvedBy ? ([["Decided by", campaign.approvedBy]] as [string, string][])
        : []),
      ...(campaign.decisionNote ? ([["Reason given", campaign.decisionNote]] as [string, string][]) : []),
    ],
    ...(awaiting
      ? {
          mode: "commit" as const,
          commitLabel: "Approve and send",
          commitNote: threshold
            ? `This send is above the school's ${threshold}-recipient threshold, so it waits for a Principal or Proprietor.`
            : "This send is waiting on a decision.",
          commitDone: "Approved",
          commitDoneBody: `${campaign.name} has gone to ${campaign.recipientCount} recipients.`,
          submit: {
            endpoint: `${BASE}/campaigns/${campaign.id}/decision`,
            method: "PATCH" as const,
            body: { action: "APPROVE" },
            reasonKey: "note",
            reasonLabel: "Anything to note (optional)",
          },
        }
      : { readOnly: true as const, readOnlyNote: "A send is a record of what went out. It is never edited after the fact." }),
  };
}

function sentTab(payload: CampaignsPayload): TabContent {
  const { stats, campaigns, failures, threshold, wallet } = payload;
  const awaiting = campaigns.filter((item) => item.status === "AWAITING_APPROVAL");

  const cards: KpiCard[] = [
    { label: "Campaigns this term", value: String(stats.campaigns), sub: "Sent, scheduled and recurring" },
    {
      label: "Credits used",
      value: stats.creditsUsed.toLocaleString("en-NG"),
      sub: naira(stats.naira),
    },
    {
      label: "Awaiting approval",
      value: String(stats.awaiting),
      tone: stats.awaiting > 0 ? "submitted" : "positive",
      sub: threshold ? `Above the ${threshold}-recipient threshold` : "No threshold set",
      ...(stats.awaiting > 0 ? { link: "Decide", href: "/approvals-workflow/queue" } : {}),
    },
    {
      label: "Failed deliveries",
      value: String(stats.failed),
      tone: stats.failed > 0 ? "attention" : "positive",
      sub: failures.length ? `Across ${new Set(failures.map((f) => f.campaignName)).size} campaigns` : "Nothing has failed",
    },
    {
      label: "Credits left",
      value: wallet ? wallet.sms.toLocaleString("en-NG") : "—",
      tone: wallet?.low ? "attention" : "neutral",
      sub: wallet ? (wallet.low ? "Below your threshold" : "SMS balance") : "No wallet set up",
    },
  ];

  const rows: TableRow[] = campaigns.map((campaign) => ({
    cells: [
      nameCell(
        campaign.name,
        campaign.status === "AWAITING_APPROVAL"
          ? `Awaiting approval · above the ${campaign.thresholdAt ?? threshold} threshold`
          : `${campaign.audienceLabel} · ${whenLabel(campaign.sentAt ?? campaign.createdAt)}`,
      ),
      text(channelLabel(campaign.channel)),
      text(String(campaign.recipientCount), { mono: true }),
      text(String(campaign.creditsUsed), { mono: true }),
      pill(statusLabel(campaign.status), STATUS_TONE[campaign.status] ?? "neutral"),
      nameCell(campaign.senderName, campaign.senderRole ?? ""),
      {
        kind: "action" as const,
        label: campaign.status === "AWAITING_APPROVAL" ? "Decide" : "Open",
        drawer: campaignDrawer(campaign, threshold),
      },
    ],
    drawer: campaignDrawer(campaign, threshold),
    keywords: `${campaign.audienceLabel} ${campaign.senderName}`,
  }));

  const failureRows: TableRow[] = failures.map((failure) => ({
    cells: [
      nameCell(failure.recipientName, failure.destination ?? "No number on file"),
      text(failure.campaignName),
      text(failure.reason ?? "—"),
      { kind: "action" as const, label: "Fix", href: "/parents-guardians/guardians" },
    ],
    keywords: failure.campaignName,
  }));

  return {
    title: "Sent",
    desc: "Everything sent, scheduled and failed.",
    launchers: [{ label: "Compose", href: "/communication-center/compose" }],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "What has gone out", per: 5, cards }] },
      ...(awaiting.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "submitted" as PanelTone,
                  icon: ICON.warn,
                  title: `${awaiting.length} send${awaiting.length === 1 ? " is" : "s are"} above the school threshold and awaiting your decision`,
                  body: `${awaiting[0].senderName} composed ${awaiting[0].name} to ${awaiting[0].recipientCount} recipients. The school's mass-communication threshold is ${threshold ?? "—"} recipients, so it waits here for a Principal or Proprietor.`,
                  acts: [{ label: "Review and approve", drawer: campaignDrawer(awaiting[0], threshold) }],
                },
              ],
            },
          ]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Campaigns",
            sub: campaigns.length
              ? "Sent, scheduled and recurring in one list."
              : "Nothing has been sent from this school yet.",
            meta: "Scope: the whole school",
            search: "Find a campaign by name, sender or audience",
            head: ["Campaign", "Channel", "Recipients", "Credits", "State", "Sender", ""],
            rows,
            per: 8,
            empty: "No campaign matches this filter.",
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "table",
            title: "Failed deliveries",
            sub: "By family, with the reason and a link to the record that fixes it.",
            meta: failures.length
              ? `${failures.length} failure${failures.length === 1 ? "" : "s"}`
              : "Nothing has failed",
            head: ["Family", "Campaign", "Reason", ""],
            rows: failureRows,
            per: 6,
            empty: "No delivery has failed.",
          },
          {
            type: "list",
            title: "Oversight",
            sub: "The guardrail against training parents to ignore the school.",
            items: [
              {
                label: "Sends this term",
                sub: `${stats.campaigns} campaign${stats.campaigns === 1 ? "" : "s"} · ${stats.creditsUsed.toLocaleString("en-NG")} credit${stats.creditsUsed === 1 ? "" : "s"} · ${naira(stats.naira)}`,
                pill: `${stats.campaigns}`,
              },
              {
                label: "Awaiting a decision",
                sub: threshold
                  ? `Above the ${threshold}-recipient threshold, set in Policies`
                  : "No threshold is set, so nothing is held",
                pill: String(stats.awaiting),
                tone: stats.awaiting > 0 ? "submitted" : "neutral",
              },
              {
                label: "Scheduled, not yet sent",
                sub: "Credits are only spent once a send actually goes",
                pill: String(stats.scheduled),
              },
              {
                label: "Failed deliveries",
                sub: "Each one points at the record that fixes it",
                pill: String(stats.failed),
                tone: stats.failed > 0 ? "attention" : "neutral",
              },
            ],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────── Automation ───────────────────────── */

function ruleDrawer(rule: Rule): DrawerSpec {
  return {
    kicker: rule.channel,
    title: rule.name,
    sub: rule.isMandatory ? "Mandatory · cannot be switched off" : rule.isActive ? "Enabled" : "Disabled",
    tone: rule.isMandatory ? "withheld" : rule.isActive ? "positive" : "neutral",
    facts: [
      ["Channel", rule.channel],
      ["Timing", rule.timing ?? "—"],
      ["Audience", rule.audience],
      ["State", rule.isMandatory ? "Mandatory" : rule.isActive ? "Enabled" : "Disabled"],
      ...(rule.lockedReason ? ([["Why it is locked", rule.lockedReason]] as [string, string][]) : []),
      ["Times fired", String(rule.sendCount)],
      ["Last fired", whenLabel(rule.lastRunAt)],
    ],
    ...(rule.isMandatory
      ? {
          readOnly: true as const,
          readOnlyNote:
            rule.lockedReason ??
            "This rule is mandatory and cannot be switched off by the school.",
        }
      : {
          mode: "commit" as const,
          commitLabel: rule.isActive ? "Switch it off" : "Switch it on",
          commitNote: rule.isActive
            ? "Families stop receiving this message until it is switched back on."
            : "Families begin receiving this message again.",
          commitDone: rule.isActive ? "Rule switched off" : "Rule switched on",
          commitDoneBody: `${rule.name} is now ${rule.isActive ? "off" : "on"}.`,
          submit: {
            endpoint: `${BASE}/rules/${rule.id}`,
            method: "PATCH" as const,
            body: { isActive: !rule.isActive },
          },
        }),
  };
}

function automationTab(payload: RulesPayload, templates: Template[]): TabContent {
  const { stats, rules } = payload;

  const cards: KpiCard[] = [
    { label: "Notification rules", value: String(stats.total), sub: "Channel, timing and audience each" },
    { label: "Enabled", value: String(stats.enabled), tone: "positive", sub: "Editable by the school" },
    {
      label: "Mandatory and locked",
      value: String(stats.mandatory),
      tone: "withheld",
      sub: "Each says why, in one sentence",
    },
    {
      label: "Templates",
      value: String(templates.length),
      sub: `${templates.filter((item) => item.owner === "SCHOOL").length} school-owned · versioned`,
    },
  ];

  const ruleRows: TableRow[] = rules.map((rule) => ({
    cells: [
      nameCell(rule.name, rule.lockedReason ? `Locked · ${rule.lockedReason}` : rule.audience),
      text(rule.channel),
      text(rule.timing ?? "—"),
      text(rule.audience),
      pill(
        rule.isMandatory ? "Mandatory" : rule.isActive ? "Enabled" : "Disabled",
        rule.isMandatory ? "withheld" : rule.isActive ? "positive" : "neutral",
      ),
      {
        kind: "action" as const,
        label: rule.isMandatory ? "Locked" : "Edit",
        drawer: ruleDrawer(rule),
      },
    ],
    drawer: ruleDrawer(rule),
    keywords: `${rule.channel} ${rule.audience}`,
  }));

  const templateRows: TableRow[] = templates.map((template) => ({
    cells: [
      nameCell(
        template.name,
        `${channelLabel(template.channel)} · ${template.variables.length} variable${template.variables.length === 1 ? "" : "s"}`,
      ),
      text(template.owner === "PLATFORM" ? "Future Realm" : template.owner === "SYSTEM" ? "System" : "School"),
      text(String(template.version), { mono: true }),
      text(whenLabel(template.lastUsedAt)),
    ],
    drawer: {
      kicker: channelLabel(template.channel),
      title: template.name,
      sub: `Version ${template.version} · ${template.owner === "SCHOOL" ? "school-owned" : "not editable here"}`,
      readOnly: true,
      readOnlyNote:
        "Versioned, so a sent message always renders as the version that was sent rather than as the template reads today.",
      facts: [
        ["Channel", channelLabel(template.channel)],
        ["Owner", template.owner === "PLATFORM" ? "Future Realm" : template.owner === "SYSTEM" ? "System" : "School"],
        ["Version", String(template.version)],
        ["Merge fields", template.variables.length ? template.variables.join(", ") : "None"],
        ["Last used", whenLabel(template.lastUsedAt)],
        ["Body", template.body],
      ],
    },
    keywords: template.body,
  }));

  return {
    title: "Automation",
    desc: "Messages nobody writes, and the words they use.",
    launchers: [{ label: "Compose", href: "/communication-center/compose" }],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "What sends itself", per: 4, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Notification rules",
            sub: "Each with channel, timing and audience.",
            meta: `${stats.total} rules · ${stats.mandatory} mandatory and locked`,
            search: "Find a rule",
            head: ["Rule", "Channel", "Timing", "Audience", "State", ""],
            rows: ruleRows,
            per: 9,
            empty: "No rule matches this filter.",
          },
        ],
      },
      {
        cols: "1.05fr 1fr",
        panels: [
          {
            type: "table",
            title: "Templates",
            sub: "Versioned, so a sent message always renders as the version sent.",
            meta: `${templates.length} templates · ${templates.filter((t) => t.owner === "SCHOOL").length} school-owned`,
            search: "Find a template",
            head: ["Template", "Owner", "Version", "Last used"],
            rows: templateRows,
            per: 6,
            empty: "No template matches this filter.",
          },
          {
            type: "note",
            tone: "progress",
            icon: ICON.gear,
            title: "Default channel and contact window are one record, shown in two places",
            body: "This is the same record you see in Module 2 · Policies — editing it there edits it here. The mass-communication threshold above is read from that same place.",
            acts: [{ label: "Open in Policies", href: "/school-configuration/policies" }],
          },
        ],
      },
    ],
  };
}

export async function communicationCenterLiveTab(
  tabSlug: string,
  query?: Record<string, string | undefined>,
): Promise<TabContent | undefined> {
  if (tabSlug === "compose") {
    const audiences = await apiGet<Audience[]>(`${BASE}/audience`);
    return composeTab(audiences ?? [], query?.to ?? "Guardians");
  }

  if (tabSlug === "sent") {
    const [payload, delivery] = await Promise.all([
      apiGet<CampaignsPayload>(`${BASE}/campaigns`),
      apiGet<DeliveryStatus>("/api/v1/delivery/status"),
    ]);
    const tab = sentTab(payload);
    return { ...tab, rows: [deliveryRow(delivery), ...tab.rows] };
  }

  if (tabSlug === "automation") {
    const [rules, templates] = await Promise.all([
      apiGet<RulesPayload>(`${BASE}/rules`),
      apiGet<Template[]>(`${BASE}/templates`),
    ]);
    return automationTab(rules, templates ?? []);
  }

  return undefined;
}
