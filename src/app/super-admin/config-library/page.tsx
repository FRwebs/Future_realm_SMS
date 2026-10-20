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

function countryFields(row?: SuperAdminConfigLibrary["profiles"][number]) {
  return [
    { name: "country", label: "Country", required: true, defaultValue: row?.country ?? "", section: "Identity" },
    { name: "currency", label: "Currency (3 letters)", required: true, defaultValue: row?.currency ?? "NGN", section: "Identity" },
    { name: "isLive", label: "Schools are being set up here", type: "select" as const, defaultValue: String(row?.isLive ?? false), options: [{ label: "Yes — live", value: "true" }, { label: "No — not yet", value: "false" }], section: "Identity" },
    { name: "phonePattern", label: "Phone pattern (regular expression)", defaultValue: row?.phonePattern ?? "", section: "Phone and channel" },
    { name: "phonePrefixes", label: "Network prefixes (comma-separated)", type: "textarea" as const, parse: "csv" as const, defaultValue: row?.phonePrefixes.join(", ") ?? "", section: "Phone and channel" },
    { name: "defaultChannel", label: "Default parent channel", type: "select" as const, defaultValue: row?.defaultChannel ?? "", options: [{ label: "Not set", value: "" }, { label: "SMS", value: "SMS" }, { label: "Email", value: "EMAIL" }, { label: "WhatsApp", value: "WHATSAPP" }], section: "Phone and channel" },
    { name: "educationAuthority", label: "Education authority", defaultValue: row?.educationAuthority ?? "", section: "Authorities" },
    { name: "registrationAuthority", label: "Business registration authority", defaultValue: row?.registrationAuthority ?? "", section: "Authorities" },
    { name: "dataProtectionRegime", label: "Data protection regime", defaultValue: row?.dataProtectionRegime ?? "", section: "Data protection" },
    { name: "consentAge", label: "Consent age", type: "number" as const, defaultValue: row?.consentAge ?? undefined, min: 0, max: 25, section: "Data protection" },
    { name: "verificationSources", label: "Verification sources (comma-separated)", type: "textarea" as const, parse: "csv" as const, defaultValue: row?.verificationSources.join(", ") ?? "", section: "Data protection" }
  ];
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
        description="A versioned library of curriculum, grading scale and report card templates, and the country profiles they hang from. A new school's setup copies the published grading scale for its country and records which version it took; the school then owns its copy."
        action={
          <ResourceActionDialog
            triggerLabel="New template"
            title="New master template"
            description="Starts a draft. It becomes available to new schools only once it is validated and published — and a published version is never edited again, a new version is made instead."
            endpoint="/api/super-admin/config-library/curricula"
            submitLabel="Save draft"
            variant="heroWhite"
            fields={[
              { name: "name", label: "Template name", required: true, placeholder: "e.g. Nigerian Standard (NERDC)", section: "Identity" },
              { name: "country", label: "Country", type: "select", required: true, options: data.profiles.map((profile) => ({ label: profile.country, value: profile.country })), note: "A country needs a profile (Country Settings) before a template can be validated.", section: "Identity" },
              { name: "version", label: "Version", required: true, defaultValue: "1.0", section: "Identity" },
              { name: "owner", label: "Owner", type: "static", placeholder: "You — recorded when saved", section: "Identity" },
              { name: "effectiveFrom", label: "Effective from", type: "date", note: "Blank means the day it is published.", section: "Identity" },
              { name: "baseOnId", label: "Base on", type: "select", defaultValue: "", options: [{ label: "Start blank", value: "" }, ...data.curricula.map((c) => ({ label: `${c.name} v${c.version}`, value: c.id }))], note: "Copies the subjects and language from an existing template.", section: "Starting point" },
              { name: "calendarType", label: "Layer 1 · calendar", type: "select", options: calendarOptions, section: "Starting point" },
              { name: "language", label: "Language of instruction", placeholder: "e.g. English", section: "Starting point" },
              { name: "layer2", label: "2 · Levels and classes", type: "toggle", disabled: true, note: "Not authored here — a school's class ladder comes from the levels it chooses at setup.", section: "Layers to author" },
              { name: "layer3", label: "3 · Subjects", type: "toggle", section: "Layers to author" },
              { name: "layer4", label: "4 · Assessment", type: "toggle", disabled: true, note: "Each school sets its own CA/exam weights; there is no platform preset.", section: "Layers to author" },
              { name: "layer5", label: "5 · Grading", type: "toggle", note: "Authored as a grading scale in its own tab, then named under Applicable curricula.", section: "Layers to author" },
              { name: "layer6", label: "6 · Report card", type: "toggle", disabled: true, section: "Layers to author" },
              { name: "subjects", label: "Subjects (comma-separated)", type: "textarea", parse: "csv", placeholder: "Mathematics, English, Basic Science", section: "Configuration" }
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
            { layer: "1", name: "Education System", governs: "Calendar shape, term/semester count, currency, language, phone format, promotion policy", state: "Partly — a country profile (Country Settings tab) now holds currency, phone format, authorities, consent age and channel as data, and the template names its calendar. A school's own term dates are still set on the school, and its currency still defaults to NGN in finance code.", tone: "warn" },
            { layer: "2", name: "Level Structure", governs: "The stages and classes a school may operate, and which are examination/transition points", state: "Not built — every school creates its own class-level rows directly; there's no master \"stages\" record to select from, and nothing in the schema links a class to a curriculum template.", tone: "bad" },
            { layer: "3", name: "Subject Framework", governs: "Subject catalogue, core/elective/compulsory-choice rules, minimum and maximum subject counts", state: "A versioned reference list — subjects are kept per version and mapped from one version to the next. A new school's subjects still come from the platform's built-in catalogue, not from this list.", tone: "warn" },
            { layer: "4", name: "Assessment Framework", governs: "The components that make up a subject score, their weights, term and session aggregation", state: "Confirmed not a master template — every school builds its own CA/exam weighting from scratch, with no platform preset (see Assessment Frameworks tab). This is the one layer with no library at all, by design of the current schema.", tone: "bad" },
            { layer: "5", name: "Grading Scale", governs: "Bands, boundaries, labels, remarks, pass mark", state: "Real and connected — a published scale is validated (0–100, no gap or overlap), copied into each new school in a country whose curriculum names it, and the version taken is recorded. Without one, the platform default from Settings applies.", tone: "good" },
            { layer: "6", name: "Report Card Template", governs: "Layout, which fields are displayed, position/ranking display rules", state: "A single free-text layout name, not structured section data — there's no field for position display, cumulative columns, or behavioural domains. Also unlinked to any school.", tone: "warn" }
          ]}
          getRowKey={(row) => row.layer}
          columns={[
            { key: "layer", header: "Layer", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.layer}</span> },
            { key: "name", header: "Name", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.name}</span> },
            { key: "governs", header: "What it would govern", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.governs}</span> },
            {
              key: "state",
              header: "Real state today",
              render: (row) => {
                const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" } }[row.tone as "good" | "warn" | "bad"];
                return <span className="inline-block rounded-[7px] px-2.5 py-2 text-[11px] leading-5" style={{ background: tone.bg, color: tone.fg }}>{row.state}</span>;
              }
            }
          ]}
        />

        <section className="overflow-hidden rounded-[12.5px] border border-[#DEE8E2] bg-white">
          <div className="border-b border-[#E6EEE9] px-5 py-4">
            <p className="font-[var(--font-display)] text-[14.5px] font-bold text-[#0D2315]">Three hard constraints on every other module</p>
            <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">Each follows directly from the governing principle — checked against this codebase, not asserted.</p>
          </div>
          <div className="grid gap-3 p-5">
            {[
              { label: "No module may contain a literal reference to a Nigerian grade band, subject name, term count or class level", detail: "Partly met — signup takes a country, and grade bands can come from a published template. But finance code still falls back to NGN, the signup phone check is the Nigerian pattern, and a school's level structure is drawn from a fixed platform enum rather than configuration.", tone: "bad" },
              { label: "The result engine takes the assessment framework as an input, never as an assumption", detail: "Met — component weights, tie-handling, and absent-handling are all read from each school's own AssessmentComponent configuration (see Assessment Frameworks), not hard-coded.", tone: "good" },
              { label: "Master templates are owned by Nooria; the copy a school customises is owned by that school", detail: "Met for grading — setup copies the published scale into the school's own grading scheme and records the version (see “Schools and the version they took”). Later versions never change a school that already has one.", tone: "good" }
            ].map((item) => {
              const dot = { good: "var(--color-success)", bad: "var(--color-danger)", mute: "var(--color-text-muted)" }[item.tone];
              return (
                <div key={item.label} className="flex items-start gap-3 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
                  <div>
                    <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <TableCard
          title="Versioning requirements"
          description="Checked against the real template-update code, not the aspiration."
          items={[
            { requirement: "Templates are versioned", spec: "Enforced — a template is a name plus a version. Publishing a new version supersedes the Active one; a validated or published version cannot be edited, only copied into a new draft. Effective-from is kept.", state: "good" },
            { requirement: "Assignment is per class", spec: "Not built — a copy is taken per school at setup. There is no link from a class or cohort to a template version, so two classes cannot run different versions.", state: "bad" },
            { requirement: "Historical results are immutable", spec: "Partly — a school owns its copy, so publishing a new version cannot change a school's past results. A score record still carries no curriculum-version tag of its own.", state: "warn" },
            { requirement: "Migration path is explicit", spec: "Enforced as data — subject mappings (renamed, merged, split) are recorded between versions of the same template and checked against both subject lists.", state: "good" },
            { requirement: "Schools are notified, not forced", spec: "Partly — schools are never forced: they keep their copy. They are not notified of a new version either; nothing tells a school one exists.", state: "warn" }
          ]}
          getRowKey={(row) => row.requirement}
          columns={[
            { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
            { key: "spec", header: "What actually happens", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
            {
              key: "state",
              header: "State",
              render: (row) => {
                const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "N/A" } }[row.state as "good" | "warn" | "bad" | "mute"];
                return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
              }
            }
          ]}
        />

        <CurriculumLifecycleFlow />

        <div className="grid gap-5 lg:grid-cols-2">
          <TableCard
            title="Subject mapping between template versions"
            description="How a subject is renamed, merged or split when a template changes, so a student's history stays explainable years later."
            items={data.mappings}
            getRowKey={(row) => row.id}
            actions={
              <ResourceActionDialog
                triggerLabel="Add mapping"
                title="Map a subject between two versions"
                description="Both versions must be of the same template, and each subject must exist in its version."
                endpoint="/api/super-admin/config-library/mappings"
                submitLabel="Save mapping"
                variant="secondary"
                fields={[
                  { name: "fromTemplateId", label: "From version", type: "select", required: true, options: data.curricula.map((c) => ({ label: `${c.name} v${c.version}`, value: c.id })) },
                  { name: "toTemplateId", label: "To version", type: "select", required: true, options: data.curricula.map((c) => ({ label: `${c.name} v${c.version}`, value: c.id })) },
                  { name: "fromSubject", label: "Subject in the old version", required: true },
                  { name: "toSubject", label: "Subject in the new version", required: true },
                  { name: "relationship", label: "Relationship", type: "select", defaultValue: "RENAMED", options: [{ label: "Renamed", value: "RENAMED" }, { label: "Merged (several old into one)", value: "MERGED" }, { label: "Split (one old into several)", value: "SPLIT" }] }
                ]}
              />
            }
            columns={[
              { key: "from", header: "From", render: (row) => <span>{row.fromSubject} <span className="text-[11px] text-[var(--color-text-muted)]">v{row.fromVersion}</span></span> },
              { key: "to", header: "To", render: (row) => <span>{row.toSubject} <span className="text-[11px] text-[var(--color-text-muted)]">v{row.toVersion}</span></span> },
              { key: "relationship", header: "Relationship", render: (row) => row.relationship.toLowerCase() },
              { key: "x", header: "", render: (row) => <ResourceActionDialog triggerLabel="Remove" title="Remove this mapping" description={`${row.fromSubject} → ${row.toSubject}`} endpoint={`/api/super-admin/config-library/mappings/${row.id}`} method="DELETE" variant="textActionDanger" submitLabel="Remove" confirmLabel="Confirm" fields={[]} /> }
            ]}
            emptyState="No subject has been mapped between versions yet — it matters once a template has a second version."
          />
          <TableCard
            title="Schools and the version they took"
            description="The copy each new school's setup took from the library. Per-class assignment is not built — the unit is the school."
            items={data.adoptions}
            getRowKey={(row) => row.id}
            columns={[
              { key: "school", header: "School", render: (row) => row.school },
              { key: "kind", header: "Copied", render: (row) => row.kind === "GRADING" ? "Grading scale" : "Curriculum" },
              { key: "template", header: "Template", render: (row) => `${row.template} v${row.version}` },
              { key: "at", header: "When", render: (row) => row.at.slice(0, 10) }
            ]}
            emptyState="No school has taken a template yet. When a scale is published for a country, the next school set up there is given a copy and listed here."
          />
        </div>

        <TableCard
          title="Portability tests — checked against this codebase"
          description="Tests any curriculum-facing feature would need to pass to launch a new country by configuration alone rather than a code change. Checked against real code, not asserted as passing by default."
          items={[
            { test: "T1", question: "Does it work with a different currency, calendar, script or grading system?", failureLooksLike: "A fee field hardcoded to Naira; a country hardcoded at signup", state: "warn", verdict: "Partly — signup takes a country and the country profile holds currency, but \"NGN\" is still the fallback across pricing/finance code." },
            { test: "T2", question: "Does it assume a three-term year?", failureLooksLike: "A results table with three fixed columns; a session average dividing by three", state: "mute", verdict: "Not exercised — a school's real term structure comes from its own Term/AcademicSession records, entirely decoupled from the curriculum template's calendarType field, which nothing else reads." },
            { test: "T3", question: "Does it assume examination-band grading?", failureLooksLike: "A grade lookup returning A1 to F9; a report card column headed WAEC Grade", state: "mute", verdict: "Not exercised — grading-scale templates store arbitrary bands, but (per Layer 5 above) no school is linked to one, so this is untested by real use." },
            { test: "T4", question: "Does it assume a numeric score exists at all?", failureLooksLike: "A position computation that cannot run against descriptive bands", state: "bad", verdict: "Fails as built — a score is a mandatory number on every score record; there is no descriptive-band-only scoring path anywhere in this system." },
            { test: "T5", question: "Does it assume WhatsApp is the parent channel?", failureLooksLike: "A notification path with no channel fallback; copy that says WhatsApp rather than the configured channel", state: "good", verdict: "Passes, trivially — WhatsApp isn't wired as a real send channel at all yet (see Settings → Notifications), so nothing depends on it being the default." },
            { test: "T6", question: "Does it assume a single-campus, owner-operated school?", failureLooksLike: "No path for a group or trust; a single owner with no delegation model", state: "good", verdict: "Passes — a school can be marked as a group with its own Campus records; multi-campus is a real, modeled structure." },
            { test: "T7", question: "Would it survive scrutiny under a stricter regime than Nigeria's?", failureLooksLike: "Children's data with no consent record; no route to erasure; no processing record", state: "mute", verdict: "Not reviewed here — see Security & Compliance for the platform's actual data-retention and deletion posture." },
            { test: "T8", question: "Can a new country launch by adding configuration records alone?", failureLooksLike: "Any answer that includes writing code", state: "warn", verdict: "Partly — a country profile, a curriculum and a grading scale can be added as data and a new school there is given them. The level ladder, signup phone check and finance defaults still need code." }
          ]}
          getRowKey={(row) => row.test}
          columns={[
            { key: "test", header: "#", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.test}</span> },
            { key: "question", header: "Test", render: (row) => <span className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{row.question}</span> },
            { key: "failureLooksLike", header: "Failure looks like", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.failureLooksLike}</span> },
            { key: "verdict", header: "What's actually true here", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.verdict}</span> },
            {
              key: "state",
              header: "State",
              render: (row) => {
                const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Passing" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Fails" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not reviewed" } }[row.state as "good" | "warn" | "bad" | "mute"];
                return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
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
              { key: "meaning", header: "Meaning", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.meaning}</span> },
              { key: "constraint", header: "Constraint", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.constraint}</span> },
              {
                key: "state",
                header: "State",
                render: (row) => {
                  const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "bad"];
                  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
                }
              }
            ]}
          />

          <section className="overflow-hidden rounded-[12.5px] border border-[#DEE8E2] bg-white">
            <div className="border-b border-[#E6EEE9] px-5 py-4">
              <p className="font-[var(--font-display)] text-[14.5px] font-bold text-[#0D2315]">Nigerian curriculum structure — not populated in this codebase</p>
              <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
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
              description="Provide grade bands as JSON, e.g. [{&quot;grade&quot;:&quot;A1&quot;,&quot;min&quot;:75,&quot;max&quot;:100,&quot;remark&quot;:&quot;Excellent&quot;}]. It is saved as a draft: validate it, then publish."
              endpoint="/api/super-admin/config-library/grading-scales"
              submitLabel="Save scale"
              fields={[
                { name: "name", label: "Scale name", required: true, placeholder: "e.g. WAEC Nigeria", section: "Identity" },
                { name: "version", label: "Version", required: true, defaultValue: "1.0", section: "Identity" },
                { name: "passMark", label: "Pass mark", type: "number", defaultValue: 40, min: 0, max: 100, section: "Identity" },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated template names)", parse: "csv", note: "A new school in the country of a curriculum named here is given a copy once this scale is published.", section: "Configuration" },
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
            title="Country profiles"
            description="Everything the platform knows about a country, held as data. A country needs a profile before a template for it can be validated."
            items={data.profiles}
            getRowKey={(row) => row.id}
            actions={
              <ResourceActionDialog
                triggerLabel="Add a country"
                title="Add a country profile"
                description="Currency, phone format, authorities, consent age and channel for a country. Marking it live says schools are being set up there."
                endpoint="/api/super-admin/config-library/country-profiles"
                submitLabel="Save profile"
                fields={countryFields()}
              />
            }
            columns={[
              { key: "country", header: "Country", render: (row) => <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-primary)]"><Globe2 className="h-[13.5px] w-[13.5px] text-[var(--color-text-muted)]" />{row.country}</span> },
              { key: "regime", header: "Data protection", render: (row) => row.dataProtectionRegime ?? <span className="text-[var(--color-text-muted)]">Not set</span> },
              { key: "channel", header: "Channel", render: (row) => row.defaultChannel ?? <span className="text-[var(--color-text-muted)]">Not set</span> },
              { key: "currency", header: "Currency", render: (row) => row.currency },
              { key: "consentAge", header: "Consent age", render: (row) => (row.consentAge === null ? <span className="text-[var(--color-text-muted)]">Not set</span> : row.consentAge) },
              { key: "authority", header: "Authorities", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{[row.educationAuthority, row.registrationAuthority].filter(Boolean).join(" · ") || "Not set"}</span> },
              { key: "schools", header: "Real schools", render: (row) => row.schools },
              { key: "state", header: "State", render: (row) => <StatusBadge status={row.isLive ? "LIVE" : "NOT LIVE"} tone={row.isLive ? "success" : "neutral"} /> },
              { key: "edit", header: "", render: (row) => <ResourceActionDialog triggerLabel="Edit" title={`Country profile — ${row.country}`} description="Saves over this country's profile." endpoint="/api/super-admin/config-library/country-profiles" method="PATCH" variant="textAction" submitLabel="Save profile" fields={countryFields(row)} /> }
            ]}
            emptyState="No country has a profile yet."
            footnote={data.unprofiled.length ? `Schools exist in ${data.unprofiled.map((row) => `${row.country} (${row.schools})`).join(", ")} with no profile — add one.` : "Every country that has a school has a profile."}
          />

          <TableCard
            title="Where each country field is read"
            description="Each field a country profile holds, and whether anything in the platform reads it yet. Recording a field is not the same as enforcing it."
            items={[
              { field: "currency", purpose: "Formatting, invoicing, reporting", state: "Recorded — finance and pricing code still falls back to NGN directly rather than reading the profile.", tone: "warn" },
              { field: "phone_pattern / phone_prefixes", purpose: "Valid patterns and recognised network prefixes", state: "Recorded — signup's phone check still uses the built-in Nigerian pattern; the profile's pattern is not yet applied.", tone: "warn" },
              { field: "education_authority", purpose: "Name of the education regulator", state: "Recorded as reference — no screen or check reads it yet.", tone: "warn" },
              { field: "registration_authority", purpose: "Name of the business registration body", state: "Recorded as reference — the NGO plan's CAC wording is still a literal in plan copy.", tone: "warn" },
              { field: "default_channel", purpose: "Dominant parent notification channel", state: "Recorded as reference — delivery sends on the channel a message is queued for; it does not consult this.", tone: "warn" },
              { field: "consent_age", purpose: "Age below which a guardian must consent", state: "Recorded as reference — guardian consent is captured per family; the age is not enforced anywhere.", tone: "warn" },
              { field: "data_protection_regime", purpose: "Which framework applies", state: "Recorded — shown on this page; Security & Compliance's own obligations are authored separately.", tone: "warn" },
              { field: "verification_sources[]", purpose: "Which public checks a reviewer can perform here", state: "Recorded as reference — the school risk review shows its own fixed checks.", tone: "warn" },
              { field: "blocked_address_terms[]", purpose: "Reserved and offensive web-address terms", state: "Real, but global — a platform-wide list in the web-address registry, not per country.", tone: "warn" },
              { field: "currency / timezone defaults on a school", purpose: "Per-school formatting", state: "Real — set on each school at signup.", tone: "good" }
            ]}
            getRowKey={(row) => row.field}
            columns={[
              { key: "field", header: "Field", render: (row) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{row.field}</span> },
              { key: "purpose", header: "Purpose", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.purpose}</span> },
              {
                key: "state",
                header: "Read by the platform",
                render: (row) => {
                  const tone = row.tone === "good" ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" } : { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
                  return <span className="inline-block rounded-[7px] px-2.5 py-2 text-[11px] leading-5" style={{ background: tone.bg, color: tone.fg }}>{row.state}</span>;
                }
              }
            ]}
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
    { label: "Drafted", note: "Real — created as a draft; editable until validated" },
    { label: "Previewed", note: "Partly — a grading scale previews sample scores; a curriculum has nothing to render", tone: "warn" },
    { label: "Validated", note: "Real — subjects present, country profile exists; scales must cover 0–100 with no gap or overlap", tone: "good" },
    { label: "Published", note: "Real — becomes the Active version; the one before it is superseded", tone: "good" },
    { label: "Superseded", note: "Real — kept, read-only, with the schools that copied it" },
    { label: "Archived", note: "Real — taken out of use; copies already taken are untouched", tone: "ink" }
  ];

  return (
    <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[12.5px] font-semibold text-[#0D2315]">Template lifecycle</p>
      <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-[var(--color-text-muted)]">
        A template moves through these stages in one direction only; each is a recorded state, not a flag.
      </p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[10px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[11px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[9.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
