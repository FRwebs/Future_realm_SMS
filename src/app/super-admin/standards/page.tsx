import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { TableCard } from "@/components/data-display/table-card";

function tabHref(tab: string) {
  return tab === "workflows" ? "/super-admin/standards" : `/super-admin/standards?tab=${tab}`;
}

const toneStyle = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  teal: { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" },
  ink: { bg: "var(--color-bg-elevated)", fg: "var(--color-text-primary)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
} as const;
type Tone = keyof typeof toneStyle;

function ReferenceList({ title, sub, items }: { title: string; sub?: string; items: Array<{ label: string; detail: string; pill?: string; tone?: Tone }> }) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</p>
        {sub ? <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      </div>
      <div className="grid gap-3 p-5">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
            </div>
            {item.pill ? (
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ background: toneStyle[item.tone ?? "mute"].bg, color: toneStyle[item.tone ?? "mute"].fg }}>
                {item.pill}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function FlowSteps({ title, sub, steps }: { title: string; sub?: string; steps: Array<{ label: string; note: string; tone?: Tone }> }) {
  return (
    <section className="surface-card p-6">
      <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</p>
      {sub ? <p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      <div className="mt-5 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = toneStyle[step.tone ?? "mute"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bg }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-[var(--color-text-secondary)]">{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function SuperAdminStandardsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = searchParams ? await searchParams : {};
  const validTabs = new Set(["workflows", "principles", "access", "sequence", "changelog", "nonfunctional", "issues"]);
  const tab = rawTab && validTabs.has(rawTab) ? rawTab : "workflows";

  const tabs = [
    { label: "Key Workflows", href: tabHref("workflows"), active: tab === "workflows" },
    { label: "Governing Principles", href: tabHref("principles"), active: tab === "principles" },
    { label: "Access Control Foundation", href: tabHref("access"), active: tab === "access" },
    { label: "Build Sequence", href: tabHref("sequence"), active: tab === "sequence" },
    { label: "Changelog", href: tabHref("changelog"), active: tab === "changelog" },
    { label: "Non-Functional & Out of Scope", href: tabHref("nonfunctional"), active: tab === "nonfunctional" },
    { label: "Open Issues Register", href: tabHref("issues"), active: tab === "issues" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Internal reference"
        title="Standards"
        description="The governing specification this platform is built against — key workflows, the principles that constrain every design decision, access control, build order, and what remains open."
      />

      <DetailTabs tabs={tabs} />

      {tab === "workflows" ? <WorkflowsTab /> : null}
      {tab === "principles" ? <PrinciplesTab /> : null}
      {tab === "access" ? <AccessTab /> : null}
      {tab === "sequence" ? <SequenceTab /> : null}
      {tab === "changelog" ? <ChangelogTab /> : null}
      {tab === "nonfunctional" ? <NonFunctionalTab /> : null}
      {tab === "issues" ? <IssuesTab /> : null}
    </div>
  );
}

function WorkflowsTab() {
  return (
    <section className="grid gap-5">
      <ReferenceList
        title="What this page is for"
        sub="Seven flows account for nearly everything that happens in this console. Each is written as steps, in order, with the gate that stops it going wrong."
        items={[
          { label: "These are the flows, not the screens", detail: "A flow crosses several modules. Knowing the flow is what lets you answer a school without checking four tabs.", pill: "Read first", tone: "teal" },
          { label: "Every flow has one gate that matters", detail: "Marked in each row below. If you remember nothing else, remember the gates.", pill: "Read first", tone: "teal" },
          { label: "Nothing here is a suggestion", detail: "Each gate is enforced in code. The console refuses, it doesn't just warn.", pill: "Enforced", tone: "bad" }
        ]}
      />

      <FlowSteps
        title="1 · A school arrives"
        sub="Two ways in, one destination. A school Nooria creates directly after a closed deal skips the automated risk check, because the deal itself is the verification."
        steps={[
          { label: "Signup or we create it", note: "Self-signup, or Nooria after a closed deal" },
          { label: "Web address issued", note: "Permanent from this minute", tone: "ink" },
          { label: "Risk check", note: "Automatic · self-signup only", tone: "warn" },
          { label: "Provisioned", note: "No human approval in the path", tone: "good" },
          { label: "Admin invited", note: "Single-use link, time-limited" },
          { label: "Setup, six layers", note: "Curriculum, classes, subjects, assessment, grading, report card" },
          { label: "Trial running", note: "30 days, everything unlocked", tone: "good" }
        ]}
      />

      <TableCard
        title="The gates in each flow"
        description="One row per flow. The gate column is the thing that cannot be skipped, worked around, or approved by the same person twice."
        items={[
          { n: "1", flow: "A school arrives", gate: "A web address is permanent from the minute it is created", prevents: "Two schools claiming the same address, and a school losing links it has already printed" },
          { n: "2", flow: "History is migrated", gate: "The school approves a preview before anything commits", prevents: "A school discovering after the fact that its results were imported wrong" },
          { n: "3", flow: "Money is collected", gate: "Recording a payment and reconciling it are two different people", prevents: "One person being able to invent a payment that was never received" },
          { n: "4", flow: "Commission accrues", gate: "Only on a fully paid, reconciled invoice", prevents: "Paying commission on money that was invoiced but never arrived" },
          { n: "5", flow: "A school is reviewed", gate: "The school keeps operating throughout the review", prevents: "Punishing a real school for an automated signal's suspicion" },
          { n: "6", flow: "A message goes out", gate: "Consent is checked per recipient at send time", prevents: "Contacting someone who has said no" },
          { n: "7", flow: "A plan changes", gate: "The person who drafts it cannot publish it", prevents: "A price or entitlement reaching schools without a second pair of eyes" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.n}
        columns={[
          { key: "n", header: "#", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{item.n}</span> },
          { key: "flow", header: "Flow", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.flow}</span> },
          { key: "gate", header: "The gate", render: (item) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.gate}</span> },
          { key: "prevents", header: "What it prevents", render: (item) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.prevents}</span> }
        ]}
      />

      <FlowSteps
        title="2 · History is migrated"
        sub="The most consequential thing this platform does to a school's data. Nothing commits without the school's own approval."
        steps={[
          { label: "Source received", note: "Export, spreadsheets or scans" },
          { label: "Mapped and loaded", note: "Into a staging area, not the live account" },
          { label: "Preview built", note: "Counts, samples, computed results, balances", tone: "warn" },
          { label: "School approves", note: "Required — nothing commits without it", tone: "bad" },
          { label: "Committed", note: "Rollback available up to sign-off", tone: "good" },
          { label: "Reconciliation report", note: "Sent to the proprietor" },
          { label: "Sources deleted", note: "On a retention clock after sign-off, evidenced", tone: "ink" }
        ]}
      />

      <FlowSteps
        title="3 · Money is collected"
        sub="An invoice is not income. Only reconciled money counts, and one person cannot do both halves."
        steps={[
          { label: "Invoice run drafted", note: "Per term, per school" },
          { label: "Issued and sent", note: "Bursar and proprietor · cannot be undone" },
          { label: "Reminders", note: "Before due date, then after, on a schedule", tone: "warn" },
          { label: "Payment recorded", note: "With a named payer and a bank reference" },
          { label: "Reconciled", note: "By a second person, against the statement", tone: "bad" },
          { label: "Receipt issued", note: "To the payer and the school", tone: "good" },
          { label: "Commission accrues", note: "Only now, and only if fully settled", tone: "ink" }
        ]}
      />

      <FlowSteps
        title="5 · A school is reviewed"
        sub="An automated signal raises the case. A person decides. The school never stops working while it happens."
        steps={[
          { label: "Signal raised", note: "Automatic · never by a person" },
          { label: "Case opened", note: "Owned, with an internal target", tone: "warn" },
          { label: "School unaffected", note: "Fully operational throughout", tone: "good" },
          { label: "Human checks", note: "Registration, contact, evidence requested" },
          { label: "Decision with a reason", note: "Clear, request evidence, or close", tone: "bad" },
          { label: "Logged", note: "Actor, reason, outcome — immutably", tone: "ink" }
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <ReferenceList
          title="Things this platform will not do"
          sub="Not “not yet”. These were decided against, and the absence is deliberate. You can say all of this to a school."
          items={[
            { label: "Read a child's record", detail: "No account, at any level, with any reason. The function does not exist.", pill: "Never", tone: "bad" },
            { label: "Send third-party commercial offers to parents", detail: "Not permitted in any form — no enabled state exists for it.", pill: "Never", tone: "bad" },
            { label: "Edit a school's own configuration", detail: "We publish masters. The copy a school customises belongs to the school.", pill: "Never", tone: "bad" },
            { label: "Delete a school's data on downgrade or dormancy", detail: "Access narrows. Records stay, in full, and return on restoration.", pill: "Never", tone: "bad" },
            { label: "Change a published invoice or a published result", detail: "A figure someone has already seen does not move underneath them.", pill: "Never", tone: "bad" }
          ]}
        />
        <ReferenceList
          title="Words that mean something specific here"
          sub="Used precisely throughout the console. Using them loosely with a school causes most misunderstandings."
          items={[
            { label: "Issued vs sent", detail: "An invoice is issued once. It can be sent many times." },
            { label: "Recorded vs reconciled", detail: "Recorded means somebody says money arrived. Reconciled means the bank agrees." },
            { label: "Suspended vs closed", detail: "Suspended is reversible and keeps everything. Closed starts a retention clock." },
            { label: "Exception vs plan change", detail: "An exception is one school, with an end date. A plan change is everyone, forever." },
            { label: "Support access vs impersonation", detail: "Called support access because it is time-boxed and logged before it starts." },
            { label: "Withheld vs not built", detail: "Withheld means we chose not to. Not built means there is no code path at all.", tone: "warn" }
          ]}
        />
      </section>
    </section>
  );
}

function PrinciplesTab() {
  return (
    <TableCard
      title="Governing principles"
      description="Each with what it forbids."
      items={[
        { code: "P1", principle: "Offline-first is the foundation, not a feature. Attendance and score entry must work completely without a connection.", forbids: "No school-facing workflow may assume connectivity." },
        { code: "P2", principle: "Result computation correctness is existential. A deterministic engine, a stored trace for every computed value, server-side as the sole authority.", forbids: "No client-side computation is authoritative. No value may exist without a trace explaining how it was reached." },
        { code: "P3", principle: "Permissions are three-dimensional and enforced at the query layer: module access, function access and data scope, independently.", forbids: "Hiding a button while the interface still returns the data is a security failure, not a permission system." },
        { code: "P4", principle: "Audit logging is written into every module from its first commit — who, what, before, after, when, where and why. Immutable at the database layer.", forbids: "No user, including a Super Admin, may alter an audit entry. Audit is never a later phase." },
        { code: "P5", principle: "Everything cultural is configuration, never code — curriculum, grading, terms, calendars, currencies, languages, phone formats, report card layouts.", forbids: "Entering a new country must require a configuration record, not an engineering sprint." },
        { code: "P6", principle: "The school owns its data absolutely. Full export at any time, without asking permission.", forbids: "No retention of a school's data as commercial leverage. No export gated behind a support ticket." },
        { code: "P7", principle: "Cost transparency before any paid action — credit cost shown before every send, with balance before and after.", forbids: "No school may discover it has spent money after the fact." },
        { code: "P8", principle: "Child safety and data protection are designed in. Where a feature would place the platform in the controller position for children's data with no route to consent, it is redesigned architecturally.", forbids: "Legal argument is not a substitute for a schema that cannot hold the data in the first place." },
        { code: "P9", principle: "Speed of the highest-frequency workflow determines adoption. Attendance is marked every day, in every class, often on a low-end phone.", forbids: "Anything above sixty seconds per class for attendance is a failed design." }
      ]}
      pageSize={false}
      getRowKey={(item) => item.code}
      columns={[
        { key: "code", header: "", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.code}</span> },
        { key: "principle", header: "Principle", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.principle}</span> },
        { key: "forbids", header: "What it forbids", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.forbids}</span> }
      ]}
    />
  );
}

function AccessTab() {
  return (
    <TableCard
      title="Order of authority"
      description="Where two documents conflict, the higher document wins."
      items={[
        { n: "1", doc: "User Onboarding & Account Creation Spec", status: "Final", tone: "good", authority: "Absolute on identity, signup, provisioning, invitations, trial mechanics and login routing" },
        { n: "2", doc: "Platform Admin Panel BRD", status: "Approved", tone: "good", authority: "Absolute on internal back-office operations" },
        { n: "3", doc: "School Admin Portal BRD", status: "Approved", tone: "good", authority: "Absolute on the school-facing portal" },
        { n: "4", doc: "Foundation & Alignment Document", status: "Requires update", tone: "warn", authority: "Vision, pillars and market definition only — its pricing and trial-length statements are superseded" },
        { n: "5", doc: "Partnership counter-proposals", status: "Issued", tone: "mute", authority: "Commercial terms only, pending countersignature" }
      ]}
      pageSize={false}
      getRowKey={(item) => item.n}
      columns={[
        { key: "n", header: "", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{item.n}</span> },
        { key: "doc", header: "Document", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.doc}</span> },
        {
          key: "status",
          header: "Status",
          render: (item) => {
            const tone = toneStyle[item.tone as Tone];
            return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{item.status}</span>;
          }
        },
        { key: "authority", header: "Authority", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.authority}</span> }
      ]}
      emptyState="Nothing recorded."
    />
  );
}

function SequenceTab() {
  return (
    <FlowSteps
      title="Platform Admin build order"
      sub="Access control is first because everything else is enforced through it — retrofitting it later is the most expensive mistake available on this project."
      steps={[
        { label: "Stage 1", note: "Access Control Foundation + Team — the three-dimensional model, enforced at the query layer", tone: "ink" },
        { label: "Stage 2", note: "Security & Compliance — audit logging live before any module writes a record", tone: "ink" },
        { label: "Stage 3", note: "School Accounts → Migration" },
        { label: "Stage 4", note: "Billing → Partners — commission cannot be computed before revenue is reconciled" },
        { label: "Stage 5", note: "Users → Support" },
        { label: "Stage 6", note: "Curriculum → Plans & Features" },
        { label: "Stage 7", note: "Infrastructure → Communications" },
        { label: "Stage 8", note: "Analytics → Command Center", tone: "good" }
      ]}
    />
  );
}

function ChangelogTab() {
  return (
    <section className="grid gap-5">
      <TableCard
        title="A · Contradictions resolved against the Onboarding Specification"
        description="Every change is a correction to a defect, a contradiction, or a gap. Nothing here is cosmetic."
        items={[
          { code: "A1", was: "New registrations enter a pending approval queue; no school is activated automatically.", now: "Every school provisions instantly and unconditionally. Risk assessment is automated, silent, and resolved during the trial.", why: "Manual approval doesn't scale, and it was ceremony that delayed real customers." },
          { code: "A2", was: "Trial = one full academic term, Starter features only.", now: "Trial = 30 calendar days, every feature unlocked, started only when the admin chooses.", why: "A term-length trial creates a fairness problem with schools that pay immediately." },
          { code: "A3", was: "Post-trial: read-only for 3 days, then locked.", now: "Read-only for 7 days, then locked. Data retained, never deleted.", why: "Aligned to the Onboarding Specification." },
          { code: "A4", was: "Lifecycle ran Pending Verification → Trial Active → Active, with Rejected terminal.", now: "Lifecycle rebuilt — Provisioned, Trial Active, Dormant and Risk Flagged added; gating states removed.", why: "Aligns the state machine with instant provisioning." },
          { code: "A5", was: "No dormancy concept existed.", now: "Dormancy added — a period without login moves an account to Dormant; the address releases only if no real student records exist.", why: "A data-safety condition the original spec did not state." }
        ]}
        pageSize={false}
        getRowKey={(item) => item.code}
        columns={[
          { key: "code", header: "", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{item.code}</span> },
          { key: "was", header: "Said before", render: (item) => <span className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{item.was}</span> },
          { key: "now", header: "Says now", render: (item) => <span className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{item.now}</span> },
          { key: "why", header: "Why", render: (item) => <span className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{item.why}</span> }
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <TableCard
          title="B · Added because nothing owned them"
          description="Capabilities promised elsewhere with no owning module."
          items={[
            { code: "B1", added: "Risk Assessment & Review", from: "Onboarding spec — queue and internal SLA" },
            { code: "B2", added: "Address Registry & Disputes", from: "Onboarding spec" },
            { code: "B3", added: "Ownership Transfer", from: "Nowhere — proprietors sell schools, retire and die" },
            { code: "B4", added: "Dormancy & Reclamation", from: "Onboarding spec" },
            { code: "B5", added: "Individual Users Register", from: "Named in strategy as a ranked lead list" },
            { code: "B6", added: "School-Visible Support Access", from: "Nowhere — the school was never told" },
            { code: "B7", added: "Partner & Commission", from: "Partner-agreement commitments" },
            { code: "B8", added: "Migration & Onboarding Ops", from: "Strategy: free migration as a sales weapon" }
          ]}
          pageSize={false}
          getRowKey={(item) => item.code}
          columns={[
            { key: "code", header: "", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{item.code}</span> },
            { key: "added", header: "Added", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.added}</span> },
            { key: "from", header: "Where it was promised", render: (item) => <span className="text-[12px] text-[var(--color-text-muted)]">{item.from}</span> }
          ]}
        />
        <TableCard
          title="C · Regulatory corrections"
          description="The operative data-protection instrument changed."
          items={[
            { code: "C1", correction: "Rebuilt around the regulator's actual artefacts: registration, DPIA, DPO, breach notification, grievance handling and cross-border transfer records." },
            { code: "C2", correction: "Registration requirements reached almost immediately at our expected scale — registration and DPO became launch requirements, with costs in the model." },
            { code: "C3", correction: "A child is anyone under 18, with guardian consent required regardless of purpose." },
            { code: "C4", correction: "Post-closure retention is platform policy with a documented lawful basis — not a general regulatory requirement." },
            { code: "C5", correction: "A processor cannot repurpose controller data for its own commercial benefit; the school must opt in as controller and share revenue, or the feature does not ship." }
          ]}
          pageSize={false}
          getRowKey={(item) => item.code}
          columns={[
            { key: "code", header: "", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{item.code}</span> },
            { key: "correction", header: "Correction", render: (item) => <span className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{item.correction}</span> }
          ]}
        />
      </section>

      <TableCard
        title="D · Structural and format corrections"
        items={[
          { code: "D1", correction: "Module numbering is deliberately unchanged so every existing cross-reference still resolves. New modules are appended, not inserted." },
          { code: "D2", correction: "Every module now carries the full standing structure, including Offline Behaviour and Notification Triggers sections previously omitted." },
          { code: "D3", correction: "Data export corrected from “Excel and PDF” to Excel and CSV — PDF is a presentation format, not a data export format." },
          { code: "D4", correction: "Provider names removed from monitoring thresholds and moved to per-region configuration." },
          { code: "D5", correction: "Country-specific verification signals, blocked-address lists and phone validation moved into a per-country configuration record." },
          { code: "D6", correction: "Pricing figures are marked provisional throughout and must not be built against until the open pricing issue is closed." },
          { code: "D7", correction: "Curriculum module rewritten and expanded into a full curriculum configuration standard." }
        ]}
        pageSize={false}
        getRowKey={(item) => item.code}
        columns={[
          { key: "code", header: "", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{item.code}</span> },
          { key: "correction", header: "Correction", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.correction}</span> }
        ]}
      />
    </section>
  );
}

function NonFunctionalTab() {
  return (
    <section className="grid gap-5">
      <TableCard
        title="Non-functional requirements"
        description="Measured at scale, not merely at current usage."
        items={[
          { area: "Performance", requirement: "Every page loads within 2 seconds under normal load. Tables above 500 rows paginate. Reports above 10 seconds run as background jobs.", state: "Target" },
          { area: "Security", requirement: "A separate non-public admin address; encryption in transit and at rest; permission checks server-side on every request.", state: "Partially met" },
          { area: "Audit", requirement: "Every internal action logged automatically with no suppression option; entries immutable at the database layer.", state: "Met" },
          { area: "Availability", requirement: "99.5% monthly uptime target; planned maintenance communicated ahead of time.", state: "Target" },
          { area: "Scalability", requirement: "Every table and report performs within threshold at scale. Data-scope predicates must be indexed, since they apply to every query.", state: "Ongoing" },
          { area: "Portability", requirement: "No module may hard-code a country, currency, curriculum, calendar, grading scale, provider or language.", state: "Ongoing" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.area}
        columns={[
          { key: "area", header: "Area", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.area}</span> },
          { key: "requirement", header: "Requirement", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.requirement}</span> },
          { key: "state", header: "State", render: (item) => <span className="text-[12px] text-[var(--color-text-muted)]">{item.state}</span> }
        ]}
      />

      <TableCard
        title="Out of scope for version 1.0"
        description="Excluded means excluded — each returns as a scoped decision, not as scope creep."
        items={[
          { excluded: "Automated payment reconciliation", returns: "When school-facing payment integration is fully live. Until then, reconciliation is a manual dual-control process." },
          { excluded: "Predictive churn modelling", returns: "A later phase. Churn scoring stays rule-based and explainable in the meantime — a score nobody can explain is a score nobody acts on." },
          { excluded: "Automated invoice generation without admin review", returns: "After the billing module has been validated across at least two full term cycles." },
          { excluded: "Self-serve partner portal", returns: "A later phase, built on the partner data-scope model already in place." },
          { excluded: "Mobile version of the admin panel", returns: "Not planned — this is a desktop back-office tool by design." },
          { excluded: "Automated regulatory reporting to authorities", returns: "As a formal government partnership. The schema is exportable now; no integration before there's a relationship to justify it." },
          { excluded: "Multi-branch and school group management", returns: "A later phase — a nullable group identifier is already carried on the school record." },
          { excluded: "Third-party commercial campaigns to parents", returns: "Only in a redesigned form where the school opts in as controller and shares revenue." }
        ]}
        pageSize={false}
        getRowKey={(item) => item.excluded}
        columns={[
          { key: "excluded", header: "Excluded", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.excluded}</span> },
          { key: "returns", header: "Returns when", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.returns}</span> }
        ]}
      />
    </section>
  );
}

function IssuesTab() {
  return (
    <TableCard
      title="Open Issues Register"
      description="Carried forward, unresolved. No module may be built in a way that assumes any of them is settled."
      items={[
        { code: "OI-1", issue: "Pricing model. A per-student-per-term model produces costs well outside observed market rates. A base platform fee plus a smaller per-student component is under consideration.", status: "Open", tone: "bad", blocks: "Billing engine, commission modelling, revenue targets, tier boundaries" },
        { code: "OI-2", issue: "Free teacher tier data protection. With no school in the chain, the platform becomes controller for children's data with no route to guardian consent.", status: "Design agreed", tone: "warn", blocks: "Teacher Portal — must be structurally incapable of storing identifiable student data" },
        { code: "OI-3", issue: "Data-protection registration tier and DPO appointment — confirmed as launch requirements, not later commitments.", status: "Action required", tone: "bad", blocks: "Launch" },
        { code: "OI-4", issue: "Web address dispute policy — the written procedure must exist before the first real incident.", status: "Open", tone: "bad", blocks: "Web Address Registry" },
        { code: "OI-5", issue: "The verification threshold for real-student records is a chosen number, not a derived one.", status: "Open — confirm with adviser", tone: "warn", blocks: "Risk assessment escalation trigger" },
        { code: "OI-6", issue: "Sample data is load-bearing for trial conversion, not a polish item.", status: "Decided — build constraint", tone: "good", blocks: "May not be descoped if the build runs late" }
      ]}
      pageSize={false}
      getRowKey={(item) => item.code}
      columns={[
        { key: "code", header: "", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.code}</span> },
        { key: "issue", header: "Issue", render: (item) => <span className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.issue}</span> },
        {
          key: "status",
          header: "Status",
          render: (item) => {
            const tone = toneStyle[item.tone as Tone];
            return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{item.status}</span>;
          }
        },
        { key: "blocks", header: "Blocks", render: (item) => <span className="text-[12px] text-[var(--color-text-muted)]">{item.blocks}</span> }
      ]}
    />
  );
}
