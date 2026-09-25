import {
  mark,
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
 * M16 · Sync & Support — "Is everything saved, what is waiting, and what does
 * this device hold?"
 *
 * The mockup hides the pending queue and the conflicts while the device is
 * online, because there is nothing in them. There is no live connection state
 * behind this content, so the tab is authored in the state that has something
 * to say — a device with work waiting — and every figure on it agrees with
 * that state. An online device would show the same panels, empty.
 *
 * The honest list is the point of the module: eleven things that work with no
 * connection, and eleven that need one, stated plainly rather than discovered
 * by a teacher standing in a classroom.
 */

/* ------------------------------------------------------------------- Sync */

type PendingType = {
  type: string;
  count: number;
  oldest: string;
  who: string;
  role: string;
  retries: number;
};

const pendingQueue: PendingType[] = [
  { type: "Attendance marks", count: 6, oldest: "41 min · JSS 2A, 4 Sep", who: "Adaeze Nwosu", role: "Principal · you", retries: 3 },
  { type: "Score entries", count: 4, oldest: "28 min · Chemistry SSS 2A", who: "Mr S. Adeyemi", role: "Exam Officer", retries: 2 },
  { type: "Payments", count: 1, oldest: "19 min · ₦95,000, provisional receipt", who: "Miss G. Etim", role: "Registrar", retries: 1 },
  { type: "Remark drafts", count: 1, oldest: "12 min · Chioma Adebayo", who: "Mrs F. Adeniyi", role: "Form master", retries: 0 },
];

const pendingRecords = pendingQueue.reduce((total, entry) => total + entry.count, 0);

type Conflict = {
  record: string;
  kind: string;
  versionA: string;
  versionB: string;
  authors: string;
};

const conflicts: Conflict[] = [
  {
    record: "JSS 2A · 4 September register",
    kind: "Attendance mark",
    versionA: "Emeka Okafor marked Absent · 08:12 on device “Principal iPhone”",
    versionB: "Emeka Okafor marked Present · 08:19 on device “Staff room tablet”",
    authors: "A: Adaeze Nwosu · B: Mrs F. Adeniyi",
  },
  {
    record: "Chioma Adebayo · payment",
    kind: "₦60,000, bank transfer",
    versionA: "Recorded 09:02 on device “Bursary desktop” · reference GTB/2609/884120",
    versionB: "Recorded 09:05 on device “Registrar laptop” · same reference",
    authors: "A: Mrs C. Obi · B: Miss G. Etim",
  },
];

/** Eleven things that work with no connection, and eleven that need one. */
const offlineCapabilities: Array<[string, string]> = [
  ["Mark attendance", "Publish report cards"],
  ["Enter and edit scores", "Send any message"],
  ["Write remark drafts", "Approve anything"],
  ["Record a payment · provisional receipt", "Generate report cards"],
  ["Read any student record", "Migration and bulk import"],
  ["Read any guardian record", "Full-school export"],
  ["View computed results · marked provisional", "Add or invite a staff member"],
  ["Read cached help articles", "Change permissions"],
  ["View your timetable and class lists", "Publish a timetable or fee structure"],
  ["Draft a support ticket", "Resolve a sync conflict"],
  ["See sync state and pending queue", "Platform status check"],
];

const syncNowDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Sync",
  title: "Sync now",
  sub: "Manual sync is always available and always visible.",
  facts: [
    ["Pending records", String(pendingRecords), "Nothing has been lost"],
    ["Oldest", "41 minutes · an attendance register"],
    ["Unresolved conflicts", String(conflicts.length), "These need a decision before they can sync"],
    ["What happens", "Every queued record is sent in the order it was made"],
    ["If it fails again", "It stays queued and retries", "A record is never dropped"],
  ],
  commitLabel: "Sync now",
  commitDone: "Sync started",
  commitDoneBody: `${pendingRecords} records are on their way. The ${conflicts.length} conflicts still need a decision.`,
};

function conflictDrawer(conflict: Conflict): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Sync conflict",
    title: conflict.record,
    sub: "Two versions of the same record. Both are shown with their author, device and time.",
    tone: "negative",
    facts: [
      ["Record", conflict.record, conflict.kind],
      ["Version A", conflict.versionA],
      ["Version B", conflict.versionB],
      ["Authors", conflict.authors],
      [
        "Why it happened",
        "Two devices held the record while one was offline",
        "Neither person did anything wrong",
      ],
      [
        "What is not decided for you",
        "Which version is right",
        "The product will not guess between two people's work",
      ],
      ["Logged", "The choice and the discarded version", "Both are kept on the record"],
    ],
    commitLabel: "Keep version B",
    commitDone: "Conflict resolved",
    commitDoneBody: "Version B is the record. Version A is kept alongside it, with who chose and when.",
  };
}

const syncTab: TabContent = {
  title: "Sync",
  desc: "Is everything saved, what is waiting, and what does this device hold?",
  primary: { label: "Sync now", drawer: syncNowDrawer },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          {
            label: "Connection",
            value: "Offline",
            sub: "Manual sync is always available and always visible",
            tone: "offline",
          },
          {
            label: "Pending records",
            value: String(pendingRecords),
            sub: "Oldest is 41 minutes old · an attendance register",
            tone: "attention",
          },
          {
            label: "Last successful sync",
            value: "41 min ago",
            sub: "4 September 2026, 09:43 WAT",
          },
          {
            label: "Unresolved conflicts",
            value: String(conflicts.length),
            sub: "Above the school threshold of 1 — escalated to the Principal",
            tone: "negative",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Pending queue",
        sub: "By type, with the oldest record and its age.",
        meta: `${pendingRecords} records · nothing has been lost`,
        noun: "type",
        nounPlural: "types",
        empty: "Nothing is waiting. Everything on this device is saved to the school's record.",
        acts: [{ label: "Sync now", primary: true, drawer: syncNowDrawer }],
        head: ["Type", "Count", "Oldest", "Who", "Retries", "State"],
        rows: pendingQueue.map(
          (entry): TableRow => ({
            cells: [
              text(entry.type, { strong: true }),
              text(String(entry.count), { mono: true }),
              text(entry.oldest),
              nameCell(entry.who, entry.role),
              text(String(entry.retries), { mono: true }),
              pill("Queued", "attention"),
            ],
            drawer: {
              kicker: "Pending queue",
              title: entry.type,
              sub: `${entry.count} waiting. Oldest ${entry.oldest}.`,
              readOnly: true,
              readOnlyNote:
                "A queued record is held on this device until it syncs. It is never dropped, and it is never silently changed.",
              facts: [
                ["Type", entry.type],
                ["Count", String(entry.count)],
                ["Oldest", entry.oldest],
                ["Entered by", entry.who, entry.role],
                [
                  "Retries",
                  String(entry.retries),
                  entry.retries ? "Each failure is backed off, not abandoned" : "It has not needed one yet",
                ],
                ["If this device is lost", "The queue goes with it", "Sync now if you are about to hand it over"],
              ],
            },
            keywords: `${entry.who} ${entry.role}`,
          }),
        ),
        foot: "Nothing in this queue has been lost. A record is held on the device until it syncs, and it is never dropped.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Conflicts",
        tag: `${conflicts.length} unresolved · escalated`,
        tagTone: "negative",
        sub: "Both versions side by side with author, device and client event time.",
        noun: "conflict",
        nounPlural: "conflicts",
        empty: "Nothing to resolve.",
        head: ["Record", "Version A", "Version B", "Authors", ""],
        rows: conflicts.map(
          (conflict): TableRow => ({
            cells: [
              nameCell(conflict.record, conflict.kind, { avatar: false }),
              text(conflict.versionA),
              text(conflict.versionB),
              text(conflict.authors),
              { kind: "action", label: "Resolve", drawer: conflictDrawer(conflict) },
            ],
            keywords: conflict.authors,
          }),
        ),
        foot: "The product will not guess between two people's work. You choose, and the version you did not choose is kept alongside with who chose and when.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "What works offline",
        tag: "The honest list",
        tagTone: "neutral",
        sub: "Eleven things that work with no connection, and eleven that need one.",
        noun: "capability",
        nounPlural: "capabilities",
        per: 11,
        head: ["Works offline", "", "Requires a connection", ""],
        rows: offlineCapabilities.map(
          ([works, requires]): TableRow => ({
            cells: [text(works), mark(true), text(requires), mark(false)],
          }),
        ),
        foot: "This list is here so a teacher finds out what works before they are standing in a classroom with no signal — not afterwards.",
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "attention",
        title: "This browser has not granted persistent storage",
        body: "Your device is holding 42 MB of 120 MB available, which is comfortable. But this browser may clear it if the device runs short of space, which would lose anything not yet synced.",
        acts: [
          {
            label: "How to grant storage",
            drawer: {
              kicker: "Device storage",
              title: "Granting persistent storage",
              sub: "So the browser cannot clear work that has not synced yet.",
              readOnly: true,
              readOnlyNote: "This is a browser setting. Nooria cannot grant it for you.",
              facts: [
                ["Holding now", "42 MB of 120 MB available", "Comfortable"],
                [
                  "The risk",
                  "The browser may clear it under storage pressure",
                  "Anything not yet synced would go with it",
                ],
                ["On Chrome and Edge", "Site settings → Permissions → allow persistent storage"],
                ["On Safari", "Add the site to the Home Screen, which grants it automatically"],
                ["Meanwhile", "Sync often on a shared device", "The queue is safest once it has left the device"],
              ],
            },
          },
          {
            label: "Clear cache",
            drawer: {
              mode: "commit",
              kicker: "Device storage",
              title: "Clear the cache on this device",
              sub: "This is not reversible, and it does not sync anything first.",
              tone: "negative",
              facts: [
                ["Pending records", String(pendingRecords), "These would be lost"],
                ["Unresolved conflicts", String(conflicts.length), "These would be lost"],
                ["Cached articles", "6 · re-downloaded when you are next online"],
                ["What is safe", "Anything already synced", "It lives on the school's record, not this device"],
                ["Do this first", "Sync now", "Then clearing costs nothing"],
              ],
              commitLabel: "Clear the cache anyway",
              commitDone: "Cache cleared",
              commitDoneBody: "The device holds nothing now. Anything already synced is safe on the school's record.",
            },
          },
        ],
      },
    ]),
  ],
};

/* ---------------------------------------------------------- Help & Support */

const quickStartGuides: Array<{ label: string; sub: string; icon: string }> = [
  { label: "Form Master · one page", sub: "Mark a register, write remarks, act on an absence explanation", icon: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4" },
  { label: "Subject Teacher · one page", sub: "Enter scores by keyboard, submit a sheet, request a correction", icon: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5" },
  { label: "Exam Officer · two pages", sub: "Review submissions, verify, approve, generate and publish", icon: "m4.5 12.5 4.5 4.5 9-10M4.5 19.5h15" },
  { label: "Bursar · two pages", sub: "Record a payment, close a cash-up, send reminders with the cost shown", icon: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M9.5 9.6h5M9.5 14.4h5M12 6.8v10.4" },
  { label: "Principal · three pages", sub: "Read Oversight, work an approval queue, publish a results day", icon: "M3 12h4l2.5-6 4 12 2.5-6h5" },
  { label: "Proprietor · two pages", sub: "What the school owes, what it costs, and how to take your data out", icon: "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z" },
];

type Ticket = {
  ref: string;
  subject: string;
  priority: "Low" | "Normal" | "High";
  raised: string;
  state: "Resolved" | "In progress" | "Queued";
};

const tickets: Ticket[] = [
  { ref: "#4821", subject: "SMS batch to 214 families failed on 3 recipients", priority: "Normal", raised: "Yesterday", state: "Resolved" },
  { ref: "#4712", subject: "Offline register on the staff room tablet did not sync for 2 days", priority: "High", raised: "28 Aug", state: "Resolved" },
  { ref: "#4680", subject: "Credit top-up applied to rich messaging instead of SMS", priority: "Normal", raised: "14 Aug", state: "Resolved" },
  { ref: "#4655", subject: "Request a new rich messaging template for examination timetables", priority: "Low", raised: "8 Aug", state: "In progress" },
  { ref: "Draft", subject: "Civic Education JSS 3 arms show no teacher — queued offline, will send on sync", priority: "Normal", raised: "Today", state: "Queued" },
];

const articles: Array<{ label: string; sub: string }> = [
  { label: "Marking a register in under a minute", sub: "Video · 2:10 · cached on this device · the highest-frequency workflow in the product" },
  { label: "Entering scores by keyboard only", sub: "Video · 3:40 · cached on this device" },
  { label: "Recording a payment and printing a receipt", sub: "Video · 2:55 · cached on this device" },
  { label: "Publishing a results day end to end", sub: "Video · 6:20 · cached on this device" },
  { label: "Why is my work not syncing?", sub: "Article · the single most common support question, answered before it becomes a ticket" },
  { label: "What works without a connection", sub: "Article · the same honest list you see on the Sync tab" },
];

const raiseTicketDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Support",
  title: "Raise a ticket",
  sub: "Response target 4 working hours · 07:00–17:00 WAT.",
  facts: [
    ["Priority", "Low, Normal or High", "High is for something stopping the school working today"],
    ["What is attached", "Your school, your role and the page you were on", "Never a student's record"],
    ["Offline", "A ticket can be drafted and queued", "It sends on the next sync"],
    ["Who reads it", "Future Realm support", "They see only what the ticket carries, and every session is logged"],
  ],
  commitLabel: "Raise the ticket",
  commitDone: "Ticket raised",
  commitDoneBody: "You will have a first response within 4 working hours.",
};

const helpTab: TabContent = {
  title: "Help & Support",
  desc: "Learn the product, or raise a ticket.",
  primary: { label: "Raise ticket", drawer: raiseTicketDrawer },
  rows: [
    row("1fr", [
      {
        type: "note",
        tone: "positive",
        icon: "M5 12.5l4.5 4.5 9-10",
        title: "All systems operational · checked 2 minutes ago",
        body: "This answers “is it my internet or is it the system”, which otherwise generates a ticket every single time.",
        acts: [
          {
            label: "Read the 3.4 release notes",
            drawer: {
              kicker: "Release 3.4",
              title: "What changed in 3.4",
              sub: "Released 1 September 2026.",
              readOnly: true,
              facts: [
                ["Score entry", "Keyboard-only entry across a whole sheet"],
                ["Attendance", "Backdating now carries its reason on the record"],
                ["Offline", "The pending queue shows the oldest record's age"],
                ["Approvals", "A returned request states what to change, not just that it was refused"],
                ["Fixed", "A credit top-up could apply to the wrong channel", "Ticket #4680"],
              ],
            },
          },
          {
            label: "Maintenance detail",
            drawer: {
              kicker: "Platform status",
              title: "Maintenance and status",
              sub: "All systems operational, checked 2 minutes ago.",
              readOnly: true,
              readOnlyNote: "Status is checked live. It needs a connection, so it is one of the things that does not work offline.",
              facts: [
                ["Checked", "2 minutes ago"],
                ["Next planned maintenance", "Sunday 12 October, 01:00–03:00 WAT", "Outside school hours in every region"],
                ["During maintenance", "Offline entry keeps working", "It syncs when the window closes"],
                ["Notice given", "7 days", "To the billing and school contacts"],
              ],
            },
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "tiles",
        title: "Quick-start guides",
        sub: "Role-specific.",
        per: 3,
        tiles: quickStartGuides.map((guide) => ({
          label: guide.label,
          sub: guide.sub,
          icon: guide.icon,
          drawer: {
            kicker: "Quick-start guide",
            title: guide.label,
            sub: guide.sub,
            readOnly: true,
            readOnlyNote: "Cached on this device, so it opens with no connection.",
            facts: [
              ["Role", guide.label.split(" · ")[0]!],
              ["Length", guide.label.split(" · ")[1]!],
              ["Covers", guide.sub],
              ["Offline", "Cached on this device"],
            ] as Array<[string, string, string?]>,
          },
        })),
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "table",
        title: "Your tickets",
        meta: "Response target 4 working hours · 07:00–17:00 WAT",
        noun: "ticket",
        nounPlural: "tickets",
        per: 6,
        acts: [{ label: "Raise ticket", primary: true, drawer: raiseTicketDrawer }],
        head: ["Ticket", "Subject", "Priority", "Raised", "State", ""],
        rows: tickets.map(
          (ticket): TableRow => ({
            cells: [
              text(ticket.ref, { strong: true }),
              text(ticket.subject),
              pill(
                ticket.priority,
                ticket.priority === "High" ? "attention" : ticket.priority === "Low" ? "neutral" : "progress",
              ),
              text(ticket.raised),
              pill(
                ticket.state,
                ticket.state === "Resolved" ? "positive" : ticket.state === "Queued" ? "offline" : "progress",
              ),
              {
                kind: "action",
                label: "Open",
                drawer: {
                  kicker: `Ticket ${ticket.ref}`,
                  title: ticket.subject,
                  sub: `${ticket.priority} priority · raised ${ticket.raised.toLowerCase()}.`,
                  readOnly: ticket.state === "Resolved",
                  readOnlyNote:
                    ticket.state === "Resolved"
                      ? "A resolved ticket is kept with everything that was said. Reopen it by raising a new one that references it."
                      : undefined,
                  tone: ticket.state === "Queued" ? "offline" : undefined,
                  facts: [
                    ["Ticket", ticket.ref],
                    ["Subject", ticket.subject],
                    ["Priority", ticket.priority],
                    ["Raised", ticket.raised],
                    [
                      "State",
                      ticket.state,
                      ticket.state === "Queued"
                        ? "Drafted offline — it sends on the next sync"
                        : ticket.state === "Resolved"
                          ? "Closed with an answer"
                          : "With Future Realm support",
                    ],
                    [
                      "What support can see",
                      "Your school, your role and the page you were on",
                      "Every support session is logged in Audit & Security",
                    ],
                  ],
                },
              },
            ],
            keywords: `${ticket.priority} ${ticket.state}`,
          }),
        ),
        foot: "A ticket drafted with no connection is queued and sends on the next sync — it is never lost because the signal went.",
      },
      {
        type: "list",
        title: "Articles and walkthroughs",
        items: articles.map((article) => ({
          label: article.label,
          sub: article.sub,
          pill: "Cached",
          tone: "positive" as PanelTone,
          facts: [
            ["Title", article.label],
            ["Format", article.sub],
            ["Offline", "Cached on this device", "It opens with no connection"],
          ] as Array<[string, string, string?]>,
        })),
        foot: "Everything here is cached, because the moment you need it most is the moment the connection has gone.",
      },
    ]),
  ],
};

export const syncSupportContent: ModuleContent = {
  sync: syncTab,
  "help-support": helpTab,
};
