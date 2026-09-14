"use client";

import { useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { SuperAdminPartnerCommissionSummaryRow, SuperAdminPartnerDealRow, SuperAdminPartnerRow } from "@/lib/domain/types";
import { PartnerDetailButton } from "./_partner-detail-sheet";
import { agreementSummary, partnerReference } from "./_shared";

export function PartnerRegistryTable({
  partners,
  deals,
  commissionSummary,
  partnerOptions
}: {
  partners: SuperAdminPartnerRow[];
  deals: SuperAdminPartnerDealRow[];
  commissionSummary: SuperAdminPartnerCommissionSummaryRow[];
  partnerOptions: Array<{ label: string; value: string }>;
}) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All regions");
  const [status, setStatus] = useState("All statuses");

  const commissionByPartner = new Map(commissionSummary.map((row) => [row.partnerId, row]));
  const dealsByPartner = new Map<string, SuperAdminPartnerDealRow[]>();
  for (const deal of deals) {
    const list = dealsByPartner.get(deal.partnerId) ?? [];
    list.push(deal);
    dealsByPartner.set(deal.partnerId, list);
  }

  const regionOptions = useMemo(
    () => ["All regions", ...Array.from(new Set(partners.map((partner) => partner.territory).filter((value): value is string => Boolean(value)))).sort()],
    [partners]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter((partner) => {
      const code = partnerReference(partner.id);
      const matchesSearch =
        !q ||
        partner.name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        (partner.territory ?? "").toLowerCase().includes(q);
      const matchesRegion = region === "All regions" || partner.territory === region;
      const matchesStatus = status === "All statuses" || (status === "Active" ? partner.isActive : !partner.isActive);
      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [partners, search, region, status]);

  return (
    <TableCard
      title="Partner registry"
      description="Every partner carries a permanent reference code. A school arriving with that code maps to the partner without anyone typing a name."
      items={filtered}
      emptyState="No partners match this filter."
      getRowKey={(partner) => partner.id}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a partner, code or region" }}
          filters={[
            { label: "Type", value: "Not tracked" },
            { label: "Region", value: region, options: regionOptions.map((value) => ({ label: value, value })), onChange: setRegion },
            { label: "Status", value: status, options: ["All statuses", "Active", "Inactive"].map((value) => ({ label: value, value })), onChange: setStatus }
          ]}
          note={`${filtered.length} of ${partners.length} shown`}
        />
      }
      columns={[
        {
          key: "name",
          header: "Partner",
          render: (partner) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{partner.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {partnerReference(partner.id)} · Tier not tracked · since {formatDate(partner.createdAt)}
              </p>
            </div>
          )
        },
        { key: "type", header: "Type", render: () => <span className="text-[var(--color-text-muted)]">Not categorized</span> },
        { key: "territory", header: "Region", render: (partner) => partner.territory ?? "Not recorded" },
        { key: "dealCount", header: "Schools", render: (partner) => partner.dealCount },
        {
          key: "accrued",
          header: "Accrued",
          render: (partner) => <span className="font-bold text-[var(--color-text-primary)]">{formatCurrency(commissionByPartner.get(partner.id)?.totalCommissionOwed ?? 0)}</span>,
          sortValue: (partner) => commissionByPartner.get(partner.id)?.totalCommissionOwed ?? 0
        },
        {
          key: "agreement",
          header: "Agreement",
          render: (partner) => agreementSummary(partner.agreementReference, partner.agreementValidTo)
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
        },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (partner) => (
            <PartnerDetailButton
              partner={partner}
              deals={dealsByPartner.get(partner.id) ?? []}
              commission={commissionByPartner.get(partner.id)}
              partnerOptions={partnerOptions}
            />
          )
        }
      ]}
    />
  );
}
