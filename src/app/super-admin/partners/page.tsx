import { BadgeCheck, Clock3, Handshake, Landmark, Link2, PiggyBank, Undo2 } from "lucide-react";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { ResourceField } from "@/components/forms/resource-form";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminPartnerDealRow, SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

import { compactCurrency, dealStatusTone, daysUntil, flowToneStyle, formatPercent } from "./_shared";

/* ───────────────────────── shapes the endpoints answer with ───────────────────────── */

type PartnerRow = {
  id: string; name: string; email: string | null; territory: string | null; code: string | null; type: string | null; tier: string | null; status: string; suspendedReason: string | null;
  registrationNumber: string | null; agreementReference: string | null; agreementVersion: string | null; agreementValidTo: string | null; countersignedAt: string | null; countersignedRef: string | null;
  commissionRatePercent: number; streamARatePercent: number | null; yearRates: number[] | null;
  primaryContactName: string | null; primaryContactPhone: string | null; opsContactName: string | null; opsContactPhone: string | null; partnerManagerId: string | null;
  minRegistrationsPerTerm: number | null; minRetentionPercent: number | null; bank: string | null; createdAt: string; schools: number; accrued: number;
};
type Registry = { kpis: { partners: number; active: number; dormant: number; suspended: number; attributedSchools: number; attributedShare: number | null; liability: number; settled: number; settledStatements: number; clawbacks: number; clawbackCount: number }; partners: PartnerRow[] };
type Performance = { rows: Array<{ id: string; name: string; code: string | null; registered: number; converted: number; conversion: number | null; retention: number | null; ticketsPer100: number | null; schools: number; recentRegistrations: number; condition: "MET" | "BREACHED" | "NONE"; conditionNote: string | null }>; direct: { schools: number; retention: number | null; ticketsPer100: number | null }; totals: { partnerSchools: number; conversion: number | null; breached: number } };
type Deal = SuperAdminPartnerDealRow & { rejectedReason?: string | null; expectedStudents?: number | null; contactName?: string | null };
type Commission = { kpis: { liability: number; settled: number; settledStatements: number; clawbacks: number; clawbackCount: number }; lines: Array<{ id: string; school: string; partner: string; stream: string; kind: string; collected: number; year: number | null; rate: number; commission: number; reconciledAt: string; statemented: boolean; note: string | null }> };
type Statement = { id: string; ref: string; partnerId: string; partner: string; code: string | null; period: string; gross: number; clawbacks: number; net: number; invoices: number; status: string; issuedAt: string; dueAt: string; settledAt: string | null; paymentRef: string | null };
type StatementDetail = Statement & { lines: Array<{ school: string; invoice: string | null; kind: string; stream: string; collected: number; rate: number; year: number | null; commission: number; reconciledAt: string; note: string | null }>; agreement: string | null; rate: number; bank: string | null; contact: string | null };
type Dispute = { id: string; schoolId: string; school: string; raisedBy: string; counterparty: string; grounds: string; evidence: string | null; status: string; outcome: string | null; decidedAt: string | null; createdAt: string };
type MappedSchool = { id: string; name: string; location: string; plan: string; status: string; students: number; since: string; stream: string; commission: number };

const TYPES = ["Reseller", "Consultant", "Association", "NGO", "Individual agent"].map((value) => ({ label: value, value }));
const TIERS = ["Bronze", "Silver", "Gold"].map((value) => ({ label: value, value }));
const PLAN_LABEL: Record<string, string> = { BASIC: "Starter", STANDARD: "Standard", PROFESSIONAL: "Premium", ENTERPRISE: "Elite", CUSTOM: "NGO / Mission" };
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  DORMANT: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  SUSPENDED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  ISSUED: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  SETTLED: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  VOID: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  OPEN: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  UPHELD: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  REJECTED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  MET: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  BREACHED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  NONE: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};
const pill = (label: string, tone: keyof typeof STATUS_TONE | string) => {
  const colours = STATUS_TONE[tone] ?? STATUS_TONE.NONE;
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: colours.bg, color: colours.fg }}>{label}</span>;
};
const dash = <span className="text-[var(--color-text-muted)]">—</span>;

function FlowSteps({ title, sub, steps }: { title: string; sub: string; steps: Array<{ label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" }> }) {
  return (
    <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[12.5px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[10px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[11px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[9.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Rules({ title, sub, rules }: { title: string; sub: string; rules: Array<{ label: string; sub: string; tone: "good" | "warn" | "bad" }> }) {
  return (
    <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[12.5px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 text-[11px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 grid gap-3">
        {rules.map((rule) => (
          <div key={rule.label} className="flex items-start gap-2.5 rounded-[9px] border px-3.5 py-3" style={{ borderColor: flowToneStyle[rule.tone].bd, background: flowToneStyle[rule.tone].bg }}>
            <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: flowToneStyle[rule.tone].fg }} />
            <div>
              <p className="text-[11px] font-bold" style={{ color: flowToneStyle[rule.tone].fg }}>{rule.label}</p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--color-text-secondary)]">{rule.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const tabHref = (tab: string) => (tab === "partners" ? "/super-admin/partners" : `/super-admin/partners?tab=${tab}`);

/** Every field a partner is made of — the registry form and the edit form are the same form. */
function partnerFields(partner?: PartnerRow): ResourceField[] {
  const v = <T,>(value: T | null | undefined) => (value === null || value === undefined ? undefined : value);
  return [
    { name: "name", label: "Registered / trading name", required: true, defaultValue: v(partner?.name), placeholder: "e.g. GSR Education Partners", section: "The organisation" },
    { name: "type", label: "Partner type", type: "select", options: TYPES, defaultValue: v(partner?.type), section: "The organisation" },
    { name: "registrationNumber", label: "CAC / registration number", defaultValue: v(partner?.registrationNumber), section: "The organisation" },
    { name: "territory", label: "Region they may operate in", defaultValue: v(partner?.territory), placeholder: "e.g. Lagos, Ogun", section: "Where they may operate" },
    { name: "tier", label: "Partner tier", type: "select", options: TIERS, defaultValue: v(partner?.tier), section: "Where they may operate" },
    { name: "email", label: "Notices go to", type: "email", defaultValue: v(partner?.email), note: "Deal confirmations and statements are emailed here.", section: "People" },
    { name: "primaryContactName", label: "Primary contact — signs and is answerable", defaultValue: v(partner?.primaryContactName), section: "People" },
    { name: "primaryContactPhone", label: "Primary contact phone", defaultValue: v(partner?.primaryContactPhone), section: "People" },
    { name: "opsContactName", label: "Day-to-day contact — answers operationally", defaultValue: v(partner?.opsContactName), section: "People" },
    { name: "opsContactPhone", label: "Day-to-day contact phone", defaultValue: v(partner?.opsContactPhone), section: "People" },
    { name: "agreementReference", label: "Agreement reference", defaultValue: v(partner?.agreementReference), placeholder: "e.g. standard reseller", section: "Agreement" },
    { name: "agreementVersion", label: "Agreement version", defaultValue: v(partner?.agreementVersion), placeholder: "e.g. v2.1", section: "Agreement" },
    { name: "agreementValidTo", label: "Agreement end", type: "date", defaultValue: partner?.agreementValidTo?.slice(0, 10), section: "Agreement" },
    { name: "commissionRatePercent", label: "Subscription commission — year 1 (%)", type: "number", defaultValue: partner?.commissionRatePercent ?? 20, min: 0, max: 100, step: 0.5, section: "Commission" },
    { name: "yearRates", label: "Rate by relationship year (%)", defaultValue: partner?.yearRates?.join(", ") ?? "", placeholder: "20, 12, 6", note: "What is paid in year one, two, three… After the last year commission ends. Blank steps the year-1 rate down to 60% then 30%.", section: "Commission" },
    { name: "streamARatePercent", label: "Agency and IT projects — flat (%)", type: "number", defaultValue: v(partner?.streamARatePercent), min: 0, max: 100, step: 0.5, note: "Stream A is a flat share of project value; it never applies to a subscription invoice.", section: "Commission" },
    { name: "minRegistrationsPerTerm", label: "Minimum new registrations each term", type: "number", defaultValue: v(partner?.minRegistrationsPerTerm), min: 0, max: 100, note: "Checked every time Partners is opened: two terms below this, and the partner is flagged for review.", section: "Minimum performance" },
    { name: "minRetentionPercent", label: "Minimum second-term retention (%)", type: "number", defaultValue: v(partner?.minRetentionPercent), min: 0, max: 100, section: "Minimum performance" },
    { name: "bankName", label: "Bank", defaultValue: partner?.bank ? undefined : undefined, placeholder: "e.g. Zenith Bank", section: "Where commission is paid" },
    { name: "bankAccountNumber", label: "Account number", placeholder: partner?.bank ? "Leave blank to keep the number on file" : "10 digits", section: "Where commission is paid" },
    { name: "bankAccountName", label: "Account name", section: "Where commission is paid" }
  ];
}

function dealFields(partnerOptions: Array<{ label: string; value: string }>, partnerId?: string): ResourceField[] {
  return [
    { name: "partnerId", label: "Partner", type: "select", required: true, options: partnerOptions, defaultValue: partnerId, section: "Partner and prospect" },
    { name: "prospectSchoolName", label: "Prospect school", required: true, section: "Partner and prospect" },
    { name: "prospectLocation", label: "Location", section: "Partner and prospect" },
    { name: "contactName", label: "Contact at the school", section: "Partner and prospect" },
    { name: "contactPhone", label: "Contact phone", section: "Partner and prospect" },
    { name: "expectedStudents", label: "Expected size (students)", type: "number", min: 1, section: "Partner and prospect" },
    { name: "expectedTier", label: "Expected tier", type: "select", options: [{ label: "Starter", value: "BASIC" }, { label: "Standard", value: "STANDARD" }, { label: "Elite", value: "ENTERPRISE" }, { label: "NGO / Mission", value: "CUSTOM" }], section: "Partner and prospect" },
    { name: "stream", label: "Stream / referral channel", section: "Evidence of introduction" },
    { name: "introductionEvidence", label: "How the introduction was made", type: "textarea", note: "Checked on submission: a partner that has not countersigned, a school that is already a customer, and a school another partner registered first are refused — and the refusal is kept on the register.", section: "Evidence of introduction" }
  ];
}

export default async function PartnersPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const activeTab = params.tab === "registrations" ? "registrations" : params.tab === "commission" ? "commission" : params.tab === "statements" ? "statements" : "partners";

  const registry = await apiGet<Registry>("/api/super-admin/partners/registry");
  const partnerOptions = registry.partners.map((partner) => ({ label: partner.name, value: partner.id }));

  const tabs = [
    { label: "Partners", href: tabHref("partners"), active: activeTab === "partners", badge: registry.kpis.partners },
    { label: "Registrations", href: tabHref("registrations"), active: activeTab === "registrations" },
    { label: "Commission", href: tabHref("commission"), active: activeTab === "commission" },
    { label: "Statements", href: tabHref("statements"), active: activeTab === "statements" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Schools & Revenue"
        title="Partners & Commission"
        description="Attribution before introductions, commission on money received."
        action={
          activeTab === "registrations" ? (
            <ResourceActionDialog triggerLabel="Register a school" title="Register a school for a partner" description="Log an introduction. It is valid for 90 days; the school must sign up inside the window for the attribution to hold." endpoint="/api/super-admin/partners/deals" submitLabel="Register" variant="heroWhite" fields={dealFields(partnerOptions)} />
          ) : activeTab === "statements" ? (
            <ResourceActionDialog
              triggerLabel="Issue statements"
              title="Issue statements for a period"
              description="One statement per partner, issued whether or not the amount is positive. Every reconciled, unstatemented accrual in the period goes on it."
              endpoint="/api/super-admin/partners/statements/generate"
              submitLabel="Issue statements"
              variant="heroWhite"
              fields={[
                { name: "period", label: "Period", required: true, placeholder: "Term 1 · 2026/27" },
                { name: "from", label: "From", type: "date", required: true },
                { name: "to", label: "To", type: "date", required: true },
                { name: "partnerId", label: "Partner (blank = all)", type: "select", options: [{ label: "Every partner", value: "" }, ...partnerOptions] },
                { name: "dueDays", label: "Payable within (days)", type: "number", defaultValue: 14, min: 0, max: 120 }
              ]}
            />
          ) : (
            <ResourceActionDialog triggerLabel="Register a partner" title="Register a partner" description="A partner is an organisation, a named person who answers for it, a signed agreement, a bank account to pay, and a permanent code a school can carry." endpoint="/api/super-admin/partners" submitLabel="Register partner" variant="heroWhite" fields={partnerFields()} />
          )
        }
      />

      <DetailTabs tabs={tabs} />

      {activeTab === "partners" ? <PartnersTab registry={registry} focus={params.partner} /> : null}
      {activeTab === "registrations" ? <RegistrationsTab partnerOptions={partnerOptions} /> : null}
      {activeTab === "commission" ? <CommissionTab /> : null}
      {activeTab === "statements" ? <StatementsTab focus={params.statement} /> : null}
    </div>
  );
}

/* ───────────────────────── Partners ───────────────────────── */

async function PartnersTab({ registry, focus }: { registry: Registry; focus?: string }) {
  const k = registry.kpis;
  const [performance, mapped] = await Promise.all([
    apiGet<Performance>("/api/super-admin/partners/performance"),
    focus ? apiGet<MappedSchool[]>(`/api/super-admin/partners/${focus}/schools`).catch(() => [] as MappedSchool[]) : Promise.resolve([] as MappedSchool[])
  ]);
  const focused = registry.partners.find((partner) => partner.id === focus);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Partners on the registry" value={k.partners} detail={`${k.active} active · ${k.dormant} dormant · ${k.suspended} suspended`} icon={Handshake} tone="dark" />
        <StatCard label="Attributed schools" value={k.attributedSchools} detail={k.attributedShare === null ? "No schools yet" : `${k.attributedShare}% of the schools on the platform`} icon={Link2} tone="info" />
        <StatCard label="Commission liability accrued" value={compactCurrency(k.liability)} detail="Earned and not yet on a statement" icon={PiggyBank} tone="success" />
        <StatCard label="Commission settled" value={compactCurrency(k.settled)} detail={`Across ${k.settledStatements} settled statement${k.settledStatements === 1 ? "" : "s"}`} icon={BadgeCheck} tone="info" />
        <StatCard label="Clawbacks" value={compactCurrency(Math.abs(k.clawbacks))} detail={`${k.clawbackCount} reversed payment${k.clawbackCount === 1 ? "" : "s"}`} icon={Undo2} tone="neutral" />
      </section>

      <TableCard
        title="Partner registry"
        description="Every partner carries a permanent reference code. A school arriving with that code — on the partner's link, as ?partner=CODE — maps to the partner without anyone typing a name."
        items={registry.partners}
        emptyState="No partner has been registered yet."
        getRowKey={(partner) => partner.id}
        columns={[
          { key: "partner", header: "Partner", render: (partner) => <div><p className="font-bold text-[var(--color-text-primary)]">{partner.name}</p><p className="text-[10px] text-[var(--color-text-muted)]">{partner.code ?? "No code"} · {partner.tier ?? "No tier"} · since {formatDate(partner.createdAt)}</p></div> },
          { key: "type", header: "Type", render: (partner) => partner.type ?? dash },
          { key: "region", header: "Region", render: (partner) => partner.territory ?? dash },
          { key: "schools", header: "Schools", render: (partner) => <span className="font-bold">{partner.schools}</span> },
          { key: "accrued", header: "Accrued", render: (partner) => <span className="font-bold">{partner.accrued ? formatCurrency(partner.accrued) : "₦0"}</span> },
          { key: "agreement", header: "Agreement", render: (partner) => <div className="text-[11px] text-[var(--color-text-secondary)]">{partner.agreementReference ?? "No agreement on file"}{partner.agreementVersion ? ` · ${partner.agreementVersion}` : ""}<p className="text-[10px]" style={{ color: partner.countersignedAt ? "var(--color-success)" : "var(--color-warning)" }}>{partner.countersignedAt ? `Countersigned ${formatDate(partner.countersignedAt)} · ${partner.countersignedRef}` : "Not countersigned"}</p></div> },
          { key: "status", header: "Status", render: (partner) => pill(partner.status.charAt(0) + partner.status.slice(1).toLowerCase(), partner.status) },
          {
            key: "actions", header: "", render: (partner) => (
              <ActionMenu>
                <Link href={`/super-admin/partners?partner=${partner.id}`} className="block px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text-primary)]">See every school mapped</Link>
                <ResourceActionDialog triggerLabel="Edit the record" title={`Edit ${partner.name}`} description="Contacts, agreement, rates, minimum performance and bank details." endpoint={`/api/super-admin/partners/${partner.id}`} method="PATCH" variant="secondary" submitLabel="Save" fields={partnerFields(partner)} />
                {!partner.countersignedAt ? <ResourceActionDialog triggerLabel="Record countersignature" title={`Countersigned agreement · ${partner.name}`} description="Deals can only be registered for a partner whose signed agreement is on file." endpoint={`/api/super-admin/partners/${partner.id}/countersign`} method="PATCH" variant="secondary" submitLabel="Record" fields={[{ name: "reference", label: "Reference of the countersigned agreement", required: true }, { name: "signedOn", label: "Signed on", type: "date" }]} /> : null}
                {partner.status === "SUSPENDED" ? (
                  <ResourceActionDialog triggerLabel="Reactivate" title={`Reactivate ${partner.name}`} description="They can register deals again and accrue commission." endpoint={`/api/super-admin/partners/${partner.id}/reactivate`} method="PATCH" variant="secondary" submitLabel="Reactivate" fields={[]} />
                ) : (
                  <ResourceActionDialog triggerLabel="Suspend" title={`Suspend ${partner.name}`} description="No new deal is registered and no new commission accrues until they are reactivated." endpoint={`/api/super-admin/partners/${partner.id}/suspend`} method="PATCH" variant="menuDanger" submitLabel="Suspend" confirmLabel="Confirm" fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]} />
                )}
              </ActionMenu>
            )
          }
        ]}
        footnote="The signed agreement is the legal record; the structured terms on this record are what the commission engine operates on. Partners have no login of their own to this platform: everything here is run by the team."
      />

      {focused ? (
        <TableCard
          title={`Schools mapped to ${focused.name}`}
          description={`Every school that arrived carrying ${focused.code ?? "the partner's code"}. Attribution was written at signup and is changed only by a dispute decision.`}
          items={mapped}
          emptyState="No school is mapped to this partner yet."
          getRowKey={(school) => school.id}
          actions={<Link href="/super-admin/partners" className="text-[11px] font-semibold text-[var(--color-text-accent)]">Close</Link>}
          columns={[
            { key: "school", header: "School", render: (school) => <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{school.name}</Link> },
            { key: "location", header: "Location", render: (school) => school.location || dash },
            { key: "plan", header: "Tier", render: (school) => PLAN_LABEL[school.plan] ?? school.plan },
            { key: "students", header: "Students", render: (school) => school.students.toLocaleString() },
            { key: "status", header: "Status", render: (school) => school.status.replaceAll("_", " ").toLowerCase() },
            { key: "since", header: "Tenure", render: (school) => formatDate(school.since) },
            { key: "commission", header: "Commission", render: (school) => <span className="font-bold">{formatCurrency(school.commission)}</span> }
          ]}
          footnote="Commission is shown per school on collected, reconciled revenue only — a school with an unpaid invoice contributes nothing here until the balance is settled."
        />
      ) : null}

      <TableCard
        title="Partner performance"
        description="Retention of partner-sourced schools against direct-sourced is the number that reveals whether a channel is producing customers or merely signatures."
        items={performance.rows.filter((row) => row.registered > 0 || row.condition !== "NONE")}
        emptyState="No partner has registered a school yet."
        getRowKey={(row) => row.id}
        columns={[
          { key: "partner", header: "Partner", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.name}</span> },
          { key: "registered", header: "Registered", render: (row) => row.registered },
          { key: "converted", header: "Converted", render: (row) => row.converted },
          { key: "conversion", header: "Conversion", render: (row) => (row.conversion === null ? dash : `${row.conversion}%`) },
          { key: "retention", header: "2nd-term retention", render: (row) => (row.retention === null ? dash : `${row.retention}%`) },
          { key: "tickets", header: "Tickets / 100 schools", render: (row) => (row.ticketsPer100 === null ? dash : row.ticketsPer100) },
          { key: "condition", header: "Condition", render: (row) => <div>{pill(row.condition === "MET" ? "Met" : row.condition === "BREACHED" ? "Review condition reached" : "No condition set", row.condition)}{row.conditionNote ? <p className="mt-1 text-[9.5px] text-[var(--color-text-muted)]">{row.conditionNote}</p> : null}</div> }
        ]}
        footnote={`Direct-sourced schools, for comparison: ${performance.direct.schools} schools · ${performance.direct.retention === null ? "retention not yet measurable" : `${performance.direct.retention}% retained`} · ${performance.direct.ticketsPer100 ?? "—"} tickets per 100 schools in the last 90 days. Second-term retention counts schools older than 240 days that are still trading.`}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <TableCard
          title="Two streams, never interchangeable"
          description="A completed website costs nothing after delivery. A live school costs infrastructure, storage, support, messaging and compliance every day it remains."
          items={[
            { row: "Nature", a: "Project, delivered once", b: "Recurring, per academic term" },
            { row: "Cost after delivery", a: "Effectively zero", b: "Substantial and permanent" },
            { row: "Commission shape", a: "Flat share of project value", b: "Declining by year, then ends" },
            { row: "Basis", a: "Collected and reconciled project revenue", b: "Fully paid, reconciled invoices only" },
            { row: "Settlement", a: "On the next statement", b: "Termly, within the agreed window" }
          ]}
          pageSize={false}
          getRowKey={(item) => item.row}
          columns={[
            { key: "row", header: "", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.row}</span> },
            { key: "a", header: "Stream A — agency & IT", render: (item) => <span className="text-[11.5px]">{item.a}</span> },
            { key: "b", header: "Stream B — subscriptions", render: (item) => <span className="text-[11.5px]">{item.b}</span> }
          ]}
          footnote="The engine applies the agency rate only to invoices marked as stream A and never to a subscription invoice, or the reverse."
        />
        <Rules
          title="Rules the system enforces rather than trusts"
          sub="Encoded in the accrual engine, not in the agreement text."
          rules={[
            { label: "Commission accrues on reconciled revenue only", sub: "An invoice is a statement of what is owed, a recorded payment is somebody saying money arrived; matching it to the bank is what counts.", tone: "bad" },
            { label: "Commission accrues on fully settled invoices only", sub: "A partial payment accrues nothing until the balance is settled.", tone: "bad" },
            { label: "A commission rate belongs to a stream", sub: "Stream A rates cannot reach a subscription invoice.", tone: "bad" },
            { label: "Relationship year runs from the first reconciled invoice", sub: "Not from the agreement date.", tone: "warn" },
            { label: "Commission is computed on the amount actually collected", sub: "Before tax, never list price.", tone: "good" }
          ]}
        />
      </section>
    </div>
  );
}

/* ───────────────────────── Registrations ───────────────────────── */

async function RegistrationsTab({ partnerOptions }: { partnerOptions: Array<{ label: string; value: string }> }) {
  const [dealsEnvelope, disputes, schoolsEnvelope] = await Promise.all([
    apiGetEnvelope<Deal[]>("/api/super-admin/partners/deals"),
    apiGet<Dispute[]>("/api/super-admin/partners/disputes"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const deals = dealsEnvelope.data ?? [];
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const open = deals.filter((deal) => deal.status === "REGISTERED");

  return (
    <div className="grid gap-5">
      <FlowSteps
        title="Deal registration — attribution is established before the introduction"
        sub="Never argued about afterwards. This prevents the most damaging partner dispute: two parties claiming the same school."
        steps={[
          { label: "Partner registers a prospect", note: "Name, location, contact, expected size" },
          { label: "Duplicate and conflict check", note: "Automatic, on submission" },
          { label: "Registered", note: "Valid 90 days · refusals are kept with their reason", tone: "good" },
          { label: "School signs up in window", note: "With the partner's code, or converted by hand" },
          { label: "Commission eligible", note: "From the first reconciled invoice", tone: "ink" }
        ]}
      />

      <TableCard
        title="Registered deals"
        description="First valid registration wins, and the rule is visible to every party in advance."
        items={deals}
        emptyState="No deal has been registered."
        getRowKey={(deal) => deal.id}
        actions={
          <ResourceActionDialog triggerLabel="Send expiry alerts" title="Send expiry alerts" description="Emails every partner with a registration expiring within 14 days." endpoint="/api/super-admin/partners/deals/expiry-alerts" method="POST" variant="secondary" submitLabel="Send alerts" fields={[]} />
        }
        columns={[
          { key: "school", header: "Prospect school", render: (deal) => <div><p className="font-bold text-[var(--color-text-primary)]">{deal.prospectSchoolName}</p><p className="text-[10px] text-[var(--color-text-muted)]">{deal.prospectLocation ?? "No location"}{deal.contactName ? ` · ${deal.contactName}` : ""}</p></div> },
          { key: "partner", header: "Partner", render: (deal) => deal.partnerName },
          { key: "registered", header: "Registered", render: (deal) => (deal.status === "REJECTED" ? dash : formatDate(deal.registeredAt)) },
          { key: "expires", header: "Expires", render: (deal) => (deal.status === "REGISTERED" ? <span style={{ color: daysUntil(deal.validUntil) <= 14 ? "var(--color-warning)" : undefined }}>{formatDate(deal.validUntil)} · {Math.max(0, daysUntil(deal.validUntil))}d</span> : dash) },
          { key: "size", header: "Expected size", render: (deal) => (deal.expectedStudents ? `~${deal.expectedStudents.toLocaleString()} students` : dash) },
          { key: "status", header: "Status", render: (deal) => deal.status === "REJECTED" ? pill(`Rejected — ${deal.rejectedReason ?? "refused"}`, "BREACHED") : <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: (dealStatusTone[deal.status] ?? dealStatusTone.EXPIRED).bg, color: (dealStatusTone[deal.status] ?? dealStatusTone.EXPIRED).fg }}>{(dealStatusTone[deal.status] ?? dealStatusTone.EXPIRED).label}</span> },
          {
            key: "actions", header: "", render: (deal) => deal.status === "REGISTERED" ? (
              <ActionMenu>
                <ResourceActionDialog triggerLabel="Mark converted" title={`Convert ${deal.prospectSchoolName}`} description="Attribute the school that signed up to this partner. Commission starts from its first reconciled invoice." endpoint={`/api/super-admin/partners/deals/${deal.id}/convert`} method="PATCH" variant="secondary" submitLabel="Convert" fields={[{ name: "schoolId", label: "School that signed up", type: "select", required: true, options: schoolOptions }]} />
                <ResourceActionDialog triggerLabel="Mark expired" title={`Expire ${deal.prospectSchoolName}`} description="Closes the registration; the partner may register it once more." endpoint={`/api/super-admin/partners/deals/${deal.id}/expire`} method="PATCH" variant="menuDanger" submitLabel="Expire" confirmLabel="Confirm" fields={[]} />
              </ActionMenu>
            ) : null
          }
        ]}
        footnote={`${open.length} open registration${open.length === 1 ? "" : "s"}. A school arriving through self-signup with no registration and no partner code is unattributed, and remains so. A partner cannot claim a school retrospectively.`}
      />

      <TableCard
        title="Attribution disputes"
        description="Resolved against the registration record, which is timestamped and immutable — this is why registration exists."
        items={disputes}
        emptyState="No attribution dispute has been raised."
        getRowKey={(dispute) => dispute.id}
        actions={
          <ResourceActionDialog triggerLabel="Log a dispute" title="Log an attribution dispute" description="Two parties claiming one school. It is decided against the registration record by a Super Admin." endpoint="/api/super-admin/partners/disputes" method="POST" variant="secondary" submitLabel="Log dispute" fields={[
            { name: "schoolId", label: "School in dispute", type: "select", required: true, options: schoolOptions },
            { name: "raisedBy", label: "Raised by", required: true, placeholder: "Partner or Nooria direct" },
            { name: "counterparty", label: "Counterparty", required: true },
            { name: "grounds", label: "Grounds as stated", type: "textarea", required: true },
            { name: "evidence", label: "Evidence references", type: "textarea" }
          ]} />
        }
        columns={[
          { key: "school", header: "School", render: (dispute) => <span className="font-bold text-[var(--color-text-primary)]">{dispute.school}</span> },
          { key: "raised", header: "Raised by", render: (dispute) => dispute.raisedBy },
          { key: "counter", header: "Counterparty", render: (dispute) => dispute.counterparty },
          { key: "grounds", header: "Grounds", render: (dispute) => <span className="text-[11.5px] leading-5 text-[var(--color-text-secondary)]">{dispute.grounds}</span> },
          { key: "status", header: "Status", render: (dispute) => <div>{pill(dispute.status === "OPEN" ? "Under review" : dispute.status === "UPHELD" ? "Upheld — reattributed" : "Rejected", dispute.status)}{dispute.outcome ? <p className="mt-1 max-w-[18rem] text-[9.5px] text-[var(--color-text-muted)]">{dispute.outcome}</p> : null}</div> },
          {
            key: "actions", header: "", render: (dispute) => dispute.status === "OPEN" ? (
              <ResourceActionDialog triggerLabel="Decide" title={`Decide · ${dispute.school}`} description="Super Admin only. Where it is upheld, commission is recalculated from the point of attribution, and the correction appears on the next statement." endpoint={`/api/super-admin/partners/disputes/${dispute.id}/decide`} method="PATCH" variant="secondary" submitLabel="Record decision" fields={[
                { name: "outcome", label: "Outcome", type: "select", required: true, options: [{ label: "Upheld — the school moves", value: "UPHELD" }, { label: "Rejected — attribution stands", value: "REJECTED" }] },
                { name: "reattributeToPartnerId", label: "If upheld: the school belongs to", type: "select", options: [{ label: "—", value: "" }, ...partnerOptions] },
                { name: "notes", label: "Reasons", type: "textarea", required: true, note: "Kept permanently against the school and the partner." }
              ]} />
            ) : null
          }
        ]}
        footnote="Where a dispute is upheld, what was accrued to the old partner is voided (or clawed back if it was already settled) and the same reconciled invoices accrue to the new one."
      />
    </div>
  );
}

/* ───────────────────────── Commission ───────────────────────── */

async function CommissionTab() {
  const commission = await apiGet<Commission>("/api/super-admin/partners/commission");
  const k = commission.kpis;
  return (
    <div className="grid gap-5">
      <FlowSteps
        title="Commission accrual — reconciliation is the only trigger"
        sub="The design exists to make reconciliation, not invoicing, the event that means something."
        steps={[
          { label: "Invoice issued", note: "No commission. An invoice is not income.", tone: "bad" },
          { label: "Payment recorded", note: "Still none — someone told us money arrived", tone: "bad" },
          { label: "Payment reconciled", note: "Matched to a bank statement line, by someone else", tone: "warn" },
          { label: "Fully settled?", note: "A partial payment waits for the balance" },
          { label: "Attribution checked", note: "Unattributed → no commission" },
          { label: "Rate resolved", note: "Stream + agreement + relationship year" },
          { label: "Accrued", note: "A liability, and a line on the statement", tone: "ink" }
        ]}
      />
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Liability accrued" value={compactCurrency(k.liability)} detail="Earned, not yet on a statement" icon={PiggyBank} tone="dark" />
        <StatCard label="Settled to date" value={compactCurrency(k.settled)} detail={`${k.settledStatements} statement${k.settledStatements === 1 ? "" : "s"}`} icon={BadgeCheck} tone="info" />
        <StatCard label="Clawbacks (120 days)" value={compactCurrency(Math.abs(k.clawbacks))} detail={`${k.clawbackCount} reversed payment${k.clawbackCount === 1 ? "" : "s"}`} icon={Undo2} tone="neutral" />
        <StatCard label="Lines on record" value={commission.lines.length} detail="Each traces to an invoice and a reconciliation" icon={Clock3} tone="neutral" />
      </section>
      <TableCard
        title="Accruals"
        description="Every line traceable to an invoice and a reconciliation record."
        items={commission.lines}
        emptyState="Nothing has accrued yet. A payment accrues commission when it is reconciled, the invoice is fully settled, and the school is attributed to a partner."
        getRowKey={(line) => line.id}
        actions={
          <ResourceActionDialog triggerLabel="Record a clawback" title="Record a clawback" description="A payment was reversed or refunded: it takes back what it earned, at the rate it earned it." endpoint="/api/super-admin/partners/clawbacks" method="POST" variant="secondary" submitLabel="Record clawback" fields={[
            { name: "transactionId", label: "Payment (transaction id)", required: true, placeholder: "The reversed payment's id from Billing" },
            { name: "amount", label: "Amount refunded (₦)", type: "number", required: true, min: 1 },
            { name: "reason", label: "Why it was reversed", type: "textarea", required: true }
          ]} />
        }
        columns={[
          { key: "school", header: "School", render: (line) => <span className="font-bold text-[var(--color-text-primary)]">{line.school}</span> },
          { key: "partner", header: "Partner", render: (line) => line.partner },
          { key: "stream", header: "Stream", render: (line) => pill(line.stream, line.stream === "A" ? "ISSUED" : "NONE") },
          { key: "collected", header: "Collected", render: (line) => formatCurrency(line.collected) },
          { key: "year", header: "Yr", render: (line) => line.year ?? dash },
          { key: "rate", header: "Rate", render: (line) => formatPercent(line.rate) },
          { key: "commission", header: "Commission", render: (line) => <span className="font-bold" style={{ color: line.commission < 0 ? "var(--color-danger)" : undefined }}>{formatCurrency(line.commission)}</span> },
          { key: "reconciled", header: "Reconciled", render: (line) => <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(line.reconciledAt)}{line.kind === "CLAWBACK" ? " · clawback" : ""}{line.statemented ? " · on a statement" : ""}</span> }
        ]}
        footnote="A rate change mid-term applies to invoices reconciled after the change, never retrospectively."
      />
    </div>
  );
}

/* ───────────────────────── Statements ───────────────────────── */

async function StatementsTab({ focus }: { focus?: string }) {
  const [statements, detail] = await Promise.all([
    apiGet<Statement[]>("/api/super-admin/partners/statements"),
    focus ? apiGet<StatementDetail>(`/api/super-admin/partners/statements/${focus}`).catch(() => null) : Promise.resolve(null)
  ]);
  return (
    <div className="grid gap-5">
      <TableCard
        title="Statements of account"
        description="Issued whether or not the amount is positive, so that a zero period is a statement rather than a silence. The person who issues a statement cannot be the person who pays it."
        items={statements}
        emptyState="No statement has been issued."
        getRowKey={(statement) => statement.id}
        actions={<a href="/api/super-admin/partners/statements/export" className="text-[11px] font-semibold text-[var(--color-text-accent)]">Export the payment run (CSV)</a>}
        columns={[
          { key: "partner", header: "Partner", render: (statement) => <div><p className="font-bold text-[var(--color-text-primary)]">{statement.partner}</p><p className="text-[10px] text-[var(--color-text-muted)]">{statement.ref}</p></div> },
          { key: "period", header: "Period", render: (statement) => statement.period },
          { key: "gross", header: "Gross commission", render: (statement) => formatCurrency(statement.gross) },
          { key: "claw", header: "Clawbacks", render: (statement) => formatCurrency(statement.clawbacks) },
          { key: "net", header: "Net payable", render: (statement) => <span className="font-bold">{formatCurrency(statement.net)}</span> },
          { key: "status", header: "Status", render: (statement) => <div>{pill(statement.status === "SETTLED" ? "Settled" : statement.status === "ISSUED" ? "Awaiting settlement" : "Void", statement.status)}<p className="mt-1 text-[9.5px] text-[var(--color-text-muted)]">{statement.status === "SETTLED" ? `Settled ${statement.settledAt ? formatDate(statement.settledAt) : ""} · ${statement.paymentRef ?? ""}` : `Due ${formatDate(statement.dueAt)}`}</p></div> },
          {
            key: "actions", header: "", render: (statement) => (
              <ActionMenu>
                <Link href={`/super-admin/partners?tab=statements&statement=${statement.id}`} className="block px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text-primary)]">Open statement</Link>
                {statement.status === "ISSUED" ? <ResourceActionDialog triggerLabel="Settle" title={`Settle ${statement.ref}`} description={`Release ${formatCurrency(statement.net)} to ${statement.partner}. A Super Admin other than the person who issued it settles, and the deals it paid move to “commission paid”.`} endpoint={`/api/super-admin/partners/statements/${statement.id}/settle`} method="PATCH" variant="secondary" submitLabel="Mark settled" fields={[{ name: "paymentRef", label: "Bank reference of the payment", required: true }]} /> : null}
              </ActionMenu>
            )
          }
        ]}
        footnote="Historic statements are retained permanently and reproducible exactly as issued — a statement a partner cannot verify is a statement they will dispute."
      />

      {detail ? (
        <TableCard
          title={`Statement ${detail.ref} · ${detail.partner} · ${detail.period}`}
          description={`Agreement ${detail.agreement ?? "not on file"} · year-1 rate ${detail.rate}% · paid to ${detail.bank ?? "no bank on file"} · sent to ${detail.contact ?? "no contact"}`}
          items={detail.lines}
          emptyState="No commission accrued in this period."
          getRowKey={(line) => `${line.school}:${line.invoice}:${line.kind}:${line.reconciledAt}`}
          actions={<Link href="/super-admin/partners?tab=statements" className="text-[11px] font-semibold text-[var(--color-text-accent)]">Close</Link>}
          columns={[
            { key: "school", header: "School", render: (line) => <span className="font-bold text-[var(--color-text-primary)]">{line.school}</span> },
            { key: "invoice", header: "Invoice", render: (line) => <span className="font-[var(--font-mono)] text-[11px]">{line.invoice ?? "—"}</span> },
            { key: "collected", header: "Collected", render: (line) => formatCurrency(line.collected) },
            { key: "rate", header: "Rate", render: (line) => `${line.rate}%${line.year ? ` · yr ${line.year}` : ""}` },
            { key: "commission", header: "Commission", render: (line) => <span className="font-bold" style={{ color: line.commission < 0 ? "var(--color-danger)" : undefined }}>{formatCurrency(line.commission)}</span> },
            { key: "note", header: "", render: (line) => <span className="text-[10px] text-[var(--color-text-muted)]">{line.kind === "CLAWBACK" ? `Clawback${line.note ? ` — ${line.note}` : ""}` : ""}</span> }
          ]}
          footnote={`Gross ${formatCurrency(detail.gross)} · clawbacks ${formatCurrency(detail.clawbacks)} · net payable ${formatCurrency(detail.net)} · ${detail.invoices} reconciled invoice${detail.invoices === 1 ? "" : "s"}. Read-only: reproduced exactly as issued.`}
        />
      ) : null}

      <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#0D2315]"><Landmark className="h-4 w-4" /> How a statement is paid</p>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-[var(--color-text-muted)]">Finance issues the statement; a Super Admin settles it with the bank reference. The amount is held as a liability until then. The payment run exports every awaiting statement with its partner&apos;s bank details.</p>
      </section>
    </div>
  );
}
