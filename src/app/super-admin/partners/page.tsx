import { Building2, Handshake, PiggyBank, ReceiptText } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
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

const expectedTierOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];

const dealStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  REGISTERED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Registered" },
  CONVERTED: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Converted — commission pending" },
  EXPIRED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Expired" },
  COMMISSION_PAID: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Commission paid" }
};

function tabHref(tab: string) {
  return tab === "partners" ? "/super-admin/partners" : `/super-admin/partners?tab=${tab}`;
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
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
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Referral network</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Partners &amp; Commission</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
              Track external referral partners, the school-introduction deals they register, and the commission owed —
              computed live from reconciled billing transactions, never a static figure.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTab === "registrations" ? (
              <ResourceActionDialog
                triggerLabel="Register a deal"
                title="Register a partner deal"
                description="Log a school introduction from a referral partner. The deal stays open for 90 days before it expires."
                endpoint="/api/super-admin/partners/deals"
                submitLabel="Register deal"
                fields={[
                  { name: "partnerId", label: "Partner", type: "select", required: true, options: partnerOptions },
                  { name: "prospectSchoolName", label: "Prospect school name", required: true },
                  { name: "prospectLocation", label: "Location" },
                  { name: "expectedTier", label: "Expected tier", type: "select", options: expectedTierOptions },
                  { name: "stream", label: "Stream / referral channel" },
                  { name: "introductionEvidence", label: "Introduction evidence", type: "textarea", placeholder: "Email thread, call notes, or reference link proving the introduction" }
                ]}
              />
            ) : (
              <ResourceActionDialog
                triggerLabel="Register partner"
                title="Register a referral partner"
                description="Add an external partner who introduces schools to the platform in exchange for commission."
                endpoint="/api/super-admin/partners"
                submitLabel="Register partner"
                fields={[
                  { name: "name", label: "Partner name", required: true },
                  { name: "territory", label: "Territory" },
                  { name: "agreementReference", label: "Agreement reference" },
                  { name: "agreementValidTo", label: "Agreement valid to", type: "date" },
                  { name: "commissionRatePercent", label: "Commission rate (%)", type: "number", defaultValue: 20, min: 0, max: 100, step: 0.5 }
                ]}
              />
            )}
          </div>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {activeTab === "partners" ? <PartnersTab partners={partners} deals={deals} /> : null}
      {activeTab === "registrations" ? <RegistrationsTab deals={registeredDeals} schoolOptions={schoolOptions} /> : null}
      {activeTab === "commission" ? <CommissionTab deals={convertedDeals} /> : null}
      {activeTab === "statements" ? <StatementsTab commissionSummary={commissionSummary} /> : null}
    </div>
  );
}

function PartnersTab({ partners, deals }: { partners: SuperAdminPartnerRow[]; deals: SuperAdminPartnerDealRow[] }) {
  const activePartners = partners.filter((partner) => partner.isActive).length;
  const totalConverted = deals.filter((deal) => deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total partners" value={partners.length} icon={Handshake} tone="accent" />
        <StatCard label="Active partners" value={activePartners} icon={Building2} tone="success" />
        <StatCard label="Total deals" value={deals.length} icon={ReceiptText} tone="info" />
        <StatCard label="Total converted" value={totalConverted} icon={PiggyBank} tone="warning" />
      </section>

      <TableCard
        title="Referral partners"
        description="External partners registered to introduce schools to the platform."
        items={partners}
        emptyState="No partners registered yet. Use the Register partner action above to add the first one."
        getRowKey={(partner) => partner.id}
        columns={[
          {
            key: "name",
            header: "Partner",
            render: (partner) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{partner.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{partner.agreementReference ?? "No agreement reference on file"}</p>
              </div>
            )
          },
          { key: "territory", header: "Territory", render: (partner) => partner.territory ?? "Not recorded" },
          { key: "commissionRatePercent", header: "Commission rate", render: (partner) => `${partner.commissionRatePercent}%` },
          { key: "dealCount", header: "Deals", render: (partner) => partner.dealCount },
          {
            key: "agreementValidTo",
            header: "Agreement valid to",
            render: (partner) => (partner.agreementValidTo ? formatDate(partner.agreementValidTo) : "No expiry on file")
          },
          {
            key: "isActive",
            header: "Status",
            render: (partner) => (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={
                  partner.isActive
                    ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                    : { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }
                }
              >
                {partner.isActive ? "Active" : "Inactive"}
              </span>
            )
          }
        ]}
      />
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
  return (
    <TableCard
      title="Registered deals awaiting conversion"
      description="Prospect schools introduced by partners. A deal expires automatically 90 days after registration unless the school converts."
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
        { key: "expectedTier", header: "Expected tier", render: (deal) => deal.expectedTier ?? "Not specified" },
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
          key: "actions",
          header: "Actions",
          sortable: false,
          render: (deal) => (
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

function CommissionTab({ deals }: { deals: SuperAdminPartnerDealRow[] }) {
  return (
    <TableCard
      title="Commission owed on converted deals"
      description="Computed live on every load: each school's reconciled billing transactions, summed and multiplied by the deal's commission rate."
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
        { key: "commissionRatePercent", header: "Rate", render: (deal) => `${deal.commissionRatePercent}%` },
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

function StatementsTab({ commissionSummary }: { commissionSummary: SuperAdminPartnerCommissionSummaryRow[] }) {
  const statementRows = commissionSummary.flatMap((partner) =>
    partner.statements.map((statement) => ({ ...statement, partnerName: partner.partnerName }))
  );

  return (
    <div className="grid gap-5">
      <TableCard
        title="Commission by partner"
        description="Real commission accrued across every converted deal for each partner, computed live from reconciled billing transactions."
        items={commissionSummary}
        emptyState="No commission has accrued yet. Statements appear once a deal converts and the linked school has reconciled payments."
        getRowKey={(partner) => partner.partnerId}
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
        description="Every converted deal's underlying reconciled revenue and computed commission, for reconciliation with partner payout statements."
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
