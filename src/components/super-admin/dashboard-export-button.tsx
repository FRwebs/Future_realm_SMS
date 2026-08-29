"use client";

import { Download } from "lucide-react";

export interface DashboardExportRow {
  section: string;
  label: string;
  value: string;
}

function downloadCommandCenterCsv(rows: DashboardExportRow[]) {
  const headers = ["Section", "Metric", "Value"];
  const csv = [headers, ...rows.map((row) => [row.section, row.label, row.value])]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `command-center-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DashboardExportButton({ rows }: { rows: DashboardExportRow[] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCommandCenterCsv(rows)}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0d2315] transition hover:bg-[#eaf3ee]"
    >
      <Download className="h-3.5 w-3.5" />
      Export
    </button>
  );
}
