import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";

const calendarOptions = [{ label: "Three-term", value: "THREE_TERM" }, { label: "Two-semester", value: "TWO_SEMESTER" }];

function tabHref(tab: string) {
  return tab === "curricula" ? "/super-admin/config-library" : `/super-admin/config-library?tab=${tab}`;
}

export default async function SuperAdminConfigLibraryPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "curricula" } = searchParams ? await searchParams : {};
  const data = await apiGet<SuperAdminConfigLibrary>("/api/super-admin/config-library");

  const tabs = [
    { label: "Curriculum Templates", href: tabHref("curricula"), active: tab === "curricula" },
    { label: "Grading Scales", href: tabHref("grading"), active: tab === "grading" },
    { label: "Report Cards", href: tabHref("reportcards"), active: tab === "reportcards" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Academic configuration</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Config Library</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Country-specific curriculum, grading scale, and report card templates. Schools consume these during onboarding and customise their own copy — the master library is never edited by schools.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "curricula" ? (
        <TableCard
          title="Curriculum templates"
          description="Pre-populate grading scale, subject list, class structure, and calendar per country/curriculum."
          items={data.curricula}
          actions={
            <ResourceActionDialog
              triggerLabel="Add / update curriculum"
              title="Add or update a curriculum template"
              description="Re-using an existing name updates that template."
              endpoint="/api/super-admin/config-library/curricula"
              submitLabel="Save curriculum"
              fields={[
                { name: "name", label: "Name", required: true, placeholder: "e.g. Nigerian Standard (NERDC)" },
                { name: "country", label: "Country", required: true, placeholder: "Nigeria" },
                { name: "subjects", label: "Subjects (comma-separated)", type: "textarea", placeholder: "Mathematics, English, Basic Science" },
                { name: "calendarType", label: "Calendar", type: "select", options: calendarOptions },
                { name: "version", label: "Version", defaultValue: "1.0" }
              ]}
            />
          }
          columns={[
            { key: "country", header: "Country", render: (item) => item.country },
            { key: "name", header: "Template", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
            { key: "subjects", header: "Subjects", render: (item) => item.subjectCount },
            { key: "calendar", header: "Calendar", render: (item) => item.calendarType.replaceAll("_", " ") },
            { key: "version", header: "Version", render: (item) => item.version },
            { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> }
          ]}
          emptyState="No curriculum templates yet."
        />
      ) : null}

      {tab === "grading" ? (
        <TableCard
          title="Grading scale templates"
          description="Reusable grade bands (WAEC, NECO, percentage, letter, GPA) with a default pass mark."
          items={data.gradingScales}
          actions={
            <ResourceActionDialog
              triggerLabel="Add / update scale"
              title="Add or update a grading scale"
              description="Provide grade bands as JSON, e.g. [{&quot;grade&quot;:&quot;A1&quot;,&quot;min&quot;:75,&quot;max&quot;:100,&quot;remark&quot;:&quot;Excellent&quot;}]."
              endpoint="/api/super-admin/config-library/grading-scales"
              submitLabel="Save scale"
              fields={[
                { name: "name", label: "Name", required: true, placeholder: "e.g. WAEC Nigeria" },
                { name: "gradeBands", label: "Grade bands (JSON array)", type: "textarea", parse: "json", required: true, defaultValue: "[\n  { \"grade\": \"A1\", \"min\": 75, \"max\": 100, \"remark\": \"Excellent\" }\n]" },
                { name: "passMark", label: "Pass mark", type: "number", defaultValue: 40, min: 0, max: 100 },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated)" }
              ]}
            />
          }
          columns={[
            { key: "name", header: "Scale", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
            { key: "bands", header: "Bands", render: (item) => item.bandCount },
            { key: "pass", header: "Pass mark", render: (item) => item.passMark },
            { key: "curricula", header: "Applicable to", render: (item) => item.applicableCurricula.join(", ") || "All" },
            { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> }
          ]}
          emptyState="No grading scale templates yet."
        />
      ) : null}

      {tab === "reportcards" ? (
        <TableCard
          title="Report card templates"
          description="Base report card layouts. Elite-tier schools can brand these; all are previewed with sample data before release."
          items={data.reportCards}
          actions={
            <ResourceActionDialog
              triggerLabel="Add / update report card"
              title="Add or update a report card template"
              description="Define a base layout and which curricula/tiers it applies to."
              endpoint="/api/super-admin/config-library/report-cards"
              submitLabel="Save template"
              fields={[
                { name: "name", label: "Name", required: true, placeholder: "e.g. Standard portrait A4" },
                { name: "layout", label: "Layout", required: true, placeholder: "portrait_a4" },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated)" },
                { name: "availableToTiers", label: "Available to tiers (comma-separated)", placeholder: "STANDARD, ELITE" }
              ]}
            />
          }
          columns={[
            { key: "name", header: "Template", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
            { key: "curricula", header: "Curricula", render: (item) => item.applicableCurricula.join(", ") || "All" },
            { key: "tiers", header: "Tiers", render: (item) => item.availableToTiers.join(", ") || "All" },
            { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> }
          ]}
          emptyState="No report card templates yet."
        />
      ) : null}
    </div>
  );
}
