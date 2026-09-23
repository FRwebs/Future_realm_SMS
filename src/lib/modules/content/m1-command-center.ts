import {
  action,
  name,
  pill,
  row,
  text,
  type ModuleContent,
} from "@/lib/modules/panels";
import { decisionDrawer, decisions } from "@/lib/modules/decisions";
import { exportDrawer, notifyPersonDrawer, nudgeDrawer } from "@/lib/modules/drawers";
import { nairaShort, schoolFees } from "@/lib/modules/fees-data";
import { attendanceDay } from "@/lib/modules/school-data";
import { registrySummary } from "@/lib/modules/students-data";

const day = attendanceDay();
const fees = schoolFees();
const registry = registrySummary();

/**
 * M01 · Command Center — "What needs you today, and what the school owes."
 *
 * Ported from the School Admin mockup. Oversight answers three questions in
 * order and nothing else: can we publish, who is holding us up, and what is
 * quietly rotting. Everything on it is a person, a number, and the thing that
 * clears it.
 */
export const commandCenterContent: ModuleContent = {
  today: {
    title: "Today",
    desc: "The decisions waiting on you, and how the term is tracking.",
    primary: { label: "Review submissions", href: "/score-entry-results/review" },
    launchers: [{ label: "Open the queue", href: "/approvals-workflow/queue" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 6,
          cards: [
            {
              // Every student record, which is 1,560: the 1,557 on an arm's roll
              // plus the 3 sitting in no class arm. Attendance counts the roll
              // instead, because a child in no arm is in no register.
              label: "Total students",
              value: registry.total.toLocaleString(),
              sub: "+14 this term · 3 withdrawals",
              link: "Open registry",
              href: "/student-records/registry",
            },
            {
              label: "Attendance today",
              value: "94.2%",
              sub: `${day.unmarked + day.partial} of ${day.arms} classes unmarked`,
              tone: "attention",
              link: "See unmarked",
              href: "/attendance/register",
            },
            {
              // Derived from the published fee table and the school's own rolls,
              // for the same reason the roll is: the mockup's stated ₦48.2m of
              // ₦63.7m cannot be reconciled with its own receipts, where one
              // SSS 2 term is ₦339,000.
              label: "Collected this term",
              value: nairaShort(fees.collected),
              sub: `of ${nairaShort(fees.billed)} expected`,
              link: "Open collections",
              href: "/fee-management/collections",
            },
            {
              label: "Score submissions",
              value: "38 of 54",
              sub: "7 returned to teachers",
              tone: "attention",
              link: "Open review",
              href: "/score-entry-results/review",
            },
            {
              label: "Message credits",
              value: "8,420",
              sub: "SMS · above your 2,000 threshold",
              link: "Top up",
              href: "/subscription-billing/credits",
            },
            {
              label: "Sync depth",
              value: "0",
              unit: "pending",
              sub: "Last synced 2 minutes ago",
              link: "Sync detail",
              href: "/sync-support/sync",
            },
          ],
        },
      ]),
      row("1.55fr 1fr", [
        {
          type: "table",
          title: "My actions",
          sub: "Decisions routed to you, priority then age.",
          meta: "6 waiting · 2 escalate today",
          acts: [{ label: "Open queue", href: "/approvals-workflow/queue" }],
          head: ["Decision", "Type", "Blocking", "Age", "Action"],
          // Generated from the shared decision list, so opening one here and
          // opening it from the approvals queue land on the same drawer.
          rows: decisions.map((decision) => ({
            cells: [
              name(decision.shortTitle, decision.shortSub),
              pill(decision.type),
              text(decision.blocking, {
                tone: decision.blockingTone,
                strong: Boolean(decision.blockingTone),
              }),
              text(decision.age, {
                tone: decision.ageTone,
                strong: Boolean(decision.ageTone),
              }),
              { kind: "action", label: "Decide", drawer: decisionDrawer(decision) },
            ],
            keywords: `${decision.type} ${decision.requester}`,
          })),
        },
        {
          type: "tiles",
          title: "Quick actions",
          sub: "The four you use most in this role.",
          per: 2,
          tiles: [
            {
              label: "Mark attendance",
              icon: "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5",
              sub: "Your form class, 60 seconds",
              href: "/attendance/mark",
            },
            {
              label: "Review submissions",
              icon: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5",
              sub: "38 of 54 sheets in",
              tone: "attention",
              href: "/score-entry-results/review",
            },
            {
              label: "Generate cards",
              icon: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4",
              sub: "Blocker gate before it commits",
              tone: "submitted",
              href: "/report-cards/completion",
            },
            {
              label: "Send a message",
              icon: "M4 5.5h16v10.5H9l-5 4z",
              sub: "Cost shown before it sends",
              href: "/communication-center/compose",
            },
          ],
        },
      ]),
      row("1fr 1.1fr", [
        {
          type: "list",
          title: "Term progress",
          sub: "The school's own milestones.",
          acts: [{ label: "Open the calendar", href: "/school-configuration/calendar" }],
          items: [
            {
              label: "Continuous assessment window closed",
              sub: "14 August",
              pill: "Complete",
              tone: "positive",
              viewLabel: "Edit",
              facts: [
                ["Milestone", "Continuous assessment window closed"],
                ["Date", "14 August 2026"],
                ["State", "Complete", "Pick from the states a milestone can be in"],
                ["Owner", "Mrs Folake Adeniyi", "Exam Officer"],
                ["Reminder", "7 days before", "Sent to the owner and to you"],
              ],
            },
            {
              label: "Examination week",
              sub: "8–19 September",
              pill: "In progress",
              tone: "progress",
              viewLabel: "Edit",
              facts: [
                ["Milestone", "Examination week"],
                ["Date", "8–19 September 2026"],
                ["State", "In progress"],
                ["Owner", "Mrs Folake Adeniyi", "Exam Officer"],
                ["Reminder", "3 days before", "Sent to the owner and to you"],
              ],
            },
            {
              label: "Score submission deadline",
              sub: "Was 22 September · 16 sheets outstanding",
              pill: "Overdue",
              tone: "negative",
              viewLabel: "Edit",
              facts: [
                ["Milestone", "Score submission deadline"],
                ["Date", "22 September 2026", "Passed 4 days ago"],
                ["State", "Overdue"],
                ["Owner", "All subject teachers", "16 have not submitted"],
                [
                  "Reminder",
                  "On the day, then daily",
                  "Escalates to Heads of Department after 3 days",
                ],
              ],
            },
            {
              label: "Report card publication",
              sub: "2 October",
              pill: "Not started",
              viewLabel: "Edit",
              facts: [
                ["Milestone", "Report card publication"],
                ["Date", "2 October 2026", "27 days away"],
                ["State", "Not started"],
                ["Owner", "You · Adaeze Nwosu"],
                ["Reminder", "7 days before"],
              ],
            },
            {
              label: "Term close and rollover",
              sub: "9 October",
              pill: "Not started",
              viewLabel: "Edit",
              facts: [
                ["Milestone", "Term close and rollover"],
                ["Date", "9 October 2026", "34 days away"],
                ["State", "Not started"],
                ["Owner", "You · Adaeze Nwosu"],
                ["Reminder", "14 days before", "Cannot run until every card is published"],
              ],
            },
          ],
        },
        {
          type: "list",
          title: "Activity",
          sub: "Consequential actions across the school, scoped to what you may see.",
          readOnly: true,
          acts: [{ label: "Open the full audit log", href: "/audit-security/audit-log" }],
          foot: "Audit entries are records of what happened: read-only, never editable, never deletable — a log you can delete from is not a log.",
          items: [
            {
              label: "Mrs Folake Adeniyi approved 12 score sheets",
              sub: "Score Entry · 14 minutes ago",
              tone: "positive",
              facts: [
                ["Who", "Mrs Folake Adeniyi", "Exam Officer · staff ID GIA/ST/0031"],
                ["What", "Approved 12 score sheets", "JSS 1A–JSS 3C · Mathematics and English"],
                [
                  "Effect",
                  "408 subject scores became final",
                  "They now feed the broadsheet and the report cards",
                ],
                ["When", "Today, 07:52", "14 minutes ago"],
                [
                  "Where from",
                  "Chrome on Windows · school network",
                  "197.210.44.18 · Wuse II campus",
                ],
                [
                  "Reversible",
                  "Yes, for 48 hours",
                  "After that a score correction request is required",
                ],
              ],
            },
            {
              label: "Bursar recorded ₦1,240,000 across 9 payments",
              sub: "Fee Management · 41 minutes ago",
              tone: "positive",
              facts: [
                ["Who", "Mr Tunde Bakare", "Bursar · staff ID GIA/ST/0008"],
                ["What", "9 payments recorded", "7 bank transfers, 2 cash"],
                ["Effect", "₦1,240,000 collected", "4 families cleared their balance in full"],
                ["When", "Today, 07:25", "41 minutes ago"],
                ["Where from", "Nooria mobile · Android", "Recorded offline, synced at 07:31"],
                ["Reversible", "Each payment individually", "A reversal needs a reason and is logged"],
              ],
            },
            {
              label: "Mr Ibrahim Danladi returned JSS 2B Mathematics",
              sub: "Score Entry · 2 hours ago",
              tone: "attention",
              facts: [
                ["Who", "Mr Ibrahim Danladi", "Head of Department · Mathematics"],
                ["What", "Returned a submitted sheet", "JSS 2B Mathematics · Second Term"],
                [
                  "Reason given",
                  "Two CA totals exceed the 15 maximum",
                  "Rows 12 and 27 · flagged by validation",
                ],
                ["Effect", "34 cards blocked", "The teacher has been notified and must resubmit"],
                ["When", "Today, 06:04", "2 hours ago"],
                ["Reversible", "No — the sheet is with the teacher", "You can escalate instead"],
              ],
            },
            {
              label: "Timetable republished — 14 staff notified of their change",
              sub: "Class & Timetable · yesterday",
              tone: "progress",
              facts: [
                ["Who", "You · Adaeze Nwosu", "School Administrator"],
                ["What", "Republished the running timetable", "Version 4 · Second Term 2026/2027"],
                ["Effect", "14 staff had a period move", "Each was told only about their own change"],
                ["When", "Yesterday, 16:20"],
                ["Reversible", "Yes — version 3 is still on file"],
              ],
            },
          ],
        },
      ]),
    ],
  },

  oversight: {
    title: "Oversight",
    desc: "Can we publish, who is holding us up, what is rotting.",
    primary: {
      label: "Notify everyone outstanding",
      drawer: nudgeDrawer({
        count: 23,
        kicker: "Oversight",
        title: "Notify everyone outstanding",
        who: "16 teachers, 5 form masters, 2 heads of department",
        what: "Their own outstanding items, with a link straight to each one",
        extra: [
          ["Score sheets outstanding", "16", "Oldest is 9 days late"],
          ["Remarks outstanding", "948", "Across 2 form masters who have not started"],
        ],
      }),
    },
    launchers: [
      { label: "Open the queue", href: "/approvals-workflow/queue" },
      { label: "Report cards", href: "/report-cards/completion" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Cards that would generate now",
              value: "1,433",
              unit: "of 1,560",
              sub: "92% of the school is ready today",
              tone: "positive",
            },
            {
              label: "Cards blocked",
              value: "127",
              sub: "Across 4 arms and 4 named causes",
              tone: "negative",
              link: "See the causes",
              href: "/report-cards/completion",
            },
            {
              label: "People holding it up",
              value: "5",
              sub: "3 teachers, 2 form masters",
              tone: "attention",
              link: "See who",
              href: "/approvals-workflow/queue",
            },
            {
              label: "Days of slack left",
              value: "11",
              sub: "Before remarks alone put the date at risk",
              tone: "attention",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "blockers",
          title: "What is blocking those 127 cards",
          tag: "4 blockers",
          tagTone: "negative",
          sub: "Each one names the record that clears it and the person who owns it.",
          meta: "Target 2 October · oldest blocker 34 days",
          acts: [
            {
              label: "Export readiness report",
              drawer: exportDrawer({
                title: "Export readiness report",
                what: "Every blocked card, its cause, and the person who owns it",
                scope: "The whole school · 127 blocked cards across 4 arms",
                note: "Produced against the target publication date of 2 October.",
              }),
            },
          ],
          items: [
            {
              title: "JSS 2A · 4 cards · Chemistry scores unapproved",
              detail:
                "Submitted by Mr Ibrahim Danladi on 3 September. Sitting with the Exam Officer for 3 days. Two CA totals exceed the maximum, which is why it was flagged.",
              action: "Open the sheet",
              href: "/score-entry-results/review",
            },
            {
              title: "SSS 1B · 11 cards · form master remarks outstanding",
              detail:
                "Mrs Ngozi Eze has written 18 of 29. At her current rate this clears in 4 days — inside the deadline, but only just.",
              action: "Open remarks",
              href: "/report-cards/remarks",
            },
            {
              title: "JSS 3A and 3C · 112 cards · Civic Education has no teacher",
              detail:
                "Unassigned since term start, 34 days ago. No scores can exist for a subject nobody teaches, so these cards cannot generate at all. This is the one blocker that will not clear itself.",
              action: "Assign a teacher",
              href: "/class-timetable/teaching",
            },
            {
              title: "6 students · no core consent recorded",
              detail:
                "Their results cannot be published to a guardian until consent is on file. Five have a phone number; one does not and will need a printed form.",
              action: "Request consent",
              href: "/parents-guardians/consent",
              tone: "attention",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Who is holding the school up",
          sub: "Sorted by how long the oldest item has been sitting with them.",
          meta: "23 people owe something · 5 are past the point of nudging",
          search: "Find a person by name or role",
          filters: [
            { label: "Owes", value: "Anything", options: ["Anything", "remarks", "score sheet", "approval", "cash-up"], column: 2 },
            { label: "Role", value: "All", options: ["All", "Form master", "Subject teacher", "Head of Dept", "Exam Officer", "Bursar"], column: 1 },
          ],
          selectable: true,
          per: 8,
          noun: "person",
          nounPlural: "people",
          bulkActs: [
            { label: "Notify selected" },
            { label: "Escalate to their head of department" },
            { label: "Reassign the work", primary: true },
          ],
          acts: [
            {
              label: "Notify everyone",
              primary: true,
              drawer: nudgeDrawer({
                count: 23,
                kicker: "Oversight",
                who: "people who owe the school something",
              }),
            },
          ],
          head: ["Person", "Role", "What they owe", "Items", "Oldest", "Last notified", ""],
          rows: [
            {
              cells: [
                name("Mrs Ngozi Eze", "Form master · SSS 1B"),
                text("Form master"),
                text("11 remarks"),
                text("11", { mono: true }),
                text("6 days", { tone: "attention", strong: true }),
                text("Yesterday"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mrs Ngozi Eze",
                    role: "Form master · SSS 1B",
                    owes: "11 remarks",
                    items: 11,
                    oldest: "6 days",
                    last: "Yesterday",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mr Samuel Adeyemi", "Chemistry · SSS 2A"),
                text("Subject teacher"),
                text("1 score sheet returned"),
                text("1", { mono: true }),
                text("9 days", { tone: "negative", strong: true }),
                text("3 days ago"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mr Samuel Adeyemi",
                    role: "Subject teacher · Chemistry · SSS 2A",
                    owes: "1 score sheet returned",
                    items: 1,
                    oldest: "9 days",
                    last: "3 days ago",
                    due: "End of today",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mr Ibrahim Danladi", "Head of Department · Mathematics"),
                text("Head of Dept"),
                text("4 sheets to review"),
                text("4", { mono: true }),
                text("3 days"),
                text("Today"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mr Ibrahim Danladi",
                    role: "Head of Department · Mathematics",
                    owes: "4 sheets to review",
                    items: 4,
                    oldest: "3 days",
                    last: "Today",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mrs Folake Adeniyi", "Exam Officer"),
                text("Exam Officer"),
                text("1 broadsheet approval"),
                text("1", { mono: true }),
                text("2 days"),
                text("Today"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mrs Folake Adeniyi",
                    role: "Exam Officer",
                    owes: "1 broadsheet approval",
                    items: 1,
                    oldest: "2 days",
                    last: "Today",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mr Peter Obi", "Form master · JSS 2C"),
                text("Form master"),
                text("29 remarks · not started"),
                text("29", { mono: true }),
                text("6 days", { tone: "attention", strong: true }),
                text("Never", { tone: "negative", strong: true }),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mr Peter Obi",
                    role: "Form master · JSS 2C",
                    owes: "29 remarks · not started",
                    items: 29,
                    oldest: "6 days",
                    last: "Never",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Miss Grace Etim", "English · JSS 1A–1C"),
                text("Subject teacher"),
                text("3 score sheets"),
                text("3", { mono: true }),
                text("4 days"),
                text("2 days ago"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Miss Grace Etim",
                    role: "Subject teacher · English · JSS 1A–1C",
                    owes: "3 score sheets",
                    items: 3,
                    oldest: "4 days",
                    last: "2 days ago",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mr Tunde Bakare", "Bursar"),
                text("Bursar"),
                text("2 cash-up days"),
                text("2", { mono: true }),
                text("2 days"),
                text("Never", { tone: "negative", strong: true }),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mr Tunde Bakare",
                    role: "Bursar",
                    owes: "2 cash-up days",
                    items: 2,
                    oldest: "2 days",
                    last: "Never",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mrs Amaka Eze", "Form master · JSS 1A"),
                text("Form master"),
                text("7 remarks"),
                text("7", { mono: true }),
                text("3 days"),
                text("Yesterday"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mrs Amaka Eze",
                    role: "Form master · JSS 1A",
                    owes: "7 remarks",
                    items: 7,
                    oldest: "3 days",
                    last: "Yesterday",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Mr Sule Bature", "Biology · SSS 1A–1B"),
                text("Subject teacher"),
                text("2 score sheets"),
                text("2", { mono: true }),
                text("2 days"),
                text("Today"),
                {
                  kind: "action",
                  label: "Notify",
                  drawer: notifyPersonDrawer({
                    name: "Mr Sule Bature",
                    role: "Subject teacher · Biology · SSS 1A–1B",
                    owes: "2 score sheets",
                    items: 2,
                    oldest: "2 days",
                    last: "Today",
                    due: "In 2 days",
                  }),
                },
              ],
            },
            {
              cells: [
                name("Unassigned", "Civic Education · JSS 3A, 3C"),
                text("No teacher"),
                text("2 subject-arms"),
                text("2", { mono: true }),
                text("34 days", { tone: "negative", strong: true }),
                text("—"),
                action("Assign", "/class-timetable/teaching"),
              ],
            },
          ],
        },
      ]),
      row("1.15fr 1fr", [
        {
          type: "table",
          title: "Delegated work",
          sub: "Everything you handed to someone else, and whether it is moving.",
          meta: "8 trackers · 3 not moving",
          head: ["Tracker", "Progress", "State", "Oldest", "Moving?", ""],
          foot: "“Not moving” means the count has not changed in more than 5 days.",
          rows: [
            {
              cells: [
                text("Attendance today", { strong: true }),
                text("36 of 42", { mono: true }),
                pill("In progress", "progress"),
                text("—"),
                text("Yes · +8 today", { tone: "positive", strong: true }),
                action("Open", "/attendance/register"),
              ],
            },
            {
              cells: [
                text("Score submissions", { strong: true }),
                text("38 of 54", { mono: true }),
                pill("Returned", "attention"),
                text("9 days"),
                text("Slowly · +2 this week", { tone: "attention", strong: true }),
                action("Open", "/score-entry-results/review"),
              ],
            },
            {
              cells: [
                text("Remarks", { strong: true }),
                text("612 of 1,560", { mono: true }),
                pill("In progress", "progress"),
                text("6 days"),
                text("Yes · +94 this week", { tone: "positive", strong: true }),
                action("Open", "/report-cards/remarks"),
              ],
            },
            {
              cells: [
                text("Report cards", { strong: true }),
                text("0 of 1,560", { mono: true }),
                pill("Not started"),
                text("—"),
                text("Blocked", { tone: "negative", strong: true }),
                action("Open", "/report-cards/completion"),
              ],
            },
            {
              cells: [
                text("Pending approvals", { strong: true }),
                text("6 of 15", { mono: true }),
                pill("Awaiting", "attention"),
                text("19 days"),
                text("No · unchanged 6 days", { tone: "negative", strong: true }),
                action("Open", "/approvals-workflow/queue"),
              ],
            },
            {
              cells: [
                text("Guardian submissions", { strong: true }),
                text("23 of 28", { mono: true }),
                pill("In progress", "progress"),
                text("4 days"),
                text("Yes", { tone: "positive", strong: true }),
                action("Open", "/parents-guardians/submissions"),
              ],
            },
            {
              cells: [
                text("Record changes", { strong: true }),
                text("11 of 14", { mono: true }),
                pill("Awaiting", "attention"),
                text("2 days"),
                text("Yes", { tone: "positive", strong: true }),
                action("Open", "/student-records/changes"),
              ],
            },
            {
              cells: [
                text("Payments recorded", { strong: true }),
                text("9 of 9", { mono: true }),
                pill("Complete", "positive"),
                text("—"),
                text("Done", { tone: "positive", strong: true }),
                action("Open", "/fee-management/collections"),
              ],
            },
          ],
        },
        {
          type: "table",
          title: "Quietly rotting",
          sub: "Data that breaks something later, not today.",
          meta: "61 records · each one blocks a specific thing",
          head: ["Check", "Count", "What it breaks", ""],
          foot: "None of these stop you today. All of them stop you on result day.",
          rows: [
            {
              cells: [
                text("Guardian never activated the portal"),
                text("21", { mono: true }),
                text("They will not see the report card you publish."),
                action("Fix", "/parents-guardians/guardians"),
              ],
            },
            {
              cells: [
                text("No guardian phone number"),
                text("14", { mono: true }),
                text("Cannot be reached by SMS at all — needs a printed copy."),
                action("Fix", "/parents-guardians/guardians"),
              ],
            },
            {
              cells: [
                text("Delivery failing to guardian"),
                text("9", { mono: true }),
                text("Messages are being sent and silently lost."),
                action("Fix", "/communication-center/sent"),
              ],
            },
            {
              cells: [
                text("Missing photograph or date of birth"),
                text("7", { mono: true }),
                text("Blocks the transcript and the WAEC entry file."),
                action("Fix", "/student-records/registry"),
              ],
            },
            {
              cells: [
                text("No consent recorded"),
                text("6", { mono: true }),
                text("Results cannot be published to that guardian."),
                action("Fix", "/parents-guardians/consent"),
              ],
            },
            {
              cells: [
                text("Invalid phone number format"),
                text("4", { mono: true }),
                text("Fails at the network, not at Nooria."),
                action("Fix", "/parents-guardians/guardians"),
              ],
            },
            {
              cells: [
                text("Student with no class arm"),
                text("3", { mono: true }),
                text("Excluded from every register and every report card."),
                action("Fix", "/class-timetable/classes"),
              ],
            },
            {
              cells: [
                text("Suspected duplicate record"),
                text("2", { mono: true }),
                text("One child counted twice in enrolment and fees."),
                action("Fix", "/student-records/registry"),
              ],
            },
          ],
        },
      ]),
    ],
  },
};
