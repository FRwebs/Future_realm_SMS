import { Globe2 } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { ReferenceList } from "@/components/data-display/reference-list";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { formatDate } from "@/lib/utils/formatters";
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
    { name: "isLive", label: "Schools are being set up here", type: "switch" as const, on: (String(row?.isLive ?? false)) === "true", note: "Signup is open for this country, using its phone pattern and currency", section: "Identity" },
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

type ClassAssignmentRow = {
  id: string;
  schoolId: string;
  school: string;
  classId: string;
  className: string;
  templateId: string;
  template: string;
  version: string;
  assignedAt: string;
};

function tabHref(tab: string) {
  return tab === "curricula" ? "/super-admin/config-library" : `/super-admin/config-library?tab=${tab}`;
}

export default async function SuperAdminConfigLibraryPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "curricula" } = searchParams ? await searchParams : {};
  const data = await apiGet<SuperAdminConfigLibrary>("/api/super-admin/config-library");
  const [classAssignments, classOptions] = await Promise.all([
    apiGet<ClassAssignmentRow[]>("/api/super-admin/config-library/class-assignments").catch(() => [] as ClassAssignmentRow[]),
    apiGet<Array<{ value: string; label: string }>>("/api/super-admin/config-library/class-options").catch(() => [] as Array<{ value: string; label: string }>)
  ]);

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
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 09"
        title="Curriculum & Academics"
        description="The master library every school draws a copy from."
        action={
          <ResourceActionDialog
            triggerLabel="New template"
            title="New master template"
            description="Starts a draft. It becomes available to new schools only once it is validated and published — and a published version is never edited again, a new version is made instead."
            endpoint="/api/super-admin/config-library/curricula"
            submitLabel="Save draft"
            variant="heroWhite"
            note="No template reaches a school until it is validated and published, and a published version is never edited again." fields={[
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
        <div className="grid gap-[14px]">
        <CurriculumTemplatesTable items={data.curricula} />

        <TableCard
          title="The six-layer curriculum configuration model — what's real today"
          description="A fully layered model would let a school swap each of these independently, and read its own choice from live configuration rather than hard-coded assumptions. Each layer is rated against what the platform does today."
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

        <section className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-white">
          <div className="border-b border-[#E6EEE9] px-5 py-4">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Three hard constraints on every other module</p>
            <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">Each follows directly from the governing principle — each one checked against how the platform actually behaves.</p>
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
          title="Classes pinned to a version"
          description="A class running a named template version of its own, rather than whatever its school adopted. This is what lets a leaving year finish on the syllabus it was taught."
          items={classAssignments}
          pageSize={false}
          getRowKey={(row) => row.id}
          emptyState="No class is pinned. Every class runs the version its school adopted at setup, which is the right answer until a school is mid-change."
          actions={
            <ResourceActionDialog
              triggerLabel="Pin a class"
              title="Pin a class to a template version"
              description="The class runs this version whatever its school adopts afterwards, until the pin is removed."
              endpoint="/api/super-admin/config-library/class-assignments"
              variant="secondary"
              submitLabel="Pin the class"
              fields={[
                { name: "classId", label: "Class", type: "select", required: true, section: "What to pin", options: classOptions, note: classOptions.length ? undefined : "No active class was found to pin." },
                { name: "templateId", label: "Template version", type: "select", required: true, section: "What to pin", options: data.curricula.filter((row) => row.lifecycle !== "DRAFT").map((row) => ({ label: `${row.name} ${row.version} · ${row.lifecycle.toLowerCase()}`, value: row.id })), note: "A draft is not offered — nothing should be taught against a version that has not been validated." }
              ]}
              impact={{
                label: "Once pinned",
                rows: [
                  ["Only this class moves", "Every other class in the school carries on with what the school adopted."],
                  ["It survives the school adopting a new version", "That is the point: the pin is what the class is running, and it outranks the school's own."],
                  ["Removable at any time", "Clearing the pin puts the class straight back on its school's version."]
                ]
              }}
              note="Pin a class only when it genuinely needs a different syllabus from the rest of its school — usually a cohort finishing what it started."
            />
          }
          columns={[
            { key: "school", header: "School", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.school}</span> },
            { key: "class", header: "Class", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.className}</span> },
            { key: "template", header: "Running", render: (row) => <span className="text-[var(--color-text-primary)]">{row.template} <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{row.version}</span></span> },
            { key: "at", header: "Pinned", render: (row) => <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(row.assignedAt)}</span>, sortValue: (row) => row.assignedAt },
            {
              key: "clear",
              header: "",
              render: (row) => (
                <ResourceActionDialog
                  triggerLabel="Unpin"
                  title={`Unpin ${row.className}`}
                  description="The class goes back to running whatever its school adopted."
                  endpoint={`/api/super-admin/config-library/class-assignments/${row.classId}/clear`}
                  variant="secondary"
                  submitLabel="Unpin the class"
                  fields={[
                    { name: "_class", label: "Class", type: "static", placeholder: `${row.school} · ${row.className}`, section: "What you are unpinning" },
                    { name: "_running", label: "Currently running", type: "static", placeholder: `${row.template} ${row.version}`, section: "What you are unpinning" }
                  ]}
                  impact={{
                    label: "On unpinning",
                    rows: [
                      ["Back on the school's version", "Whatever the school adopted, from the next computation."],
                      ["Nothing already recorded changes", "Results worked out while the pin was on stay as they were."]
                    ]
                  }}
                />
              )
            }
          ]}
        />

        <TableCard
          title="Versioning requirements"
          description="Checked against the real template-update code, not the aspiration."
          items={[
            { requirement: "Templates are versioned", spec: "Enforced — a template is a name plus a version. Publishing a new version supersedes the Active one; a validated or published version cannot be edited, only copied into a new draft. Effective-from is kept.", state: "good" },
            { requirement: "Assignment is per class", spec: "Enforced — a class can be pinned to a named template version of its own, so a leaving year can finish on the syllabus it was taught while the intake below it starts on the new one. A class with no pin runs whatever its school adopted, and a draft cannot be pinned to anything.", state: "good" },
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
                return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
              }
            }
          ]}
        />

        <CurriculumLifecycleFlow />

        <div className="grid items-start gap-[14px] lg:grid-cols-2">
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
            title="Version assignment in a transitioning school"
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
          title="Portability tests every template must pass"
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
                return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
              }
            }
          ]}
        />
        </div>
      ) : null}

      {tab === "assessment-frameworks" ? (
        <div className="grid gap-[14px]">
          <TableCard
            title="Ready-made assessment frameworks"
            description="Frameworks in use across schools, grouped by weight pattern, most common first. Weights must total exactly 100 — the system refuses to save a framework that does not."
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
                Each school sets up its own framework; there is no shared framework library yet.
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
              { field: "cumulative_display", meaning: "Running cumulative alongside the term score", constraint: "Not built — there is no cumulative average yet.", state: "bad" },
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
                  return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
                }
              }
            ]}
          />

          <section className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-white">
            <div className="border-b border-[#E6EEE9] px-5 py-4">
              <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Nigerian National (NERDC 2025) — not configured yet</p>
              <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
                No stage or subject structure has been entered for this template yet. Each table below fills from the template once a Product Lead adds it; until then it is empty rather than assumed.</p>
            </div>
          </section>
          <ReferenceList
            title="Nigerian template defaults"
            sub="Shipped configuration — the school confirms or changes it during setup"
            items={[
              { label: "Seven components", detail: "Assignment, classwork, two tests, project and practical at 10 each, and a terminal exam at 40", tone: "teal" },
              { label: "Term aggregation: weighted sum to a score out of 100", detail: "The only rule that exists; each term stands alone", tone: "teal" },
              { label: "Position: computed within class, and arm where used", detail: "Never platform-wide", tone: "teal" },
              { label: "Ties: equal position, next position skipped", detail: "Not configurable per school", tone: "teal" },
              { label: "Absent: recorded as absent, never as zero", detail: "A distinct flag, separate from a numeric score", tone: "teal" },
              { label: "Rounding: two decimals", detail: "Applied to every computed total and average; not configurable", tone: "teal" }
            ]}
          />

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
          <div className="grid items-start gap-[14px] lg:grid-cols-2">
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
          <div className="grid items-start gap-[14px] lg:grid-cols-2">
            <TableCard
              title="Trade subjects — one is compulsory"
              items={[]}
              columns={[{ key: "a", header: "Trade subject", render: () => null }, { key: "b", header: "Trade subject", render: () => null }]}
              emptyState="No trade-subject record exists in this system."
            />
            <TableCard
              title="Primary subject sets"
              items={[]}
              columns={[{ key: "lower", header: "Primary 1–3", render: () => null }, { key: "upper", header: "Primary 4–6", render: () => null }]}
              emptyState="No primary-level subject-set record exists — lower and upper primary are not distinguished yet."
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
                { name: "gradeBands", label: "Grade bands — one per line", type: "textarea", parse: "bands", required: true, defaultValue: "A1 | 75-100 | Excellent", note: "Write each band as: grade | from-to | remark. The bands must cover 0 to 100 with no gap or overlap before the scale can be validated.", section: "Configuration" }
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
        <div className="grid gap-[14px]">
          <TableCard
            title="Country configuration records"
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
    <section className="rounded-[14px] border border-[var(--color-border-default)] bg-white p-6">
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
