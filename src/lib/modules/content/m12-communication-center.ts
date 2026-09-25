import {
  audiences,
  campaigns,
  channelTiles,
  costOf,
  defaultAudience,
  failedDeliveries,
  guardiansSuppressed,
  households,
  messageTemplates,
  notificationRules,
  reachOf,
  smsRate,
  type Audience,
} from "@/lib/modules/comms-data";
import {
  name as nameCell,
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
 * M12 · Communication Center — "Reach families, with the cost shown first."
 *
 * The rule the whole module turns on: anyone who cannot be reached is excluded
 * before the count, so the number you approve is the number that gets
 * delivered — never an optimistic one. The cost is shown and approved before
 * anything sends, without exception.
 *
 * The mockup composes with live forms. Content here is server-authored, so an
 * audience or a message block states what it is set to and opens a drawer to
 * change it — every field, option and hint the mockup carries is kept.
 */

const audience = defaultAudience;
const reach = reachOf(audience);
const cost = costOf(reach);

/* ---------------------------------------------------------------- Compose */

const costAndSendDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Compose · SMS",
  title: `Send to ${reach.toLocaleString("en-NG")} people`,
  sub: "The cost is shown and approved before anything sends — without exception.",
  facts: [
    ["Audience", audience.key, audience.desc],
    ["Matched", audience.matched.toLocaleString("en-NG")],
    [
      "Cannot be reached",
      audience.suppressed.toLocaleString("en-NG"),
      "Excluded before the count, and listed by name so you can print for them instead",
    ],
    ["Will receive it", reach.toLocaleString("en-NG"), "The number you approve is the number delivered"],
    ["Channel", "SMS", `${reach.toLocaleString("en-NG")} credits · ${cost}`],
    ["Sender", "Grace International Academy", "Always the school's own name — never Future Realm, never a staff member"],
    ["Send window", "07:00–19:00 WAT", "Inside the school's contact window"],
    [
      "Above the threshold",
      reach > 150 ? "Yes — this needs a Principal or Proprietor" : "No",
      reach > 150 ? "The school's mass-communication threshold is 150 recipients" : "",
    ],
  ],
  commitLabel: `Send · ${cost}`,
  commitDone: "Send approved",
  commitDoneBody: `${reach.toLocaleString("en-NG")} messages are on their way, and ${cost} in credits was used.`,
};

function audienceDrawer(entry: Audience): DrawerSpec {
  const entryReach = reachOf(entry);

  return {
    mode: "commit",
    kicker: "Compose · who it goes to",
    title: `Send to ${entry.key.toLowerCase()}`,
    sub: entry.desc,
    facts: [
      ["Matched", entry.matched.toLocaleString("en-NG")],
      [
        "Cannot be reached",
        entry.suppressed ? entry.suppressed.toLocaleString("en-NG") : "None",
        entry.suppressed ? "Excluded before the count" : "",
      ],
      ["Will receive it", entryReach.toLocaleString("en-NG")],
      ["Cost at SMS", costOf(entryReach), `${entryReach.toLocaleString("en-NG")} credits`],
      ["Free alternative", "In-app", "Reaches activated families only, and costs nothing"],
    ],
    commitLabel: `Choose ${entry.key.toLowerCase()}`,
    commitDone: `Audience set to ${entry.key}`,
    commitDoneBody: `${entryReach.toLocaleString("en-NG")} people will receive it. Nothing has been sent.`,
  };
}

const editAudienceDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Compose · audience",
  title: "Filter the families",
  sub: "Filters with a live count — saved as criteria, never as a frozen list.",
  facts: [
    ["Class or arm", "All arms", "Nursery · Primary · JSS 1–3 · SSS 1–3"],
    ["Fee status", "Any", "Outstanding · Part paid · Paid"],
    ["Ageing bucket", "Any", "Current · 30 days and over · 60 · 90"],
    ["Portal state", "Any", "Activated · Never activated"],
    ["Delivery health", "Reachable", "Reachable · Failing · No number on file"],
    ["Language", "Any", "English, French, Arabic, Swahili, Hausa, Yoruba, Igbo"],
    ["Consent", "Required", "Ignoring consent is for emergencies only"],
    [
      "Cannot be reached",
      `${guardiansSuppressed} excluded before the count`,
      "Listed by name so you can print for them instead",
    ],
  ],
  commitNote:
    "A saved segment re-runs its criteria every time, so a family who clears their fees drops out on its own.",
  commitLabel: "Save this segment",
  commitDone: "Segment saved",
  commitDoneBody: "It re-runs its criteria on every send, so it is never a frozen list.",
};

const editMessageDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Compose · message",
  title: "Write the message",
  sub: "Merge fields resolve against a real record before you can send.",
  facts: [
    ["Channel", `SMS · ₦${smsRate.toFixed(2)} each`, "In-app free · Email · Rich messaging"],
    ["Sender", "Grace International Academy", "Always the school's own name"],
    ["Template", "Fee reminder · second · version 3", "Or write from scratch"],
    ["Length", "142 of 160 characters", "A longer message costs a second credit"],
    [
      "Preview against",
      "Mrs Ifeoma Adebayo · Chioma · ₦124,000 · 67 days",
      "Every merge field resolves against a real record before the send button unlocks",
    ],
    ["Send", "Inside the contact window · 07:00–19:00 WAT", "Or immediately, or scheduled"],
  ],
  commitLabel: "Save the message",
  commitDone: "Message saved",
  commitDoneBody: "Nothing has been sent. The cost is shown and approved at the send step.",
};

const composeTab: TabContent = {
  title: "Compose",
  desc: "Write it once, see what it costs, send.",
  primary: { label: "See the cost and send", drawer: costAndSendDrawer },
  launchers: [
    { label: "Use a template", href: "/communication-center/automation" },
    { label: "Everything sent so far", href: "/communication-center/sent" },
  ],
  rows: [
    row("1fr", [
      {
        type: "tiles",
        title: "Who is this going to",
        tag: audience.key,
        tagTone: "progress",
        per: 5,
        tiles: audiences.map((entry) => ({
          label: entry.key,
          sub:
            entry.key === audience.key
              ? entry.desc
              : `${entry.matched.toLocaleString("en-NG")}${entry.key === "One person" ? " at a time" : " people"}`,
          tone: (entry.key === audience.key ? "progress" : "neutral") as PanelTone,
          icon: entry.icon,
          drawer: audienceDrawer(entry),
        })),
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: reach > 500 ? "attention" : "progress",
        icon: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M9.5 9.6h5M9.5 14.4h5M12 6.8v10.4",
        title: `This send will reach ${reach.toLocaleString("en-NG")} people and cost ${reach.toLocaleString("en-NG")} SMS credits · ${cost}`,
        body: `${audience.matched.toLocaleString("en-NG")} match, ${audience.suppressed.toLocaleString("en-NG")} cannot be reached and are excluded before this count, so ${reach.toLocaleString("en-NG")} will actually receive it. The number you approve is the number that gets delivered — never an optimistic one.`,
        acts: [
          { label: "See the cost and send", drawer: costAndSendDrawer },
          {
            label: `See the ${audience.suppressed} who cannot be reached`,
            href: "/parents-guardians/guardians",
          },
          {
            label: "Switch to in-app · free",
            drawer: {
              mode: "commit",
              kicker: "Compose · channel",
              title: "Switch to in-app",
              sub: "In-app is free, and reaches activated families only.",
              facts: [
                ["Cost", "Free", "Unlimited on every tier"],
                ["Reaches", "1,161 activated families", "A family who never activated sees nothing"],
                ["Against SMS", `${cost} saved`, "SMS is the only channel that always arrives"],
                ["Acknowledgement", "Tracked", "You can see who opened it"],
              ],
              commitLabel: "Switch to in-app",
              commitDone: "Channel set to in-app",
              commitDoneBody: "The send costs nothing, and reaches activated families only.",
            },
          },
        ],
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "facts",
        title: "Audience",
        tag: `${reach.toLocaleString("en-NG")} will receive`,
        tagTone: "positive",
        sub: "Filters with a live count — saved as criteria, never as a frozen list.",
        meta: `${audience.matched.toLocaleString("en-NG")} matched · ${audience.suppressed} cannot be reached · ${reach.toLocaleString("en-NG")} will receive`,
        per: 2,
        acts: [
          { label: `Preview the ${reach.toLocaleString("en-NG")} recipients`, href: "/parents-guardians/guardians" },
          { label: "Save this segment", primary: true, drawer: editAudienceDrawer },
        ],
        facts: [
          ["Class or arm", "All arms"],
          ["Fee status", "Any"],
          ["Ageing bucket", "Any"],
          ["Portal state", "Any"],
          ["Delivery health", "Reachable"],
          ["Language", "Any"],
          ["Consent", "Required", "Ignoring consent is for emergencies only"],
          [
            "Cannot be reached",
            `${guardiansSuppressed} excluded before the count`,
            "Listed by name so you can print for them instead",
          ],
        ],
        foot: "A saved segment re-runs its criteria every time, so a family who clears their fees drops out on its own.",
      },
      {
        type: "facts",
        title: "Message",
        tag: "SMS · 1 credit each",
        tagTone: "attention",
        sub: "Merge fields resolve against a real record before you can send.",
        meta: "142 of 160 characters",
        per: 1,
        acts: [
          { label: "Preview on a phone", drawer: editMessageDrawer },
          { label: "See the cost and send", primary: true, drawer: costAndSendDrawer },
        ],
        facts: [
          ["Channel", `SMS · ₦${smsRate.toFixed(2)} each`],
          [
            "Sender",
            "Grace International Academy",
            "Always the school's own name — never Future Realm, never a staff member",
          ],
          ["Template", "Fee reminder · second · version 3"],
          [
            "Message",
            "Dear {{guardian_title}} {{guardian_surname}}, {{student_first_name}}'s Second Term balance of {{outstanding_amount}} is now {{days_overdue}} days overdue. Kindly settle at the bursary. — Grace International Academy",
            "142 of 160 characters · merge fields are validated before the send unlocks",
          ],
          [
            "Preview against",
            "Mrs Ifeoma Adebayo · Chioma · ₦124,000 · 67 days",
            "Every merge field resolves against a real record before the send button unlocks",
          ],
          ["Send", "Inside the contact window · 07:00–19:00 WAT"],
        ],
        foot: "The cost is shown and approved before anything sends — without exception.",
      },
    ]),
    row("1fr", [
      {
        type: "tiles",
        title: "Channels",
        per: 4,
        tiles: channelTiles.map((channel) => ({
          label: channel.label,
          sub: channel.sub,
          icon: channel.icon,
          tone: "tone" in channel ? (channel.tone as PanelTone) : undefined,
          drawer: {
            kicker: "Channel",
            title: channel.label,
            sub: channel.sub,
            readOnly: true,
            readOnlyNote: "The channel is chosen on the message block.",
            facts: [
              ["Channel", channel.label.split(" · ")[0]!],
              ["Cost", channel.label.split(" · ")[1] ?? "Free"],
              ["Reaches", channel.sub],
            ] as Array<[string, string, string?]>,
          },
        })),
      },
    ]),
  ],
};

/* ------------------------------------------------------------------- Sent */

const approvePendingDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Sent · awaiting approval",
  title: "Fee reminder · second, to 214 families",
  sub: "Above the school's 150-recipient threshold, so it waits on a Principal or Proprietor.",
  facts: [
    ["Composed by", "Mrs Chinelo Obi · Bursar"],
    ["Audience", "214 families with an overdue balance"],
    ["Will receive it", "191", "23 cannot be reached and are excluded before the count"],
    ["Channel", "SMS", `191 credits · ${costOf(191)}`],
    ["Threshold", "150 recipients", "Set in School Configuration · Policies"],
    ["What each family sees", "Their own balance only", "Nothing about any other family"],
  ],
  commitLabel: "Approve the send",
  commitDone: "Send approved",
  commitDoneBody: `191 messages are on their way, each showing only that family's own balance. ${costOf(191)} in credits was used.`,
};

const sentTab: TabContent = {
  title: "Sent",
  desc: "Everything sent, scheduled and failed.",
  primary: { label: "Approve pending send", drawer: approvePendingDrawer },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Campaigns this term", value: "55", sub: "Sent, scheduled and recurring" },
          { label: "Credits used", value: "4,120", sub: "₦15,656 · 34 days in" },
          {
            label: "Awaiting approval",
            value: "1",
            sub: "Above the 150-recipient threshold",
            tone: "submitted",
            link: "Decide",
            drawer: approvePendingDrawer,
          },
          { label: "Failed deliveries", value: "9", sub: "Across 3 campaigns", tone: "attention" },
          { label: "Messages per family", value: "Median 6", sub: "Highest 11, to debtor families", tone: "attention" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "submitted",
        title: "1 send is above the school threshold and awaiting your decision",
        body: "Mrs Chinelo Obi has composed a fee reminder to 214 families. The school's mass-communication threshold is 150 recipients, so it waits here for a Principal or Proprietor.",
        acts: [
          { label: "Review and approve", drawer: approvePendingDrawer },
          {
            label: "Return with a comment",
            drawer: {
              mode: "commit",
              kicker: "Sent · awaiting approval",
              title: "Return the send with a comment",
              sub: "It goes back to Mrs Chinelo Obi with your reason.",
              facts: [
                ["Goes back to", "Mrs Chinelo Obi · Bursar"],
                ["Reason", "Required", "She sees exactly why, not just that it was refused"],
                ["Nothing is sent", "No credits are used"],
                ["She can", "Amend and resubmit", "It returns here for a decision"],
              ],
              commitLabel: "Return it",
              commitDone: "Send returned",
              commitDoneBody: "Mrs Chinelo Obi has it back, with your reason. Nothing was sent.",
            },
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Campaigns",
        sub: "Sent, scheduled and recurring in one list.",
        meta: "Scope: the whole school",
        search: "Find a campaign by name, sender or audience",
        noun: "campaign",
        nounPlural: "campaigns",
        per: 8,
        filters: [
          { label: "State", value: "All", options: ["All", "Awaiting", "Scheduled", "Delivered", "Active", "Cancelled"], column: 4 },
          { label: "Channel", value: "All", options: ["All", "SMS", "In-app", "Rich messaging"], column: 1 },
        ],
        head: ["Campaign", "Channel", "Recipients", "Credits", "State", "Sender", ""],
        rows: campaigns.map(
          (campaign): TableRow => ({
            cells: [
              nameCell(campaign.name, campaign.sub, { avatar: false }),
              text(campaign.channel),
              text(campaign.recipients, { mono: true }),
              text(campaign.credits, { mono: true }),
              pill(
                campaign.state,
                campaign.state === "Delivered" || campaign.state === "Active"
                  ? "positive"
                  : campaign.state === "Awaiting"
                    ? "submitted"
                    : campaign.state === "Cancelled"
                      ? "neutral"
                      : "progress",
              ),
              campaign.sender === "Automation"
                ? text("Automation")
                : nameCell(campaign.sender, campaign.senderRole),
              {
                kind: "action",
                label: campaign.act,
                drawer:
                  campaign.state === "Awaiting"
                    ? approvePendingDrawer
                    : {
                        kicker: `${campaign.channel} · ${campaign.state.toLowerCase()}`,
                        title: campaign.name,
                        sub: campaign.sub,
                        readOnly: campaign.state === "Delivered" || campaign.state === "Cancelled",
                        readOnlyNote:
                          campaign.state === "Delivered"
                            ? "A delivered campaign is a record of what families received. It is never edited."
                            : campaign.state === "Cancelled"
                              ? "Kept with its reason — a cancelled send is part of the record."
                              : undefined,
                        facts: [
                          ["Channel", campaign.channel],
                          ["Recipients", campaign.recipients],
                          [
                            "Credits used",
                            campaign.credits,
                            campaign.credits === "0" ? "Nothing was charged" : "",
                          ],
                          ["State", campaign.state],
                          ["Sender", campaign.sender, campaign.senderRole],
                          ["What each family saw", "Their own record only", "Nothing about any other family"],
                        ],
                      },
              },
            ],
            keywords: `${campaign.sender} ${campaign.senderRole}`,
          }),
        ),
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "table",
        title: "Failed deliveries",
        sub: "By family, with the reason and a link to the record that fixes it.",
        meta: "9 failures across 3 campaigns",
        noun: "failure",
        nounPlural: "failures",
        head: ["Family", "Campaign", "Reason", ""],
        rows: failedDeliveries.map(
          (failure): TableRow => ({
            cells: [
              nameCell(failure.family, failure.contact),
              text(failure.campaign),
              text(failure.reason),
              { kind: "action", label: "Fix", href: "/parents-guardians/guardians" },
            ],
            keywords: failure.reason,
          }),
        ),
      },
      {
        type: "list",
        title: "Oversight",
        sub: "The guardrail against training parents to ignore the school.",
        items: [
          {
            label: "Messages received per family this term",
            sub: "Median 6 · highest 11, to the 214 debtor families · a family at 11 will start ignoring us",
            pill: "Median 6",
            tone: "attention",
            facts: [
              ["Median", "6 messages a family, this term"],
              ["Highest", "11", "To the 214 families with an overdue balance"],
              ["Why it matters", "A family at 11 will start ignoring us", "Including the message that actually matters"],
              ["What to do", "Fewer, better-targeted sends", "A saved segment drops a family the moment they settle"],
            ],
          },
          {
            label: "By sender",
            sub: "Bursar 6 campaigns · Principal 9 · Exam Officer 4 · Registrar 2 · Automation 34",
            pill: "55 sends",
            facts: [
              ["Bursar", "6 campaigns"],
              ["Principal", "9 campaigns"],
              ["Exam Officer", "4 campaigns"],
              ["Registrar", "2 campaigns"],
              ["Automation", "34 campaigns", "Nobody writes these — they follow the rules on Automation"],
            ],
          },
          {
            label: "Credit consumption by sender",
            sub: "Bursar 1,587 · Principal 2,662 · Exam Officer 1,161 · Registrar 191",
            pill: "₦22,800",
            facts: [
              ["Bursar", "1,587 credits"],
              ["Principal", "2,662 credits"],
              ["Exam Officer", "1,161 credits"],
              ["Registrar", "191 credits"],
              ["Total", "₦22,800", "Charged on send, not on approval"],
            ],
          },
          {
            label: "Pending approval",
            sub: "1 send above the 150-recipient threshold",
            pill: "1",
            tone: "submitted",
            viewLabel: "Decide",
            drawer: approvePendingDrawer,
          },
        ],
      },
    ]),
  ],
};

/* ------------------------------------------------------------- Automation */

const automationTab: TabContent = {
  title: "Automation",
  desc: "Messages nobody writes, and the words they use.",
  primary: {
    label: "Save rules",
    drawer: {
      mode: "commit",
      kicker: "Automation",
      title: "Save notification rules",
      sub: "Every changed rule takes effect on the next event that triggers it.",
      facts: [
        ["Rules", "15", "Channel, timing and audience each"],
        ["Mandatory and locked", "4", "Each says why, in one sentence"],
        ["Takes effect", "On the next event that triggers it"],
        ["Cost", "Rules that send SMS draw on the wallet", "Shown per rule before you enable it"],
      ],
      commitLabel: "Save rules",
      commitDone: "Rules saved",
      commitDoneBody: "Each changed rule applies from the next event that triggers it.",
    },
  },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          { label: "Notification rules", value: "15", sub: "Channel, timing and audience each" },
          { label: "Enabled", value: "11", sub: "Editable by the school", tone: "positive" },
          {
            label: "Mandatory and locked",
            value: "4",
            sub: "Each says why, in one sentence",
            tone: "withheld",
          },
          { label: "Templates", value: "22", sub: "14 school-owned · versioned" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Notification rules",
        sub: "Fifteen rules with channel, timing and audience.",
        meta: "15 rules · 4 mandatory and locked",
        search: "Find a rule",
        noun: "rule",
        nounPlural: "rules",
        per: 9,
        filters: [
          { label: "Channel", value: "All", options: ["All", "In-app", "SMS", "Email", "All channels"], column: 1 },
          { label: "State", value: "All", options: ["All", "Enabled", "Disabled", "Mandatory"], column: 4 },
          { label: "Audience", value: "All", options: ["All", "Guardian", "Guardians", "form master", "Bursar"], column: 3 },
        ],
        head: ["Rule", "Channel", "Timing", "Audience", "State", ""],
        rows: notificationRules.map(
          (rule): TableRow => ({
            cells: [
              nameCell(rule.rule, rule.why, { avatar: false }),
              text(rule.channel),
              text(rule.timing),
              text(rule.audience),
              pill(rule.state, rule.state === "Mandatory" ? "withheld" : "positive"),
              rule.state === "Mandatory"
                ? text("Locked", { strong: true, tone: "withheld" })
                : {
                    kind: "action",
                    label: "Edit",
                    drawer: {
                      mode: "commit",
                      kicker: "Notification rule",
                      title: rule.rule,
                      sub: rule.why,
                      facts: [
                        ["Channel", rule.channel],
                        ["Timing", rule.timing],
                        ["Audience", rule.audience],
                        ["State", rule.state],
                        [
                          "Cost",
                          /SMS/.test(rule.channel) ? "Draws on the wallet" : "Free",
                          /SMS/.test(rule.channel) ? "Charged per message, on send" : "In-app and email cost nothing",
                        ],
                        ["Takes effect", "On the next event that triggers it"],
                      ],
                      commitLabel: "Save the rule",
                      commitDone: `${rule.rule} saved`,
                      commitDoneBody: "It applies from the next event that triggers it.",
                    },
                  },
            ],
            keywords: rule.why,
          }),
        ),
        foot: "A locked rule cannot be disabled. Each one says why in a single sentence, rather than being silently unavailable.",
      },
    ]),
    row("1.05fr 1fr", [
      {
        type: "table",
        title: "Templates",
        sub: "Versioned, so a sent message always renders as the version sent.",
        meta: "22 templates · 14 school-owned",
        search: "Find a template",
        noun: "template",
        nounPlural: "templates",
        per: 6,
        filters: [
          { label: "Owner", value: "All", options: ["All", "School", "System", "Future Realm"], column: 1 },
          { label: "Channel", value: "All", options: ["All", "SMS", "Rich messaging"], column: 0 },
        ],
        head: ["Template", "Owner", "Version", "Last used", ""],
        rows: messageTemplates.map(
          (template): TableRow => ({
            cells: [
              nameCell(template.name, template.sub, { avatar: false }),
              text(template.owner),
              text(template.version, { mono: true }),
              text(template.lastUsed),
              {
                kind: "action",
                label: template.owner === "School" ? "Edit" : "View",
                drawer: {
                  mode: template.owner === "School" ? "commit" : "read",
                  kicker: `${template.owner}-owned template`,
                  title: template.name,
                  sub: template.sub,
                  readOnly: template.owner !== "School",
                  readOnlyNote:
                    template.owner === "System"
                      ? "A system template is maintained by the product. The school can copy it, not edit it."
                      : template.owner === "Future Realm"
                        ? "Pre-approved library. It can be used as it is, or copied into a school template."
                        : undefined,
                  facts: [
                    ["Owner", template.owner],
                    ["Version", template.version, "A sent message always renders as the version sent"],
                    ["Last used", template.lastUsed],
                    ["Variables", template.sub],
                    [
                      "Editing it",
                      template.owner === "School" ? "Saves as a new version" : "Copy it first",
                      "Anything already sent keeps the version it was sent under",
                    ],
                  ],
                  commitLabel: template.owner === "School" ? "Save a new version" : undefined,
                  commitDone: template.owner === "School" ? `${template.name} saved` : undefined,
                  commitDoneBody:
                    template.owner === "School"
                      ? "Saved as a new version. Anything already sent keeps the version it was sent under."
                      : undefined,
                },
              },
            ],
            keywords: `${template.owner} ${template.sub}`,
          }),
        ),
      },
      {
        type: "note",
        tone: "progress",
        icon: "M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4M12 3.6v2M12 19v2M5.4 7.4l1.7 1M16.9 15.6l1.7 1",
        title: "Default channel and contact window are one record, shown in two places",
        body: "SMS, 07:00–19:00 West Africa Time. This is the same record you see in School Configuration · Policies — editing it here edits it there.",
        acts: [
          {
            label: "Edit here",
            drawer: {
              mode: "commit",
              kicker: "Automation",
              title: "Default channel and contact window",
              sub: "One record, two entry points. Editing it here edits it in Policies.",
              facts: [
                ["Default channel", "SMS"],
                ["Contact window", "07:00–19:00 West Africa Time"],
                ["Outside the window", "A send waits until the window opens", "Unless it is an emergency broadcast"],
                ["Where else it appears", "School Configuration · Policies", "The same record, not a copy"],
              ],
              commitLabel: "Save",
              commitDone: "Saved",
              commitDoneBody: "The change is in force here and in Policies — they are one record.",
            },
          },
          { label: "Open in Policies", href: "/school-configuration/policies" },
        ],
      },
    ]),
  ],
};

export const communicationCenterContent: ModuleContent = {
  compose: composeTab,
  sent: sentTab,
  automation: automationTab,
};

/** The households the module reports on, for the tests that check it counts one school. */
export const composeHouseholds = households.length;
