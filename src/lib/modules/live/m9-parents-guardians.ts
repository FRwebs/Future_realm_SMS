import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M09 Parents & Guardians · Guardians, read from `GET /v1/parents`.
 *
 * That endpoint already folds each guardian's children into the row, so the
 * directory and the per-guardian drawer come from one call rather than a query
 * per family.
 */

type LinkedChild = {
  studentId: string;
  studentName: string;
  className: string;
  admissionNumber: string;
};

type GuardianRow = {
  id: string;
  parentName: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  canReceiveSms: boolean;
  canReceiveEmail: boolean;
  linkedChildren: LinkedChild[];
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function guardianFacts(row: GuardianRow): PanelFact[] {
  return [
    ["Guardian", row.parentName],
    ["Relationship", row.relationship || "not recorded"],
    ["Phone", row.phone || "none on file"],
    ["Email", row.email || "none on file"],
    ["Address", row.address || "not recorded"],
    ["SMS", row.canReceiveSms ? "allowed" : "declined"],
    ["Email contact", row.canReceiveEmail ? "allowed" : "declined"],
    [
      "Children",
      row.linkedChildren.length
        ? row.linkedChildren.map((child) => `${child.studentName} (${child.className})`).join(" · ")
        : "none linked",
    ],
  ];
}

function guardiansTab(rows: GuardianRow[]): TabContent {
  const noEmail = rows.filter((row) => !row.email?.trim());
  const noPhone = rows.filter((row) => !row.phone?.trim());
  const unreachable = rows.filter((row) => !row.phone?.trim() && !row.email?.trim());
  const smsOff = rows.filter((row) => !row.canReceiveSms);
  const multi = rows.filter((row) => row.linkedChildren.length > 1);
  const children = rows.reduce((sum, row) => sum + row.linkedChildren.length, 0);

  const tableRows: TableRow[] = rows
    .slice()
    .sort((a, b) => a.parentName.localeCompare(b.parentName))
    .map((row) => ({
      cells: [
        nameCell(row.parentName, row.relationship || "relationship not recorded"),
        text(row.phone || "—", { tone: row.phone ? undefined : "negative", mono: Boolean(row.phone) }),
        text(row.email || "—", { tone: row.email ? undefined : "attention" }),
        text(
          row.linkedChildren.length
            ? row.linkedChildren.map((child) => child.studentName).join(", ")
            : "none",
          { tone: row.linkedChildren.length ? undefined : "negative" },
        ),
        pill(
          row.canReceiveSms ? "SMS on" : "SMS off",
          row.canReceiveSms ? "positive" : "attention",
        ),
        {
          kind: "action" as const,
          label: "View",
          drawer: {
            kicker: row.relationship || "Guardian",
            title: row.parentName,
            sub: row.linkedChildren.length
              ? `${row.linkedChildren.length} child${row.linkedChildren.length === 1 ? "" : "ren"} on the roll`
              : "No child linked",
            facts: guardianFacts(row),
            readOnly: true,
            readOnlyNote:
              "Contact details are corrected on the guardian's own record, which keeps the change on the audit trail.",
          },
        },
      ],
      keywords: `${row.parentName} ${row.phone ?? ""} ${row.email ?? ""} ${row.linkedChildren
        .map((child) => child.studentName)
        .join(" ")}`,
    }));

  return {
    title: "Guardians",
    desc: "Who answers for each child, and whether the school can reach them.",
    launchers: [{ label: "Communication Center", href: "/communication-center/compose" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Who the school can reach",
            per: 5,
            cards: [
              { label: "Guardians", value: String(rows.length), sub: `Covering ${children} children` },
              {
                label: "No phone",
                value: String(noPhone.length),
                sub: noPhone.length ? "SMS cannot reach them" : "Every guardian has a number",
                tone: noPhone.length ? "negative" : "positive",
              },
              {
                label: "No email",
                value: String(noEmail.length),
                sub: noEmail.length ? "Report cards cannot be emailed" : "Every guardian has one",
                tone: noEmail.length ? "attention" : "positive",
              },
              {
                label: "Unreachable",
                value: String(unreachable.length),
                sub: unreachable.length ? "Neither phone nor email" : "Everyone is contactable",
                tone: unreachable.length ? "negative" : "positive",
              },
              {
                label: "More than one child",
                value: String(multi.length),
                sub: "One message, several families' worth",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          noEmail.length
            ? {
                type: "note",
                tone: "attention",
                title: `${noEmail.length} guardian${noEmail.length === 1 ? " has" : "s have"} no email address`,
                body: `Every one of them has a phone number, so SMS still reaches them — but anything sent by email, including a report card, will silently miss ${noEmail.length} ${noEmail.length === 1 ? "family" : "families"}. Message credits are the only channel that covers the whole roll.`,
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Every guardian has both a phone and an email",
                body: "Either channel reaches the whole roll.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Guardian directory",
            sub: "Everyone the school holds a contact for.",
            meta: `${rows.length} guardians · ${smsOff.length} with SMS declined`,
            head: ["Guardian", "Phone", "Email", "Children", "SMS", ""],
            per: 12,
            rows: tableRows,
          },
        ],
      },
    ],
  };
}


type ConsentRow = {
  id: string;
  guardianName: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  recorded: boolean;
  sms: boolean | null;
  emailOptIn: boolean | null;
  optedOutAt: string | null;
};

/**
 * M09 · Consent, read from `GET /v1/parents/consent`.
 *
 * The distinction the page exists to make is between a guardian who said no
 * and a guardian who was never asked. Both are "not consented" and only one of
 * them is a decision, so no record at all is reported as its own state rather
 * than folded into the opt-outs.
 */
function consentTab(rows: ConsentRow[]): TabContent {
  const unrecorded = rows.filter((row) => !row.recorded);
  const smsOut = rows.filter((row) => row.recorded && row.sms === false);
  const emailOut = rows.filter((row) => row.recorded && row.emailOptIn === false);
  const bothIn = rows.filter((row) => row.sms && row.emailOptIn);

  const cell = (value: boolean | null, recorded: boolean) =>
    !recorded
      ? pill("never asked", "negative")
      : value
        ? pill("opted in", "positive")
        : pill("opted out", "attention");

  return {
    title: "Consent",
    desc: "Who has agreed to be contacted, who has refused, and who was never asked.",
    launchers: [{ label: "Guardians", href: "/parents-guardians/guardians" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Permission to make contact",
            per: 4,
            cards: [
              { label: "Guardians", value: String(rows.length), sub: "On the roll" },
              {
                label: "Never asked",
                value: String(unrecorded.length),
                sub: unrecorded.length ? "No consent record at all" : "Everyone has been asked",
                tone: unrecorded.length ? "negative" : "positive",
              },
              {
                label: "Opted out of email",
                value: String(emailOut.length),
                sub: "A decision, not a gap",
                tone: emailOut.length ? "attention" : "positive",
              },
              {
                label: "Reachable both ways",
                value: String(bothIn.length),
                sub: `of ${rows.length} guardians`,
                tone: bothIn.length === rows.length ? "positive" : undefined,
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          unrecorded.length
            ? {
                type: "note",
                tone: "negative",
                title: `${unrecorded.length} guardian${unrecorded.length === 1 ? " has" : "s have"} no consent record at all`,
                body: "That is not the same as a refusal. Nobody asked them, so the school has no basis either way — and sending to them is a decision being made by default rather than on purpose.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Every guardian has been asked",
                body: `${emailOut.length} said no to email and ${smsOut.length} to SMS. Those are decisions on record.`,
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          rows.length
            ? {
                type: "table",
                title: "Consent by guardian",
                sub: "Never-asked first, because that is the gap worth closing.",
                meta: `${rows.length} guardians · ${unrecorded.length} unasked`,
                head: ["Guardian", "SMS", "Email", "Phone", "Email address"],
                per: 12,
                rows: rows
                  .slice()
                  .sort((a, b) => Number(a.recorded) - Number(b.recorded))
                  .map((row) => ({
                    cells: [
                      nameCell(row.guardianName, row.relationship ?? ""),
                      cell(row.sms, row.recorded),
                      cell(row.emailOptIn, row.recorded),
                      text(row.phone ?? "—", { mono: Boolean(row.phone) }),
                      text(row.email ?? "none on file", {
                        tone: row.email ? undefined : "attention",
                      }),
                    ],
                    keywords: `${row.guardianName} ${row.recorded ? "recorded" : "unasked"}`,
                  })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No guardian is on file",
                body: "There is nobody to hold consent for.",
              },
        ],
      },
    ],
  };
}


type EditRequest = {
  id: string;
  targetUserId: string;
  targetName: string;
  requestedBy: string;
  reviewedBy: string | null;
  fields: Record<string, unknown>;
  reason: string | null;
  status: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

function editTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "positive";
    case "PENDING":
      return "attention";
    default:
      return "negative";
  }
}

function fieldSummary(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields ?? {});
  if (!entries.length) return "no fields named";
  return entries
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, (char) => ` ${char.toLowerCase()}`)
        .replace(/^./, (char) => char.toUpperCase());
      return `${label} → ${String(value)}`;
    })
    .join(" · ");
}

function editWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function editAgeDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/**
 * The two decisions the API accepts on an edit request.
 *
 * Approving does not just mark a row — it writes the requested fields onto the
 * user record, which is why the drawer says so before it is pressed.
 */
function editDecision(row: EditRequest, action: "APPROVED" | "REJECTED") {
  const approving = action === "APPROVED";
  return {
    kind: "action" as const,
    label: approving ? "Approve" : "Reject",
    drawer: {
      kicker: row.status.toLowerCase(),
      title: row.targetName,
      sub: fieldSummary(row.fields),
      mode: "commit" as const,
      commitLabel: approving ? "Approve the change" : "Reject",
      commitNote: approving
        ? "Approving writes these fields onto the person's record straight away."
        : "Rejecting leaves the record untouched. Say why, so they know what to fix.",
      commitDone: approving ? "Applied" : "Rejected",
      commitDoneBody: approving
        ? "The record has been updated and the page re-read."
        : "The request is closed with your reason against it.",
      facts: [
        ["Person", row.targetName],
        ["Requested by", row.requestedBy],
        ["Change", fieldSummary(row.fields)],
        ["Reason given", row.reason || "none"],
        ["Raised", editWhen(row.createdAt)],
        ["Waiting", `${editAgeDays(row.createdAt)} day(s)`],
      ] as PanelFact[],
      submit: {
        endpoint: `/api/v1/profiles/edit-requests/${row.id}/review`,
        method: "PATCH" as const,
        body: { status: action },
        reasonKey: "reviewComment",
        reasonLabel: approving ? "Note (optional)" : "Why (required)",
        reasonRequired: !approving,
      },
    },
  };
}

function editRequestPanels(rows: EditRequest[], heading: string, blurb: string) {
  const pending = rows.filter((row) => row.status.toUpperCase() === "PENDING");
  const decided = rows.filter((row) => row.status.toUpperCase() !== "PENDING");
  const stale = pending.filter((row) => editAgeDays(row.createdAt) >= 3);

  const queue = pending.length
    ? {
        type: "table" as const,
        title: heading,
        sub: blurb,
        meta: `${pending.length} waiting · ${stale.length} over three days`,
        head: ["Person", "Change", "Raised", "Waiting", "", ""],
        per: 10,
        rows: pending.map((row) => ({
          cells: [
            nameCell(row.targetName, `asked by ${row.requestedBy}`),
            text(fieldSummary(row.fields)),
            text(editWhen(row.createdAt)),
            text(`${editAgeDays(row.createdAt)}d`, {
              tone: editAgeDays(row.createdAt) >= 3 ? "negative" : undefined,
              strong: editAgeDays(row.createdAt) >= 3,
            }),
            editDecision(row, "APPROVED"),
            editDecision(row, "REJECTED"),
          ],
          keywords: `${row.targetName} ${row.requestedBy}`,
        })),
      }
    : {
        type: "note" as const,
        tone: "positive" as const,
        icon: CHECK_ICON,
        title: "Nothing is waiting on a decision",
        body:
          rows.length === 0
            ? "Nobody has asked for a correction to their record."
            : `All ${rows.length} requests have been decided. They stay listed below.`,
      };

  const history = decided.length
    ? {
        type: "table" as const,
        title: "Decided",
        sub: "What was changed, by whom, and why.",
        meta: `${decided.length} decided`,
        head: ["Person", "Change", "Outcome", "Reviewed by", "Comment"],
        per: 10,
        rows: decided.map((row) => ({
          cells: [
            nameCell(row.targetName, `asked by ${row.requestedBy}`),
            text(fieldSummary(row.fields)),
            pill(row.status.toLowerCase(), editTone(row.status)),
            text(row.reviewedBy ?? "—"),
            text(row.reviewComment || "—", {
              tone: row.reviewComment ? undefined : "attention",
            }),
          ],
          keywords: `${row.targetName} ${row.status}`,
        })),
      }
    : {
        type: "note" as const,
        tone: "neutral" as const,
        title: "Nothing has been decided yet",
        body: "Once a request is approved or rejected it stays here with its reason.",
      };

  return { pending, decided, stale, queue, history };
}

/**
 * M09 · Submissions — what guardians have asked the school to change.
 *
 * Same table M08's Changes reads, asked from the family's side: these are the
 * corrections people outside the staff room are waiting on, and a guardian has
 * no other way to chase one.
 */
function submissionsTab(rows: EditRequest[]): TabContent {
  const { pending, decided, stale, queue, history } = editRequestPanels(
    rows,
    "Waiting on the school",
    "Approving writes the change onto the record immediately.",
  );
  const oldest = pending.length
    ? Math.max(...pending.map((row) => editAgeDays(row.createdAt)))
    : 0;

  return {
    title: "Submissions",
    desc: "What families and staff have asked the school to correct.",
    launchers: [{ label: "Guardians", href: "/parents-guardians/guardians" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Requests from outside the office",
            per: 4,
            cards: [
              { label: "Submitted", value: String(rows.length), sub: "All time" },
              {
                label: "Still waiting",
                value: String(pending.length),
                sub: pending.length ? "No answer given yet" : "Everything answered",
                tone: pending.length ? "attention" : "positive",
              },
              {
                label: "Longest wait",
                value: pending.length ? `${oldest} day${oldest === 1 ? "" : "s"}` : "—",
                sub: pending.length ? "Since it was raised" : "Nothing outstanding",
                tone: oldest >= 3 ? "negative" : undefined,
              },
              { label: "Answered", value: String(decided.length), sub: "With a reason on file" },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          stale.length
            ? {
                type: "note",
                tone: "negative",
                title: `${stale.length} request${stale.length === 1 ? " has" : "s have"} been waiting more than three days`,
                body: "Somebody outside the office asked for a correction and has heard nothing. They have no way to chase it except to turn up, which is the thing this page exists to prevent.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Nothing has been left waiting",
                body: "Every request has been answered within three days.",
              },
        ],
      },
      { cols: "1fr", panels: [queue] },
      { cols: "1fr", panels: [history] },
    ],
  };
}

export async function parentsGuardiansLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "guardians") {
    const rows = await apiGet<GuardianRow[]>("/api/v1/parents");
    if (!rows?.length) return undefined;
    return guardiansTab(rows);
  }

  if (tabSlug === "consent") {
    const rows = await apiGet<ConsentRow[]>("/api/v1/parents/consent");
    return consentTab(rows ?? []);
  }

  if (tabSlug === "submissions") {
    const rows = await apiGet<EditRequest[]>("/api/v1/profiles/edit-requests");
    return submissionsTab(rows ?? []);
  }

  return undefined;
}
