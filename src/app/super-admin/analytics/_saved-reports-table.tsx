"use client";

import { ReactNode, useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { formatDate } from "@/lib/utils/formatters";

import { ReportRun } from "./_report-run";

interface SavedReportsTableProps {
  items: Array<{ id: string; name: string; dimension: string; metric: string; generatedAt?: string; createdAt: string; question?: string | null; groupName?: string | null; periodDays?: number | null; compare?: boolean; suppressUnder?: number | null; lockFilters?: boolean; frequency?: string | null; recipients?: string[]; lastSentAt?: string | null; createdBy?: string }>;
  actions: ReactNode;
}

export function SavedReportsTable({ items, actions }: SavedReportsTableProps) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All groups");
  const [schedule, setSchedule] = useState("Any");

  const groups = useMemo(() => ["All groups", ...Array.from(new Set(items.map((item) => item.groupName).filter((g): g is string => Boolean(g)))).sort()], [items]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => (!q || item.name.toLowerCase().includes(q)) && (group === "All groups" || item.groupName === group) && (schedule === "Any" || (schedule === "Scheduled" ? Boolean(item.frequency) : !item.frequency)));
  }, [items, search, group, schedule]);

  return (
    <TableCard
      title="Saved report templates"
      items={filtered}
      pageSize={false}
      getRowKey={(item) => item.id}
      emptyState="No saved reports yet. Build one to start tracking a metric over time."
      actions={actions}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a saved template" }}
          filters={[
            { label: "Group", value: group, options: groups.map((value) => ({ label: value, value })), onChange: setGroup },
            { label: "Schedule", value: schedule, options: ["Any", "Scheduled", "On demand"].map((value) => ({ label: value, value })), onChange: setSchedule }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "name", header: "Template", render: (item) => <div><p className="font-bold text-[var(--color-text-primary)]">{item.name}</p>{item.question ? <p className="text-[11px] text-[var(--color-text-muted)]">{item.question}</p> : null}{item.groupName ? <p className="text-[10.5px] text-[var(--color-text-muted)]">{item.groupName}</p> : null}</div>, sortValue: (item) => item.name },
        { key: "filters", header: "Filters", render: (item) => <span className="text-[11px] text-[var(--color-text-secondary)]">{item.metric} · grouped by {item.dimension}{item.periodDays ? ` · joined in last ${item.periodDays}d${item.compare ? " vs before" : ""}` : ""}{item.suppressUnder ? ` · groups under ${item.suppressUnder} withheld` : ""}{item.lockFilters ? " · locked" : ""}</span> },
        { key: "format", header: "Delivery", render: (item) => <div className="text-[11px] text-[var(--color-text-secondary)]"><p>CSV on download</p>{item.frequency ? <p>{item.frequency.toLowerCase()} to {item.recipients?.length ?? 0} recipient{item.recipients?.length === 1 ? "" : "s"}{item.lastSentAt ? ` · last sent ${formatDate(item.lastSentAt)}` : " · not sent yet"}</p> : <p className="text-[var(--color-text-muted)]">On demand</p>}</div> },
        { key: "created", header: "Last generated", render: (item) => (item.generatedAt ? formatDate(item.generatedAt) : formatDate(item.createdAt)), sortValue: (item) => item.generatedAt ?? item.createdAt },
        { key: "run", header: "", render: (item) => <div className="flex items-center gap-3"><ReportRun id={item.id} name={item.name} /><a href={`/api/super-admin/analytics-bi/reports/${item.id}/export`} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">CSV</a></div> }
      ]}
    />
  );
}
