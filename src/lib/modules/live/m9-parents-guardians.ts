import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type PanelFact,
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

export async function parentsGuardiansLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "guardians") {
    const rows = await apiGet<GuardianRow[]>("/api/v1/parents");
    if (!rows?.length) return undefined;
    return guardiansTab(rows);
  }

  // Submissions and Consent stay authored. Submissions reads ProfileEditRequest
  // and Consent reads ConsentRecord; neither has a school-facing endpoint, and
  // ConsentRecord has no rows on this school at all, so wiring them today would
  // trade written figures for empty ones without being any more true.
  return undefined;
}
