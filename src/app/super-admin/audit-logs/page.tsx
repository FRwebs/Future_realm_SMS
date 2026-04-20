import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminAuditLogRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function SuperAdminAuditLogsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const key of ["action", "schoolId", "dateFrom", "dateTo", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<SuperAdminAuditLogRow[]>(`/api/super-admin/audit-logs?${query.toString()}`);
  const logs = envelope.data ?? [];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Compliance trail</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Audit Logs</h1>
          </div>
          <a href={`/api/super-admin/audit-logs/export?${query.toString()}`} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Export CSV</a>
        </div>
      </section>

      <FilterToolbar
        action="/super-admin/audit-logs"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "action", label: "Action type", type: "search", placeholder: "SUSPEND, LOGIN, UPDATE", defaultValue: params.action },
          { name: "schoolId", label: "School ID", type: "search", placeholder: "Optional school ID", defaultValue: params.schoolId },
          { name: "dateFrom", label: "Date from", type: "date", defaultValue: params.dateFrom },
          { name: "dateTo", label: "Date to", type: "date", defaultValue: params.dateTo }
        ]}
      />

      <TableCard
        title="Platform audit trail"
        description={`${envelope.pagination?.total ?? logs.length} event(s) found.`}
        items={logs}
        columns={[
          { key: "timestamp", header: "Timestamp", render: (item) => formatDate(item.timestamp) },
          { key: "admin", header: "Super Admin", render: (item) => item.superAdmin },
          { key: "action", header: "Action", render: (item) => item.action.replaceAll("_", " ") },
          { key: "target", header: "Target", render: (item) => item.target },
          { key: "details", header: "Details", render: (item) => item.schoolName ?? "Platform" }
        ]}
      />
    </div>
  );
}
