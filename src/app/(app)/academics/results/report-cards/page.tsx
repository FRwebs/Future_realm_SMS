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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Report cards</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          PDF report cards use the existing report-card utility and respect student/parent publication rules at download time.
        </p>
      </section>

      {previewCard ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
          <div className="bg-ink p-6 text-white md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">Printable preview</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-bold">Greenfield College, Ibadan</h2>
            <p className="mt-2 text-sm text-white/70">{previewCard.term}{previewCard.session ? ` · ${previewCard.session}` : ""} report card</p>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
            <article className="md:col-span-2">
              <p className="text-sm font-semibold text-ink/55">Student</p>
              <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{previewCard.studentName}</p>
              <p className="mt-2 text-sm text-ink/65">{formatNigeriaClassName(previewCard.className)}</p>
            </article>
            <article className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">Average</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-brand-800">{previewCard.average}%</p>
            </article>
            <article className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">Status</p>
              <div className="mt-3"><StatusBadge status={previewCard.status} /></div>
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
              <a className="font-semibold text-brand-700" href={item.reportCardUrl ?? `/api/v1/reports/report-card/${item.studentId}`}>
                Download
              </a>
            )
          }
        ]}
      />
    </div>
  );
}
