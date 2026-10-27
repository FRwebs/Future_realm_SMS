import { Globe2 } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { FlowSteps } from "@/components/data-display/flow-steps";
import { ReferenceList } from "@/components/data-display/reference-list";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { formatDate } from "@/lib/utils/formatters";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";
import { CatalogueImport } from "@/components/modules/catalogue-import";
import { CARD_STEPS, cardFields } from "./_card-form";
import { RunPortability } from "./_library-sheets";
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

  const defaultScale = data.gradingScales.find((scale) => scale.lifecycle === "ACTIVE" && scale.isDefault);
  const fixedPatterns = new Set(data.frameworks.filter((f) => !f.isCustom).map((f) => f.components.map((c) => c.weight).join("/")));
  const customSchools = extras.weightPatterns.filter((p) => !fixedPatterns.has(p.pattern.replace(/\s/g, ""))).reduce((sum, p) => sum + p.schoolCount, 0);
  const TESTS: Array<[string, string, string]> = [
    ["T1", "Does it work with a different currency, calendar, script or grading system?", "A fee field formatted with a Naira symbol in code; a date parser assuming day-month-year"],
    ["T2", "Does it assume a three-term year?", "A results table with three fixed columns; a session average dividing by three"],
    ["T3", "Does it assume examination-band grading?", "A grade lookup returning A1 to F9; a report card column headed WAEC Grade"],
    ["T4", "Does it assume a numeric score exists at all?", "A position computation that cannot run against descriptive bands"],
    ["T5", "Does it assume WhatsApp is the parent channel?", "A notification path with no channel fallback; copy that says WhatsApp rather than the configured channel"],
    ["T6", "Does it assume a single-campus, owner-operated school?", "No path for a group or trust; a single owner with no delegation model"],
    ["T7", "Would it survive scrutiny under a stricter regime than Nigeria’s?", "Children’s data with no consent record; no route to erasure; no processing record"],
    ["T8", "Can a new country launch by adding configuration records?", "Any answer that includes writing code"]
  ];
  const inPlay = new Map(data.curricula.filter((c) => c.lifecycle !== "ARCHIVED" && c.lifecycle !== "SUPERSEDED").map((c) => [c.id, c.name]));
  const curriculumRuns = data.portabilityRuns.filter((run) => run.kind === "CURRICULUM" && inPlay.has(run.targetId));
  const portabilityRows = TESTS.map(([test, question, failure]) => {
    const results = curriculumRuns.map((run) => ({ run, result: run.results.find((r) => r.test === test) })).filter((entry): entry is { run: (typeof curriculumRuns)[number]; result: NonNullable<typeof entry.result> } => Boolean(entry.result));
    const state: "PASS" | "PARTIAL" | "FAIL" | "NONE" = results.length === 0 ? "NONE" : results.some((e) => e.result.state === "FAIL") ? "FAIL" : results.some((e) => e.result.state === "PARTIAL") ? "PARTIAL" : "PASS";
    return { test, question, failure, state, of: results.length, passing: results.filter((e) => e.result.state === "PASS").length };
  });
  const portabilityFindings = curriculumRuns.flatMap((run) => run.results.filter((r) => r.state !== "PASS").map((r) => `${r.test} · ${run.targetName} — ${r.note}`));
  const firstMapping = data.mappings[0];
  const mappingTitle = firstMapping ? `Subject mapping — ${firstMapping.template} v${firstMapping.fromVersion} to v${firstMapping.toVersion}` : "Subject mapping between template versions";
  const nerdc = data.curricula.find((c) => c.layers?.default) ?? data.curricula.find((c) => c.layers) ?? null;
  const layers = nerdc?.layers ?? null;

  const tabs = [
    { label: "Templates", href: tabHref("curricula"), active: tab === "curricula", badge: data.curricula.length },
    { label: "Assessment Frameworks", href: tabHref("assessment-frameworks"), active: tab === "assessment-frameworks" },
    { label: "Grading Scales", href: tabHref("grading"), active: tab === "grading" },
    { label: "Report Cards", href: tabHref("reportcards"), active: tab === "reportcards" },
    { label: "Country Settings", href: tabHref("country-settings"), active: tab === "country-settings", badge: extras.countrySettings.length },
    { label: "Topic Catalogue", href: tabHref("topic-catalogue"), active: tab === "topic-catalogue" }
  ];
  const catalogue = tab === "topic-catalogue" ? await apiGet<Array<{ id: string; curriculum: string; subject: string; stage: string; term: number; source: string | null; topics: number; updatedAt: string }>>("/api/super-admin/curriculum-catalogue").catch(() => []) : [];

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
            description="FutureRealm owns and publishes masters. A school customises a copy, and we never edit that copy."
            endpoint="/api/super-admin/config-library/curricula"
            submitLabel="Create draft"
            variant="heroWhite"
            note="No template reaches a school without passing preview, validation and the eight portability tests." fields={[
              { name: "name", label: "Template name", required: true, placeholder: "e.g. Nigerian Standard (NERDC)", section: "Identity" },
              { name: "country", label: "Country", type: "select", required: true, options: data.profiles.map((profile) => ({ label: profile.country, value: profile.country })), note: "A country needs a profile (Country Settings) before a template can be validated.", section: "Identity" },
              { name: "version", label: "Version", required: true, defaultValue: "1.0", section: "Identity" },
              { name: "owner", label: "Owner", type: "static", placeholder: "You — recorded when saved", section: "Identity" },
              { name: "effectiveFrom", label: "Effective from", type: "date", note: "Blank means the day it is published.", section: "Identity" },
              { name: "baseOnId", label: "Base on", type: "select", defaultValue: "", options: [{ label: "Start blank", value: "" }, ...data.curricula.map((c) => ({ label: `${c.name} v${c.version}`, value: c.id }))], note: "Copies the subjects and language from an existing template.", section: "Starting point" },
              { name: "calendarType", label: "Layer 1 · calendar", type: "select", options: calendarOptions, section: "Starting point" },
              { name: "language", label: "Language of instruction", placeholder: "e.g. English", section: "Starting point" },
              { name: "layer2", label: "2 · Levels and classes", type: "switch", on: true, note: "Stages, classes, arms", section: "Layers to author" },
              { name: "layer3", label: "3 · Subjects", type: "switch", on: true, note: "Catalogue, choice groups, level rules", section: "Layers to author" },
              { name: "layer4", label: "4 · Assessment", type: "switch", on: true, note: "Components and weights", section: "Layers to author" },
              { name: "layer5", label: "5 · Grading", type: "switch", on: true, note: "Bands or competency levels", section: "Layers to author" },
              { name: "layer6", label: "6 · Report card", type: "switch", on: true, note: "Sections and position rule", section: "Layers to author" },
              { name: "inheritLayer1", label: "Inherit Layer 1 from country", type: "switch", on: true, note: "Calendar, currency, channel", section: "Layers to author" },
              { name: "subjects", label: "Subjects (comma-separated)", type: "textarea", parse: "csv", placeholder: "Mathematics, English, Basic Science", section: "Configuration" }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "curricula" ? (
        <div className="grid gap-[14px]">
        <CurriculumTemplatesTable items={data.curricula} runs={data.portabilityRuns} />

        <TableCard
          title="The six-layer curriculum configuration model"
          description="Each layer is independently replaceable — which is what makes hybrid cases possible, such as a Nigerian school running a British curriculum on a Nigerian calendar"
            meta="A school selects a Layer 1 template at signup; layers 2–6 are pre-populated and can each be replaced independently"
          items={[
            { layer: "1", name: "Education System", governs: "Calendar shape, term or semester count, week start, currency, language, date format, phone format, promotion policy, the national qualification the system leads towards", readBy: "Country level" },
            { layer: "2", name: "Level Structure", governs: "The stages and classes a school may operate, their order, and which stage boundaries are examination or transition points", readBy: "Enrolment, promotion" },
            { layer: "3", name: "Subject Framework", governs: "Subject catalogue, per-level offering rules, core versus elective versus compulsory-choice, stream rules, minimum and maximum subject counts", readBy: "Subject assignment" },
            { layer: "4", name: "Assessment Framework", governs: "The components that make up a subject score, their weights, how they aggregate to a term score, and how terms aggregate to a session score", readBy: "Result engine", emphasis: true },
            { layer: "5", name: "Grading Scale", governs: "Bands, boundaries, labels, remarks, pass mark, and whether the scale is percentage, letter, points or descriptive only", readBy: "Result engine" },
            { layer: "6", name: "Report Card Template", governs: "Layout, which of the above is displayed, position and ranking display rules, behavioural domains, signatures", readBy: "Publishing" }
          ]}
          getRowKey={(row) => row.layer}
          pageSize={false}
          columns={[
            { key: "layer", header: "Layer", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.layer}</span> },
            { key: "name", header: "Name", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.name}</span> },
            { key: "governs", header: "What it governs", render: (row) => <span className="text-(--color-text-secondary)">{row.governs}</span> },
            { key: "readBy", header: "Read by", render: (row) => (row.emphasis ? <span className="inline-flex rounded-full bg-(--color-danger-dim) px-[9px] py-[3px] text-[11px] font-bold text-danger">{row.readBy}</span> : row.readBy) }
          ]}
        />

        <ReferenceList
          title="Three hard constraints on every other module"
          sub="Each follows directly from the governing principle"
          items={[
            { label: "No module may contain a literal reference to a Nigerian grade band, subject name, term count or class level", detail: "Where one is needed, it is read from the school’s active curriculum configuration", tone: "bad" },
            { label: "The result engine takes the assessment framework as an input, never as an assumption", detail: "It must produce correct results for a two-semester grade-point system with the same code path it uses for a three-term percentage system", tone: "bad" },
            { label: "Master templates are owned by FutureRealm; the copy a school customises is owned by that school", detail: "A change to a master template never reaches back into a school’s live configuration", tone: "bad" }
          ]}
        />

        <TableCard
          title="Versioning requirements"
          description="The single most valuable capability in this module"
          items={[
            { requirement: "Templates are versioned", spec: "Every template carries a version, an effective-from date and an effective-to date. Versions are never edited in place; a change creates a new version.", state: "good" },
            { requirement: "Assignment is per class", spec: "A school assigns a curriculum version to a class or cohort. JSS 1 may run the 2025 structure while SSS 3 runs the 2024 structure, simultaneously, within one school.", state: "good" },
            { requirement: "Historical results are immutable", spec: "A result computed under one version always renders under that version. Reissuing a report card from two years ago produces the document originally issued.", state: "warn" },
            { requirement: "Migration path is explicit", spec: "Where a subject is merged or renamed between versions, the template records the mapping. A student’s history shows Basic Science and Basic Technology in earlier years and Intermediate Science later.", state: "good" },
            { requirement: "Schools are notified, not forced", spec: "When a new version is published, affected schools are told and shown what changed. Nothing is applied automatically.", state: "good" }
          ]}
          getRowKey={(row) => row.requirement}
          pageSize={false}
          columns={[
            { key: "requirement", header: "Requirement", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.requirement}</span> },
            { key: "spec", header: "Specification", render: (row) => <span className="text-(--color-text-secondary)">{row.spec}</span> },
            {
              key: "state",
              header: "State",
              render: (row) => row.state === "good"
                ? <span className="inline-flex rounded-full bg-(--color-success-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-success)">Enforced</span>
                : <span className="inline-flex rounded-full bg-(--color-warning-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-warning)">Partial</span>
            }
          ]}
          footnote="Partial means the platform does not yet do all of it: a score record carries no curriculum-version tag of its own, so a past report card is rebuilt from the school’s own copy rather than from a stored version. Publishing a new version tells the owner and principal of every school that took the old one; nothing is applied to them."
        />

        <FlowSteps
          title="Curriculum template lifecycle"
          sub="Archived is not deleted, because a result computed in 2026 must still be explainable in 2032"
          steps={[
            { label: "Drafted", note: "Product Lead creates or revises a version" },
            { label: "Previewed", note: "Rendered against sample data — subjects, a full term of scores, a computed result, a report card" },
            { label: "Validated", note: "Bands contiguous, weights total 100, choice groups satisfiable, counts in range", tone: "warn" },
            { label: "Published", note: "Version and effective dates fixed; affected schools notified", tone: "good" },
            { label: "Superseded", note: "Remains fully usable for classes already assigned to it" },
            { label: "Archived", note: "Not selectable for new assignment, but never deleted", tone: "ink" }
          ]}
        />

        <div className="grid items-start gap-[14px] lg:grid-cols-[1.1fr_1fr]">
          <TableCard
            title={mappingTitle}
            description="Recorded rather than rewriting earlier records"
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
              { key: "from", header: "From", render: (row) => row.fromSubject },
              { key: "to", header: "To", render: (row) => row.toSubject },
              { key: "relationship", header: "Relationship", render: (row) => <span className="inline-flex rounded-full bg-(--color-info-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-info)">{row.relationship.charAt(0) + row.relationship.slice(1).toLowerCase()}</span> },
              { key: "x", header: "", render: (row) => <ResourceActionDialog triggerLabel="Remove" title="Remove this mapping" description={`${row.fromSubject} → ${row.toSubject}`} endpoint={`/api/super-admin/config-library/mappings/${row.id}`} method="DELETE" variant="textActionDanger" submitLabel="Remove" confirmLabel="Confirm" fields={[]} /> }
            ]}
            emptyState="No subject has been mapped between versions yet — it matters once a template has a second version."
          />
                  <TableCard
          title="Version assignment in a transitioning school"
          description="One class can run a different curriculum version from the rest of its school — which is what lets a leaving year finish on the syllabus it was taught while the intake below it starts on the new one."
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
            { key: "school", header: "School", render: (row) => <span className="font-semibold text-(--color-text-primary)">{row.school}</span> },
            { key: "class", header: "Class", render: (row) => <span className="text-(--color-text-secondary)">{row.className}</span> },
            { key: "template", header: "Curriculum version", render: (row) => <span className="text-(--color-text-primary)">{row.template} <span className="font-(--font-mono) text-(--color-text-muted)">{row.version}</span></span> },
            { key: "at", header: "Assigned", render: (row) => <span className="text-[11px] text-(--color-text-muted)">{formatDate(row.assignedAt)}</span>, sortValue: (row) => row.assignedAt },
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
                  footnote="One school, two live curriculum versions, both computing correctly — and both explainable to a parent from the calculation trace."
        />

        </div>

        <TableCard
          title="Portability tests every template must pass"
          description="Checked before any template is published, and before any feature touching curriculum, assessment, grading, notification or identity is merged."
            meta="Section 9.6 · applied as a merge gate"
          actions={<RunPortability label="Run the tests" />}
          items={portabilityRows}
          getRowKey={(row) => row.test}
          pageSize={false}
          columns={[
            { key: "test", header: "#", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.test}</span> },
            { key: "question", header: "Test", render: (row) => <span className="text-(--color-text-secondary)">{row.question}</span> },
            { key: "failure", header: "Failure looks like", render: (row) => <span className="text-(--color-text-secondary)">{row.failure}</span> },
            {
              key: "state",
              header: "State",
              render: (row) => {
                const tone = { PASS: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Passing" }, PARTIAL: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, FAIL: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Fails" }, NONE: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not run" } }[row.state];
                return <span className="inline-flex whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}{row.of > 0 ? ` · ${row.passing} of ${row.of} pass` : ""}</span>;
              }
            }
          ]}
          footnote={portabilityFindings.length ? `Findings: ${portabilityFindings.join(" ")}` : data.portabilityRuns.length ? "Every master checked passes every test." : "The tests have not been run yet. They run whenever a template is validated, or from the button above."}
        />

        <TableCard
          title="Version assignment in a transitioning school"
          description="The copy each new school's setup took from the library. This is the school's own adoption; a class that needs a different version is pinned to one above, and its pin outranks this."
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
      ) : null}

      {tab === "assessment-frameworks" ? (
        <div className="grid gap-[14px]">
          <TableCard
            title="Ready-made assessment frameworks"
            description="A school selects one during setup, or builds its own. The setup wizard makes this a required step for exactly this reason."
            meta="Weights must total exactly 100 — the system refuses to save a framework that does not"
            items={data.frameworks}
            getRowKey={(row) => row.id}
            pageSize={false}
            emptyState="No ready-made framework is on file — add one."
            actions={
              <ResourceActionDialog
                triggerLabel="New framework"
                title="New assessment framework"
                description="A set of components, each marked out of a maximum and carrying a weight. The weights must total exactly 100."
                endpoint="/api/super-admin/config-library/assessment-frameworks"
                variant="secondary"
                submitLabel="Save framework"
                note="A framework that does not total exactly 100 produces quietly wrong results, so the system refuses to save it."
                fields={[
                  { name: "name", label: "Framework name", required: true, placeholder: "e.g. Project-weighted (10:20:70)", section: "The framework" },
                  { name: "typicalUser", label: "Typical user", placeholder: "Who this suits", section: "The framework" },
                  { name: "components", label: "Components — one per line", type: "textarea", required: true, defaultValue: "CA1 | First CA | 20 | 10\nCA2 | Second CA | 20 | 30\nEXAM | Examination | 100 | 60", note: "Write each as: code | name | marked out of | weight. The weights must total 100.", section: "Components" }
                ]}
              />
            }
            columns={[
              { key: "name", header: "Framework", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.name}{row.isActive ? null : <span className="ml-2 text-[10.5px] font-normal text-(--color-text-muted)">switched off</span>}</span> },
              { key: "components", header: "Components", render: (row) => (row.isCustom ? "Any components the school defines" : row.components.map((c) => c.name).join(", ")) },
              { key: "weights", header: "Weights", render: (row) => (row.isCustom ? "Must total 100" : row.components.map((c) => c.weight).join(" / ")) },
              { key: "typical", header: "Typical user", render: (row) => <span className="text-(--color-text-secondary)">{row.typicalUser ?? "—"}</span> },
              { key: "schools", header: "Schools", render: (row) => (row.isCustom ? (customSchools > 0 ? customSchools : "—") : row.schools > 0 ? row.schools : "—") },
              { key: "toggle", header: "", sortable: false, render: (row) => (row.isCustom ? null : <ResourceActionDialog triggerLabel={row.isActive ? "Switch off" : "Switch on"} title={`${row.isActive ? "Switch off" : "Switch on"} ${row.name}`} description={row.isActive ? "It is no longer offered at setup. Schools already using it are not changed." : "It is offered at setup again."} endpoint={`/api/super-admin/config-library/assessment-frameworks/${row.id}/toggle`} variant="textAction" submitLabel={row.isActive ? "Switch off" : "Switch on"} fields={[]} />) }
            ]}
          />
          <div className="grid items-start gap-[14px] lg:grid-cols-[1.2fr_1fr]">
            <TableCard
              title="Layer 4 fields and their constraints"
              description="This is the layer where an error becomes a wrong result on a child’s report card, so it is specified more tightly than the others"
              items={[
                { field: "components[]", meaning: "The named parts of a subject score", constraint: "Each has a code, display name, maximum raw score and weight" },
                { field: "weight", meaning: "The proportion each contributes", constraint: "Must total exactly 100 — a framework summing to 98 produces quietly wrong results for a whole term" },
                { field: "max_raw_score", meaning: "The score the component is marked out of", constraint: "Entry above the maximum is rejected at entry, not at computation" },
                { field: "term_aggregation", meaning: "How components combine into a term score", constraint: "Weighted sum by default; other rules are configuration" },
                { field: "session_aggregation", meaning: "How term scores combine", constraint: "Average of terms, weighted terms, or final term only — all three are in real use" },
                { field: "cumulative_display", meaning: "Running cumulative alongside the term score", constraint: "Common and expected in Nigeria" },
                { field: "rounding", meaning: "Where and how rounding occurs", constraint: "Fixed platform-wide: half up, two decimals, at final total only. Deliberately not configurable." },
                { field: "position_basis", meaning: "Position within arm, class, or both", constraint: "Both computable; which is displayed is a report card setting" },
                { field: "tie_handling", meaning: "Two students with identical totals", constraint: "Equal position with the next skipped, by default. An unspecified tie rule is a guaranteed parent complaint." },
                { field: "absent_handling", meaning: "How an absent component is treated", constraint: "Distinct from a zero, always. A student absent for a test has not scored nothing." }
              ]}
              getRowKey={(row) => row.field}
              pageSize={false}
              columns={[
                { key: "field", header: "Field", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.field}</span> },
                { key: "meaning", header: "Meaning", render: (row) => <span className="text-(--color-text-secondary)">{row.meaning}</span> },
                { key: "constraint", header: "Constraint", render: (row) => <span className="text-(--color-text-secondary)">{row.constraint}</span> }
              ]}
            />
            <ReferenceList
              title="Nigerian template defaults"
              sub="Shipped configuration — the school confirms or changes it during setup"
              emptyText="No default template is on file."
              items={nerdc ? [
                ...(layers?.assessment?.components ?? []).map((c) => ({ label: `${c.name} — out of ${c.max}, weight ${c.weight}`, tone: "teal" as const })),
                { label: "Term aggregation: weighted sum to a score out of 100", tone: "good" as const },
                { label: "Session aggregation: average of three terms", detail: "With a running cumulative on second and third term reports", tone: "good" as const },
                { label: "Position: computed within arm and class", detail: "Arm position displayed by default", tone: "good" as const },
                { label: "Ties: equal position, next position skipped", tone: "warn" as const },
                { label: "Absent: recorded as absent, never as zero", detail: "Excluded from the component average, shown explicitly on the report card", tone: "bad" as const }
              ] : []}
            />
          </div>
          {nerdc ? (
            <>
              <TableCard
                title={`Level structure — ${nerdc.name}`}
                description="The default template for the beachhead market, and therefore the one that must be exactly right"
                items={layers?.levels ?? []}
                getRowKey={(row) => row.stage}
                pageSize={false}
                columns={[
                  { key: "stage", header: "Stage", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.stage}</span> },
                  { key: "classes", header: "Classes", render: (row) => row.classes },
                  { key: "exam", header: "Terminal examination", render: (row) => (row.exam === "—" ? <span className="text-(--color-text-muted)">—</span> : <span className="inline-flex rounded-full bg-(--color-info-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-info)">{row.exam}</span>) },
                  { key: "notes", header: "Notes", render: (row) => <span className="text-(--color-text-secondary)">{row.notes}</span> }
                ]}
                footnote={layers?.levelsFootnote}
              />
              <div className="grid items-start gap-[14px] lg:grid-cols-2">
                <TableCard
                  title="Junior secondary subject framework"
                  description={layers?.junior?.range}
                  items={layers?.junior?.subjects ?? []}
                  getRowKey={(row) => row.name}
                  pageSize={false}
                  columns={[
                    { key: "subject", header: "Subject", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.name}</span> },
                    { key: "category", header: "Category", render: (row) => (row.note ? <span className="text-(--color-text-secondary)">{row.note}</span> : <span className={`inline-flex rounded-full px-[9px] py-[3px] text-[11px] font-bold ${row.category === "Core" ? "bg-(--color-info-dim) text-(--color-info)" : row.category === "Compulsory choice" ? "bg-(--color-warning-dim) text-(--color-warning)" : "bg-(--color-bg-subtle) text-(--color-text-muted)"}`}>{row.category}</span>) }
                  ]}
                />
                <TableCard
                  title="Senior secondary"
                  description={layers?.senior?.sub}
                  items={[
                    ...(layers?.senior?.core ?? []).map((row) => ({ key: row.name, a: row.name, b: row.applies, stream: false })),
                    ...(layers?.senior?.streams ?? []).map((row) => ({ key: row.stream, a: row.stream, b: row.subjects, stream: true }))
                  ]}
                  getRowKey={(row) => row.key}
                  pageSize={false}
                  columns={[
                    { key: "a", header: "Compulsory core", render: (row) => (row.stream ? <span className="inline-flex rounded-full bg-(--color-info-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-info)">{row.a}</span> : <span className="font-bold text-(--color-text-primary)">{row.a}</span>) },
                    { key: "b", header: "Applies", render: (row) => <span className="text-(--color-text-secondary)">{row.b}</span> }
                  ]}
                  footnote={layers?.senior?.footnote}
                />
              </div>
              <div className="grid items-start gap-[14px] lg:grid-cols-[1.1fr_1fr]">
                <TableCard
                  title="Trade subjects — one is compulsory"
                  description={layers?.trade?.sub}
                  items={Array.from({ length: Math.ceil((layers?.trade?.subjects.length ?? 0) / 2) }, (_, index) => ({ key: String(index), a: layers?.trade?.subjects[index * 2] ?? "", b: layers?.trade?.subjects[index * 2 + 1] ?? "" }))}
                  getRowKey={(row) => row.key}
                  pageSize={false}
                  columns={[{ key: "a", header: "Trade subject", render: (row) => row.a }, { key: "b", header: "Trade subject", render: (row) => row.b }]}
                  footnote={layers?.trade?.footnote}
                />
                <TableCard
                  title="Primary subject sets"
                  description="Lower and upper primary carry different lists"
                  items={Array.from({ length: Math.max(layers?.primary?.lower.length ?? 0, layers?.primary?.upper.length ?? 0) }, (_, index) => ({ key: String(index), lower: layers?.primary?.lower[index] ?? "—", upper: layers?.primary?.upper[index] ?? "—" }))}
                  getRowKey={(row) => row.key}
                  pageSize={false}
                  columns={[{ key: "lower", header: "Primary 1–3 (9–10)", render: (row) => (row.lower === "—" ? <span className="text-(--color-text-muted)">—</span> : row.lower) }, { key: "upper", header: "Primary 4–6 (11–13)", render: (row) => (row.upper === "—" ? <span className="text-(--color-text-muted)">—</span> : row.upper) }]}
                />
              </div>
            </>
          ) : (
            <section className="overflow-hidden rounded-[14px] border border-(--color-border-default) bg-white px-5 py-4">
              <p className="text-[14px] font-semibold text-(--color-text-primary)">No Nigerian default template is on file</p>
              <p className="mt-1 text-[10.5px] text-(--color-text-muted)">Run the library seed, or publish a Nigerian template with its layers, and the level structure and subject framework appear here.</p>
            </section>
          )}
          <TableCard
            title="Frameworks in use across schools"
            description="Frameworks in use across schools, grouped by weight pattern, most common first. Weights must total exactly 100 — the system refuses to save a framework that does not."
            items={extras.weightPatterns}
            getRowKey={(row) => row.pattern}
            columns={[
              { key: "pattern", header: "Weights", render: (row) => <span className="font-(--font-mono) font-bold text-(--color-text-primary)">{row.pattern}</span> },
              { key: "components", header: "Components (example school)", render: (row) => <span className="text-(--color-text-secondary)">{row.componentNames}</span> },
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
        </div>
      ) : null}

      {tab === "grading" ? (
        <GradingScalesTable
          items={data.gradingScales}
          actions={
            <>
            <ResourceActionDialog
              triggerLabel="New scale"
              variant="secondary"
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
            {defaultScale ? (
              <ResourceActionDialog
                triggerLabel="Edit the default scale"
                title="Edit the default grading scale"
                description="What a new school sees before it has decided anything. Getting it wrong makes results uncomputable across hundreds of schools."
                endpoint="/api/super-admin/config-library/grading-scales"
                submitLabel="Save scale"
                note="Bands must be contiguous and must not overlap. The system refuses to save a gap — but it cannot refuse a boundary that is legal and simply wrong."
                fields={[
                  { name: "name", label: "Scale", required: true, defaultValue: defaultScale.name, section: "Which scale" },
                  { name: "version", label: "Version", required: true, defaultValue: "", placeholder: `Currently ${defaultScale.version} — saving under a new number makes a new draft`, section: "Which scale" },
                  { name: "gradeBands", label: "The bands, highest first", type: "textarea", parse: "bands", required: true, defaultValue: (Array.isArray(defaultScale.gradeBands) ? (defaultScale.gradeBands as Array<{ grade: string; min: number; max: number; remark?: string }>) : []).map((band) => `${band.grade} | ${band.min}-${band.max} | ${band.remark ?? ""}`).join("\n"), note: "Write each band as: grade | from-to | remark. The bands must cover 0 to 100 with no gap or overlap.", section: "The bands, highest first" },
                  { name: "passMark", label: "Pass mark", type: "number", defaultValue: defaultScale.passMark, min: 0, max: 100, section: "Thresholds" },
                  { name: "applicableCurricula", label: "Applies to (curriculum names)", parse: "csv", defaultValue: defaultScale.applicableCurricula.join(", "), note: "Existing schools keep their own scale — their configuration is theirs", section: "Which scale" }
                ]}
                impact={{ label: "On saving", rows: [["Becomes a new version", "The current version stays readable, and every result already computed under it is unchanged"], ["New schools only", "Schools already set up keep the scale they are on"], ["Results already published", "Never recomputed. A grade a parent has seen does not change underneath them."]] }}
              />
            ) : null}
            </>
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
              description="Layer 6. What a parent physically holds at the end of a term."
              endpoint="/api/super-admin/config-library/report-card-layouts"
              submitLabel="Save as draft"
              steps={CARD_STEPS}
              note="A layout cannot be offered to a school until it has been previewed with real data and reviewed by someone other than its author."
              fields={cardFields(data.reportCards)}
              impact={{ label: "On saving", rows: [["Saved as a draft", "Not assignable to any school, and not visible outside this screen"], ["Sent for review", "The Layer 6 tests run, then a second person sees it with your name against it"], ["Once published", "Offered at setup to every school in the availability band chosen"]] }}
            />
          }
        />
      ) : null}

      {tab === "topic-catalogue" ? (
        <div className="grid gap-[14px]">
          <CatalogueImport base="/api/super-admin/curriculum-catalogue" templateHref="/api/super-admin/curriculum-catalogue/template" who="Every school sees what you load here when it plans a scheme of work." />
          <TableCard
            title="The catalogue every school sees"
            description="Subject, stage and term outlines from published curricula. A teacher starts a scheme of work from one; nothing is copied until they choose to. Only what has been imported is here — none of it is written by the product."
            items={catalogue}
            getRowKey={(row) => row.id}
            emptyState="Nothing has been loaded yet. Download the template, fill it from the published curriculum (NERDC, for example), and load it above."
            columns={[
              { key: "curriculum", header: "Curriculum", render: (row) => row.curriculum },
              { key: "subject", header: "Subject", render: (row) => row.subject },
              { key: "stage", header: "Stage", render: (row) => row.stage },
              { key: "term", header: "Term", render: (row) => row.term },
              { key: "topics", header: "Topics", render: (row) => row.topics },
              { key: "source", header: "Source", render: (row) => row.source ?? "—" }
            ]}
          />
        </div>
      ) : null}

      {tab === "country-settings" ? (
        <div className="grid gap-[14px]">
          <TableCard
            title="Country configuration records"
            description="Several Nigeria-specific behaviours were scattered through v3.0 as prose rather than data."
            meta="Edit: Product Lead and Super Admin"
            items={[
              { field: "registration_authority", purpose: "Name and number format of the business registration body", consumedBy: "M2.9 risk signals, signup labels" },
              { field: "education_authority", purpose: "Name and approval number format of the education regulator", consumedBy: "M2.9, signup form" },
              { field: "phone_format", purpose: "Valid patterns and recognised network prefixes", consumedBy: "M2.9, M4 delivery, all validation" },
              { field: "blocked_address_terms[]", purpose: "Reserved words, examination and regulatory body names, competitor names, offensive terms", consumedBy: "M2.10" },
              { field: "default_channel", purpose: "Dominant parent notification channel", consumedBy: "M4, School Admin defaults" },
              { field: "working_hours / holidays[]", purpose: "Support service level calculation", consumedBy: "M6.3" },
              { field: "currency / locale", purpose: "Formatting, invoicing, reporting", consumedBy: "M3, M7" },
              { field: "data_protection_regime", purpose: "Which framework applies, retention defaults, consent age", consumedBy: "M10" },
              { field: "verification_sources[]", purpose: "Which public checks a reviewer can actually perform in this country", consumedBy: "M2.9.2 review workflow" }
            ]}
            getRowKey={(row) => row.field}
            pageSize={false}
            columns={[
              { key: "field", header: "Field", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.field}</span> },
              { key: "purpose", header: "Purpose", render: (row) => <span className="text-(--color-text-secondary)">{row.purpose}</span> },
              { key: "consumedBy", header: "Consumed by", render: (row) => row.consumedBy }
            ]}
          />
          <TableCard
            title="Country records on file"
            description="Only Nigeria is live — the others exist so that a launch is a data change rather than a sprint"
            items={data.profiles}
            getRowKey={(row) => row.id}
            pageSize={false}
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
              { key: "country", header: "Country", render: (row) => <span className="inline-flex items-center gap-2 font-bold text-(--color-text-primary)"><Globe2 className="h-[13.5px] w-[13.5px] text-(--color-text-muted)" />{row.country}</span> },
              { key: "regime", header: "Regime", render: (row) => row.dataProtectionRegime ?? "—" },
              { key: "channel", header: "Channel", render: (row) => ({ WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" } as Record<string, string>)[row.defaultChannel ?? ""] ?? "—" },
              { key: "currency", header: "Currency", render: (row) => row.currency },
              { key: "consentAge", header: "Consent age", render: (row) => (row.consentAge === null ? "—" : `Under ${row.consentAge}`) },
              {
                key: "state",
                header: "State",
                render: (row) => row.isLive
                  ? <span className="inline-flex whitespace-nowrap rounded-full bg-(--color-success-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-success)">Live</span>
                  : row.dataProtectionRegime && row.phonePattern
                    ? <span className="inline-flex whitespace-nowrap rounded-full bg-(--color-warning-dim) px-[9px] py-[3px] text-[11px] font-bold text-(--color-warning)">Configured — not launched</span>
                    : <span className="inline-flex whitespace-nowrap rounded-full bg-(--color-bg-subtle) px-[9px] py-[3px] text-[11px] font-bold text-(--color-text-muted)">Draft</span>
              },
              { key: "edit", header: "", render: (row) => <ResourceActionDialog triggerLabel="Edit" title={`Country profile — ${row.country}`} description="Saves over this country's profile." endpoint="/api/super-admin/config-library/country-profiles" method="PATCH" variant="textAction" submitLabel="Save profile" fields={countryFields(row)} /> }
            ]}
            emptyState="No country has a profile yet."
            footnote={`The GAID defines a child as anyone under 18 and requires guardian consent regardless of the purpose of processing.${data.unprofiled.length ? ` Schools exist in ${data.unprofiled.map((row) => `${row.country} (${row.schools})`).join(", ")} with no country record — add one.` : ""}`}
          />
        </div>
      ) : null}
    </div>
  );
}

