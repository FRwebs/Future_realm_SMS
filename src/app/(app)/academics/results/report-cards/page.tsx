import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { ReportCardView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function ReportCardsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/report-cards"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const reportCards = await apiGet<ReportCardView[]>("/api/v1/academics/report-cards");
  const previewCard = reportCards[0];

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/academics/results" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to results</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Report cards</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          PDF report cards use the existing report-card utility and respect student/parent publication rules at download time.
        </p>
      </section>

      {previewCard ? (
        <section className="surface-card overflow-hidden p-0">
          <div className="bg-[var(--color-text-primary)] p-6 text-[var(--color-bg-surface)] md:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-bg-surface)]/65">Printable preview</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[22px] font-bold">Greenfield College, Ibadan</h2>
            <p className="mt-2 text-[13px] text-[var(--color-bg-surface)]/70">{previewCard.term}{previewCard.session ? ` · ${previewCard.session}` : ""} report card</p>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
            <article className="md:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Student</p>
              <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{previewCard.studentName}</p>
              <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{formatNigeriaClassName(previewCard.className)}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Average</p>
              <p className="mt-2 text-[22px] font-bold text-[var(--color-text-accent)]">{previewCard.average}%</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Status</p>
              <div className="mt-2"><StatusBadge status={previewCard.status} /></div>
            </article>
          </div>
        </section>
      ) : null}

      <TableCard
        title="Available report cards"
        description="Generated cards come from approved broadsheets and are visible to parents/students only after publication."
        items={reportCards}
        columns={[
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "term", header: "Term", render: (item) => item.session ? `${item.term} · ${item.session}` : item.term },
          { key: "average", header: "Average", render: (item) => `${item.average}%` },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "download",
            header: "PDF",
            render: (item) => (
              <a className="font-semibold text-[var(--color-text-accent)]" href={item.reportCardUrl ?? `/api/v1/reports/report-card/${item.studentId}`}>
                Download
              </a>
            )
          }
        ]}
      />
    </div>
  );
}
