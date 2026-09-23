import { exportDrawer, nudgeDrawer } from "@/lib/modules/drawers";
import {
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type TableRow,
} from "@/lib/modules/panels";
import { families, registrySummary } from "@/lib/modules/students-data";

/**
 * M09 · Parents & Guardians — "The families, and everything they send in."
 *
 * A family that never activated the portal is the quietest failure in the
 * product: nothing digital reaches them, and no screen looks wrong until
 * somebody asks why they never replied.
 */

const households = families();
const summary = registrySummary();
const noPortal = households.filter((family) => family.portal !== "Active");
const phoneOnly = households.filter((family) => !family.hasSecondContact);
const owingFamilies = households.filter((family) => family.owing > 0);

function familyDrawer(family: (typeof households)[number]): DrawerSpec {
  return {
    kicker: "Family",
    title: family.name,
    sub: `${family.relation} of ${family.children.length} ${
      family.children.length === 1 ? "child" : "children"
    } · ${family.phone}`,
    facts: [
      ["Relation", family.relation],
      ["Phone", family.phone],
      ["Email", family.email],
      ["Occupation", family.occupation],
      [
        "Children",
        family.children.map((child) => `${child.name} (${child.arm})`).join(" · "),
        `${family.children.length} in this school`,
      ],
      [
        "Portal",
        family.portal,
        family.portal === "Active"
          ? "They see published cards, reminders and broadcasts"
          : "Nothing digital reaches them — no card, no reminder, no emergency broadcast",
      ],
      [
        "Second contact",
        family.hasSecondContact ? "On file" : "None",
        family.hasSecondContact
          ? "A second adult can be reached if the first cannot"
          : "If this number fails, the school cannot reach this family at all",
      ],
      [
        "Fees",
        family.owing
          ? `${family.owing} of ${family.children.length} not settled`
          : "All settled",
        family.owing ? "A balance never withholds a report card" : "",
      ],
    ],
  };
}

const familyRows: TableRow[] = households.slice(0, 400).map((family) => ({
  cells: [
    nameCell(family.name, family.relation),
    text(String(family.children.length), { mono: true }),
    text(family.children.map((child) => child.arm).join(", ")),
    text(family.phone, { mono: true }),
    pill(
      family.portal,
      family.portal === "Active"
        ? "positive"
        : family.portal === "Invited"
          ? "attention"
          : "negative",
    ),
    family.hasSecondContact
      ? text("Yes")
      : text("Phone only", { tone: "attention", strong: true }),
    family.owing
      ? text(`${family.owing} owing`, { tone: "attention", strong: true })
      : text("Settled", { tone: "positive" }),
    { kind: "action", label: "Open", drawer: familyDrawer(family) },
  ],
  keywords: `${family.occupation} ${family.email}`,
}));

export const parentsGuardiansContent: ModuleContent = {
  guardians: {
    title: "Guardians",
    desc: "The families, and everything they send in.",
    primary: {
      label: "Add a guardian",
      drawer: {
        mode: "commit",
        kicker: "Guardians",
        title: "Add a guardian",
        sub: "A guardian is a household, not a contact — children are mapped to it.",
        facts: [
          ["Relation", "Mother, father or other", "Shown to every member of staff who calls"],
          ["Phone", "Required", "A family with no number can be reached by nobody"],
          ["Children", "Mapped after the household is created"],
          ["Portal invite", "Sent on create", "Or later, if they have no phone yet"],
        ],
        commitLabel: "Create the household",
        commitDone: "Household created",
        commitDoneBody:
          "The family is on the list and the portal invitation is on its way.",
      },
    },
    launchers: [
      {
        label: `Resend ${noPortal.length} portal invites`,
        drawer: nudgeDrawer({
          count: noPortal.length,
          kicker: "Guardians",
          title: `Resend ${noPortal.length} portal invites`,
          who: "families who have never activated the portal",
          what: "An activation link, and what the portal gives them",
          channels: "SMS",
          extra: [
            [
              "Why it matters",
              "Nothing digital reaches them",
              "No published card, no fee reminder, no emergency broadcast",
            ],
          ],
        }),
      },
      { label: "Submissions", href: "/parents-guardians/submissions" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Households",
              value: households.length.toLocaleString(),
              sub: `${summary.enrolled.toLocaleString()} children`,
            },
            {
              label: "Never activated",
              value: noPortal.length.toLocaleString(),
              sub: "Nothing digital reaches them",
              tone: "negative",
            },
            {
              label: "Phone only",
              value: phoneOnly.length.toLocaleString(),
              sub: "No second contact on file",
              tone: "attention",
            },
            {
              label: "With a balance",
              value: owingFamilies.length.toLocaleString(),
              sub: "Families, not children",
              tone: "attention",
              link: "Open the debtor list",
              href: "/fee-management/collections",
            },
            {
              label: "More than one child",
              value: households.filter((family) => family.children.length > 1).length.toLocaleString(),
              sub: "Sibling discount applies",
              tone: "positive",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "note",
          tone: "attention",
          title: `${noPortal.length} families have never activated the portal`,
          body: "Nothing digital reaches them — no published report card, no fee reminder, no emergency broadcast. No screen in this product will look wrong until somebody asks why they never replied.",
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Every family",
          tag: `${households.length.toLocaleString()} households`,
          tagTone: "neutral",
          sub: "Open a family for their children, their contacts and everything they have sent in.",
          meta: `Showing the first ${familyRows.length} of ${households.length.toLocaleString()} · ${noPortal.length} never activated`,
          search: "Find a family by name, phone or child",
          filters: [
            {
              label: "Portal",
              value: "All",
              options: ["All", "Active", "Invited", "Not activated"],
              column: 4,
            },
            { label: "Reachable", value: "All", options: ["All", "Yes", "Phone only"], column: 5 },
          ],
          selectable: true,
          per: 12,
          noun: "family",
          nounPlural: "families",
          bulkActs: [
            { label: "Resend the portal invite" },
            { label: "Message these families" },
            { label: "Request consent" },
            { label: "Export selected", primary: true },
          ],
          acts: [
            {
              label: "Export the family list",
              drawer: exportDrawer({
                title: "Export the family list",
                what: "Household, relation, children, contacts, portal state and balance",
                scope: `${households.length.toLocaleString()} households`,
                format: "Excel",
              }),
            },
          ],
          head: ["Family", "Children", "Arms", "Phone", "Portal", "Second contact", "Fees", ""],
          rows: familyRows,
          foot: "A household is identified by the guardian's full name. A child who does not fit one is re-homed into another, never dropped — dropping one leaves a real debtor billed in the headline and absent from the debtor list.",
        },
      ]),
    ],
  },

  submissions: {
    title: "Submissions",
    desc: "Everything a family has sent in, and what the school decided.",
    primary: { label: "Open the approvals queue", href: "/approvals-workflow/queue" },
    launchers: [{ label: "Guardians", href: "/parents-guardians/guardians" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Waiting on the school",
              value: "28",
              sub: "Absence notes, evidence and corrections",
              tone: "attention",
            },
            { label: "Decided this term", value: "214", sub: "Average 1.1 days", tone: "positive" },
            {
              label: "Oldest waiting",
              value: "4 days",
              sub: "An absence explanation",
              tone: "attention",
            },
            {
              label: "Returned for more",
              value: "9",
              sub: "Evidence missing or unreadable",
              tone: "withheld",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Inbound submissions",
          sub: "A guardian submits; the school decides. Nothing a family sends changes a record on its own.",
          meta: "28 waiting · 214 decided this term",
          search: "Find by family or child",
          filters: [
            {
              label: "Type",
              value: "All",
              options: ["All", "Absence", "Record change", "Consent", "Evidence"],
              column: 2,
            },
            {
              label: "State",
              value: "All",
              options: ["All", "New", "Returned", "Resolved"],
              column: 5,
            },
          ],
          per: 8,
          noun: "submission",
          nounPlural: "submissions",
          head: ["Family", "Child", "Type", "What they sent", "Age", "State", ""],
          rows: [
            {
              cells: [
                nameCell("Mrs Chinyere Okafor", "Mother"),
                text("Emeka Okafor"),
                pill("Absence", "attention"),
                text("Malaria, treated at Garki Hospital · card attached"),
                text("4 days", { tone: "attention", strong: true }),
                pill("New", "attention"),
                {
                  kind: "action",
                  label: "Decide",
                  drawer: {
                    mode: "commit",
                    kicker: "Submission · Absence",
                    title: "Emeka Okafor · 2 and 4 September",
                    sub: "A guardian submits; the school decides.",
                    facts: [
                      ["Student", "Emeka Okafor", "GIA/23/0407 · SSS 2A"],
                      ["Dates", "2 and 4 September", "2 school days"],
                      ["Submitted by", "Mrs Chinyere Okafor", "Mother · primary contact"],
                      ["Reason given", "Malaria, treated at Garki Hospital"],
                      ["Evidence", "Hospital card photographed", "Attached 4 September, 18:22"],
                      [
                        "If accepted",
                        "Absent becomes Excused",
                        "His term percentage moves from 88% to 94%",
                      ],
                    ],
                    commitLabel: "Accept the explanation",
                    commitDone: "Explanation accepted",
                    commitDoneBody:
                      "Those two days are now Excused, his term percentage has moved, and the family has been told.",
                  },
                },
              ],
            },
            {
              cells: [
                nameCell("Mr Sani Mohammed", "Father"),
                text("Aisha Mohammed"),
                pill("Absence", "attention"),
                text("Family bereavement in Kaduna · no attachment"),
                text("3 days"),
                pill("New", "attention"),
                {
                  kind: "action",
                  label: "Decide",
                  drawer: {
                    mode: "commit",
                    kicker: "Submission · Absence",
                    title: "Aisha Mohammed · 1 September",
                    sub: "A guardian submits; the school decides.",
                    facts: [
                      ["Student", "Aisha Mohammed", "GIA/23/0412 · SSS 2A"],
                      ["Date", "1 September", "1 school day"],
                      ["Submitted by", "Mr Sani Mohammed", "Father"],
                      ["Reason given", "Family bereavement in Kaduna"],
                      [
                        "Evidence",
                        "None attached",
                        "Your policy allows a bereavement without evidence",
                      ],
                      [
                        "Note",
                        "She is already a chronic absence case",
                        "72% this term, below the 75% threshold",
                      ],
                    ],
                    commitLabel: "Accept the explanation",
                    commitDone: "Explanation accepted",
                    commitDoneBody:
                      "That day is now Excused and the family has been told. Her chronic absence case stays open.",
                  },
                },
              ],
            },
            {
              cells: [
                nameCell("Mrs Ifeoma Adebayo", "Mother"),
                text("Chioma Adebayo"),
                pill("Record change", "submitted"),
                text("Date of birth correction · birth certificate attached"),
                text("1 day"),
                pill("New", "attention"),
                { kind: "action", label: "Decide", href: "/approvals-workflow/queue" },
              ],
            },
            {
              cells: [
                nameCell("Mr Tayo Ade", "Father"),
                text("Blessing Ade"),
                pill("Evidence", "withheld"),
                text("Photograph for the record · too blurred to accept"),
                text("6 days", { tone: "attention", strong: true }),
                pill("Returned", "withheld"),
                {
                  kind: "action",
                  label: "Open",
                  drawer: {
                    kicker: "Submission · Evidence",
                    title: "Blessing Ade · photograph",
                    sub: "Returned to the family — they have been told why.",
                    facts: [
                      ["Student", "Blessing Ade", "GIA/23/0418"],
                      ["Submitted by", "Mr Tayo Ade", "Father"],
                      ["What was sent", "A photograph for the student record"],
                      ["Why it was returned", "Too blurred to accept"],
                      ["What happens next", "The family can send another at any time"],
                    ],
                  },
                },
              ],
            },
          ],
          foot: "A guardian never changes a record directly. They submit, the school decides, and the decision is logged.",
        },
      ]),
    ],
  },

  consent: {
    title: "Consent",
    desc: "What each family has agreed to, and what is still missing.",
    primary: {
      label: "Request the missing consent",
      drawer: nudgeDrawer({
        count: 6,
        kicker: "Consent",
        title: "Request the missing consent",
        who: "families with no core consent on file",
        what: "Which consent is missing and what it covers",
        channels: "SMS and the portal",
        extra: [
          [
            "Why it matters",
            "Results cannot be published to a guardian without it",
            "Six children are affected",
          ],
          ["One family has no phone", "1 of 6", "They will need a printed form"],
        ],
      }),
    },
    launchers: [{ label: "Guardians", href: "/parents-guardians/guardians" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Core consent on file",
              value: `${(((households.length - 6) / households.length) * 100).toFixed(1)}%`,
              sub: `${households.length - 6} of ${households.length.toLocaleString()} families`,
              tone: "positive",
            },
            {
              label: "Missing core consent",
              value: "6",
              sub: "Results cannot be published to them",
              tone: "negative",
            },
            { label: "Withdrawn", value: "3", sub: "A family may withdraw at any time", tone: "withheld" },
            {
              label: "Renewed this session",
              value: "1,418",
              sub: "Consent is asked for once a session",
              tone: "positive",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "The consents this school needs",
          sub: "Each one names what it covers and what is blocked without it.",
          meta: "5 consents · 1 of them mandatory",
          head: ["Consent", "Covers", "On file", "Missing", "Without it"],
          rows: [
            {
              cells: [
                nameCell("Results to guardian", "Mandatory"),
                text("Publishing a report card to the guardian portal"),
                text(`${households.length - 6}`, { mono: true }),
                text("6", { mono: true, tone: "negative", strong: true }),
                text("The card cannot be published to them", { tone: "negative" }),
              ],
            },
            {
              cells: [
                nameCell("Photography", "Optional"),
                text("Photographs in school publications"),
                text(`${households.length - 184}`, { mono: true }),
                text("184", { mono: true, tone: "attention" }),
                text("The child is excluded from published photographs"),
              ],
            },
            {
              cells: [
                nameCell("Excursions", "Per trip"),
                text("Leaving the school grounds"),
                text("—", { mono: true }),
                text("Asked per trip", { mono: true }),
                text("The child stays behind"),
              ],
            },
            {
              cells: [
                nameCell("Medical treatment", "Mandatory"),
                text("Emergency treatment when a guardian cannot be reached"),
                text(`${households.length - 22}`, { mono: true }),
                text("22", { mono: true, tone: "attention" }),
                text("The school must wait for a guardian"),
              ],
            },
            {
              cells: [
                nameCell("Data processing", "Mandatory"),
                text("Holding the child's records at all"),
                text(households.length.toLocaleString(), { mono: true }),
                text("0", { mono: true, tone: "positive" }),
                text("The child could not be enrolled"),
              ],
            },
          ],
          foot: "Consent is evidenced by who gave it, when, and through which channel. A family may withdraw any of it at any time, and the withdrawal is logged the same way.",
        },
      ]),
      row("1fr", [
        {
          type: "facts",
          title: "How consent is evidenced here",
          sub: "The same rules for every consent the school holds.",
          facts: [
            ["Who may give it", "A guardian on the household", "Never a member of staff"],
            ["How it is given", "In the portal, or on a printed form", "Both are evidenced"],
            ["What is recorded", "Who, when, and through which channel"],
            ["Renewal", "Once a session"],
            ["Withdrawal", "At any time", "Logged exactly as the grant was"],
            [
              "A child with no consent",
              "Is never penalised",
              "The school withholds the action, not the child's place",
            ],
          ],
        },
      ]),
    ],
  },
};
