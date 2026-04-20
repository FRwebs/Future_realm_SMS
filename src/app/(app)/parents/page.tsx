import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { ParentDirectoryRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

type ParentsPageProps = {
  searchParams?: Promise<{ search?: string }>;
};

export default async function ParentsPage({ searchParams }: ParentsPageProps) {
  const session = await getServerSession();
  if (!session) return null;

  let parents: ParentDirectoryRecordView[];
  try {
    parents = await apiGet<ParentDirectoryRecordView[]>("/api/v1/parents");
  } catch {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : { search: "" };
  const search = params.search ?? "";
  const filteredParents = parents.filter((parent) =>
    !search ||
    [
      parent.parentName,
      parent.phone,
      parent.email,
      parent.relationship,
      ...parent.linkedChildren.flatMap((child) => [child.studentName, child.admissionNumber, child.className]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Parents</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Parent and guardian directory</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
          Permission-aware parent visibility for school communication, fees follow-up, admissions, welfare, and class teacher engagement.
        </p>
      </section>

      <FilterToolbar
        action="/parents"
        title="Find parent or guardian"
        description="Search by guardian name, phone, email, linked child, admission number, or class."
        activeSummary={search ? [`Search: ${search}`] : []}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Parent, phone, child, class", defaultValue: search },
        ]}
      />

      <TableCard
        title="Parents and guardians"
        description="Linked children are shown so staff can quickly confirm the correct family contact."
        items={filteredParents}
        emptyState="No parents or guardians match the current search."
        columns={[
          {
            key: "parent",
            header: "Parent / guardian",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.parentName}</p>
                <p className="text-xs text-ink/55">{item.relationship}</p>
              </div>
            ),
          },
          {
            key: "contact",
            header: "Contact",
            render: (item) => (
              <div>
                <p>{item.phone}</p>
                <p className="text-xs text-ink/55">{item.email ?? "No email"}</p>
              </div>
            ),
          },
          {
            key: "children",
            header: "Linked children",
            render: (item) => (
              <div className="grid gap-1">
                {item.linkedChildren.map((child) => (
                  <p key={child.studentId} className="text-sm">
                    <span className="font-semibold text-ink">{child.studentName}</span>
                    <span className="text-ink/55"> · {child.admissionNumber} · {formatNigeriaClassName(child.className)}</span>
                  </p>
                ))}
              </div>
            ),
          },
          { key: "sms", header: "SMS", render: (item) => (item.canReceiveSms ? "Allowed" : "Opted out") },
          { key: "email", header: "Email", render: (item) => (item.canReceiveEmail ? "Allowed" : "Opted out") },
        ]}
      />
    </div>
  );
}
