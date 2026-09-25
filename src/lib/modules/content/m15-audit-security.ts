import {
  auditEntries,
  auditTotals,
  consentGap,
  consentHeld,
  integrityMonitors,
  openFlags,
  openRequests,
  retentionSchedule,
  securityChecks,
  subjectRequests,
  vendorSessions,
  type IntegrityMonitor,
  type SecurityCheck,
  type SubjectRequest,
} from "@/lib/modules/audit-data";
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
import { registryStudents } from "@/lib/modules/students-data";

/**
 * M15 · Audit & Security — "Show what happened, who did it, and prove both."
 *
 * Nothing on these screens can be edited. The log covers Future Realm's own
 * access to this workspace as plainly as it covers the school's, and elevated
 * vendor access requires the school's recorded confirmation before it proceeds.
 *
 * A monitor with nothing open still says what it looked for: a clean check is a
 * result, not an absence.
 */

/* --------------------------------------------------------------- Audit Log */

function auditDrawer(entry: (typeof auditEntries)[number]): DrawerSpec {
  return {
    kicker: `${entry.category} · ${entry.when}`,
    title: entry.action,
    sub: `${entry.actor} · ${entry.role}.`,
    readOnly: true,
    readOnlyNote:
      "An audit entry is a record of what happened. Nothing on this screen can be edited, by anybody, including us.",
    tone: entry.vendor ? "vendor" : entry.category === "Sensitive" ? "sensitive" : undefined,
    facts: [
      ["When", entry.when],
      ["Actor", entry.actor, entry.role],
      ["Action", entry.action],
      ["Detail", entry.detail],
      ["Category", entry.category],
      ...(entry.category === "Sensitive"
        ? ([
            [
              "Disclosure",
              "The family may request this log",
              "Every reveal of a sensitive record is logged and disclosable",
            ],
          ] as Array<[string, string, string?]>)
        : []),
      ...(entry.vendor
        ? ([
            [
              "Vendor access",
              "Future Realm",
              "Read-only unless the school recorded a confirmation for elevated access",
            ],
          ] as Array<[string, string, string?]>)
        : []),
      ["Retention", auditTotals.retention, "Legal obligation · immutable"],
    ],
  };
}

const auditLogTab: TabContent = {
  title: "Audit Log",
  desc: "Find the truth about any record or any person — including us.",
  primary: {
    label: "Export log",
    drawer: {
      kicker: "Audit log",
      title: "Export the audit log",
      sub: "The complete log, in the format a regulator or an auditor reads.",
      facts: [
        ["Entries", auditTotals.entries, `Across ${auditTotals.categories} categories`],
        ["Editable", "No", "Nothing in the log can be changed, by anybody, including us"],
        ["Retention", auditTotals.retention, "Legal obligation"],
        ["Format", "Excel and CSV"],
        ["This export", "Itself logged", "An export of the log appears in the log"],
      ],
    },
  },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          {
            label: "Entries",
            value: auditTotals.entries,
            sub: `Across ${auditTotals.categories} categories · nothing editable`,
          },
          {
            label: "Vendor sessions",
            value: String(vendorSessions.length),
            sub: "Future Realm · 3 read-only, 1 elevated",
            tone: "vendor",
          },
          {
            label: "Sensitive reads",
            value: String(auditTotals.sensitiveReads),
            sub: "All by group holders, all logged",
            tone: "sensitive",
          },
          {
            label: "Exports",
            value: String(auditTotals.exports),
            sub: "Last 30 days · all by permitted holders",
          },
          { label: "Retention", value: auditTotals.retention, sub: "Legal obligation · immutable" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Future Realm access",
        tag: `Vendor · ${vendorSessions.length} sessions this session`,
        tagTone: "vendor",
        meta: "Elevated access requires your recorded confirmation before it proceeds",
        noun: "session",
        nounPlural: "sessions",
        acts: [{ label: "Export vendor log" }],
        head: ["Who", "Role", "When", "Duration", "Why", "Access"],
        rows: vendorSessions.map(
          (session): TableRow => ({
            cells: [
              nameCell(session.who, session.role, { avatarTone: "vendor" }),
              text("Future Realm"),
              text(session.when),
              text(session.duration),
              text(session.why),
              pill(session.access, session.access === "Read-only" ? "neutral" : "vendor"),
            ],
            drawer: {
              kicker: "Vendor session",
              title: `${session.who} · ${session.when}`,
              sub: session.why,
              tone: "vendor",
              readOnly: true,
              readOnlyNote: "A vendor session is a record like any other. It cannot be edited.",
              facts: [
                ["Who", session.who, `${session.role} · Future Realm`],
                ["When", session.when],
                ["Duration", session.duration],
                ["Why", session.why],
                [
                  "Access",
                  session.access,
                  session.access === "Read-only"
                    ? "Nothing could be changed during this session"
                    : "The school recorded a confirmation before it proceeded",
                ],
                ["Logged", "Every action taken", "Visible in the entries below, under Vendor"],
              ],
            },
            keywords: session.why,
          }),
        ),
        foot: "Future Realm's access to this workspace is logged exactly as the school's is — and elevated access never proceeds without the school's recorded confirmation.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Audit entries",
        sub: "Filter by date, actor, action, entity, student or staff.",
        meta: `${auditTotals.entries} entries · nothing on this screen can be edited`,
        search: "Search across actors, entities and reasons",
        noun: "entry",
        nounPlural: "entries",
        per: 9,
        filters: [
          {
            label: "Category",
            value: "All",
            options: [
              "All", "Scores", "Exports", "Attendance", "Finance",
              "Vendor", "Sensitive", "Approvals", "Guardians",
            ],
            column: 4,
          },
          {
            label: "Actor",
            value: "All",
            options: [
              "All", "Adaeze Nwosu", "Dr E. Nwosu", "Mr S. Adeyemi",
              "Mrs F. Adeniyi", "Mrs C. Obi", "Miss G. Etim", "Tobi Aluko",
            ],
            column: 1,
          },
        ],
        head: ["When", "Actor", "Action", "Detail", "Category"],
        rows: auditEntries.map(
          (entry): TableRow => ({
            cells: [
              text(entry.when),
              nameCell(entry.actor, entry.role, entry.vendor ? { avatarTone: "vendor" } : {}),
              text(entry.action, { strong: true }),
              text(entry.detail),
              text(entry.category),
            ],
            drawer: auditDrawer(entry),
            keywords: `${entry.role} ${entry.detail}`,
          }),
        ),
        foot: "Nothing here can be edited. The log is immutable and kept for ten years, which is what makes it worth anything.",
      },
    ]),
  ],
};

/* -------------------------------------------------------------- Monitoring */

function monitorDrawer(monitor: IntegrityMonitor): DrawerSpec {
  return {
    kicker: "Integrity monitor",
    title: monitor.monitor,
    sub: monitor.open
      ? `${monitor.open} open · ${monitor.age}.`
      : "Nothing open. The monitor ran and found nothing.",
    tone: monitor.open ? "attention" : undefined,
    readOnly: monitor.open === 0,
    readOnlyNote:
      monitor.open === 0
        ? "A clean check is a result, not an absence — the monitor says what it looked for."
        : undefined,
    facts: [
      ["Open", monitor.open ? String(monitor.open) : "None"],
      ["What was found", monitor.found],
      ["Age", monitor.age, monitor.open ? "Since the oldest of them was flagged" : ""],
      [
        "What happens next",
        monitor.open ? "You review it, or dismiss it with a reason" : "Nothing — it keeps running",
        monitor.open ? "A dismissal is itself logged" : "It runs on every relevant action",
      ],
    ],
  };
}

function securityDrawer(check: SecurityCheck): DrawerSpec {
  return {
    mode: check.state === "Normal" ? "read" : "commit",
    kicker: "Security",
    title: check.check,
    sub: check.detail,
    tone: check.state === "Critical" ? "negative" : check.state === "Attention" ? "attention" : undefined,
    facts: [
      ["Count", String(check.count)],
      ["State", check.state],
      ["Detail", check.detail],
      [
        "Action available",
        check.action,
        check.action === "Terminate"
          ? "A session can be ended remotely from here"
          : check.action === "Require it"
            ? "They are prompted at their next sign-in and cannot skip it"
            : "",
      ],
      ["Logged", "Yes", "Whatever you do here appears in the audit log"],
    ],
    commitLabel: check.state === "Normal" ? undefined : check.action,
    commitDone: check.state === "Normal" ? undefined : `${check.check} · ${check.action.toLowerCase()}`,
    commitDoneBody:
      check.state === "Normal" ? undefined : "The change is in force, and it is on the audit record against your name.",
  };
}

const monitoringTab: TabContent = {
  title: "Monitoring",
  desc: "What needs attention now, rather than what happened.",
  primary: {
    label: "Resolve flag",
    drawer: monitorDrawer(integrityMonitors.find((monitor) => monitor.open > 0)!),
  },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          {
            label: "Open integrity flags",
            value: String(openFlags),
            sub: `Across ${integrityMonitors.length} monitors`,
            tone: "attention",
          },
          {
            label: "Users without two-factor",
            value: "6 of 31",
            sub: "One can export the whole school",
            tone: "negative",
            link: "See users",
            href: "/staff-access/permissions",
          },
          {
            label: "Failed logins, 7 days",
            value: "14",
            sub: "11 from one dormant account",
            tone: "attention",
            link: "See attempts",
            href: "/audit-security/audit-log",
          },
          {
            label: "Access recertification",
            value: "Due 30 Sep",
            sub: "Last confirmed 12 June by Dr E.",
            tone: "attention",
            link: "Open review",
            href: "/staff-access/permissions",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Integrity flags",
        sub: "Ten monitors.",
        meta: `${openFlags} open · 3 dismissed this term`,
        noun: "monitor",
        nounPlural: "monitors",
        per: 10,
        head: ["Monitor", "Open", "What was found", "Age", ""],
        rows: integrityMonitors.map(
          (monitor): TableRow => ({
            cells: [
              text(monitor.monitor, { strong: true }),
              text(String(monitor.open), {
                mono: true,
                strong: monitor.open > 0,
                tone: monitor.open > 0 ? "attention" : undefined,
              }),
              text(monitor.found),
              text(monitor.age),
              // A monitor with nothing open has nothing to action: offering
              // "Clear" would imply there is something to clear. The row still
              // opens, so what it looked for stays readable.
              monitor.open
                ? { kind: "action", label: "Review", drawer: monitorDrawer(monitor) }
                : text("—"),
            ],
            drawer: monitorDrawer(monitor),
            keywords: monitor.found,
          }),
        ),
        foot: "A monitor with nothing open still says what it looked for. A clean check is a result, not an absence.",
      },
    ]),
    row("1fr 1.15fr", [
      {
        type: "note",
        tone: "positive",
        icon: "M5 12.5l4.5 4.5 9-10",
        title: "A standing segregation-of-duties exception is declared for this school",
        body: "Dr Emmanuel Nwosu declared on 6 January that Mr Samuel Adeyemi acts as both Exam Officer and Head of Sciences, because the school has one science department and one officer.",
        acts: [
          {
            label: "Review the exception",
            drawer: {
              kicker: "Segregation of duties",
              title: "Standing exception · Mr Samuel Adeyemi",
              sub: "Exam Officer and Head of Sciences, held by one person.",
              readOnly: true,
              readOnlyNote:
                "An exception is declared, not configured — it is a statement the Proprietor put on the record.",
              facts: [
                ["Declared by", "Dr Emmanuel Nwosu · Proprietor"],
                ["Declared on", "6 January"],
                ["Who it covers", "Mr Samuel Adeyemi"],
                ["The two roles", "Exam Officer and Head of Sciences"],
                [
                  "Why",
                  "The school has one science department and one officer",
                  "A small school cannot always separate what a large one can",
                ],
                [
                  "What still holds",
                  "He cannot approve a sheet he entered",
                  "Segregation is enforced at the moment of approval regardless",
                ],
                ["Reviewed", "Each term, with access recertification"],
              ],
            },
          },
        ],
      },
      {
        type: "table",
        title: "Security",
        sub: "Sessions can be terminated remotely from this table.",
        meta: "31 accounts · 12 active sessions",
        noun: "check",
        nounPlural: "checks",
        per: 7,
        head: ["Check", "Count", "State", "Detail", ""],
        rows: securityChecks.map(
          (check): TableRow => ({
            cells: [
              text(check.check, { strong: true }),
              text(String(check.count), { mono: true }),
              pill(
                check.state,
                check.state === "Critical" ? "negative" : check.state === "Attention" ? "attention" : "neutral",
              ),
              text(check.detail),
              { kind: "action", label: check.action, drawer: securityDrawer(check) },
            ],
            keywords: check.detail,
          }),
        ),
      },
    ]),
  ],
};

/* --------------------------------------------------------- Data Protection */

function requestDrawer(request: SubjectRequest): DrawerSpec {
  const urgent = request.daysLeft === "4 days";

  return {
    mode: request.closed ? "read" : "commit",
    kicker: `${request.type} request`,
    title: request.reference,
    sub: request.closed
      ? `Closed ${request.daysLeft.replace("Closed ", "")}.`
      : `${request.requester}, about ${request.about}. ${request.daysLeft} left of the statutory 30.`,
    tone: urgent ? "negative" : undefined,
    readOnly: request.closed,
    readOnlyNote: request.closed
      ? "A closed request is kept with what was sent and when — it is the evidence the school responded."
      : undefined,
    facts: [
      ["Reference", request.reference],
      ["Type", request.type],
      ["Requester", request.requester, `About ${request.about}`],
      ["Owner", request.owner, request.ownerRole],
      [
        "Time left",
        request.daysLeft,
        request.closed ? "" : "The statutory response period is 30 days",
      ],
      [
        "What it obliges",
        request.type === "Access"
          ? "Every record the school holds about the person"
          : request.type === "Correction"
            ? "Correcting what is wrong, and telling anyone it was shared with"
            : request.type === "Portability"
              ? "The data in a machine-readable format the family can take elsewhere"
              : request.type === "Erasure"
                ? "Deleting what there is no lawful basis to keep"
                : "Stopping the processing the person objected to",
        request.type === "Erasure"
          ? "An academic record is kept where the law requires it, and the family is told why"
          : "",
      ],
      ["Logged", "Yes", "The request, the response and the date are all on the record"],
    ],
    commitLabel: request.closed ? undefined : "Send the response",
    commitDone: request.closed ? undefined : `${request.reference} answered`,
    commitDoneBody: request.closed
      ? undefined
      : "The response is on its way, and the request is closed on the record with what was sent.",
  };
}

const dataProtectionTab: TabContent = {
  title: "Data Protection",
  desc: "The school operating its own responsibility as data controller.",
  primary: {
    label: "Log a request",
    drawer: {
      mode: "commit",
      kicker: "Data Protection",
      title: "Log a subject request",
      sub: "Five types, each with a reference, an owner and a response clock.",
      facts: [
        ["Types", "Access, correction, objection or withdrawal, portability, erasure"],
        ["Reference", "Issued automatically", "So the family can quote it"],
        ["Owner", "A named officer", "Usually the Data Protection Officer"],
        ["Clock", "Starts today", "The statutory response period is 30 days"],
        ["Logged", "Yes", "The request, the response and the date"],
      ],
      commitLabel: "Log the request",
      commitDone: "Request logged",
      commitDoneBody: "It has a reference and an owner, and the 30-day clock has started.",
    },
  },
  launchers: [
    {
      label: "Request a correction",
      drawer: {
        mode: "commit",
        kicker: "F12 · correction",
        title: "Request a correction",
        sub: "A correction to a record the school holds, with the evidence for it.",
        facts: [
          ["What is corrected", "The record named in the request"],
          ["Evidence", "Required", "Kept with the correction permanently"],
          ["Who is told", "Anyone the record was shared with"],
          ["The original", "Kept", "A correction is versioned, never an overwrite"],
        ],
        commitLabel: "Send the request",
        commitDone: "Correction requested",
        commitDoneBody: "It is with the owner named on it, and the original is kept alongside.",
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          {
            label: "Open subject requests",
            value: String(openRequests.length),
            sub: "Five types · statutory 30 days",
            tone: "attention",
          },
          {
            label: "Closest deadline",
            value: "4 days",
            sub: "DSR/26/0011 · access request",
            tone: "negative",
            link: "Respond",
            drawer: requestDrawer(subjectRequests[0]!),
          },
          {
            label: "Core consent held",
            value: `${consentHeld.toLocaleString("en-NG")} of ${registryStudents.length.toLocaleString("en-NG")}`,
            sub: `${consentGap} students named in Parents & Guardians`,
            tone: "attention",
            link: `See the ${consentGap}`,
            href: "/parents-guardians/consent",
          },
          {
            label: "Incidents recorded",
            value: "0",
            sub: "Breach register is empty",
            tone: "positive",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Subject requests",
        sub: "Five types, each with a reference, an owner and a response clock.",
        meta: `${openRequests.length} open · statutory response 30 days`,
        noun: "request",
        nounPlural: "requests",
        filters: [
          {
            label: "Type",
            value: "All",
            options: ["All", "Access", "Correction", "Objection or withdrawal", "Portability", "Erasure"],
            column: 1,
          },
          { label: "Owner", value: "All", options: ["All", "DPO", "Registrar"], column: 3 },
        ],
        head: ["Reference", "Type", "Requester", "Owner", "Days left", ""],
        rows: subjectRequests.map(
          (request): TableRow => ({
            cells: [
              text(request.reference, { strong: true }),
              text(request.type),
              nameCell(request.requester, request.about),
              nameCell(request.owner, request.ownerRole),
              text(request.daysLeft, {
                strong: request.daysLeft === "4 days",
                tone: request.daysLeft === "4 days" ? "negative" : undefined,
              }),
              {
                kind: "action",
                label: request.closed ? "View" : "Respond",
                drawer: requestDrawer(request),
              },
            ],
            keywords: `${request.type} ${request.about}`,
          }),
        ),
        foot: "A request is answered within 30 days or the school is in breach. The clock is shown because it is the only figure that matters.",
      },
    ]),
    row("1.05fr 1fr", [
      {
        type: "table",
        title: "Retention schedule",
        meta: "Hosted in Nigeria · Lagos region",
        noun: "class",
        nounPlural: "classes",
        per: 7,
        head: ["Data class", "Retention", "Basis", "Hosted"],
        rows: retentionSchedule.map(
          (entry): TableRow => ({
            cells: [
              text(entry.dataClass, { strong: true }),
              text(entry.retention),
              text(entry.basis),
              text(entry.hosted),
            ],
            drawer: {
              kicker: "Retention",
              title: entry.dataClass,
              sub: `Kept for ${entry.retention.toLowerCase()}.`,
              readOnly: true,
              readOnlyNote:
                "A retention period follows the law and the country profile, not a preference — it is shown so the school can answer for it.",
              facts: [
                ["Retention", entry.retention],
                ["Basis", entry.basis],
                ["Hosted", entry.hosted, "Shown in-product, in plain words"],
                [
                  "After the period",
                  entry.retention === "Permanent" ? "Kept" : "Permanently deleted",
                  entry.retention === "Permanent"
                    ? "A transcript may be requested decades later"
                    : "Deletion is itself logged",
                ],
              ],
            },
            keywords: entry.basis,
          }),
        ),
      },
      {
        type: "facts",
        title: "Accountability",
        tag: "Shown in-product",
        tagTone: "positive",
        per: 2,
        acts: [{ label: "Consent coverage", href: "/parents-guardians/consent" }],
        facts: [
          ["Data controller", "Grace International Academy"],
          ["Data processor", "Future Realm Agency Ltd"],
          ["Data Protection Officer", "Mrs Chinelo Obi"],
          ["DPO contact", "dpo@graceacademy.ng · +234 803 000 0007"],
          ["Hosting country", "Nigeria · Lagos region"],
          ["Sub-processors", "2 · SMS gateway and object storage, both in Nigeria"],
          [
            "Consent coverage",
            `${consentHeld.toLocaleString("en-NG")} of ${registryStudents.length.toLocaleString("en-NG")} core`,
            `${consentGap} students with no core consent — named in Parents & Guardians`,
          ],
          ["Breach register", "No incidents recorded"],
        ],
      },
    ]),
  ],
};

export const auditSecurityContent: ModuleContent = {
  "audit-log": auditLogTab,
  monitoring: monitoringTab,
  "data-protection": dataProtectionTab,
};
