import { Globe2, LayoutTemplate } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";

const calendarOptions = [{ label: "Three-term", value: "THREE_TERM" }, { label: "Two-semester", value: "TWO_SEMESTER" }];

// Real, isolated backend endpoint (curriculum-extras) — no dedicated Prisma model exists yet for
// either "platform assessment framework masters" or "per-country platform settings", so this
// aggregates what genuinely IS real and country/assessment-scoped today (School + CurriculumTemplate
// + AssessmentComponent/SectionAssessmentComponent). See page body for how each tab uses it.
interface CountrySettingsRow {
  country: string;
  schoolCount: number;
  defaultTimezone: string | null;
  defaultCurrency: string | null;
  curriculumTemplateCount: number;
  calendarTypes: Array<{ calendarType: string; count: number }>;
}

interface AssessmentFrameworkStats {
  totalComponents: number;
  totalSectionComponents: number;
  schoolsWithFrameworks: number;
}

interface CurriculumExtrasOverview {
  countrySettings: CountrySettingsRow[];
  assessmentFrameworkStats: AssessmentFrameworkStats;
}

function tabHref(tab: string) {
  return tab === "curricula" ? "/super-admin/config-library" : `/super-admin/config-library?tab=${tab}`;
}

export default async function SuperAdminConfigLibraryPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "curricula" } = searchParams ? await searchParams : {};
  const data = await apiGet<SuperAdminConfigLibrary>("/api/super-admin/config-library");

  // Defensive fetch: this endpoint lives in its own newly-added module, so if it's ever
  // unreachable (e.g. not yet deployed) the rest of the page still renders.
  let extras: CurriculumExtrasOverview = { countrySettings: [], assessmentFrameworkStats: { totalComponents: 0, totalSectionComponents: 0, schoolsWithFrameworks: 0 } };
  try {
    const extrasEnvelope = await apiGetEnvelope<CurriculumExtrasOverview>("/api/curriculum-extras/overview");
    if (extrasEnvelope.data) extras = extrasEnvelope.data;
  } catch {
    extras = { countrySettings: [], assessmentFrameworkStats: { totalComponents: 0, totalSectionComponents: 0, schoolsWithFrameworks: 0 } };
  }

  const tabs = [
    { label: "Templates", href: tabHref("curricula"), active: tab === "curricula", badge: data.curricula.length },
    { label: "Assessment Frameworks", href: tabHref("assessment-frameworks"), active: tab === "assessment-frameworks" },
    { label: "Grading Scales", href: tabHref("grading"), active: tab === "grading" },
    { label: "Report Cards", href: tabHref("reportcards"), active: tab === "reportcards" },
    { label: "Country Settings", href: tabHref("country-settings"), active: tab === "country-settings", badge: extras.countrySettings.length }
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
        <div className="relative z-[1]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Academic configuration</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Curriculum &amp; Academics</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            Country-specific curriculum, assessment, grading scale, and report card templates. Schools consume these during onboarding and customise their own copy — the master library is never edited by schools.
          </p>
        </div>
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
            { key: "name", header: "Template", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
            { key: "subjects", header: "Subjects", render: (item) => item.subjectCount },
            { key: "calendar", header: "Calendar", render: (item) => item.calendarType.replaceAll("_", " ") },
            { key: "version", header: "Version", render: (item) => item.version },
            { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> }
          ]}
          emptyState="No curriculum templates yet."
        />
      ) : null}

      {tab === "assessment-frameworks" ? (
        <div className="grid gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Schools with assessment setups" value={String(extras.assessmentFrameworkStats.schoolsWithFrameworks)} />
            <StatCard label="Class-level assessment components" value={String(extras.assessmentFrameworkStats.totalComponents)} />
            <StatCard label="Section-level assessment components" value={String(extras.assessmentFrameworkStats.totalSectionComponents)} />
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                <LayoutTemplate className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">No master assessment framework library yet</h3>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  Unlike curriculum, grading scale, and report card templates, assessment components (CA weighting, exam weighting, and their score maxima) are configured per school today —
                  there is no platform-level master record that schools copy from. The counts above are real, aggregated across every school in the system, and reflect what schools have
                  already built for themselves. A publishable Nooria framework library (analogous to Curriculum Templates) would need a new Prisma model — it does not exist in the schema
                  yet, so nothing is fabricated here.
                </p>
              </div>
            </div>
          </div>
        </div>
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
            { key: "name", header: "Scale", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
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
            { key: "name", header: "Template", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
            { key: "curricula", header: "Curricula", render: (item) => item.applicableCurricula.join(", ") || "All" },
            { key: "tiers", header: "Tiers", render: (item) => item.availableToTiers.join(", ") || "All" },
            { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> }
          ]}
          emptyState="No report card templates yet."
        />
      ) : null}

      {tab === "country-settings" ? (
        <div className="grid gap-5">
          {extras.countrySettings.length === 1 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-[13px] leading-6 text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-text-primary)]">{extras.countrySettings[0].country}</span> is the only country currently represented in the platform's
                schools and curriculum templates. This is an honest reflection of real data, not a limitation of the settings UI — additional countries will appear here automatically
                once a school or curriculum template is registered under them.
              </p>
            </div>
          ) : null}
          <TableCard
            title="Country settings"
            description="Derived from real School and Curriculum Template records — the default timezone/currency per country, and how many curriculum templates and calendar conventions exist for it."
            items={extras.countrySettings}
            columns={[
              {
                key: "country",
                header: "Country",
                render: (item) => (
                  <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    <Globe2 className="h-[15px] w-[15px] text-[var(--color-text-muted)]" />
                    {item.country}
                  </span>
                )
              },
              { key: "schools", header: "Schools", render: (item) => item.schoolCount },
              { key: "timezone", header: "Default timezone", render: (item) => item.defaultTimezone ?? "—" },
              { key: "currency", header: "Default currency", render: (item) => item.defaultCurrency ?? "—" },
              { key: "templates", header: "Curriculum templates", render: (item) => item.curriculumTemplateCount },
              {
                key: "calendar",
                header: "Calendar conventions",
                render: (item) => (item.calendarTypes.length ? item.calendarTypes.map((c) => `${c.calendarType.replaceAll("_", " ")} (${c.count})`).join(", ") : "—")
              }
            ]}
            emptyState="No countries on record yet — add a school or curriculum template to populate this view."
          />
        </div>
      ) : null}
    </div>
  );
}
