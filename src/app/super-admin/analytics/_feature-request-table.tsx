"use client";

import { useMemo, useState, type ReactNode } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";

interface TicketRequest {
  keyword: string;
  requestCount: number;
  schoolsRequesting: number;
  tiersRequesting: number;
  severity?: string;
  priorityScore: number;
}

export interface LoggedRequest {
  id: string;
  title: string;
  module: string | null;
  asks: number;
  schools: number;
  schoolNames: string[];
  tiers: number;
  severity: string;
  blocksRenewal: boolean;
  roadmapFlag: boolean;
  score: number;
  loggedBy: string;
}

interface Row {
  key: string;
  title: string;
  detail: string;
  schools: number;
  tiers: number;
  severity: string;
  source: string;
  score: number;
  flag: string | null;
}

/** Requests from both routes in one list: the keywords support tickets keep coming back to, and the asks somebody logged by hand. */
export function FeatureRequestTable({ items, logged, actions }: { items: TicketRequest[]; logged: LoggedRequest[]; actions?: ReactNode }) {
  const [search, setSearch] = useState("");
  const rows = useMemo<Row[]>(() => {
    const byHand = logged.map((entry) => ({
      key: `log-${entry.id}`,
      title: entry.title,
      detail: [entry.module, entry.asks > 1 ? `${entry.asks} asks` : null, `logged by ${entry.loggedBy}`].filter(Boolean).join(" · "),
      schools: entry.schools,
      tiers: entry.tiers,
      severity: entry.severity.charAt(0) + entry.severity.slice(1).toLowerCase(),
      source: "Logged by hand",
      score: entry.score,
      flag: entry.blocksRenewal ? "Blocking a renewal" : entry.roadmapFlag ? "Roadmap review" : null
    }));
    const fromTickets = items.map((item) => ({
      key: `kw-${item.keyword}`,
      title: item.keyword,
      detail: `${item.requestCount} mention${item.requestCount === 1 ? "" : "s"} in feature-request tickets`,
      schools: item.schoolsRequesting,
      tiers: item.tiersRequesting,
      severity: item.severity ? item.severity.charAt(0) + item.severity.slice(1).toLowerCase() : "Medium",
      source: "Support tickets",
      score: item.priorityScore,
      flag: null
    }));
    return [...byHand, ...fromTickets].sort((a, b) => b.score - a.score);
  }, [items, logged]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((row) => `${row.title} ${row.detail}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  return (
    <TableCard
      title="Feature request intelligence"
      description="Ranked by weight: how many schools ask, what tier they are on, and how badly it hurts. Requests logged by hand count the same as tagged tickets."
      items={filtered}
      actions={actions}
      pageSize={false}
      getRowKey={(row) => row.key}
      emptyState={rows.length === 0 ? "No request has been logged, and no support ticket has asked for a feature yet." : "No request matches this search."}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a request, module or school" }}
          filters={[
            { label: "Source", value: "Tickets and logged by hand" },
            { label: "Status", value: "Open" }
          ]}
          note={`${filtered.length} of ${rows.length} shown`}
        />
      }
      columns={[
        { key: "rank", header: "#", render: (row) => <span className="text-[var(--color-text-muted)]">{String(filtered.indexOf(row) + 1).padStart(2, "0")}</span>, sortable: false },
        {
          key: "request",
          header: "Feature request",
          render: (row) => (
            <div>
              <p className="font-bold text-[var(--color-text-primary)]">{row.title}</p>
              <p className="text-[11.5px] text-[#5f6e65]">{row.detail}{row.flag ? ` · ${row.flag}` : ""}</p>
            </div>
          ),
          sortValue: (row) => row.title
        },
        { key: "schools", header: "Schools", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.schools}</span>, sortValue: (row) => row.schools },
        { key: "tiers", header: "Tier weight", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.tiers} tier{row.tiers === 1 ? "" : "s"}</span>, sortValue: (row) => row.tiers },
        { key: "severity", header: "Severity", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.severity}</span> },
        { key: "source", header: "Source", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.source}</span> },
        { key: "priority", header: "Priority score", render: (row) => <span className="font-extrabold text-[var(--color-text-primary)]">{row.score}</span>, sortValue: (row) => row.score }
      ]}
    />
  );
}
