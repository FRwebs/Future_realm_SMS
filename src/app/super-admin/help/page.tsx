import { BookOpen, CheckCircle2, MousePointerClick, Repeat2 } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminInfraMonitoring } from "@/lib/domain/types";

function tabHref(tab: string) {
  return tab === "start" ? "/super-admin/help" : `/super-admin/help?tab=${tab}`;
}

function ReferenceList({ title, sub, items }: { title: string; sub?: string; items: Array<{ label: string; detail: string }> }) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</p>
        {sub ? <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{sub}</p> : null}
      </div>
      <div className="grid gap-3 p-5">
        {items.map((item) => (
          <div key={item.label} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
            <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

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
      <ModuleHero
        eyebrow="Internal reference"
        title="Help"
        description="Orientation for this console, where to route a question by subject, and the platform's own health — read in plain words."
      />

      <DetailTabs tabs={tabs} />

      {tab === "start" ? <GettingStartedTab /> : null}
      {tab === "ask" ? <GetHelpTab /> : null}
      {tab === "status" ? <PlatformStatusTab /> : null}
    </div>
  );
}

function GettingStartedTab() {
  return (
    <section className="grid gap-5">
      <ReferenceList
        title="If you are new here"
        sub="Five things, in order. Read them once and most of this console explains itself."
        items={[
          { label: "1 · Command Center is the whole platform at a glance", detail: "Start there every morning. If something needs a person, it appears there before it appears anywhere else." },
          { label: "2 · My Work is only what is yours", detail: "Cases, tickets and reviews assigned to you, across every module, with the clocks that are running." },
          { label: "3 · Every module opens on a stat row", detail: "The handful of numbers that tell you whether that part of the platform is healthy, before you read anything else on the page." },
          { label: "4 · Every consequential action asks for a reason or a confirmation", detail: "Not bureaucracy — it's what the next person reads when they ask why this happened. It's written to the audit log." },
          { label: "5 · If you cannot find a control, it may not exist yet", detail: "Several things referenced elsewhere are deliberately not built yet. Settings says which, and honestly, so you can answer a school truthfully." }
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <ReferenceList
          title="How a module page is laid out"
          items={[
            { label: "Hero banner", detail: "What this module is for, in one sentence." },
            { label: "Tabs", detail: "Sub-areas of the module — Directory, Reviews & Cases, and so on." },
            { label: "Stat cards", detail: "Live counts computed from real records, never a sample." },
            { label: "Tables and action menus", detail: "Every row action opens a confirmation dialog before anything changes." }
          ]}
        />
        <ReferenceList
          title="Habits that make this job easier"
          items={[
            { label: "Write the reason for the next person, not for the log", detail: "A specific reason beats a generic one every time — it's what shows up in the audit trail." },
            { label: "Open the school record before you answer a school", detail: "Most avoidable mistakes come from answering before looking." },
            { label: "If a number looks wrong, check the filter first", detail: "Nearly every figure in this console is scoped by the filters currently applied." }
          ]}
        />
      </section>
    </section>
  );
}

function GetHelpTab() {
  return (
    <section className="grid gap-5">
      <TableCard
        title="Where to look, by subject"
        description="Specific on-call contacts and ownership are recorded in Team & Access — this routes you to the right module first."
        items={[
          { subject: "A school cannot operate", where: "Support → Board", detail: "Open a ticket at Critical priority." },
          { subject: "Money, invoices, refunds", where: "Billing → Invoices", detail: "Record a payment or review an overdue balance." },
          { subject: "Anything about a child's data", where: "Security & Compliance → Requests", detail: "Log or track a data-subject request." },
          { subject: "Pricing, plans, exceptions", where: "Plans & Features → Plan Exceptions", detail: "Review or request a per-school override." },
          { subject: "Migrations and source files", where: "Onboarding & Migration → Migration Jobs", detail: "Check status, sign-off, or a rollback reason." },
          { subject: "Anything sent to a school or parent", where: "Communications → Delivery", detail: "Check a send's delivery status and consent state." },
          { subject: "Partners and commission", where: "Partners & Commission → Statements", detail: "Review commission owed and settlement history." },
          { subject: "The platform itself feels unwell", where: "Help → Platform Status, then Infrastructure", detail: "Check health before assuming it's a school-side problem." },
          { subject: "Access and privileges", where: "Team & Access → People", detail: "Every internal account's module access and data scope." }
        ]}
        pageSize={false}
        getRowKey={(item) => item.subject}
        columns={[
          { key: "subject", header: "Subject", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.subject}</span> },
          { key: "where", header: "Where to go", render: (item) => <span className="font-semibold text-[var(--color-text-accent)]">{item.where}</span> },
          { key: "detail", header: "What to do there", render: (item) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.detail}</span> }
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <ReferenceList
          title="Report a problem with this console"
          sub="Not a school's problem — ours."
          items={[
            { label: "Something is broken", detail: "Say what you clicked, what you expected, and what happened. A screenshot answers most of it." },
            { label: "A number looks wrong", detail: "Note the figure, the filter, and the time. Most “wrong” numbers are a scope difference." },
            { label: "A word is wrong or unkind", detail: "Copy is a product decision — worth flagging, especially anything a school would read." },
            { label: "I could not find a control", detail: "Either it's somewhere unhelpful, or it doesn't exist yet. Both are worth reporting." }
          ]}
        />
        <ReferenceList
          title="Training and reference"
          items={[
            { label: "Standards → Key Workflows", detail: "The flows that account for most of the day-to-day work here, written as steps." },
            { label: "Standards → Governing Principles", detail: "Why the console refuses some things. Worth reading before promising a school anything." },
            { label: "Standards → Open Issues Register", detail: "What's known to be unresolved, and why it hasn't been closed yet." }
          ]}
        />
      </section>
    </section>
  );
}

async function PlatformStatusTab() {
  const monitoring = await apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring");
  const uptimeTone = monitoring.uptime.apiUptimeStatus === "HEALTHY" ? "success" : monitoring.uptime.apiUptimeStatus === "WARNING" ? "warning" : "danger";
  const syncTone = monitoring.syncQueue.status === "HEALTHY" ? "success" : monitoring.syncQueue.status === "WARNING" ? "warning" : "danger";

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Uptime, last 30 days" value={`${monitoring.uptime.apiUptime}%`} detail={`${monitoring.uptime.requestsLast24h.toLocaleString()} requests in the last 24h`} tone={uptimeTone} icon={CheckCircle2} />
        <StatCard label="Offline sync queue" value={monitoring.syncQueue.pending.toLocaleString()} detail={monitoring.syncQueue.oldestSchool ? `Oldest: ${monitoring.syncQueue.oldestSchool}, ${monitoring.syncQueue.oldestAgeHours}h` : "Nothing queued"} tone={syncTone} icon={Repeat2} />
        <StatCard label="Last verified backup" value={monitoring.backups.lastSuccessfulAt ? new Date(monitoring.backups.lastSuccessfulAt).toLocaleString() : "None recorded"} detail="Confirmed successful, not just attempted" icon={BookOpen} />
        <StatCard label="Average response time" value={`${monitoring.uptime.avgResponseMs}ms`} detail="Across the last 24 hours" icon={MousePointerClick} />
      </section>

      <TableCard
        title="What is happening right now"
        description="The same figures Infrastructure reads, in plain words."
        items={monitoring.deliveryHealth}
        pageSize={false}
        getRowKey={(item) => item.channel}
        columns={[
          { key: "channel", header: "Channel", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.channel}</span> },
          { key: "total", header: "Sent (recent)", render: (item) => item.total.toLocaleString() },
          { key: "failureRate", header: "Failure rate", render: (item) => `${item.failureRate}%` },
          {
            key: "status",
            header: "Health",
            render: (item) => {
              const tone = item.status === "HEALTHY" ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" } : item.status === "WARNING" ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" } : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{item.status}</span>;
            }
          }
        ]}
      />

      <ReferenceList
        title="If the platform is unwell"
        sub="In this order."
        items={[
          { label: "1 · Check here first", detail: "If it's platform-wide, it's already on this page." },
          { label: "2 · Check Infrastructure", detail: "Health, sync, computation, delivery and backups, in full detail." },
          { label: "3 · Don't tell a school it's their fault", detail: "Until you've looked, you don't know." }
        ]}
      />
    </section>
  );
}
