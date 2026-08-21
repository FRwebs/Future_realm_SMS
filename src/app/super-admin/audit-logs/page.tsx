import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminAuditLogRow, SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const actionOptions = [
  { label: "Any action", value: "" },
  ...["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "APPROVE", "REJECT", "PAYMENT", "SUSPEND", "ACTIVATE", "RESET_PASSWORD", "IMPERSONATE", "SETTINGS_UPDATE", "BILLING_UPDATE"].map((value) => ({
    label: value.replaceAll("_", " "),
    value
  }))
];

function actionTone(action: string) {
  if (["SUSPEND", "DELETE", "REJECT"].includes(action)) return { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
  if (["ACTIVATE", "APPROVE", "PAYMENT"].includes(action)) return { bg: "var(--color-success-dim)", fg: "var(--color-success)" };
  if (["RESET_PASSWORD", "IMPERSONATE", "SETTINGS_UPDATE", "BILLING_UPDATE"].includes(action)) return { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
  return { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" };
}

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function DetailsPreview({ details }: { details: unknown }) {
  if (details === null || details === undefined) return <span className="text-[var(--color-text-muted)]">—</span>;
  if (typeof details === "object" && Object.keys(details as object).length === 0) return <span className="text-[var(--color-text-muted)]">—</span>;
  const text = typeof details === "string" ? details : JSON.stringify(details);
  return <span className="line-clamp-2 max-w-xs font-[var(--font-mono)] text-[11px] text-[var(--color-text-secondary)]">{text}</span>;
}

export default async function SuperAdminAuditLogsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const key of ["action", "schoolId", "dateFrom", "dateTo", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const [envelope, schoolsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminAuditLogRow[]>(`/api/super-admin/audit-logs?${query.toString()}`),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const logs = envelope.data ?? [];
  const schoolOptions = [
    { label: "Any school", value: "" },
    ...(schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }))
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1] flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Compliance trail</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Audit Logs</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
              Every significant action taken on the platform, logged here immutably — who did what, to what, and
              when. This is the accountability layer behind every other module.
            </p>
          </div>
          <a href={`/api/super-admin/audit-logs/export?${query.toString()}`} className="btn-secondary shrink-0">
            Export CSV
          </a>
        </div>
      </section>

      <FilterToolbar
        action="/super-admin/audit-logs"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "action", label: "Action type", type: "select", defaultValue: params.action ?? "", options: actionOptions },
          { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: schoolOptions },
          { name: "dateFrom", label: "Date from", type: "date", defaultValue: params.dateFrom },
          { name: "dateTo", label: "Date to", type: "date", defaultValue: params.dateTo }
        ]}
      />

      <TableCard
        title="Platform audit trail"
        description={`${envelope.pagination?.total ?? logs.length} event(s) found, most recent first.`}
        items={logs}
        emptyState="No audit events match the current filters."
        columns={[
          { key: "timestamp", header: "Timestamp", render: (item) => formatDate(item.timestamp) },
          { key: "admin", header: "Super Admin", render: (item) => item.superAdmin },
          {
            key: "action",
            header: "Action",
            render: (item) => {
              const tone = actionTone(item.action);
              return <StatusPill bg={tone.bg} fg={tone.fg} label={item.action.replaceAll("_", " ")} />;
            }
          },
          { key: "target", header: "Target", render: (item) => <span className="font-[var(--font-mono)] text-[12px]">{item.target}</span> },
          { key: "school", header: "School", render: (item) => item.schoolName ?? "Platform" },
          { key: "details", header: "Details", render: (item) => <DetailsPreview details={item.details} /> }
        ]}
      />
    </div>
  );
}
