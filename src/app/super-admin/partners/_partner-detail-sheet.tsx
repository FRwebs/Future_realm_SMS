"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Modal } from "@/components/ui/modal";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { SuperAdminPartnerCommissionSummaryRow, SuperAdminPartnerDealRow, SuperAdminPartnerRow } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { agreementSummary, dealFormFields, dealStatusTone, formatPercent, partnerReference } from "./_shared";

function FactRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
      <p className="text-[12px] text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-right text-[12.5px] ${bold ? "font-bold text-[var(--color-text-primary)]" : "font-medium text-[var(--color-text-secondary)]"}`}>{value}</p>
    </div>
  );
}

function FactBlock({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--color-border-default)] bg-white p-5">
      <p className="text-[13px] font-bold text-[var(--color-text-primary)]">{title}</p>
      {sub ? <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PartnerDetailButton({
  partner,
  deals,
  commission,
  partnerOptions
}: {
  partner: SuperAdminPartnerRow;
  deals: SuperAdminPartnerDealRow[];
  commission?: SuperAdminPartnerCommissionSummaryRow;
  partnerOptions: Array<{ label: string; value: string }>;
}) {
  const [open, setOpen] = useState(false);
  const code = partnerReference(partner.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--color-text-accent)] transition hover:bg-[var(--color-bg-subtle)]"
      >
        Open
        <ExternalLink className="h-3 w-3" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={partner.name}
        subtitle={`${partner.territory ?? "Region not recorded"} · partner since ${formatDate(partner.createdAt)}`}
        size="report"
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#0D2315] px-2.5 py-1 text-[11px] font-bold text-white">{code}</span>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={partner.isActive ? { background: "var(--color-success-dim)", color: "var(--color-success)" } : { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}
            >
              {partner.isActive ? "Active" : "Inactive"}
            </span>
            <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-secondary)]">{partner.dealCount} schools</span>
          </div>

          <FactBlock title="Agreement and money">
            <FactRow label="Reference code" value={code} bold />
            <FactRow label="Agreement" value={agreementSummary(partner.agreementReference, partner.agreementValidTo)} />
            <FactRow label="Commission rate (default)" value={formatPercent(partner.commissionRatePercent)} />
            <FactRow label="Accrued, unsettled" value={formatCurrency(commission?.totalCommissionPending ?? 0)} bold />
            <FactRow label="Settled to date" value={formatCurrency(commission?.totalCommissionPaid ?? 0)} />
          </FactBlock>

          <FactBlock title="Contact and portal access" sub="Not built yet, disclosed here rather than left silent.">
            <FactRow label="Primary contact" value="Not captured — this system has no contact-person field for a partner." />
            <FactRow label="Partner portal" value="Not built — partners have no login of their own to this platform." />
          </FactBlock>

          <FactBlock title="Schools they brought" sub="Every deal ever registered to this partner, regardless of outcome.">
            {deals.length === 0 ? (
              <p className="py-2 text-[12.5px] text-[var(--color-text-muted)]">No schools registered to this partner yet.</p>
            ) : (
              <div className="grid gap-0">
                {deals.map((deal) => {
                  const tone = dealStatusTone[deal.status] ?? dealStatusTone.REGISTERED;
                  return (
                    <div key={deal.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">{deal.schoolName ?? deal.prospectSchoolName}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">Registered {formatDate(deal.registeredAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        {deal.commissionOwed > 0 ? <span className="text-[12px] font-bold text-[var(--color-text-primary)]">{formatCurrency(deal.commissionOwed)}</span> : null}
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                          {tone.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FactBlock>

          <div className="flex flex-wrap items-center gap-2.5">
            <ResourceActionDialog
              triggerLabel="Register a school for them"
              title={`Register a deal — ${partner.name}`}
              description="Log a school introduction for this partner."
              endpoint="/api/super-admin/partners/deals"
              submitLabel="Register deal"
              variant="secondary"
              fields={dealFormFields(partnerOptions, partner.id)}
            />
            <Link href="/super-admin/partners?tab=statements" className="btn-secondary h-9 px-4 text-[12px]">
              View statements of account
            </Link>
          </div>
        </div>
      </Modal>
    </>
  );
}
