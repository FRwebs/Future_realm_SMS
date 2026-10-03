import { apiGet } from "@/lib/api/server";
import type { KpiCard, Panel, PanelFact, TabContent } from "@/lib/modules/panels";
import { name, pill, row, text } from "@/lib/modules/panels";

/**
 * M01 Command Center · Today, built from the database rather than from the
 * in-repo derived layers.
 *
 * The static content stays where it is and remains the fallback: if the API is
 * unreachable, the tab still renders the authored page rather than an error.
 * That matters because this module is the landing page — an empty Command
 * Center reads as "the school is broken", not "one request failed".
 */

type ApiToday = {
  students: { active: number; joinedThisTerm: number; withdrawnTotal: number };
  attendance: {
    ratePct: number | null;
    present: number;
    marked: number;
    classesTotal: number;
    classesUnmarked: number;
  };
  collection: { collected: number; expected: number };
  results: { submitted: number; expected: number; returned: number };
  credits: { sms: number; whatsapp: number; threshold: number; low: boolean; configured: boolean };
  sync: { pending: number; lastSyncedAt: string | null };
  activity: Array<{
    id: string;
    actor: string | null;
    actorRole: string | null;
    action: string;
    entityType: string;
    at: string;
    count: number;
  }>;
  term: { id: string; name: string; startsOn: string | null; endsOn: string | null } | null;
};

type ApiApproval = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  blocking: string | null;
  status: string;
  requestedBy: string | null;
  assignedTo: string | null;
  ageDays: number;
  overdue: boolean;
  raisedAt: string;
};

/** ₦63.7m, ₦254.7k, ₦940 — the scale the mockup prints money at. */
function nairaShort(value: number): string {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(1)}k`;
  return `₦${Math.round(value)}`;
}

function sinceText(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function ageText(days: number): string {
  if (days <= 0) return "today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** APPROVAL_SCORE_CORRECTION → "Score correction". */
function kindLabel(kind: string): string {
  const words = kind.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function auditSentence(entry: ApiToday["activity"][number]): string {
  const who = entry.actor ?? "Someone";
  const what = entry.action.replace(/_/g, " ").toLowerCase();
  const subject = entry.entityType
    .replace(/([A-Z])/g, (char) => ` ${char.toLowerCase()}`)
    .trim();
  const plural = entry.count > 1 ? `${entry.count} ${subject} records` : `a ${subject} record`;
  return `${who} ${what} ${plural}`;
}

function kpiCards(data: ApiToday): KpiCard[] {
  const attendance = data.attendance;

  return [
    {
      label: "Total students",
      value: data.students.active.toLocaleString(),
      sub: `+${data.students.joinedThisTerm} this term · ${data.students.withdrawnTotal} withdrawn in total`,
      link: "Open registry",
      href: "/student-records/registry",
    },
    {
      label: "Attendance today",
      // Nothing marked is not 0% — it is a register nobody has opened.
      value: attendance.ratePct === null ? "Not marked" : `${attendance.ratePct}%`,
      sub:
        attendance.classesTotal === 0
          ? "No classes configured"
          : `${attendance.classesUnmarked} of ${attendance.classesTotal} classes unmarked`,
      tone: attendance.classesUnmarked > 0 ? "attention" : undefined,
      link: "See unmarked",
      href: "/attendance/register",
    },
    {
      label: "Collected this term",
      value: nairaShort(data.collection.collected),
      sub: `of ${nairaShort(data.collection.expected)} expected`,
      link: "Open collections",
      href: "/fee-management/collections",
    },
    {
      label: "Score submissions",
      value: data.results.expected === 0
        ? "None yet"
        : `${data.results.submitted} of ${data.results.expected}`,
      sub:
        data.results.expected === 0
          ? "No sheets raised this term"
          : `${data.results.returned} returned to teachers`,
      tone: data.results.returned > 0 ? "attention" : undefined,
      link: "Open review",
      href: "/score-entry-results/review",
    },
    {
      label: "Message credits",
      // A school with no wallet row has never set messaging up, which is a
      // different thing from a wallet that has run dry.
      value: data.credits.configured ? data.credits.sms.toLocaleString() : "Not set up",
      sub: data.credits.configured
        ? `SMS · ${data.credits.low ? "below" : "above"} your ${data.credits.threshold.toLocaleString()} threshold`
        : "No messaging wallet on this school",
      tone: data.credits.configured && data.credits.low ? "attention" : undefined,
      link: data.credits.configured ? "Top up" : "Set up",
      href: "/subscription-billing/credits",
    },
    {
      label: "Sync depth",
      value: String(data.sync.pending),
      unit: "pending",
      sub: `Last synced ${sinceText(data.sync.lastSyncedAt)}`,
      tone: data.sync.pending > 0 ? "attention" : undefined,
      link: "Sync detail",
      href: "/sync-support/sync",
    },
  ];
}

/**
 * One row per decision, each opening a drawer that really decides it.
 *
 * The three actions are the three the API accepts. Approve carries no reason;
 * the other two require one, because a refusal nobody can read is the thing
 * that makes people stop trusting a queue.
 */
function queueTable(queue: ApiApproval[]): Panel {
  if (!queue.length) {
    return {
      type: "note",
      title: "My actions",
      body: "Nothing is waiting on you. Decisions routed to you or to a role you hold will appear here.",
      icon: "check",
    };
  }

  return {
    type: "table",
    title: "My actions",
    sub: "Decisions routed to you, priority then age.",
    meta: `${queue.length} waiting · ${queue.filter((item) => item.overdue).length} escalating`,
    acts: [{ label: "Open queue", href: "/approvals-workflow/queue" }],
    head: ["Decision", "Type", "Blocking", "Age", "Action"],
    per: 8,
    rows: queue.map((item) => ({
      cells: [
        name(item.title, item.summary ?? item.requestedBy ?? ""),
        pill(kindLabel(item.kind)),
        text(item.blocking ?? "—", { tone: item.blocking ? "attention" : undefined, strong: Boolean(item.blocking) }),
        text(ageText(item.ageDays), {
          tone: item.overdue ? "negative" : undefined,
          strong: item.overdue,
        }),
        {
          kind: "action" as const,
          label: "Decide",
          drawer: {
            kicker: kindLabel(item.kind),
            title: item.title,
            sub: item.summary ?? undefined,
            mode: "commit" as const,
            commitLabel: "Approve",
            commitNote: "Approving records you as the decider, with a timestamp.",
            commitDone: "Approved",
            commitDoneBody: "The queue and the figures above it have been re-read.",
            facts: [
              ["Raised by", item.requestedBy ?? "—"],
              ["Assigned to", item.assignedTo ?? "a role you hold"],
              ["Waiting", ageText(item.ageDays)],
              ["Blocking", item.blocking ?? "nothing recorded"],
            ] as PanelFact[],
            submit: {
              endpoint: `/api/v1/approvals/${item.id}/decision`,
              method: "PATCH" as const,
              body: { action: "APPROVE" },
              reasonKey: "note",
              reasonLabel: "Note (kept on the decision)",
            },
          },
        },
      ],
      keywords: `${item.kind} ${item.requestedBy ?? ""} ${item.title}`,
    })),
  };
}

function activityList(data: ApiToday): Panel {
  if (!data.activity.length) {
    return {
      type: "note",
      title: "Activity",
      body: "Nothing has been recorded against this school yet.",
      icon: "info",
    };
  }

  return {
    type: "list",
    title: "Activity",
    sub: "What has happened across the school, most recent first.",
    acts: [{ label: "Open the full audit log", href: "/audit-security/audit-log" }],
    readOnly: true,
    items: data.activity.map((entry) => ({
      label: auditSentence(entry),
      sub: `${entry.actorRole ?? "system"} · ${sinceText(entry.at)}`,
      facts: [
        ["Action", entry.action],
        ["Record type", entry.entityType],
        ["Rows", String(entry.count)],
        ["When", new Date(entry.at).toLocaleString()],
      ] as PanelFact[],
    })),
  };
}

type BroadsheetRow = {
  id: string;
  className: string;
  classTeacherName: string | null;
  term: string;
  session: string;
  approvalStage: string;
  metrics: {
    studentCount: number;
    subjectCount: number;
    completeStudents: number;
    incompleteStudents: number;
    missingEntries: number;
    classAverage: number;
    published: boolean;
  };
};

type ReportCardRow = { id: string; studentName: string; className: string; status: string };

/**
 * Tab 2 · Oversight — can we publish, and who is holding us up.
 *
 * Built from the broadsheets rather than from a readiness endpoint, because
 * the broadsheet already carries the completeness figures the tab asks for:
 * how many students have a full sheet, how many entries are missing, and who
 * the class teacher is. A dedicated endpoint would recompute what this one
 * already returns.
 */
function oversightTab(
  sheets: BroadsheetRow[],
  cards: ReportCardRow[],
  queue: ApiApproval[],
  term: ApiToday["term"],
): TabContent {
  const ready = cards.filter((card) => card.status.toUpperCase() === "PUBLISHED").length;
  const blockedSheets = sheets.filter((sheet) => sheet.metrics.incompleteStudents > 0);
  const blockedStudents = blockedSheets.reduce((sum, s) => sum + s.metrics.incompleteStudents, 0);
  const missingEntries = sheets.reduce((sum, s) => sum + s.metrics.missingEntries, 0);
  const teacherless = sheets.filter((sheet) => !sheet.classTeacherName);
  const owners = new Set(
    blockedSheets.map((sheet) => sheet.classTeacherName).filter(Boolean) as string[],
  );

  const slackDays = term?.endsOn
    ? Math.round((new Date(term.endsOn).getTime() - Date.now()) / 86_400_000)
    : null;

  const blockers: Array<{ label: string; count: number; owner: string; clears: string }> = [];
  if (missingEntries) {
    blockers.push({
      label: "Scores not entered",
      count: missingEntries,
      owner: owners.size ? Array.from(owners).join(", ") : "subject teachers",
      clears: "Entering the missing scores on the broadsheet",
    });
  }
  if (blockedStudents) {
    blockers.push({
      label: "Students with an incomplete sheet",
      count: blockedStudents,
      owner: owners.size ? Array.from(owners).join(", ") : "class teachers",
      clears: "Completing every subject for those students",
    });
  }
  if (teacherless.length) {
    blockers.push({
      label: "Class with no class teacher",
      count: teacherless.length,
      owner: "Staff & Access",
      clears: "Assigning a class teacher to that arm",
    });
  }
  if (queue.length) {
    blockers.push({
      label: "Decisions waiting",
      count: queue.length,
      owner: "you",
      clears: "Deciding them in the queue",
    });
  }

  return {
    title: "Oversight",
    desc: "Can we publish, who is holding us up, and what is quietly rotting.",
    launchers: [
      { label: "Report cards", href: "/report-cards/completion" },
      { label: "Open the queue", href: "/approvals-workflow/queue" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          title: "Whether this term can be published",
          per: 4,
          cards: [
            {
              label: "Cards that exist now",
              value: String(ready),
              sub: `of ${cards.length} cut`,
              tone: ready === cards.length && cards.length ? "positive" : "attention",
            },
            {
              label: "Students blocked",
              value: String(blockedStudents),
              sub: blockedStudents ? `across ${blockedSheets.length} class(es)` : "Nothing incomplete",
              tone: blockedStudents ? "negative" : "positive",
            },
            {
              label: "People holding it up",
              value: String(owners.size + (teacherless.length ? 1 : 0)),
              sub: owners.size ? Array.from(owners).slice(0, 2).join(", ") : "Nobody",
              tone: owners.size ? "attention" : "positive",
            },
            {
              label: "Days of slack",
              value: slackDays === null ? "—" : String(slackDays),
              sub: term ? `${term.name} ends ${new Date(term.endsOn ?? "").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : "No term on file",
              tone: slackDays !== null && slackDays < 14 ? "attention" : undefined,
            },
          ],
        },
      ]),
      row("1fr", [
        blockers.length
          ? {
              type: "blockers",
              title: "What is holding publication up",
              sub: "Each one names the record that clears it and the person who owns it.",
              items: blockers.map((blocker) => ({
                title: `${blocker.label} — ${blocker.count}`,
                detail: `Owned by ${blocker.owner}.`,
                action: blocker.clears,
                tone: "attention" as const,
              })),
            }
          : {
              type: "note",
              tone: "positive",
              title: "Nothing is blocking publication",
              body: "Every compiled class has a full sheet for every student, every arm has a class teacher, and no decision is waiting on you.",
            },
      ]),
      row("1fr", [
        sheets.length
          ? {
              type: "table",
              title: "Class by class",
              sub: "Where each class stands, weakest first.",
              meta: `${sheets.length} compiled`,
              head: ["Class", "Class teacher", "Complete", "Missing", "Average", "Stage"],
              per: 10,
              rows: sheets
                .slice()
                .sort((a, b) => b.metrics.incompleteStudents - a.metrics.incompleteStudents)
                .map((sheet) => ({
                  cells: [
                    name(sheet.className, `${sheet.term} · ${sheet.session}`),
                    text(sheet.classTeacherName ?? "none assigned", {
                      tone: sheet.classTeacherName ? undefined : "negative",
                      strong: !sheet.classTeacherName,
                    }),
                    text(`${sheet.metrics.completeStudents}/${sheet.metrics.studentCount}`, {
                      tone: sheet.metrics.incompleteStudents ? "attention" : "positive",
                    }),
                    text(String(sheet.metrics.missingEntries), {
                      tone: sheet.metrics.missingEntries ? "negative" : undefined,
                      strong: sheet.metrics.missingEntries > 0,
                    }),
                    text(`${sheet.metrics.classAverage}%`),
                    pill(
                      sheet.approvalStage.replace(/_/g, " ").toLowerCase(),
                      sheet.metrics.published ? "positive" : "attention",
                    ),
                  ],
                  keywords: `${sheet.className} ${sheet.classTeacherName ?? ""}`,
                })),
            }
          : {
              type: "note",
              tone: "attention",
              title: "No class has been compiled",
              body: "Oversight counts what compilation produced. Until a broadsheet exists there is nothing to be behind on.",
            },
      ]),
    ],
  };
}

/**
 * Errors are left to propagate: the registry turns a failed call into a banner
 * saying the figures are the authored ones. Swallowing it here would fall back
 * silently, and authored figures look exactly like real ones.
 */
export async function commandCenterLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "today") {
    const [data, queue] = await Promise.all([
      apiGet<ApiToday>("/api/v1/command-center/today"),
      apiGet<ApiApproval[]>("/api/v1/approvals/queue?assignee=me").catch(() => [] as ApiApproval[]),
    ]);

    return {
      title: "Today",
      desc: data.term
        ? `The decisions waiting on you, and how ${data.term.name} is tracking.`
        : "The decisions waiting on you, and how the term is tracking.",
      primary: { label: "Review submissions", href: "/score-entry-results/review" },
      launchers: [{ label: "Open the queue", href: "/approvals-workflow/queue" }],
      rows: [
        row("1fr", [
          { type: "kpi", title: "Where the school stands today", per: 6, cards: kpiCards(data) },
        ]),
        row("1.55fr 1fr", [queueTable(queue), activityList(data)]),
      ],
    };
  }

  if (tabSlug === "oversight") {
    const [sheets, cards, queue, data] = await Promise.all([
      apiGet<BroadsheetRow[]>("/api/v1/academics/broadsheets").catch(() => [] as BroadsheetRow[]),
      apiGet<ReportCardRow[]>("/api/v1/academics/report-cards").catch(() => [] as ReportCardRow[]),
      apiGet<ApiApproval[]>("/api/v1/approvals/queue?assignee=me").catch(() => [] as ApiApproval[]),
      apiGet<ApiToday>("/api/v1/command-center/today"),
    ]);
    return oversightTab(sheets ?? [], cards ?? [], queue ?? [], data?.term ?? null);
  }

  return undefined;
}
