import { CheckCircle2, Database, HardDrive, LifeBuoy, ShieldAlert } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { ReferenceList } from "@/components/data-display/reference-list";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminComputationMonitoring, SuperAdminInfraMonitoring, SuperAdminInternalMember, SuperAdminTicketRow } from "@/lib/domain/types";

function tabHref(tab: string) {
  return tab === "start" ? "/super-admin/help" : `/super-admin/help?tab=${tab}`;
}

const tones: Record<string, { bg: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" }
};
const pill = (label: string, tone: keyof typeof tones) => <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tones[tone].bg, color: tones[tone].fg }}>{label}</span>;
const titleCase = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export default async function SuperAdminHelpPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = searchParams ? await searchParams : {};
  const validTabs = new Set(["start", "ask", "status"]);
  const tab = rawTab && validTabs.has(rawTab) ? rawTab : "start";

  const tabs = [
    { label: "Getting Started", href: tabHref("start"), active: tab === "start" },
    { label: "Get Help", href: tabHref("ask"), active: tab === "ask" },
    { label: "Platform Status", href: tabHref("status"), active: tab === "status" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero eyebrow="Overview" title="Help" description="Orientation for this console, where to route a question by subject, and the platform’s own health — read in plain words." />
      <DetailTabs tabs={tabs} />
      {tab === "start" ? <GettingStartedTab /> : null}
      {tab === "ask" ? <GetHelpTab /> : null}
      {tab === "status" ? <PlatformStatusTab /> : null}
    </div>
  );
}

function GettingStartedTab() {
  const faq = [
    { question: "Where do I see what needs doing today?", answer: "Command Center for the whole platform, My Work for what is assigned to you." },
    { question: "A school says it cannot sign in", answer: "Open the school in Users, check its last successful sign-in and whether it is locked, then raise a Critical ticket in Support if it is." },
    { question: "How do I look at a school’s own screens?", answer: "Users → Support access. It is read-only by default; changing anything needs an approval in the school’s own queue." },
    { question: "Where did a number come from?", answer: "Nearly every figure opens the records behind it. If it does not, say so on the Get Help tab." },
    { question: "Can I edit a published template or a plan price?", answer: "A template edit makes a new version that waits for a second reviewer. A plan price change is scheduled with notice to schools." },
    { question: "Who can see a child’s record?", answer: "Nobody here. No Back Office endpoint returns individual student data." }
  ];
  return (
    <section className="grid gap-5">
      <ReferenceList
        title="If you are new here"
        sub="Five things, in order. Read them once and most of this console explains itself."
        items={[
          { label: "1 · Command Center is the whole platform at a glance", detail: "Start there every morning. If something needs a person, it appears there before it appears anywhere else.", pill: "Start", tone: "teal" },
          { label: "2 · My Work is only what is yours", detail: "Cases, tickets and reviews assigned to you, across every module, with the clocks that are running", pill: "Daily", tone: "teal" },
          { label: "3 · Every module has a pulse strip", detail: "The numbers that tell you whether that part of the platform is healthy, before you read anything else on the page", pill: "Habit", tone: "good" },
          { label: "4 · Every consequential action asks for a reason", detail: "Not bureaucracy — the reason is what the next person reads when they ask why this happened", pill: "Habit", tone: "good" },
          { label: "5 · If you cannot find a control, it may not exist", detail: "Several things are deliberately not built. Docs says which, and why, so you can answer a school honestly.", pill: "Important", tone: "warn" }
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="The things people ask in their first week"
          description="Short answers. Docs has the long ones."
          items={faq}
          getRowKey={(row) => row.question}
          pageSize={8}
          columns={[
            { key: "question", header: "Question", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.question}</span> },
            { key: "answer", header: "Answer", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.answer}</span> }
          ]}
        />
        <ReferenceList
          title="Habits that make this job easier"
          items={[
            { label: "Write the reason for the next person, not for the log", detail: "“Proprietor asked by name during renewal” beats “approved” every time", tone: "good" },
            { label: "Open the school record before you answer a school", detail: "Half of all support replies are wrong because nobody looked first", tone: "good" },
            { label: "Chase by hand once before escalating", detail: "A reminder sent by a person carries more weight with a bursar than the fifth automatic one", tone: "warn" },
            { label: "If a number looks wrong, click it", detail: "Nearly every figure in this console opens the records behind it", tone: "teal" }
          ]}
        />
      </div>
    </section>
  );
}

/** The person for each subject is whoever holds that role in Team & Access — never a name typed in here. */
const routes: Array<{ subject: string; roles: string[]; fallback: string; reach: string; response: string; tone: keyof typeof tones }> = [
  { subject: "A school cannot operate", roles: ["SUPPORT_AGENT"], fallback: "Support — see Team & Access", reach: "In-app, then phone", response: "Immediately", tone: "bad" },
  { subject: "Money, invoices, refunds", roles: ["FINANCE_MANAGER"], fallback: "Finance — see Team & Access", reach: "In-app or email", response: "Same working day", tone: "good" },
  { subject: "Anything about a child’s data", roles: [], fallback: "Data Protection Officer — not yet named; see Security & Compliance", reach: "Security & Compliance → Requests", response: "Within 24 hours", tone: "warn" },
  { subject: "Pricing, plans, exceptions", roles: ["PLATFORM_ADMIN"], fallback: "Platform Admin — see Team & Access", reach: "In-app", response: "Same working day", tone: "good" },
  { subject: "Migrations and source files", roles: ["PLATFORM_ADMIN"], fallback: "Platform Admin — see Team & Access", reach: "In-app", response: "Same working day", tone: "good" },
  { subject: "Anything that is sent to anyone", roles: ["PLATFORM_ADMIN"], fallback: "Platform Admin — see Team & Access", reach: "In-app", response: "Same working day", tone: "good" },
  { subject: "Partners and commission", roles: ["SALES_MANAGER"], fallback: "Sales — see Team & Access", reach: "In-app", response: "Same working day", tone: "good" },
  { subject: "The platform itself is unwell", roles: ["DEVELOPER"], fallback: "Engineering — see Team & Access", reach: "Phone, any hour", response: "Immediately", tone: "bad" },
  { subject: "Access and privileges", roles: ["SUPER_ADMIN", "PLATFORM_OWNER"], fallback: "Super Admin — see Team & Access", reach: "In-app", response: "Same working day", tone: "good" }
];

async function GetHelpTab() {
  const team = (await apiGetEnvelope<SuperAdminInternalMember[]>("/api/super-admin/internal-team?status=ACTIVE")).data ?? [];
  const rows = routes.map((route) => {
    const person = team.find((member) => route.roles.includes(member.role));
    return { ...route, person: person ? `${person.name} · ${titleCase(person.role)}` : route.fallback };
  });

  return (
    <section className="grid gap-5">
      <TableCard
        title="Who to ask"
        description="By subject, so nobody has to guess. Every one of these people is on the team page with their full record."
        items={rows}
        pageSize={false}
        getRowKey={(row) => row.subject}
        footnote="If a school is losing data or cannot run its results, do not queue it. Phone Support and Engineering in that order."
        columns={[
          { key: "subject", header: "Subject", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.subject}</span> },
          { key: "person", header: "Person", render: (row) => row.person },
          { key: "reach", header: "Reach them", render: (row) => row.reach },
          { key: "response", header: "Response", render: (row) => pill(row.response, row.tone) }
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ReferenceList
          title="Report a problem with this console"
          sub="Not a school’s problem — ours."
          items={[
            { label: "Something is broken", detail: "Say what you clicked, what you expected and what happened. A screenshot answers most of it.", pill: "Engineering", tone: "bad" },
            { label: "A number looks wrong", detail: "Note the figure, the filter and the time. Most “wrong” numbers are a scope difference.", pill: "Analytics", tone: "warn" },
            { label: "A word is wrong or unkind", detail: "Copy is a product decision. Communications wants to hear it — especially anything a school would read.", pill: "Comms", tone: "warn" },
            { label: "I could not find a control", detail: "Either it is somewhere unhelpful or it does not exist. Both are worth reporting.", pill: "Product", tone: "teal" }
          ]}
        />
        <ReferenceList
          title="Training and reference"
          items={[
            { label: "Docs · Key Workflows", detail: "The flows that account for most of the work here, written as steps", pill: "Read", tone: "teal" },
            { label: "Docs · Governing Principles", detail: "Why the console refuses some things. Worth reading before you promise a school anything.", pill: "Read", tone: "teal" },
            { label: "Shadow a support agent for a morning", detail: "The fastest way to understand what schools actually ask for", pill: "Do", tone: "good" },
            { label: "Sit in on one migration sign-off", detail: "It is the single most consequential thing we do to a school’s data", pill: "Do", tone: "good" }
          ]}
        />
      </div>
    </section>
  );
}

async function PlatformStatusTab() {
  const [monitoring, computation, security, tickets] = await Promise.all([
    apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring"),
    apiGet<SuperAdminComputationMonitoring>("/api/super-admin/infra-extras/computation").catch(() => null),
    apiGet<{ incidents?: Array<{ status: string; resolvedAt?: string }> }>("/api/super-admin/security").catch(() => ({ incidents: [] })),
    apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?limit=100")
  ]);
  const incidents = security.incidents ?? [];
  const open = incidents.filter((incident) => incident.status !== "RESOLVED").length;
  const lastResolved = incidents.map((incident) => incident.resolvedAt).filter(Boolean).sort().pop();
  const openTickets = tickets.data ?? [];
  const schoolsWithProblem = new Set(openTickets.map((ticket) => ticket.schoolId));
  const unowned = openTickets.filter((ticket) => !ticket.assignedTo || ticket.assignedTo === "Unassigned").length;
  const sync = monitoring.syncQueue;
  const syncTone = sync.status === "HEALTHY" ? "good" : sync.status === "WARNING" ? "warn" : "bad";
  const worstDelivery = monitoring.deliveryHealth.find((channel) => channel.status !== "HEALTHY");
  const health = (status: string) => (status === "HEALTHY" ? pill("Normal", "good") : status === "WARNING" ? pill("Watch", "warn") : pill("Problem", "bad"));
  const stuck = computation?.assessments.pendingApproval ?? 0;
  const rows = [
    { area: "Schools signing in", state: `${monitoring.runtime?.concurrentUsers ?? 0} signed in over the last 5 minutes`, health: pill("Normal", "good") },
    { area: "Result computation", state: computation?.computation ? `${computation.computation.runsToday} runs today · ${stuck} assessment${stuck === 1 ? "" : "s"} awaiting approval` : "No computation recorded today", health: health(computation?.assessments.status ?? "HEALTHY") },
    { area: "Notification delivery", state: worstDelivery ? `${worstDelivery.channel} failing at ${worstDelivery.failureRate}%` : "Email, SMS and in-app normal", health: worstDelivery ? health(worstDelivery.status) : pill("Normal", "good") },
    { area: "Offline sync", state: `${sync.pending.toLocaleString()} records queued${sync.oldestSchool ? `, oldest ${sync.oldestAgeHours}h (${sync.oldestSchool})` : ""}`, health: health(sync.status) },
    { area: "Backups", state: monitoring.backups.lastSuccessfulAt ? `Last successful ${new Date(monitoring.backups.lastSuccessfulAt).toLocaleString()}${monitoring.backups.lastRestoreTestAt ? ` · restore tested ${new Date(monitoring.backups.lastRestoreTestAt).toLocaleDateString()}` : " · no restore test yet"}` : "No backup recorded", health: monitoring.backups.lastSuccessfulAt ? pill("Normal", "good") : pill("Problem", "bad") }
  ];

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Uptime, last 30 days" value={`${monitoring.uptime.apiUptime}%`} detail={`${monitoring.uptime.requestsLast24h.toLocaleString()} requests in the last 24 hours · target 99.5%`} tone="dark" icon={CheckCircle2} />
        <StatCard label="Open incidents" value={open} detail={lastResolved ? `Last resolved ${new Date(lastResolved).toLocaleDateString()}` : "None resolved yet"} icon={ShieldAlert} tone={open ? "danger" : "success"} />
        <StatCard label="Sync queue" value={sync.pending.toLocaleString()} detail={sync.oldestSchool ? `Oldest ${sync.oldestAgeHours}h · ${sync.oldestSchool}` : "Nothing waiting"} icon={Database} tone={syncTone === "good" ? "success" : syncTone === "warn" ? "warning" : "danger"} />
        <StatCard label="Last verified backup" value={monitoring.backups.lastVerifiedAt ? new Date(monitoring.backups.lastVerifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "None"} detail={monitoring.backups.lastRestoreTestAt ? `Restore tested ${new Date(monitoring.backups.lastRestoreTestAt).toLocaleDateString()}` : "No restore test yet"} icon={HardDrive} />
        <StatCard label="Schools reporting a problem" value={schoolsWithProblem.size} detail={openTickets.length ? (unowned ? `${unowned} ticket${unowned === 1 ? "" : "s"} still unowned` : "All have an owned ticket") : "No open tickets"} icon={LifeBuoy} tone={unowned ? "warning" : "neutral"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="What is happening right now"
          description="The same figures Infrastructure reads, in plain words."
          items={rows}
          pageSize={false}
          getRowKey={(row) => row.area}
          footnote="A number in Watch is not a problem yet. It is a number somebody should look at again in an hour."
          columns={[
            { key: "area", header: "Area", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.area}</span> },
            { key: "state", header: "State", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.state}</span> },
            { key: "health", header: "Health", sortable: false, render: (row) => row.health }
          ]}
        />
        <ReferenceList
          title="If the platform is unwell"
          sub="In this order."
          items={[
            { label: "1 · Check here first", detail: "If it is platform-wide, it is already on this page and somebody owns it", tone: "teal" },
            { label: "2 · Check Infrastructure", detail: "Health, sync, computation, delivery and backups, in detail", tone: "teal" },
            { label: "3 · Do not tell a school it is their fault", detail: "Until you have looked, you do not know", tone: "bad" },
            { label: "4 · Phone Engineering for anything that stops a school operating", detail: "Any hour. This is the one thing nobody minds being woken for.", tone: "bad" }
          ]}
        />
      </div>
    </section>
  );
}
