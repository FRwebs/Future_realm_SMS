"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

import type { AuditLogView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";
import {
  FinanceDataTable,
  FinancePageHeader,
  FinancePanel,
} from "@/components/finance/finance-studio-ui";

type Props = {
  logs: AuditLogView[];
};

export function FinanceAuditStudio({ logs }: Props) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("ALL");
  const [page, setPage] = useState(1);

  const entities = useMemo(
    () => Array.from(new Set(logs.map((log) => log.entityType))).sort((a, b) => a.localeCompare(b)),
    [logs],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesQuery =
        !normalized ||
        [
          log.userName ?? "",
          log.action,
          log.entityType,
          log.entityId,
          log.detail ?? "",
          log.ipAddress ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesEntity = entity === "ALL" || log.entityType === entity;
      return matchesQuery && matchesEntity;
    });
  }, [entity, logs, query]);

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Audit log"
        title="Trace every sensitive finance action"
        description="Review bursary operations across receipts, reversals, payroll, expenditure, settings, and invoice activity with a clean searchable audit trail."
      />

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <FinancePanel className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="finance-eyebrow">Search & filter</p>
              <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">
                Bursary audit events
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--finance-text-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="finance-field pl-11"
                  placeholder="Search actor, entity, IP, detail..."
                />
              </div>
              <select value={entity} onChange={(event) => setEntity(event.target.value)} className="finance-select min-w-[200px]">
                <option value="ALL">All entities</option>
                {entities.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6">
            <FinanceDataTable
              rows={filtered}
              page={page}
              pageSize={12}
              onPageChange={setPage}
              totalLabel={`${filtered.length} audit events`}
              rowKey={(row) => row.id}
              columns={[
                { key: "when", header: "When", render: (row) => formatDate(row.timestamp) },
                { key: "actor", header: "Actor", render: (row) => row.userName ?? "-" },
                { key: "action", header: "Action", render: (row) => row.action },
                { key: "entity", header: "Entity", render: (row) => row.entityType },
                { key: "detail", header: "Detail", render: (row) => row.detail ?? "-" },
                { key: "ip", header: "IP", render: (row) => row.ipAddress ?? "-" },
              ]}
            />
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <div className="finance-soft-surface rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="finance-icon-surface grid h-10 w-10 place-items-center rounded-2xl">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-[var(--finance-text-primary)]">Audit integrity</p>
                <p className="mt-2 text-sm leading-7 text-[var(--finance-text-secondary)]">
                  This log is the bursary team’s source of truth for who changed what, when it happened, and from where it was performed.
                </p>
              </div>
            </div>
          </div>
        </FinancePanel>
      </section>
    </div>
  );
}
