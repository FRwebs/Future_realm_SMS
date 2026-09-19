import {
  BadgeCheck,
  Clock3,
  FileCheck2,
  Handshake,
  Landmark,
  Link2,
  PiggyBank,
  ShieldCheck,
  Undo2,
  WalletCards
} from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminPartnerCommissionSummaryRow,
  SuperAdminPartnerDealRow,
  SuperAdminPartnerRow,
  SuperAdminSchoolRow
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { PartnerRegistryTable } from "./_partner-registry-table";
import {
  compactCurrency,
  dealFormFields,
  dealStatusTone,
  daysUntil,
  flowToneStyle,
  formatPercent,
  tierLabels
} from "./_shared";

function FlowSteps({ title, sub, steps }: { title: string; sub: string; steps: Array<{ label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" }> }) {
  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[14px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function tabHref(tab: string) {
  return tab === "partners" ? "/super-admin/partners" : `/super-admin/partners?tab=${tab}`;
}

async function loadContext() {
  const [partnersEnvelope, dealsEnvelope, commissionEnvelope, schoolsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminPartnerRow[]>("/api/super-admin/partners"),
    apiGetEnvelope<SuperAdminPartnerDealRow[]>("/api/super-admin/partners/deals"),
    apiGetEnvelope<SuperAdminPartnerCommissionSummaryRow[]>("/api/super-admin/partners/commission-summary"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);

  return {
    partners: partnersEnvelope.data ?? [],
    deals: dealsEnvelope.data ?? [],
    commissionSummary: commissionEnvelope.data ?? [],
    schools: schoolsEnvelope.data ?? []
  };
}

export default async function PartnersPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const activeTab =
    params.tab === "registrations" ? "registrations" :
    params.tab === "commission" ? "commission" :
    params.tab === "statements" ? "statements" : "partners";

  const { partners, deals, commissionSummary, schools } = await loadContext();

  const registeredDeals = deals.filter((deal) => deal.status === "REGISTERED");
  const registrationDeals = deals.filter((deal) => deal.status === "REGISTERED" || deal.status === "EXPIRED");
  const convertedDeals = deals.filter((deal) => deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID");

  const tabs = [
    { label: "Partners", href: tabHref("partners"), active: activeTab === "partners", badge: partners.length },
    { label: "Registrations", href: tabHref("registrations"), active: activeTab === "registrations", badge: registeredDeals.length },
    { label: "Commission", href: tabHref("commission"), active: activeTab === "commission", badge: convertedDeals.length },
    { label: "Statements", href: tabHref("statements"), active: activeTab === "statements" }
  ];

  const partnerOptions = partners.map((partner) => ({ label: partner.name, value: partner.id }));
  const schoolOptions = schools.map((school) => ({ label: school.name, value: school.id }));

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Schools & Revenue"
        title="Partners & Commission"
        description="Attribution before introductions, commission on money received."
        action={
          activeTab === "registrations" ? (
            <ResourceActionDialog
              triggerLabel="Register a deal"
              title="Register a partner deal"
              description="Log a school introduction from a referral partner. The deal stays open for 90 days before it expires."
              endpoint="/api/super-admin/partners/deals"
              submitLabel="Register deal"
              variant="heroWhite"
              fields={dealFormFields(partnerOptions)}
            />
          ) : (
            <ResourceActionDialog
              triggerLabel="Register partner"
              title="Register a partner"
              description="A partner is an organisation, a named person who answers for it, an agreement, and a code — checked below against what this form actually captures today."
              endpoint="/api/super-admin/partners"
              submitLabel="Register partner"
              variant="heroWhite"
              fields={[
                { name: "name", label: "Registered / trading name", required: true, placeholder: "e.g. GSR Education Partners", section: "The organisation" },
                { name: "partnerType", label: "Partner type", type: "static", placeholder: "Not tracked", note: "No partner-type field exists — Reseller, Consultant, Association, NGO and Individual agent are not distinguished.", section: "The organisation" },
                { name: "regNumber", label: "CAC / registration number", type: "static", placeholder: "Not tracked", note: "Not captured anywhere on a partner record.", section: "The organisation" },
                { name: "tin", label: "Tax identification number", type: "static", placeholder: "Not tracked", note: "Not captured anywhere on a partner record.", section: "The organisation" },
                { name: "territory", label: "Territory", placeholder: "e.g. Lagos, Ogun", section: "Where they may operate" },
                { name: "partnerTier", label: "Partner tier", type: "static", placeholder: "Not tracked", note: "No tier field exists — commission band comes only from the rate below, not a named tier.", section: "Where they may operate" },
                { name: "referenceCode", label: "Reference code", type: "static", placeholder: "Issued automatically on save", note: "Real — every partner gets a permanent reference code derived from its record once created; it's shown in the registry.", section: "Where they may operate" },
                { name: "_primaryContact", label: "Primary contact — signs and is answerable", type: "static", placeholder: "Not captured", note: "Not built — no contact-person fields exist on a partner record at all, so nobody is named as accountable.", section: "People" },
                { name: "_opsContact", label: "Day-to-day contact — answers operationally", type: "static", placeholder: "Not captured", note: "Not built — same gap as above.", section: "People" },
                { name: "_partnerManager", label: "Partner manager inside Nooria", type: "static", placeholder: "Not captured", note: "Not built — no internal owner is assigned to a partner.", section: "People" },
                { name: "agreementReference", label: "Agreement reference", placeholder: "e.g. v2.1 · standard reseller", section: "Agreement" },
                { name: "commissionRatePercent", label: "Commission rate (%)", type: "number", defaultValue: 20, min: 0, max: 100, step: 0.5, note: "Real, but flat — this rate applies for as long as the partner exists; there's no year-1/year-2/year-3 step-down.", section: "Agreement" },
                { name: "agreementValidTo", label: "Agreement end", type: "date", section: "Agreement" },
                { name: "_registrationWindow", label: "Registration window per school", type: "static", placeholder: "90 days, fixed", note: "Real — every deal this partner registers is valid for exactly 90 days; not configurable per partner.", section: "Agreement" },
                { name: "_minPerformance", label: "Minimum performance condition", type: "static", placeholder: "Not tracked", note: "No minimum-performance rule is enforced or evaluated for any partner (see Partners → Partner performance).", section: "Agreement" },
                { name: "_bank", label: "Bank account for settlement", type: "static", placeholder: "Not captured", note: "Not built — no bank or account details are held on a partner record; payouts are tracked as commission-owed figures only.", section: "Where commission is paid" },
                { name: "_countersigned", label: "Countersigned agreement", type: "static", placeholder: "Not captured", note: "Not built — there's no file upload or signed-status field on a partner record.", section: "Signed paperwork" },
                { name: "_emailInvite", label: "Email the login invitation now", type: "toggle", disabled: true, section: "Portal access" },
                { name: "_copyOpsLogin", label: "Copy the day-to-day contact", type: "toggle", disabled: true, section: "Portal access" },
                {
                  name: "_require2fa",
                  label: "Require two-factor authentication",
                  type: "toggle",
                  disabled: true,
                  note: "Not built — there is no partner login at all yet, so nothing here can actually be turned on.",
                  section: "Portal access"
                }
              ]}
            />
          )
        }
      />

      <DetailTabs tabs={tabs} />

      {activeTab === "partners" ? (
        <PartnersTab partners={partners} deals={deals} commissionSummary={commissionSummary} schools={schools} partnerOptions={partnerOptions} />
      ) : null}
      {activeTab === "registrations" ? <RegistrationsTab deals={registrationDeals} schoolOptions={schoolOptions} /> : null}
      {activeTab === "commission" ? <CommissionTab deals={convertedDeals} /> : null}
      {activeTab === "statements" ? <StatementsTab commissionSummary={commissionSummary} /> : null}
    </div>
  );
}

function PartnersTab({
  partners,
  deals,
  commissionSummary,
  schools,
  partnerOptions
}: {
  partners: SuperAdminPartnerRow[];
  deals: SuperAdminPartnerDealRow[];
  commissionSummary: SuperAdminPartnerCommissionSummaryRow[];
  schools: SuperAdminSchoolRow[];
  partnerOptions: Array<{ label: string; value: string }>;
}) {
  const activePartners = partners.filter((partner) => partner.isActive).length;
  const totalAccrued = commissionSummary.reduce((sum, row) => sum + row.totalCommissionOwed, 0);
  const totalPaid = commissionSummary.reduce((sum, row) => sum + row.totalCommissionPaid, 0);

  const schoolStatusById = new Map(schools.map((school) => [school.id, school.status]));
  const performanceRows = partners
    .map((partner) => {
      const partnerDeals = deals.filter((deal) => deal.partnerId === partner.id);
      const converted = partnerDeals.filter((deal) => deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID");
      const stillActive = converted.filter((deal) => deal.schoolId && schoolStatusById.get(deal.schoolId) === "ACTIVE").length;
      return {
        partnerId: partner.id,
        partnerName: partner.name,
        registered: partnerDeals.length,
        converted: converted.length,
        conversionPct: partnerDeals.length ? Math.round((converted.length / partnerDeals.length) * 1000) / 10 : null,
        retentionPct: converted.length ? Math.round((stillActive / converted.length) * 1000) / 10 : null
      };
    })
    .filter((row) => row.registered > 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Partners on the registry" value={partners.length} detail={`${activePartners} active`} icon={Handshake} tone="dark" />
        <StatCard label="Attributed schools" value={deals.length} detail="Every introduction ever logged" icon={Link2} tone="info" />
        <StatCard label="Commission liability accrued" value={compactCurrency(totalAccrued)} detail={formatCurrency(totalAccrued)} icon={PiggyBank} tone="success" />
        <StatCard label="Commission settled (to date)" value={compactCurrency(totalPaid)} detail={formatCurrency(totalPaid)} icon={BadgeCheck} tone="info" />
        <StatCard label="Clawbacks this term" value="N/A" detail="Not tracked — this system has no clawback or commission-reversal concept." icon={Undo2} tone="neutral" />
      </section>

      <PartnerRegistryTable partners={partners} deals={deals} commissionSummary={commissionSummary} partnerOptions={partnerOptions} />

      <TableCard
        title="Partner performance"
        description="Retention of partner-sourced schools against direct-sourced is the number that reveals whether a channel is producing customers or merely signatures — computed live from real deals and school records, not a fixed report."
        items={performanceRows}
        emptyState="No partner has a registered deal yet."
        getRowKey={(row) => row.partnerId}
        columns={[
          { key: "partner", header: "Partner", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.partnerName}</span> },
          { key: "registered", header: "Registered", render: (row) => row.registered },
          { key: "converted", header: "Converted", render: (row) => row.converted },
          { key: "conversion", header: "Conversion", render: (row) => (row.conversionPct === null ? "—" : `${row.conversionPct}%`) },
          {
            key: "retention",
            header: "Converted schools still active",
            render: (row) => (row.retentionPct === null ? "—" : `${row.retentionPct}%`)
          },
          { key: "tickets", header: "Tickets / 100 schools", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
          { key: "condition", header: "Condition", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> }
        ]}
        footnote="“Converted schools still active” is a real but different measure from a true second-term retention cohort — it checks each converted school's current status, not whether it specifically renewed into a second term. Tickets/100 and a minimum-performance condition aren't tracked anywhere in this system; no partner has ever been flagged or reviewed on performance."
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
          <p className="text-[14px] font-semibold text-[#0D2315]">How commission actually accrues here</p>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-text-muted)]">Encoded in the accrual engine, not in the agreement text — recomputed live every time it's viewed, never stored.</p>
          <div className="mt-4 grid gap-3">
            {[
              { label: "Commission accrues on reconciled revenue only", sub: "An invoice or a recorded payment accrues nothing until it matches a reconciled billing transaction.", tone: "bad" as const },
              { label: "The rate is locked in when the deal is registered", sub: "From the partner's default rate, or a one-time override — it never changes after the fact.", tone: "warn" as const },
              { label: "Commission is computed on the amount actually collected", sub: "Summed straight from the school's own reconciled transactions, not a list price.", tone: "good" as const }
            ].map((rule) => (
              <div key={rule.label} className="flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3" style={{ borderColor: flowToneStyle[rule.tone].bd, background: flowToneStyle[rule.tone].bg }}>
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: flowToneStyle[rule.tone].fg }} />
                <div>
                  <p className="text-[12px] font-bold" style={{ color: flowToneStyle[rule.tone].fg }}>{rule.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-text-secondary)]">{rule.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
          <p className="text-[14px] font-semibold text-[#0D2315]">What this system doesn't do yet</p>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-text-muted)]">Said plainly, so nobody promises a partner something that isn't built.</p>
          <div className="mt-4 grid gap-3">
            {[
              "No clawback mechanism — a reversed or refunded payment does not currently reduce commission already marked accrued.",
              "No per-partner login — a partner cannot see their own schools or statements without a Super Admin sending the figures manually.",
              "No relationship-year rate decay — a deal's commission rate is flat for as long as the deal exists; it doesn't step down over time."
            ].map((note) => (
              <div key={note} className="flex items-start gap-2.5 rounded-[10px] border border-[var(--color-border-muted)] bg-[var(--color-bg-subtle)] px-3.5 py-3">
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-text-muted)]" />
                <p className="text-[11.5px] leading-snug text-[var(--color-text-secondary)]">{note}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function RegistrationsTab({
  deals,
  schoolOptions
}: {
  deals: SuperAdminPartnerDealRow[];
  schoolOptions: Array<{ label: string; value: string }>;
}) {
  const expiringSoon = deals.filter((deal) => deal.status === "REGISTERED" && daysUntil(deal.validUntil) >= 0 && daysUntil(deal.validUntil) <= 14).length;
  const withEvidence = deals.filter((deal) => Boolean(deal.introductionEvidence?.trim())).length;
  const tiered = deals.filter((deal) => Boolean(deal.expectedTier)).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Registered introductions" value={deals.length} detail="Before conversion" icon={Link2} tone="dark" />
        <StatCard label="Expiring soon" value={expiringSoon} detail="14 days or less" icon={Clock3} tone={expiringSoon ? "warning" : "neutral"} />
        <StatCard label="Evidence attached" value={withEvidence} detail={`${deals.length - withEvidence} missing`} icon={FileCheck2} tone="success" />
        <StatCard label="Tier forecast" value={tiered} detail="Expected plan known" icon={ShieldCheck} tone="info" />
      </section>

      <FlowSteps
        title="Deal registration — attribution is established before the introduction"
        sub="Never argued about afterwards. This is the mechanism that prevents the most damaging partner dispute: two parties claiming the same school."
        steps={[
          { label: "Partner registers a prospect", note: "Name, location, contact, expected size" },
          { label: "Duplicate and conflict check", note: "Automatic, on submission" },
          { label: "Registered", note: "Valid 90 days · visible to both parties", tone: "good" },
          { label: "School signs up in window", note: "Attribution written to the school record" },
          { label: "Commission eligible", note: "From the first reconciled invoice", tone: "ink" }
        ]}
      />

      <PartnerDealsTable deals={deals} schoolOptions={schoolOptions} />
    </div>
  );
}

function CommissionTab({ deals }: { deals: SuperAdminPartnerDealRow[] }) {
  const totalRevenue = deals.reduce((sum, deal) => sum + deal.grossRevenue, 0);
  const totalOwed = deals.reduce((sum, deal) => sum + deal.commissionOwed, 0);
  const pendingDeals = deals.filter((deal) => deal.status === "CONVERTED");
  const paidDeals = deals.filter((deal) => deal.status === "COMMISSION_PAID");
  const pendingOwed = pendingDeals.reduce((sum, deal) => sum + deal.commissionOwed, 0);
  const paidOwed = paidDeals.reduce((sum, deal) => sum + deal.commissionOwed, 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Reconciled revenue" value={compactCurrency(totalRevenue)} detail={formatCurrency(totalRevenue)} icon={Landmark} tone="dark" />
        <StatCard label="Commission accrued" value={compactCurrency(totalOwed)} detail={formatCurrency(totalOwed)} icon={PiggyBank} tone="success" />
        <StatCard label="Pending payout" value={compactCurrency(pendingOwed)} detail={`${pendingDeals.length} deal${pendingDeals.length === 1 ? "" : "s"}`} icon={WalletCards} tone="warning" />
        <StatCard label="Paid statements" value={compactCurrency(paidOwed)} detail={`${paidDeals.length} settled`} icon={BadgeCheck} tone="info" />
      </section>

      <FlowSteps
        title="Commission accrual — reconciliation is the only trigger"
        sub="The whole design exists to make reconciliation, not invoicing, the event that means something."
        steps={[
          { label: "Invoice issued", note: "No commission. An invoice is not income.", tone: "bad" },
          { label: "Payment recorded", note: "Still none — someone told us money arrived", tone: "bad" },
          { label: "Payment reconciled", note: "Matched to a bank statement line", tone: "warn" },
          { label: "Deal converted", note: "Deal linked to the real school tenant" },
          { label: "Rate resolved", note: "From the deal's own rate override, or the partner default" },
          { label: "Accrued", note: "Commission owed, visible in statements", tone: "ink" }
        ]}
      />

      <CommissionTable deals={deals} />

      <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
        <p className="text-[14px] font-semibold text-[#0D2315]">Rate resolution inputs — what actually decides the number</p>
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-text-muted)]">Checked against the real accrual code, not asserted as a fixed rule.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Stream", sub: "Real, but manually entered — a free-text field set when the deal is registered, not auto-derived from an invoice type.", tone: "warn" as const },
            { label: "Partner agreement version", sub: "Not tracked — a partner's agreement is one free-text reference with no version history.", tone: "bad" as const },
            { label: "Relationship year", sub: "Not tracked — a deal's commission rate is flat for as long as it exists; there's no year-based decay.", tone: "bad" as const },
            { label: "Amount actually collected", sub: "Real — commission is computed straight from the school's own reconciled billing transactions, never a list price.", tone: "good" as const }
          ].map((rule) => (
            <div key={rule.label} className="flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3" style={{ borderColor: flowToneStyle[rule.tone].bd, background: flowToneStyle[rule.tone].bg }}>
              <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: flowToneStyle[rule.tone].fg }} />
              <div>
                <p className="text-[12px] font-bold" style={{ color: flowToneStyle[rule.tone].fg }}>{rule.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-text-secondary)]">{rule.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatementsTab({ commissionSummary }: { commissionSummary: SuperAdminPartnerCommissionSummaryRow[] }) {
  const statementRows = commissionSummary.flatMap((partner) =>
    partner.statements.map((statement) => ({ ...statement, partnerName: partner.partnerName }))
  );

  return (
    <div className="grid gap-5">
      <TableCard
        title="Statements of account"
        description="Issued whether or not the amount is positive, so that a zero period is a statement rather than a silence."
        items={commissionSummary}
        emptyState="No commission has accrued yet. Statements appear once a deal converts and the linked school has reconciled payments."
        getRowKey={(partner) => partner.partnerId}
        footnote="There's no bulk settle, re-send, or export action here — the only real way to record a payout is Commission → Mark commission paid, one deal at a time."
        columns={[
          {
            key: "partnerName",
            header: "Partner",
            render: (partner) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{partner.partnerName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{partner.territory ?? "No territory recorded"}</p>
              </div>
            )
          },
          { key: "convertedDealCount", header: "Converted deals", render: (partner) => partner.convertedDealCount },
          { key: "totalCommissionOwed", header: "Total accrued", render: (partner) => formatCurrency(partner.totalCommissionOwed) },
          {
            key: "totalCommissionPaid",
            header: "Paid",
            render: (partner) => <span style={{ color: "var(--color-success)" }}>{formatCurrency(partner.totalCommissionPaid)}</span>
          },
          {
            key: "totalCommissionPending",
            header: "Pending",
            render: (partner) => <span style={{ color: "var(--color-warning)" }}>{formatCurrency(partner.totalCommissionPending)}</span>
          }
        ]}
      />

      <TableCard
        title="Statement detail — by partner and school"
        items={statementRows}
        emptyState="No statement lines yet."
        getRowKey={(row) => row.dealId}
        columns={[
          { key: "partnerName", header: "Partner", render: (row) => row.partnerName },
          { key: "schoolName", header: "School", render: (row) => row.schoolName },
          { key: "commissionRatePercent", header: "Rate", render: (row) => `${row.commissionRatePercent}%` },
          { key: "grossRevenue", header: "Reconciled revenue", render: (row) => formatCurrency(row.grossRevenue) },
          { key: "commissionOwed", header: "Commission", render: (row) => formatCurrency(row.commissionOwed) },
          {
            key: "status",
            header: "Status",
            render: (row) => {
              const tone = dealStatusTone[row.status] ?? dealStatusTone.CONVERTED;
              return (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                  {tone.label}
                </span>
              );
            }
          }
        ]}
      />
    </div>
  );
}

function PartnerDealsTable({
  deals,
  schoolOptions
}: {
  deals: SuperAdminPartnerDealRow[];
  schoolOptions: Array<{ label: string; value: string }>;
}) {
  return (
    <TableCard
      title="Registered deals"
      description="First valid registration wins, and the rule is visible to every party in advance."
      items={deals}
      emptyState="No deals registered yet. Use the Register a deal action above to log a partner introduction."
      getRowKey={(deal) => deal.id}
      columns={[
        {
          key: "prospectSchoolName",
          header: "Prospect school",
          render: (deal) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{deal.prospectSchoolName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{deal.prospectLocation ?? "Location not recorded"}</p>
            </div>
          )
        },
        { key: "partnerName", header: "Partner", render: (deal) => deal.partnerName },
        { key: "expectedTier", header: "Expected tier", render: (deal) => (deal.expectedTier ? tierLabels[deal.expectedTier] ?? deal.expectedTier : "Not specified") },
        { key: "registeredAt", header: "Registered", render: (deal) => formatDate(deal.registeredAt) },
        {
          key: "validUntil",
          header: "Expires in",
          render: (deal) => {
            const days = daysUntil(deal.validUntil);
            return (
              <span className="font-semibold" style={{ color: days <= 14 ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                {days > 0 ? `${days} day(s)` : "Expired"}
              </span>
            );
          },
          sortValue: (deal) => new Date(deal.validUntil).getTime()
        },
        {
          key: "status",
          header: "Status",
          render: (deal) => {
            const tone = dealStatusTone[deal.status] ?? dealStatusTone.REGISTERED;
            return (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                {tone.label}
              </span>
            );
          }
        },
        {
          key: "actions",
          header: "Actions",
          sortable: false,
          render: (deal) =>
            deal.status !== "REGISTERED" ? (
              <span className="text-[12px] text-[var(--color-text-muted)]">—</span>
            ) : (
            <ActionMenu triggerLabel={`Actions for ${deal.prospectSchoolName}`}>
              <ResourceActionDialog
                triggerLabel="Mark converted"
                title={`Mark converted — ${deal.prospectSchoolName}`}
                description="Link this deal to the real school tenant it converted into. Commission is then computed live from that school's reconciled billing transactions."
                endpoint={`/api/super-admin/partners/deals/${deal.id}/convert`}
                method="PATCH"
                variant="menu"
                submitLabel="Confirm conversion"
                fields={[{ name: "schoolId", label: "Converted school", type: "select", required: true, options: schoolOptions }]}
              />
              <ResourceActionDialog
                triggerLabel="Mark expired"
                title={`Mark expired — ${deal.prospectSchoolName}`}
                description="This closes the deal without a conversion. It can no longer be linked to a school."
                endpoint={`/api/super-admin/partners/deals/${deal.id}/expire`}
                method="PATCH"
                variant="menuDanger"
                submitLabel="Mark expired"
                confirmLabel="Confirm"
                confirmMessage="This permanently closes the deal as expired."
                fields={[]}
              />
            </ActionMenu>
          )
        }
      ]}
    />
  );
}

function CommissionTable({ deals }: { deals: SuperAdminPartnerDealRow[] }) {
  return (
    <TableCard
      title="Commission accruals"
      description="Every line traceable to a converted deal and its school's reconciled billing."
      items={deals}
      emptyState="No deals have converted yet. Commission appears here once a registered deal is linked to a real school."
      getRowKey={(deal) => deal.id}
      columns={[
        {
          key: "schoolName",
          header: "School",
          render: (deal) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{deal.schoolName ?? deal.prospectSchoolName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Converted {deal.convertedAt ? formatDate(deal.convertedAt) : "—"}</p>
            </div>
          )
        },
        { key: "partnerName", header: "Partner", render: (deal) => deal.partnerName },
        { key: "stream", header: "Stream", render: (deal) => deal.stream ?? "Not recorded" },
        { key: "commissionRatePercent", header: "Rate", render: (deal) => formatPercent(deal.commissionRatePercent) },
        { key: "grossRevenue", header: "Reconciled revenue", render: (deal) => formatCurrency(deal.grossRevenue) },
        {
          key: "commissionOwed",
          header: "Commission owed",
          render: (deal) => <span className="font-bold text-[var(--color-text-primary)]">{formatCurrency(deal.commissionOwed)}</span>
        },
        {
          key: "status",
          header: "Status",
          render: (deal) => {
            const tone = dealStatusTone[deal.status] ?? dealStatusTone.CONVERTED;
            return (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                {tone.label}
              </span>
            );
          }
        },
        {
          key: "actions",
          header: "Actions",
          sortable: false,
          render: (deal) =>
            deal.status === "CONVERTED" ? (
              <ResourceActionDialog
                triggerLabel="Mark commission paid"
                title={`Mark commission paid — ${deal.schoolName ?? deal.prospectSchoolName}`}
                description={`Records that ${formatCurrency(deal.commissionOwed)} owed to ${deal.partnerName} has been paid out.`}
                endpoint={`/api/super-admin/partners/deals/${deal.id}/commission-paid`}
                method="PATCH"
                variant="secondary"
                submitLabel="Confirm payout"
                fields={[]}
              />
            ) : (
              <span className="text-[12px] text-[var(--color-text-muted)]">Paid</span>
            )
        }
      ]}
    />
  );
}
