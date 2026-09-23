import { exportDrawer, nudgeDrawer } from "@/lib/modules/drawers";
import {
  action,
  name as nameCell,
  pill,
  row,
  text,
  type ModuleContent,
  type TableRow,
} from "@/lib/modules/panels";
import { armCardStates } from "@/lib/modules/school-data";

/**
 * M06 · Report Cards — "The document a school is judged on, and which are done."
 *
 * A card is generated for a child but published for an arm, so Completion
 * answers "which arms can I send out", not "how many cards exist".
 */

const arms = armCardStates();
const total = (key: "roll" | "ready" | "blocked" | "owed" | "inReview") =>
  arms.reduce((sum, arm) => sum + arm[key], 0);

const cards = total("roll");
const ready = total("ready");
const blocked = total("blocked");
const owed = total("owed");
const clear = arms.filter((arm) => arm.ready === arm.roll).length;
const blockedArms = arms.filter((arm) => arm.blocked > 0);
const owedArms = arms.filter((arm) => arm.owed > 0);

const publishDrawer = {
  mode: "commit" as const,
  kicker: "Report Cards",
  title: `Publish the ${ready} ready cards`,
  sub: "A half-finished card never reaches a family — partly-ready arms are skipped child by child.",
  facts: [
    ["Scope", "The whole school", `${arms.length} arms · ${cards} cards`],
    ["Will publish", `${ready} cards`, "Scores, remark and review all in"],
    [
      "Will skip",
      `${cards - ready} cards`,
      `${blocked} blocked on scores · ${owed} remarks unwritten`,
    ],
    [
      "Goes to",
      "Student portal and guardian portal",
      "Both at once, free, instantly. The family is notified in-app.",
    ],
    ["Off-app delivery", "Not included", "SMS, email or print is a separate, costed send"],
    ["Reversible", "For 1 hour after publishing", "After that, a correction reissues the card"],
  ] as Array<[string, string, string?]>,
  commitLabel: `Publish ${ready} cards`,
  commitNote: "Publishing is irreversible after an hour. Nothing partly-finished goes out.",
  commitDone: `${ready} report cards published`,
  commitDoneBody:
    "They are in the student and guardian portals now, and the families have been notified. The arms that were not ready were skipped.",
};

const armRows: TableRow[] = arms.map((arm) => ({
  cells: [
    text(arm.arm, { strong: true }),
    arm.formMaster
      ? nameCell(arm.formMaster, "Form master")
      : text("Nobody named", { tone: "negative", strong: true }),
    text(String(arm.roll), { mono: true }),
    text(`${arm.ready} of ${arm.roll}`, {
      strong: true,
      tone: arm.ready === arm.roll ? "positive" : "attention",
    }),
    arm.blocked ? text(String(arm.blocked), { tone: "negative", strong: true }) : text("—"),
    arm.owed ? text(String(arm.owed), { tone: "attention", strong: true }) : text("—"),
    arm.inReview ? text(String(arm.inReview), { mono: true }) : text("—"),
    text(arm.average.toFixed(1), { mono: true }),
    pill(
      arm.ready === arm.roll
        ? "Ready"
        : arm.blocked
          ? "Blocked"
          : arm.owed
            ? "Remarks owed"
            : "Awaiting review",
      arm.ready === arm.roll
        ? "positive"
        : arm.blocked
          ? "negative"
          : arm.owed
            ? "attention"
            : "progress",
    ),
    {
      kind: "action",
      label: arm.ready === arm.roll ? "Open · publish" : "Open the arm",
      drawer: {
        kicker: `Report Cards · ${arm.arm}`,
        title: `${arm.arm} · ${arm.ready} of ${arm.roll} ready`,
        sub: `Form master ${arm.formMaster}. Open it to work through the children who are not.`,
        facts: [
          ["Roll", String(arm.roll)],
          ["Ready to publish", `${arm.ready}`, "Scores, remark and review all in"],
          [
            "Blocked on scores",
            arm.blocked ? String(arm.blocked) : "None",
            arm.blocked ? "A sheet is unapproved — nobody is being given a zero" : "",
          ],
          [
            "Remarks owed",
            arm.owed ? String(arm.owed) : "None",
            arm.owed ? "A card cannot generate without its form master remark" : "",
          ],
          ["Awaiting your review", arm.inReview ? String(arm.inReview) : "None"],
          ["Arm average", arm.average.toFixed(1)],
        ] as Array<[string, string, string?]>,
      },
    },
  ],
  keywords: arm.formMaster,
}));

export const reportCardsContent: ModuleContent = {
  remarks: {
    title: "Reports",
    desc: "Read what a teacher wrote, add your review, move to the next child.",
    primary: { label: "Open the outstanding reports", href: "/report-cards/completion" },
    launchers: [
      {
        label: "Notify the form masters behind",
        drawer: nudgeDrawer({
          count: 2,
          kicker: "Reports",
          who: "2 form masters who have not started",
          what: "How many reports they owe, and the publish date it holds up",
        }),
      },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Students in view",
              value: cards.toLocaleString(),
              sub: "Every arm in the school",
            },
            {
              label: "Teacher report in",
              value: (cards - owed).toLocaleString(),
              unit: `of ${cards}`,
              sub: `${owed} not submitted yet`,
              tone: "attention",
            },
            {
              label: "Awaiting your review",
              value: total("inReview").toLocaleString(),
              sub: "Teacher is in, you are not",
              tone: "attention",
            },
            {
              label: "Reviewed by you",
              value: ready.toLocaleString(),
              sub: "Saved on this device",
              tone: "positive",
            },
            { label: "Publish date", value: "2 Oct", sub: "27 days away" },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "tracker",
          title: "Who is behind",
          sub: "By author, class, student and state.",
          meta: `${ready} of ${cards} written`,
          clear: {
            title: "Every report is written",
            body: `All ${cards} cards have their form master, principal and subject remarks.`,
          },
          rows: [
            {
              unit: "Mrs Ngozi Eze · SSS 1B",
              sub: "18 of 29 form master reports",
              owner: "Mrs Ngozi Eze",
              role: "Form master",
              state: "In progress",
              age: "6 days",
              overdue: true,
            },
            {
              unit: "Mr Femi Balogun · JSS 3B",
              sub: "0 of 31 form master reports",
              owner: "Mr Femi Balogun",
              role: "Form master",
              state: "Not started",
              age: "6 days",
              overdue: true,
            },
            {
              unit: "Mrs Blessing Uche · SSS 2B",
              sub: "9 of 24 form master reports",
              owner: "Mrs Blessing Uche",
              role: "Form master",
              state: "In progress",
              age: "4 days",
            },
            {
              unit: "Mr Peter Obi · SSS 3A",
              sub: "22 of 22 form master reports",
              owner: "Mr Peter Obi",
              role: "Form master",
              state: "Complete",
              age: "—",
            },
            {
              unit: "Adaeze Nwosu · your reviews",
              sub: `${ready} written · ${total("inReview")} waiting on you`,
              owner: "Adaeze Nwosu",
              role: "Principal · you",
              state: "In progress",
              age: "2 days",
            },
          ],
        },
      ]),
    ],
  },

  completion: {
    title: "Completion",
    desc: "Which arms can go out, and what is holding the rest.",
    primary: { label: `Publish the ${ready} ready cards`, drawer: publishDrawer },
    launchers: [
      { label: "Open the outstanding remarks", href: "/report-cards/remarks" },
      { label: "Archive", href: "/report-cards/archive" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 6,
          cards: [
            {
              label: "Ready to publish",
              value: String(ready),
              unit: `of ${cards}`,
              sub: `${clear} arms complete`,
              tone: ready === cards ? "positive" : "attention",
            },
            {
              label: "Arms clear",
              value: String(clear),
              unit: `of ${arms.length}`,
              sub: clear ? "Every child ready" : "No arm is fully ready yet",
              tone: clear === arms.length ? "positive" : "attention",
            },
            {
              label: "Blocked on scores",
              value: String(blocked),
              sub: "A sheet is unapproved",
              tone: blocked ? "negative" : "positive",
              link: "Open review",
              href: "/score-entry-results/review",
            },
            {
              label: "Remarks owed",
              value: String(owed),
              sub: `Across ${owedArms.length} arms`,
              tone: owed ? "attention" : "positive",
              link: "Write them",
              href: "/report-cards/remarks",
            },
            {
              label: "Published",
              value: "0",
              sub: "Nothing has reached a family",
              tone: "neutral",
            },
            {
              label: "Publish date",
              value: "2 Oct",
              sub: "27 days away",
              link: "Open calendar",
              href: "/school-configuration/calendar",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Report cards by arm",
          tag: `${clear} of ${arms.length} arms clear`,
          tagTone: clear === arms.length ? "positive" : "attention",
          sub: "Open an arm to work through its children, preview a card, and publish or print the whole arm.",
          meta: `${cards} cards · ${ready} ready · ${blocked} blocked on scores · ${owed} remarks owed`,
          search: "Find an arm, a class or a form master",
          filters: [
            {
              label: "State",
              value: "All",
              options: ["All", "Ready", "Blocked", "Remarks owed", "Awaiting review"],
              column: 8,
            },
          ],
          selectable: true,
          per: 12,
          noun: "arm",
          nounPlural: "arms",
          bulkActs: [
            { label: "Publish these arms" },
            { label: "Print these arms" },
            { label: "Notify their form masters" },
            { label: "Export the broadsheet", primary: true },
          ],
          acts: [
            {
              label: "Print by class",
              drawer: exportDrawer({
                title: "Print report cards by class",
                what: `${ready} ready cards, laid out for printing`,
                scope: "The whole school · partly-ready arms are skipped child by child",
                format: "PDF",
              }),
            },
            { label: "Publish everything ready", primary: true, drawer: publishDrawer },
          ],
          head: [
            "Arm",
            "Form master",
            "Roll",
            "Ready",
            "Blocked",
            "Owed",
            "Review",
            "Avg",
            "State",
            "",
          ],
          rows: armRows,
        },
      ]),
      row("1.1fr 1fr", [
        {
          type: "list",
          title: "What is holding the school up",
          sub: "Each one names the arms it blocks.",
          items: [
            {
              label: `${blocked} cards blocked on an unapproved score sheet`,
              sub: `In ${blockedArms
                .slice(0, 4)
                .map((arm) => arm.arm)
                .join(", ")}. Nobody is being given a zero — the card simply cannot compute.`,
              pill: "Blocked",
              tone: "negative",
              viewLabel: "Open review",
              href: "/score-entry-results/review",
            },
            {
              label: `${owed} form master remarks unwritten`,
              sub: `Across ${owedArms.length} arms. A card cannot generate without its form master remark.`,
              pill: "Owed",
              tone: "attention",
              viewLabel: "Write them",
              href: "/report-cards/remarks",
            },
            {
              label: "Civic Education has no teacher in JSS 3A and 3C",
              sub: "Unassigned for 34 days. No score can exist for a subject nobody teaches.",
              pill: "No teacher",
              tone: "negative",
              viewLabel: "Assign",
              href: "/class-timetable/teaching",
            },
            {
              label: "3 children sit in no class arm",
              sub: "A card cannot be addressed to an arm that does not exist for them.",
              pill: "No arm",
              tone: "attention",
              viewLabel: "Allocate",
              href: "/student-records/registry",
            },
            {
              label: "Principal remarks not started",
              sub: `0 of ${cards}. Yours — they can be applied by band and refined individually.`,
              pill: "Not started",
              tone: "attention",
              viewLabel: "Open remarks",
              href: "/report-cards/remarks",
            },
          ],
        },
        {
          type: "facts",
          title: "How publishing works here",
          sub: `The same rules whether you publish one card or all ${cards}.`,
          facts: [
            [
              "Publishing",
              "Student portal and guardian portal, at once",
              "Free, instant, and the family is notified in-app",
            ],
            [
              "Off-app delivery",
              "SMS, email, WhatsApp or print",
              "A separate, costed send — never automatic",
            ],
            [
              "Bulk scope",
              "One child, one arm, one class, or the whole school",
              "Every scope shows what it will skip",
            ],
            [
              "Partly-ready arms",
              "Skipped child by child",
              "A half-finished card never reaches a family",
            ],
            [
              "Fee balances",
              "Do not withhold a card",
              "Your policy — changeable in Fee Management",
            ],
            [
              "Reversible",
              "For 1 hour after publishing",
              "After that, a correction reissues the card",
            ],
            [
              "Corrections",
              "Stored beside the original",
              "The family is told what changed and why",
            ],
          ],
        },
      ]),
    ],
  },

  archive: {
    title: "Archive",
    desc: "Every card ever issued, and whether it arrived.",
    primary: {
      label: "Reissue card",
      drawer: {
        mode: "commit",
        kicker: "Archive",
        title: "Reissue a report card",
        sub: "A reissue is stored beside the original, never replacing it.",
        facts: [
          ["What a reissue does", "Produces a corrected card", "The original stays on file"],
          [
            "The family is told",
            "What changed, and why",
            "A revision notice goes with the new card",
          ],
          ["Recorded as", "A revision in the audit log", "Under your name"],
        ],
        commitLabel: "Reissue the card",
        commitDone: "Card reissued",
        commitDoneBody:
          "The corrected card is in the portals beside the original, and the family has been told what changed.",
      },
    },
    launchers: [{ label: "Completion", href: "/report-cards/completion" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            { label: "Cards issued", value: "6,184", sub: "Across 4 sessions" },
            {
              label: "Revisions",
              value: "27",
              sub: "Stored beside the original, never replacing it",
              tone: "submitted",
            },
            {
              label: "Undelivered",
              value: "3",
              sub: "Each links to the record that fixes it",
              tone: "attention",
              link: "Fix",
              href: "/parents-guardians/guardians",
            },
            {
              label: "Withheld",
              value: "2",
              sub: "Both released before term close",
              tone: "withheld",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Issued cards",
          sub: "Retrievable by student, arm, term and session.",
          meta: "6,184 cards · 4 sessions on record",
          search: "Find by student, admission number or arm",
          filters: [
            {
              label: "Session",
              value: "All",
              options: ["All", "2026/2027", "2025/2026", "2024/2025", "2023/2024"],
              column: 2,
            },
            {
              label: "State",
              value: "All",
              options: ["All", "Delivered", "Undelivered", "Revised", "Withheld"],
              column: 4,
            },
          ],
          per: 8,
          noun: "card",
          nounPlural: "cards",
          head: ["Student", "Arm", "Session", "Term", "State", ""],
          rows: [
            {
              cells: [
                nameCell("Aisha Mohammed", "GIA/23/0412"),
                text("SSS 2A"),
                text("2025/2026"),
                text("Third Term"),
                pill("Delivered", "positive"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Emeka Okafor", "GIA/23/0407"),
                text("SSS 2A"),
                text("2025/2026"),
                text("Third Term"),
                pill("Revised", "submitted"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Ibrahim Sule", "GIA/23/0430"),
                text("No arm"),
                text("2025/2026"),
                text("Third Term"),
                pill("Undelivered", "attention"),
                action("Fix"),
              ],
            },
            {
              cells: [
                nameCell("Samuel Bature", "GIA/2025/0290"),
                text("JSS 3B"),
                text("2025/2026"),
                text("Second Term"),
                pill("Delivered", "positive"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Blessing Ade", "GIA/23/0418"),
                text("No arm"),
                text("2024/2025"),
                text("Third Term"),
                pill("Withheld", "withheld"),
                action("View"),
              ],
            },
          ],
          foot: "A revision is stored beside the original, never replacing it — the family can always see what they were first sent.",
        },
      ]),
    ],
  },
};
