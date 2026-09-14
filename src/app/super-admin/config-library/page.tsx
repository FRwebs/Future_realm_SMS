import { Globe2 } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";
import { CurriculumTemplatesTable, GradingScalesTable, ReportCardsTable } from "./_template-tables";

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

interface WeightPatternRow {
  pattern: string;
  componentNames: string;
  schoolCount: number;
}

interface CurriculumExtrasOverview {
  countrySettings: CountrySettingsRow[];
  assessmentFrameworkStats: AssessmentFrameworkStats;
  weightPatterns: WeightPatternRow[];
}

function tabHref(tab: string) {
  return tab === "curricula" ? "/super-admin/config-library" : `/super-admin/config-library?tab=${tab}`;
}

export default async function SuperAdminConfigLibraryPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "curricula" } = searchParams ? await searchParams : {};
  const data = await apiGet<SuperAdminConfigLibrary>("/api/super-admin/config-library");

  // Defensive fetch: this endpoint lives in its own newly-added module, so if it's ever
  // unreachable (e.g. not yet deployed) the rest of the page still renders.
  let extras: CurriculumExtrasOverview = { countrySettings: [], assessmentFrameworkStats: { totalComponents: 0, totalSectionComponents: 0, schoolsWithFrameworks: 0 }, weightPatterns: [] };
  try {
    const extrasEnvelope = await apiGetEnvelope<CurriculumExtrasOverview>("/api/curriculum-extras/overview");
    if (extrasEnvelope.data) extras = extrasEnvelope.data;
  } catch {
    extras = { countrySettings: [], assessmentFrameworkStats: { totalComponents: 0, totalSectionComponents: 0, schoolsWithFrameworks: 0 }, weightPatterns: [] };
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
      <ModuleHero
        eyebrow="Platform"
        title="Curriculum & Academics"
        description="A content library for curriculum, grading scale, and report card templates — real records a Super Admin can create and edit. No school signup flow reads any of them yet: a template added here has no effect on any real school today."
        action={
          <ResourceActionDialog
            triggerLabel="New template"
            title="New master template"
            description="A content-library record a Super Admin can create and edit. Re-using an existing name updates that template — no school reads it, so nothing goes live by saving one."
            endpoint="/api/super-admin/config-library/curricula"
            submitLabel="Save curriculum"
            variant="heroWhite"
            fields={[
              { name: "name", label: "Template name", required: true, placeholder: "e.g. Nigerian Standard (NERDC)", section: "Identity" },
              { name: "country", label: "Country", required: true, placeholder: "Nigeria", section: "Identity" },
              { name: "owner", label: "Owner", type: "static", placeholder: "Not tracked", note: "No owner field exists on a template record — it's just whichever Super Admin last saved it.", section: "Identity" },
              { name: "effectiveFrom", label: "Effective from", type: "static", placeholder: "Not tracked", note: "No effective-date field exists — a saved template is live for selection immediately.", section: "Identity" },
              { name: "baseOn", label: "Base on", type: "static", placeholder: "Not built — every template starts blank", note: "There is no template-copying or versioning mechanism to base a new one on an existing template.", section: "Starting point" },
              { name: "calendarType", label: "Layer 1 · calendar", type: "select", options: calendarOptions, section: "Starting point" },
              { name: "language", label: "Language of instruction", type: "static", placeholder: "Not tracked", note: "No language field exists on a template record.", section: "Starting point" },
              { name: "layer2", label: "2 · Levels and classes", type: "toggle", disabled: true, section: "Layers to author" },
              { name: "layer3", label: "3 · Subjects", type: "toggle", disabled: true, section: "Layers to author" },
              { name: "layer4", label: "4 · Assessment", type: "toggle", disabled: true, section: "Layers to author" },
              { name: "layer5", label: "5 · Grading", type: "toggle", disabled: true, section: "Layers to author" },
              { name: "layer6", label: "6 · Report card", type: "toggle", disabled: true, section: "Layers to author" },
              {
                name: "inheritLayer1",
                label: "Inherit Layer 1 from country",
                type: "toggle",
                disabled: true,
                note: "This template is one flat record — name, country, subjects, calendar and version — not six independently authorable layers. These switches show the shape a layered model would have; none are wired up.",
                section: "Layers to author"
              },
              { name: "version", label: "Version", defaultValue: "1.0", section: "Configuration" },
              { name: "subjects", label: "Subjects (comma-separated) — the real Layer 3 data", type: "textarea", parse: "csv", placeholder: "Mathematics, English, Basic Science", section: "Configuration" }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "curricula" ? (
        <div className="grid gap-5">
        <CurriculumTemplatesTable items={data.curricula} />

        <TableCard
          title="The six-layer curriculum configuration model — what's real today"
          description="A fully layered model would let a school swap each of these independently, and read its own choice from live configuration rather than hard-coded assumptions. Rated here against what this codebase actually does, not the aspiration."
          items={[
            { layer: "1", name: "Education System", governs: "Calendar shape, term/semester count, currency, language, phone format, promotion policy", state: "Not a template — currency (\"NGN\" by default) and academic-year/term labels are plain fields set directly on the school; nothing derives them from a shared configuration record.", tone: "bad" },
            { layer: "2", name: "Level Structure", governs: "The stages and classes a school may operate, and which are examination/transition points", state: "Not built — every school creates its own class-level rows directly; there's no master \"stages\" record to select from, and nothing in the schema links a class to a curriculum template.", tone: "bad" },
            { layer: "3", name: "Subject Framework", governs: "Subject catalogue, core/elective/compulsory-choice rules, minimum and maximum subject counts", state: "Exists only as an unused admin record — a curriculum template's subject list is free text a Super Admin can type in, but (per the note above) no school ever reads it. A school's real subjects are entered directly by that school.", tone: "warn" },
            { layer: "4", name: "Assessment Framework", governs: "The components that make up a subject score, their weights, term and session aggregation", state: "Confirmed not a master template — every school builds its own CA/exam weighting from scratch, with no platform preset (see Assessment Frameworks tab). This is the one layer with no library at all, by design of the current schema.", tone: "bad" },
            { layer: "5", name: "Grading Scale", governs: "Bands, boundaries, labels, remarks, pass mark", state: "Exists as its own template library with real, editable grade bands — but like Layer 3, nothing links a school to it. The only grading data an actual new school sees is Settings' separate default-grading JSON, applied as a one-time copy, not this template.", tone: "warn" },
            { layer: "6", name: "Report Card Template", governs: "Layout, which fields are displayed, position/ranking display rules", state: "A single free-text layout name, not structured section data — there's no field for position display, cumulative columns, or behavioural domains. Also unlinked to any school.", tone: "warn" }
          ]}
          getRowKey={(row) => row.layer}
          columns={[
            { key: "layer", header: "Layer", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.layer}</span> },
            { key: "name", header: "Name", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.name}</span> },
            { key: "governs", header: "What it would govern", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.governs}</span> },
            {
              key: "state",
              header: "Real state today",
              render: (row) => {
                const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" } }[row.tone as "good" | "warn" | "bad"];
                return <span className="inline-block rounded-[8px] px-2.5 py-2 text-[12px] leading-5" style={{ background: tone.bg, color: tone.fg }}>{row.state}</span>;
              }
            }
          ]}
        />

        <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
          <div className="border-b border-[#E6EEE9] px-5 py-4">
            <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">Three hard constraints on every other module</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">Each follows directly from the governing principle — checked against this codebase, not asserted.</p>
          </div>
          <div className="grid gap-3 p-5">
            {[
              { label: "No module may contain a literal reference to a Nigerian grade band, subject name, term count or class level", detail: "Not met — school onboarding hard-codes country to \"Nigeria\" with no field for it, billing hard-codes \"NGN\", and a school's level structure is drawn from a fixed platform enum (Creche/Nursery/Primary/Junior Secondary/Senior Secondary), not from any per-school or per-country configuration.", tone: "bad" },
              { label: "The result engine takes the assessment framework as an input, never as an assumption", detail: "Met — component weights, tie-handling, and absent-handling are all read from each school's own AssessmentComponent configuration (see Assessment Frameworks), not hard-coded.", tone: "good" },
              { label: "Master templates are owned by Nooria; the copy a school customises is owned by that school", detail: "Not applicable — there is no copy step. Templates on this page and any school's real configuration are simply unconnected today (see the footnote on the table above).", tone: "mute" }
            ].map((item) => {
              const dot = { good: "var(--color-success)", bad: "var(--color-danger)", mute: "var(--color-text-muted)" }[item.tone];
              return (
                <div key={item.label} className="flex items-start gap-3 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
                  <div>
                    <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <TableCard
          title="Versioning requirements — the single most valuable capability this module lacks"
          description="Checked against the real template-update code, not the aspiration."
          items={[
            { requirement: "Templates are versioned", spec: "Not built — version is free text (default \"1.0\"), never validated, with no effective-from/effective-to dates. Saving a template with the same name overwrites it in place; nothing is ever superseded.", state: "bad" },
            { requirement: "Assignment is per class", spec: "Not built — there is no link from a class or cohort to a specific curriculum template version anywhere in the schema.", state: "bad" },
            { requirement: "Historical results are immutable", spec: "Not built — a result record carries no curriculum-version tag, so there is nothing to hold it to even if versioning existed.", state: "bad" },
            { requirement: "Migration path is explicit", spec: "Not built — no subject-mapping record exists between any two templates.", state: "bad" },
            { requirement: "Schools are notified, not forced", spec: "Not applicable — there is nothing to notify a school about, since no school is linked to a template version in the first place.", state: "mute" }
          ]}
          getRowKey={(row) => row.requirement}
          columns={[
            { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
            { key: "spec", header: "What actually happens", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
            {
              key: "state",
              header: "State",
              render: (row) => {
                const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "N/A" } }[row.state as "good" | "bad" | "mute"];
                return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
              }
            }
          ]}
        />

        <CurriculumLifecycleFlow />

        <div className="grid gap-5 lg:grid-cols-2">
          <TableCard
            title="Subject mapping between template versions"
            description="Would record how a subject is merged or renamed when a template changes, so a student's history stays explainable years later."
            items={[]}
            columns={[
              { key: "from", header: "From", render: () => null },
              { key: "to", header: "To", render: () => null },
              { key: "relationship", header: "Relationship", render: () => null }
            ]}
            emptyState="No subject-mapping record exists in this codebase — there is no model for it, so there is nothing real to show here."
          />
          <TableCard
            title="Per-class version assignment"
            description="Would show which curriculum template version each class in a school is running, so two classes could run different versions at once."
            items={[]}
            columns={[
              { key: "class", header: "Class", render: () => null },
              { key: "version", header: "Curriculum version", render: () => null },
              { key: "assigned", header: "Assigned", render: () => null }
            ]}
            emptyState="No class anywhere in this system is assigned to a curriculum template version — that link doesn't exist in the schema."
          />
        </div>

        <TableCard
          title="Portability tests — checked against this codebase"
          description="Tests any curriculum-facing feature would need to pass to launch a new country by configuration alone rather than a code change. Checked against real code, not asserted as passing by default."
          items={[
            { test: "T1", question: "Does it work with a different currency, calendar, script or grading system?", failureLooksLike: "A fee field hardcoded to Naira; a country hardcoded at signup", state: "bad", verdict: "Fails — \"NGN\" is the hardcoded fallback currency across pricing/finance code, and school onboarding hardcodes country to \"Nigeria\" with no country field at all." },
            { test: "T2", question: "Does it assume a three-term year?", failureLooksLike: "A results table with three fixed columns; a session average dividing by three", state: "mute", verdict: "Not exercised — a school's real term structure comes from its own Term/AcademicSession records, entirely decoupled from the curriculum template's calendarType field, which nothing else reads." },
            { test: "T3", question: "Does it assume examination-band grading?", failureLooksLike: "A grade lookup returning A1 to F9; a report card column headed WAEC Grade", state: "mute", verdict: "Not exercised — grading-scale templates store arbitrary bands, but (per Layer 5 above) no school is linked to one, so this is untested by real use." },
            { test: "T4", question: "Does it assume a numeric score exists at all?", failureLooksLike: "A position computation that cannot run against descriptive bands", state: "bad", verdict: "Fails as built — a score is a mandatory number on every score record; there is no descriptive-band-only scoring path anywhere in this system." },
            { test: "T5", question: "Does it assume WhatsApp is the parent channel?", failureLooksLike: "A notification path with no channel fallback; copy that says WhatsApp rather than the configured channel", state: "good", verdict: "Passes, trivially — WhatsApp isn't wired as a real send channel at all yet (see Settings → Notifications), so nothing depends on it being the default." },
            { test: "T6", question: "Does it assume a single-campus, owner-operated school?", failureLooksLike: "No path for a group or trust; a single owner with no delegation model", state: "good", verdict: "Passes — a school can be marked as a group with its own Campus records; multi-campus is a real, modeled structure." },
            { test: "T7", question: "Would it survive scrutiny under a stricter regime than Nigeria's?", failureLooksLike: "Children's data with no consent record; no route to erasure; no processing record", state: "mute", verdict: "Not reviewed here — see Security & Compliance for the platform's actual data-retention and deletion posture." },
            { test: "T8", question: "Can a new country launch by adding configuration records alone?", failureLooksLike: "Any answer that includes writing code", state: "bad", verdict: "Fails — onboarding's country value is a literal string in the signup code path, not a configurable field." }
          ]}
          getRowKey={(row) => row.test}
          columns={[
            { key: "test", header: "#", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.test}</span> },
            { key: "question", header: "Test", render: (row) => <span className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{row.question}</span> },
            { key: "failureLooksLike", header: "Failure looks like", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.failureLooksLike}</span> },
            { key: "verdict", header: "What's actually true here", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.verdict}</span> },
            {
              key: "state",
              header: "State",
              render: (row) => {
                const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Passing" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Fails" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not reviewed" } }[row.state as "good" | "warn" | "bad" | "mute"];
                return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
              }
            }
          ]}
        />
        </div>
      ) : null}

      {tab === "assessment-frameworks" ? (
        <div className="grid gap-5">
          <TableCard
            title="Ready-made assessment frameworks — there isn't a library, only real usage"
            description="A school selects one during setup in the mockup. In this codebase there is no platform preset to select — every school builds its own from scratch. This groups real, active per-school configurations by their weight pattern, most common first."
            items={extras.weightPatterns}
            getRowKey={(row) => row.pattern}
            columns={[
              { key: "pattern", header: "Weights", render: (row) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{row.pattern}</span> },
              { key: "components", header: "Components (example school)", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.componentNames}</span> },
              { key: "schools", header: "Schools", render: (row) => row.schoolCount }
            ]}
            emptyState="No school has configured class-level assessment components yet."
            footnote={
              <>
                Real counts, aggregated live across every school: {extras.assessmentFrameworkStats.schoolsWithFrameworks} school(s) with a setup ·{" "}
                {extras.assessmentFrameworkStats.totalComponents} class-level component(s) · {extras.assessmentFrameworkStats.totalSectionComponents} section-level component(s). A publishable
                framework library, unlike Curriculum, Grading Scale, and Report Card templates, would need a new Prisma model — it doesn&apos;t exist in this schema.
              </>
            }
          />
          <TableCard
            title="Layer 4 fields and their constraints"
            description="The layer where an error becomes a wrong result on a child's report card. Each field checked against the real scoring code, not stated as intent."
            items={[
              { field: "components[]", meaning: "The named parts of a subject score", constraint: "Each has a code, display name, maximum raw score and weight — real, on AssessmentComponent.", state: "good" },
              { field: "weight", meaning: "The proportion each contributes", constraint: "Must total exactly 100 — enforced at save; a section summing to 98 is rejected outright.", state: "good" },
              { field: "max_raw_score", meaning: "The score the component is marked out of", constraint: "Entry above the maximum is rejected at entry, not at computation — enforced.", state: "good" },
              { field: "term_aggregation", meaning: "How components combine into a term score", constraint: "Weighted sum by default — real, and the only rule that exists; nothing else is configurable.", state: "good" },
              { field: "session_aggregation", meaning: "How term scores combine", constraint: "Not built — there is no \"average of terms\" or \"final term only\" computation; each term stands alone.", state: "bad" },
              { field: "cumulative_display", meaning: "Running cumulative alongside the term score", constraint: "Not built — no cumulative-average concept exists anywhere in this codebase.", state: "bad" },
              { field: "rounding", meaning: "Where and how rounding occurs", constraint: "Every computed total and average is rounded to two decimals — real, and not configurable per school.", state: "good" },
              { field: "position_basis", meaning: "Position within arm, class, or both", constraint: "Rankings are scoped to the student's class (and arm, where used) — real; never platform-wide.", state: "good" },
              { field: "tie_handling", meaning: "Two students with identical totals", constraint: "Equal position with the next skipped, by default — real, and not configurable per school.", state: "good" },
              { field: "absent_handling", meaning: "How an absent component is treated", constraint: "A distinct ABSENT score flag exists, separate from a numeric zero — real.", state: "good" }
            ]}
            getRowKey={(row) => row.field}
            columns={[
              { key: "field", header: "Field", render: (row) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{row.field}</span> },
              { key: "meaning", header: "Meaning", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.meaning}</span> },
              { key: "constraint", header: "Constraint", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.constraint}</span> },
              {
                key: "state",
                header: "State",
                render: (row) => {
                  const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "bad"];
                  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
                }
              }
            ]}
          />

          <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
            <div className="border-b border-[#E6EEE9] px-5 py-4">
              <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">Nigerian curriculum structure — not populated in this codebase</p>
              <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">
                The mockup describes a detailed NERDC 2025 stage and subject taxonomy. None of it exists as real data here: no seed script or admin action has ever created a Nigerian curriculum
                template, and every table below is honestly empty rather than filled with that fictional structure.
              </p>
            </div>
          </section>
          <TableCard
            title="Level structure — Nigerian National (NERDC 2025)"
            items={data.curricula.filter((c) => c.country.toLowerCase() === "nigeria")}
            getRowKey={(item) => item.id}
            columns={[
              { key: "name", header: "Template", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
              { key: "subjects", header: "Subjects recorded", render: (item) => (item.subjectCount > 0 ? item.subjectCount : <span className="text-[var(--color-text-muted)]">None recorded</span>) },
              { key: "calendar", header: "Calendar", render: (item) => item.calendarType.replaceAll("_", " ") },
              { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> }
            ]}
            emptyState="No curriculum template is on file for Nigeria — every real school on this platform builds its own class and subject structure directly, with no template behind it."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <TableCard
              title="Junior secondary subject framework"
              items={[]}
              columns={[{ key: "subject", header: "Subject", render: () => null }, { key: "category", header: "Category", render: () => null }]}
              emptyState="No subject-framework record exists for junior secondary — a school enters its own subjects directly."
            />
            <TableCard
              title="Senior secondary subject framework"
              items={[]}
              columns={[{ key: "subject", header: "Compulsory core", render: () => null }, { key: "applies", header: "Applies", render: () => null }]}
              emptyState="No subject-framework record exists for senior secondary — a school enters its own subjects directly."
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <TableCard
              title="Trade subjects"
              items={[]}
              columns={[{ key: "a", header: "Trade subject", render: () => null }, { key: "b", header: "Trade subject", render: () => null }]}
              emptyState="No trade-subject record exists in this system."
            />
            <TableCard
              title="Primary subject sets"
              items={[]}
              columns={[{ key: "lower", header: "Primary 1–3", render: () => null }, { key: "upper", header: "Primary 4–6", render: () => null }]}
              emptyState="No primary-level subject-set record exists — lower and upper primary aren't distinguished anywhere in this schema."
            />
          </div>
        </div>
      ) : null}

      {tab === "grading" ? (
        <GradingScalesTable
          items={data.gradingScales}
          actions={
            <ResourceActionDialog
              triggerLabel="New scale"
              title="New grading scale"
              description="Provide grade bands as JSON, e.g. [{&quot;grade&quot;:&quot;A1&quot;,&quot;min&quot;:75,&quot;max&quot;:100,&quot;remark&quot;:&quot;Excellent&quot;}]. Re-using an existing name updates that scale instead of creating a new one."
              endpoint="/api/super-admin/config-library/grading-scales"
              submitLabel="Save scale"
              fields={[
                { name: "name", label: "Scale name", required: true, placeholder: "e.g. WAEC Nigeria", section: "Identity" },
                { name: "passMark", label: "Pass mark", type: "number", defaultValue: 40, min: 0, max: 100, section: "Identity" },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated)", parse: "csv", section: "Configuration" },
                { name: "gradeBands", label: "Grade bands (JSON array)", type: "textarea", parse: "json", required: true, defaultValue: "[\n  { \"grade\": \"A1\", \"min\": 75, \"max\": 100, \"remark\": \"Excellent\" }\n]", section: "Configuration" }
              ]}
            />
          }
        />
      ) : null}

      {tab === "reportcards" ? (
        <ReportCardsTable
          items={data.reportCards}
          actions={
            <ResourceActionDialog
              triggerLabel="New layout"
              title="New report card layout"
              description="Define a base layout and which curricula/tiers it applies to. Re-using an existing name updates that layout instead of creating a new one."
              endpoint="/api/super-admin/config-library/report-cards"
              submitLabel="Save template"
              fields={[
                { name: "name", label: "Template name", required: true, placeholder: "e.g. Standard portrait A4", section: "Identity" },
                { name: "layout", label: "Layout", required: true, placeholder: "portrait_a4", section: "Identity" },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated)", parse: "csv", section: "Availability" },
                { name: "availableToTiers", label: "Available to tiers (comma-separated)", parse: "csv", placeholder: "STANDARD, ELITE", section: "Availability" }
              ]}
            />
          }
        />
      ) : null}

      {tab === "country-settings" ? (
        <div className="grid gap-5">
          <TableCard
            title="Country configuration records — mostly scattered constants, not a unified record"
            description="Several Nigeria-specific behaviours a mature system would hold as one per-country configuration record. Checked against where each one actually lives in this codebase today."
            items={[
              { field: "registration_authority", purpose: "Name and number format of the business registration body", state: "\"CAC\" appears as a hardcoded string in NGO/Mission plan eligibility copy (Plans & Features) — not a configurable per-country record.", tone: "warn" },
              { field: "education_authority", purpose: "Name and approval number format of the education regulator", state: "Not tracked — no reference to an education regulator exists anywhere in this codebase.", tone: "bad" },
              { field: "phone_format", purpose: "Valid patterns and recognised network prefixes", state: "Not tracked — phone numbers are stored as free text; no format or network-prefix validation exists.", tone: "bad" },
              { field: "blocked_address_terms[]", purpose: "Reserved words, examination and regulatory body names, competitor names, offensive terms", state: "Real, but global — a hardcoded BLOCKED_TERMS list in the web-address registry, the same list for every school regardless of country.", tone: "warn" },
              { field: "default_channel", purpose: "Dominant parent notification channel", state: "Not tracked — no \"default channel\" concept exists; see Settings → Notifications for what actually sends.", tone: "bad" },
              { field: "working_hours / holidays[]", purpose: "Support service level calculation", state: "Real, but global and hardcoded — a fixed 6am–10pm window used for out-of-hours flagging, not a per-country record.", tone: "warn" },
              { field: "currency / locale", purpose: "Formatting, invoicing, reporting", state: "Real — Naira, hardcoded platform-wide (see Settings → Platform).", tone: "good" },
              { field: "data_protection_regime", purpose: "Which framework applies, retention defaults, consent age", state: "Real as a reference — NDPA 2023 and GAID 2025 are named in Security & Compliance, but consent age itself is not tracked or enforced anywhere.", tone: "warn" },
              { field: "verification_sources[]", purpose: "Which public checks a reviewer can actually perform in this country", state: "Not tracked as a per-country list — see School Accounts for what a real risk/verification review actually checks.", tone: "bad" }
            ]}
            getRowKey={(row) => row.field}
            columns={[
              { key: "field", header: "Field", render: (row) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{row.field}</span> },
              { key: "purpose", header: "Purpose", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.purpose}</span> },
              {
                key: "state",
                header: "Real state today",
                render: (row) => {
                  const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" } }[row.tone as "good" | "warn" | "bad"];
                  return <span className="inline-block rounded-[8px] px-2.5 py-2 text-[12px] leading-5" style={{ background: tone.bg, color: tone.fg }}>{row.state}</span>;
                }
              }
            ]}
          />

          <TableCard
            title="Country records on file"
            description="Only Nigeria is real — the platform has no config record for any other country; a launch elsewhere would be a code change today, not a data change (see Curriculum & Academics' portability review)."
            items={extras.countrySettings.map((row) => ({
              country: row.country,
              regime: "NDPA 2023 + GAID 2025",
              channel: null,
              currency: row.defaultCurrency ?? "NGN",
              consentAge: null,
              schools: row.schoolCount
            }))}
            getRowKey={(row) => row.country}
            columns={[
              {
                key: "country",
                header: "Country",
                render: (row) => (
                  <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    <Globe2 className="h-[15px] w-[15px] text-[var(--color-text-muted)]" />
                    {row.country}
                  </span>
                )
              },
              { key: "regime", header: "Regime", render: (row) => row.regime },
              { key: "channel", header: "Channel", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
              { key: "currency", header: "Currency", render: (row) => row.currency },
              { key: "consentAge", header: "Consent age", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
              { key: "schools", header: "Real schools", render: (row) => row.schools },
              { key: "state", header: "State", render: () => <StatusBadge status="LIVE" tone="success" /> }
            ]}
            emptyState="No countries on record yet — add a school or curriculum template to populate this view."
          />
        </div>
      ) : null}
    </div>
  );
}

const flowToneStyle: Record<"good" | "warn" | "bad" | "ink" | "plain", { bg: string; fg: string; bd: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", bd: "#CFE4DB" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", bd: "#F2E4C6" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", bd: "#F3E0E0" },
  ink: { bg: "#0D2315", fg: "#fff", bd: "#0D2315" },
  plain: { bg: "#fff", fg: "var(--color-text-primary)", bd: "var(--color-border-default)" }
};

function CurriculumLifecycleFlow() {
  const steps: Array<{ label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" }> = [
    { label: "Drafted", note: "Real — a Super Admin can create or edit a template at any time" },
    { label: "Previewed", note: "Not built — no sample-data render exists for a template" },
    { label: "Validated", note: "Not built — nothing checks bands are contiguous or subjects are sane", tone: "bad" },
    { label: "Published", note: "Not applicable — isActive is the only state; there's no separate publish step", tone: "warn" },
    { label: "Superseded", note: "Not built — saving overwrites the same row; nothing is kept as a prior version" },
    { label: "Archived", note: "Real, but different — isActive: false hides it from new selection; it isn't a distinct archived state", tone: "ink" }
  ];

  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[14px] font-semibold text-[#0D2315]">Curriculum template lifecycle — the aspiration, checked against real code</p>
      <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">
        A mature library would move a template through these stages in one direction only. This codebase has exactly one boolean (isActive) — everything else here is not built.
      </p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
