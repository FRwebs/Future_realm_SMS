import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerPublicationView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ClassOption = { id: string; fullName?: string; name: string; arm?: string | null };
type ClassOptionsPayload = { data: ClassOption[] };

export default async function ExamOfficerPublicationPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer/publication"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [publications, classes] = await Promise.all([
    apiGet<ExamOfficerPublicationView[]>("/api/v1/exam-officer/publications"),
    apiGet<ClassOptionsPayload>("/api/v1/classes"),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-eyebrow">Publication control</p>
            <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
              Release discipline for broadsheets and term results
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
              Compile, publish, and revoke class result visibility from one exam-office command surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ResourceActionDialog
              triggerLabel="Compile Class Results"
              title="Compile class results"
              description="Generate and refresh the class broadsheet before publication."
              endpoint="/api/v1/academics/broadsheets/compile"
              submitLabel="Compile broadsheet"
              presentation="drawer"
              variant="secondary"
              fields={[
                {
                  name: "classId",
                  label: "Class",
                  type: "select",
                  required: true,
                  options: classes.data.map((item) => ({
                    label: item.fullName ?? [item.name, item.arm].filter(Boolean).join(" "),
                    value: item.id,
                  })),
                },
              ]}
            />
            <ResourceActionDialog
              triggerLabel="Publish Results"
              title="Publish approved results"
              description="Push approved results live for the selected class in the current term."
              endpoint="/api/v1/academics/publish"
              submitLabel="Publish results"
              presentation="drawer"
              fields={[
                {
                  name: "classId",
                  label: "Class",
                  type: "select",
                  required: true,
                  options: classes.data.map((item) => ({
                    label: item.fullName ?? [item.name, item.arm].filter(Boolean).join(" "),
                    value: item.id,
                  })),
                },
                {
                  name: "note",
                  label: "Publication note",
                  type: "textarea",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <TableCard
        title="Class publication status"
        description="Each class broadsheet, its readiness, and whether it is live to parents and students."
        items={publications}
        getRowKey={(item) => item.broadsheetId}
        primaryColumnKey="className"
        featuredColumnKeys={["status"]}
        columns={[
          {
            key: "className",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.term} · {item.session}</p>
              </div>
            ),
          },
          { key: "students", header: "Students", render: (item) => `${item.completeStudents}/${item.studentCount}` },
          { key: "comments", header: "Comments", render: (item) => item.commentsReady.toLocaleString() },
          { key: "warnings", header: "Warnings", render: (item) => item.missingWarnings.toLocaleString() },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "publishedAt", header: "Published", render: (item) => item.publishedAt ? formatDate(item.publishedAt) : "Not yet" },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <Link href={`/academics/results/broadsheets/${item.broadsheetId}`} className="text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline">
                View broadsheet
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
