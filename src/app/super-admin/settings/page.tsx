import { ReferenceList } from "@/components/data-display/reference-list";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminInfraMonitoring, SuperAdminSettingsView } from "@/lib/domain/types";

type Policy = {
  trial: { days: number; readOnlyDays: number; lockReminderDays: number };
  dormancy: { watchDays: number; dormantDays: number; noticeDays: number };
  invoice: { netDays: number; rounding: "NONE" | "NEAREST_NAIRA" | "NEAREST_FIVE" | "NEAREST_TEN" };
  identity: { platformName: string; supportEmail: string; supportPhone: string; timeZone: string };
  messaging: { quietFrom: string; quietTo: string; quietHoursOn: boolean; dailyCapPerRecipient: number; maxAttempts: number; providerCostSms: number; providerCostSmsInternational: number; providerCostWhatsapp: number; providerCostEmail: number };
};
type LifecycleItem = { schoolId: string; school: string; kind: string; status: string; lastLoginAt: string | null };
type CarrierStatus = { enabled: boolean; carriers: Array<{ channel: string; provider: string; configured: boolean }>; emailMfa: boolean; scheduler: boolean };

const ROUNDING_LABEL: Record<Policy["invoice"]["rounding"], string> = { NONE: "No rounding — to the kobo", NEAREST_NAIRA: "Nearest ₦1", NEAREST_FIVE: "Nearest ₦5", NEAREST_TEN: "Nearest ₦10" };
const LIFECYCLE_LABEL: Record<string, string> = {
  CONCESSION_DUE: "Remind the owner the NGO / mission discount is ending",
  CONCESSION_EXPIRED: "End the discount and move the school to Standard",
  TRIAL_ENDING: "Remind the owner the trial is ending",
  TRIAL_READ_ONLY: "Make the school read-only (trial ended)",
  TRIAL_LOCK_DUE: "Remind the owner the school will be locked",
  TRIAL_LOCK: "Lock the school (read-only window over)",
  DORMANT_WATCH: "Put on inactivity watch and tell the account manager",
  DORMANT: "Mark dormant and tell the owner",
  RECOVERED: "Clear dormancy — somebody signed in",
  ADDRESS_RELEASE: "Release the web address",
};

const loadPolicy = () => apiGet<Policy>("/api/super-admin/platform-policy");

function integrationStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "HEALTHY") return "success";
  if (status === "WARNING" || status === "PARTIAL") return "warning";
  if (status === "CRITICAL") return "danger";
  return "neutral";
}

function tabHref(tab: string) {
  return tab === "platform" ? "/super-admin/settings" : `/super-admin/settings?tab=${tab}`;
}

export default async function SuperAdminSettingsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = searchParams ? await searchParams : {};
  const validTabs = new Set(["platform", "defaults", "notifications", "security", "integrations"]);
  const tab = rawTab && validTabs.has(rawTab) ? rawTab : "platform";

  const tabs = [
    { label: "Platform", href: tabHref("platform"), active: tab === "platform" },
    { label: "School Defaults", href: tabHref("defaults"), active: tab === "defaults" },
    { label: "Notifications", href: tabHref("notifications"), active: tab === "notifications" },
    { label: "Security", href: tabHref("security"), active: tab === "security" },
    { label: "Integrations", href: tabHref("integrations"), active: tab === "integrations" }
  ];

  return (
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="SETTINGS"
        title="Settings"
        description="How the platform behaves by default, before any school changes anything."
      />

      <DetailTabs tabs={tabs} />

      {tab === "platform" ? <PlatformTab /> : null}
      {tab === "defaults" ? <DefaultsTab /> : null}
      {tab === "notifications" ? <NotificationsTab /> : null}
      {tab === "security" ? <SecurityTab /> : null}
      {tab === "integrations" ? <IntegrationsTab /> : null}
    </div>
  );
}

async function PlatformTab() {
  const [settings, policy, lifecycle, carriers, library, fx] = await Promise.all([
    apiGet<SuperAdminSettingsView>("/api/super-admin/settings"),
    loadPolicy(),
    apiGet<LifecycleItem[]>("/api/super-admin/lifecycle/preview").catch(() => [] as LifecycleItem[]),
    apiGet<CarrierStatus>("/api/super-admin/delivery-carriers"),
    apiGet<{ profiles: Array<{ country: string; isLive: boolean }> }>("/api/super-admin/config-library").catch(() => ({ profiles: [] })),
    apiGet<{ anchor: "NGN" | "USD"; source: string; ratesFor: string; shockPercent: number; refreshConfigured: boolean; rates: { usd: number }; pending: { moved: string } | null }>("/api/super-admin/billing-extras/currencies").catch(() => null)
  ]);
  const openCountries = library.profiles.filter((profile) => profile.isLive).map((profile) => profile.country);

  return (
    <section className="grid gap-[14px]">
      <ReferenceList
        title="What this page is"
        sub="Platform-wide defaults. Everything here is what a school gets before it has decided anything of its own — and every school can override most of it."
        items={[
          { label: "A default is not a rule", detail: "Change one and only new schools follow it. Nobody's existing configuration moves.", tone: "good" },
          { label: "Nothing here reaches a school's own data", detail: "These are our settings, not theirs. No control on this page can edit what a school has configured.", tone: "bad" },
          { label: "Every change is logged", detail: "Who changed a setting and when, with the new values recorded — written to the audit log the moment you save.", tone: "good" }
        ]}
      />

      <section className="surface-card p-6">
        <p className="section-eyebrow">Platform-wide</p>
        <h2 className="mt-2 text-[12.5px] font-semibold text-[var(--color-text-primary)]">Maintenance and announcement</h2>
        <p className="mt-2 text-[11.5px] leading-6 text-[var(--color-text-secondary)]">Maintenance blocks non-Super Admin logins. The announcement is shown to school admins after login.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={
              settings.maintenanceMode
                ? { background: "var(--color-danger-dim)", color: "var(--color-danger)" }
                : { background: "var(--color-success-dim)", color: "var(--color-success)" }
            }
          >
            Maintenance {settings.maintenanceMode ? "On" : "Off"}
          </span>
          <ResourceActionDialog
            triggerLabel="Update platform message"
            title="Platform announcement"
            description="Publish a message for school administrators and control maintenance mode."
            endpoint="/api/super-admin/settings"
            method="PATCH"
            variant="secondary"
            submitLabel="Publish settings"
            confirmLabel="Confirm Settings"
            fields={[
              { name: "maintenanceMode", label: "Maintenance Mode", type: "select", defaultValue: String(settings.maintenanceMode), options: [
                { label: "Off", value: "false" },
                { label: "On", value: "true" }
              ] },
              { name: "platformAnnouncement", label: "Platform Announcement", type: "textarea", defaultValue: settings.platformAnnouncement ?? "" }
            ]}
          />
        </div>
      </section>

      <TableCard
        title="Platform identity"
        description="The things that appear in front of a school or a parent and should almost never change. The name and contact are on every email the platform sends."
        items={[
          { setting: "Platform name", value: policy.identity.platformName, by: "Super Admin" },
          { setting: "School web address", value: "Chosen at signup, lower-case letters and numbers, permanent from the minute it is created", by: "Fixed" },
          { setting: "Back-office address", value: "Wherever this console is deployed — set at deployment, not here", by: "Fixed" },
          { setting: "Support email shown to schools", value: policy.identity.supportEmail || "Not set — emails carry the platform name only", by: "Super Admin" },
          { setting: "Support phone shown to schools", value: policy.identity.supportPhone || "Not set", by: "Super Admin" },
          { setting: "Platform time zone", value: `${policy.identity.timeZone} — for the platform’s own clocks only`, by: "Super Admin" },
          { setting: "Countries open for signup", value: openCountries.length ? openCountries.join(", ") : "None live — open a country in Curriculum & Academics → Country Settings", by: "Country Settings" }
        ]}
        actions={
          <ResourceActionDialog
            triggerLabel="Edit"
            title="Platform identity"
            description="Changing these never moves a school that already exists. The change is written to the audit log."
            endpoint="/api/super-admin/platform-policy"
            method="PUT"
            variant="secondary"
            submitLabel="Save"
            fields={[
              { name: "identity_platformName", label: "Platform name", defaultValue: policy.identity.platformName },
              { name: "identity_supportEmail", label: "Support email", type: "email", defaultValue: policy.identity.supportEmail },
              { name: "identity_supportPhone", label: "Support phone", defaultValue: policy.identity.supportPhone },
              { name: "identity_timeZone", label: "Platform time zone (IANA name)", defaultValue: policy.identity.timeZone, placeholder: "Africa/Lagos" }
            ]}
          />
        }
        footnote="A school’s web address is permanent from the minute it is created. Opening a country in Country Settings is what lets a school there sign up."
        pageSize={false}
        getRowKey={(item) => item.setting}
        columns={[
          { key: "setting", header: "Setting", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.setting}</span> },
          { key: "value", header: "Value", render: (item) => <span className="text-[var(--color-text-secondary)]">{item.value}</span> },
          { key: "by", header: "Changeable by", render: (item) => <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}>{item.by}</span> }
        ]}
      />

      <section className="grid items-start gap-[14px] lg:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="Pricing and currency"
          description={fx?.anchor === "USD" ? "Plans are priced in US dollars; every naira figure is derived from the rate fixed for the term. Manage it on Plans & Features → Plans." : "Plans are priced in naira. Author them in US dollars on Plans & Features → Plans to have every local figure follow one rate."}
          items={[
            { setting: "Pricing currency", value: fx?.anchor === "USD" ? "USD — authored once per plan" : "NGN — authored directly in naira", state: "Set by Super Admin" },
            { setting: "Rate source", value: fx?.source ? fx.source : fx?.refreshConfigured ? "A rate provider is set up; fetched at term start" : "Entered by hand — set FX_RATES_URL to fetch automatically", state: fx?.refreshConfigured ? "Automatic" : "Manual" },
            { setting: "Rate refresh", value: fx?.ratesFor ? `Fixed for ${fx.ratesFor}; refreshed at term rollover only, never mid-term` : "No rates fixed yet", state: "Enforced" },
            { setting: "Rounding", value: "Naira prices from dollars are rounded to the nearest 50 kobo; invoices round as set below", state: "Enforced" },
            { setting: "Currency shock guard", value: `A move above ${fx?.shockPercent ?? 15}% on any currency is held for Finance to decide${fx?.pending ? ` — ${fx.pending.moved} waiting now` : ""}`, state: "Enforced" },
            { setting: "Invoicing currency", value: "The school’s own, always", state: "Enforced" }
          ]}
          pageSize={false}
          getRowKey={(item) => item.setting}
          columns={[
            { key: "setting", header: "Setting", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.setting}</span> },
            { key: "value", header: "Value", render: (item) => <span className="text-[var(--color-text-secondary)]">{item.value}</span> },
            { key: "state", header: "State", render: (item) => <span className="text-[11px] text-[var(--color-text-muted)]">{item.state}</span> }
          ]}
        />
        <TableCard
          title="Trial, dormancy and invoice defaults"
          description="Enforced by the lifecycle engine and by every platform invoice. A change applies from the next run; nothing already done is undone."
          items={[
            { setting: "Trial length", value: `${policy.trial.days} calendar days from the day the school starts its trial` },
            { setting: "Read-only window after a trial", value: `${policy.trial.readOnlyDays} days — the school can read and export but not change anything; paying switches editing back on` },
            { setting: "Trial lock", value: `Day ${policy.trial.readOnlyDays} after the trial ends — the school is locked and only support can reopen it. The owner is reminded ${policy.trial.lockReminderDays} days before.` },
            { setting: "Invoice payment terms", value: `Net ${policy.invoice.netDays} — every platform invoice falls due ${policy.invoice.netDays} days after it is raised` },
            { setting: "Grace period after due", value: "Set by a Super Admin per school" },
            { setting: "Dormancy stage 1 — watch", value: `${policy.dormancy.watchDays} days without a sign-in: the account manager is told` },
            { setting: "Dormancy stage 2 — dormant", value: `${policy.dormancy.dormantDays} days without a sign-in: the school is marked dormant and its owner is told when the address will be released` },
            { setting: "Web address release", value: `${policy.dormancy.noticeDays} days after the owner is told, unless somebody signs in. A school that pays is never released automatically.` }
          ]}
          actions={
            <ResourceActionDialog
              triggerLabel="Edit defaults"
              title="Trial, dormancy and invoice defaults"
              description="Each value is checked against the others before it is saved. The change is written to the audit log with the old and new values."
              endpoint="/api/super-admin/platform-policy"
              method="PUT"
              variant="secondary"
              submitLabel="Save defaults"
              fields={[
                { name: "trial_days", label: "Trial length (days)", type: "number", defaultValue: policy.trial.days, min: 1, max: 120, section: "Trial" },
                { name: "trial_readOnlyDays", label: "Read-only days after the trial", type: "number", defaultValue: policy.trial.readOnlyDays, min: 0, max: 60, section: "Trial" },
                { name: "trial_lockReminderDays", label: "Remind the owner this many days before", type: "number", defaultValue: policy.trial.lockReminderDays, min: 0, max: 30, section: "Trial" },
                { name: "dormancy_watchDays", label: "Inactivity watch after (days)", type: "number", defaultValue: policy.dormancy.watchDays, min: 7, max: 720, section: "Dormancy" },
                { name: "dormancy_dormantDays", label: "Dormant after (days)", type: "number", defaultValue: policy.dormancy.dormantDays, min: 14, max: 1080, section: "Dormancy" },
                { name: "dormancy_noticeDays", label: "Release the address after the notice (days)", type: "number", defaultValue: policy.dormancy.noticeDays, min: 7, max: 365, section: "Dormancy" },
                { name: "invoice_netDays", label: "Invoice terms — Net (days)", type: "number", defaultValue: policy.invoice.netDays, min: 0, max: 90, section: "Invoices" },
                { name: "invoice_rounding", label: "Rounding", type: "select", defaultValue: policy.invoice.rounding, options: (Object.keys(ROUNDING_LABEL) as Array<Policy["invoice"]["rounding"]>).map((value) => ({ label: ROUNDING_LABEL[value], value })), section: "Invoices" }
              ]}
            />
          }
          pageSize={false}
          getRowKey={(item) => item.setting}
          columns={[
            { key: "setting", header: "Setting", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.setting}</span> },
            { key: "value", header: "Value", render: (item) => <span className="text-[var(--color-text-secondary)]">{item.value}</span> }
          ]}
        />
      </section>

      <TableCard
        title="What the lifecycle engine would do now"
        description={`Checked every 30 minutes${carriers.scheduler ? "" : " — the scheduler is switched off on this deployment, so nothing runs by itself"}. Nothing below has happened yet.`}
        items={lifecycle}
        pageSize={false}
        getRowKey={(item) => `${item.schoolId}:${item.kind}`}
        emptyState="Nothing is due. Every school is where its trial and its sign-ins say it should be."
        actions={
          lifecycle.length ? (
            <ResourceActionDialog
              triggerLabel="Run it now"
              title="Run the lifecycle engine"
              description="Applies every action listed. Each one is written to the audit log and tells the school's owner."
              endpoint="/api/super-admin/lifecycle/run"
              method="POST"
              variant="secondary"
              submitLabel="Run now"
              confirmLabel="Apply to every school listed"
              fields={[]}
            />
          ) : undefined
        }
        columns={[
          { key: "school", header: "School", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.school}</span> },
          { key: "status", header: "Status now", render: (item) => <span className="text-[11px] text-[var(--color-text-muted)]">{item.status.replaceAll("_", " ").toLowerCase()}</span> },
          { key: "kind", header: "What happens", render: (item) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{LIFECYCLE_LABEL[item.kind] ?? item.kind}</span> },
          { key: "login", header: "Last sign-in", render: (item) => <span className="text-[11px] text-[var(--color-text-muted)]">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleDateString("en-GB") : "Never"}</span> }
        ]}
      />
    </section>
  );
}

async function DefaultsTab() {
  const settings = await apiGet<SuperAdminSettingsView>("/api/super-admin/settings");

  return (
    <section className="grid gap-[14px]">
      <TableCard
        title="What a new school starts with"
        description="What is configured for a school automatically at signup, and who can change it afterwards. Each row is what the signup actually writes."
        items={[
          { setting: "Curriculum template", value: "The country's own: the Nigerian subject catalogue for Nigeria, a plain international set for every other country — loaded for each section the school runs, with each class offered its own level's subjects", canChange: "Yes", where: "Curriculum & Academics, then the school's own School Configuration" },
          { setting: "Grading scale", value: "The scale below, applied to every new school. If it is not a usable scale (it must cover 0 to 100), the country's own scale is used instead.", canChange: "Yes", where: "This page — Default grading scale" },
          { setting: "Report card layout", value: "One platform layout. No per-school template model exists, so nothing is linked at signup.", canChange: "No", where: "Fixed" },
          { setting: "Assessment weights (CA/exam)", value: "Seven components: assignment, classwork, two tests, project and practical at 10 each, and a terminal exam at 40", canChange: "Yes", where: "The school's Score Entry framework" },
          { setting: "Academic calendar", value: "The school year the school is in, September to July in three terms, with the current term set. A sample class marks attendance up to yesterday.", canChange: "Yes", where: "School Configuration → Calendar" },
          { setting: "Notification channels", value: "SMS, email, in-app and WhatsApp (from templates Meta has approved, to people who opted in).", canChange: "Yes", where: "Communication Center" },
          { setting: "Quiet hours", value: "Platform-wide, in the Notifications tab", canChange: "No", where: "This page — Notifications" },
          { setting: "Fee balance on report cards", value: "Not on the card. The report card carries scores, position, attendance, remarks and traits.", canChange: "No", where: "Fixed" },
          { setting: "Class position on report cards", value: "Shown — competition ranking within the arm, from the approved sheets", canChange: "No", where: "Fixed" },
          { setting: "Guardian portal", value: "On from the Premium tier up. A school on a trial has every feature.", canChange: "Yes", where: "Subscription & Billing → Plan" },
          { setting: "Student portal", value: "On for every student account — access is role-based, not gated by class or grade", canChange: "No — always on", where: "Real, but not a configurable default" },
          { setting: "Sample class", value: "30 sample students with a marked term, scored subjects and 30 report cards — no guardians, phones or emails, removable in one action", canChange: "Yes — the school removes it", where: "Schools → Provisioning" },
          { setting: "Full account data export", value: "A school's proprietor can request a full export with the password and a code; a Super Admin can also run one for a compliance request", canChange: "Yes", where: "Analytics & Reports · Security & Compliance" },
          { setting: "Audit log", value: "Written platform-wide on every mutating action", canChange: "No", where: "AuditLog — no toggle to hide it from a school exists" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.setting}
        columns={[
          { key: "setting", header: "Setting", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.setting}</span> },
          { key: "value", header: "Default for a new school", render: (item) => <span className="text-[var(--color-text-secondary)]">{item.value}</span> },
          {
            key: "canChange",
            header: "School can change",
            render: (item) => {
              const tone = item.canChange === "Yes"
                ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
                : item.canChange === "N/A"
                  ? { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
                  : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{item.canChange}</span>;
            }
          },
          { key: "where", header: "Where it lives", render: (item) => <span className="text-[11px] text-[var(--color-text-muted)]">{item.where}</span> }
        ]}
      />

      <TableCard
        title="Global modules"
        description="Availability toggles applied platform-wide, on top of a school's own plan and configuration."
        items={Object.entries(settings.globalModuleAvailability).map(([module, enabled]) => ({ module, enabled }))}
        pageSize={false}
        getRowKey={(item) => item.module}
        columns={[
          { key: "module", header: "Module", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.module.replaceAll("_", " ")}</span> },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <span
                className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold"
                style={item.enabled ? { background: "var(--color-success-dim)", color: "var(--color-success)" } : { background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
              >
                {item.enabled ? "Enabled" : "Disabled"}
              </span>
            )
          }
        ]}
        actions={
          <ResourceActionDialog
            triggerLabel="Update modules"
            title="Global module availability"
            description="Paste a JSON object of module flags."
            endpoint="/api/super-admin/settings"
            method="PATCH"
            variant="secondary"
            submitLabel="Save modules"
            fields={[{ name: "globalModuleAvailability", label: "Module JSON", type: "textarea", parse: "json", defaultValue: JSON.stringify(settings.globalModuleAvailability, null, 2) }]}
          />
        }
      />

      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Academic defaults</p>
            <h2 className="mt-2 text-[12.5px] font-semibold text-[var(--color-text-primary)]">Default grading scale</h2>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
              Used as the platform-level default for newly created school tenants — each school can then edit its own copy. Curriculum
              templates, assessment frameworks, and report card layouts are managed in Curriculum &amp; Academics, not duplicated here.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Edit grading scale"
            title="Default grading scale"
            description="Paste the JSON grading bands used for newly created schools."
            endpoint="/api/super-admin/settings"
            method="PATCH"
            variant="secondary"
            submitLabel="Save grading"
            fields={[{ name: "defaultGradingScale", label: "Grading JSON", type: "textarea", parse: "json", defaultValue: JSON.stringify(settings.defaultGradingScale, null, 2) }]}
          />
        </div>
        <pre className="mt-5 overflow-x-auto rounded-[11px] bg-[#0D2315] p-5 text-[11px] leading-6 text-[rgba(255,255,255,0.85)]">{JSON.stringify(settings.defaultGradingScale, null, 2)}</pre>
      </section>
    </section>
  );
}

async function NotificationsTab() {
  const [policy, carriers] = await Promise.all([loadPolicy(), apiGet<CarrierStatus>("/api/super-admin/delivery-carriers")]);
  const m = policy.messaging;
  const carrier = (channel: string) => carriers.carriers.find((entry) => entry.channel === channel);
  return (
    <section className="grid items-start gap-[14px] xl:grid-cols-[1.3fr_1fr]">
      <TableCard
        title="Sending rules"
        description="How the platform behaves when it sends something, above any individual template. Enforced by the delivery worker."
        actions={
          <ResourceActionDialog
            triggerLabel="Edit rules"
            title="Sending rules"
            description="Applies to every school's queued SMS and email from the next delivery run."
            endpoint="/api/super-admin/platform-policy"
            method="PUT"
            variant="secondary"
            submitLabel="Save rules"
            fields={[
              { name: "messaging_quietHoursOn", label: "Quiet hours", type: "select", defaultValue: String(m.quietHoursOn), options: [{ label: "Off — messages can send at any time", value: "false" }, { label: "On — hold messages during the quiet window", value: "true" }] },
              { name: "messaging_quietFrom", label: "Quiet from (Lagos time)", type: "text", defaultValue: m.quietFrom, placeholder: "21:00" },
              { name: "messaging_quietTo", label: "Quiet until", type: "text", defaultValue: m.quietTo, placeholder: "06:00" },
              { name: "messaging_dailyCapPerRecipient", label: "Daily cap per recipient (0 = none)", type: "number", defaultValue: m.dailyCapPerRecipient, min: 0, max: 100 },
              { name: "messaging_maxAttempts", label: "Attempts before a message is marked failed", type: "number", defaultValue: m.maxAttempts, min: 1, max: 10 }
            ]}
          />
        }
        items={[
          { rule: "Quiet hours", value: m.quietHoursOn ? `Held between ${m.quietFrom} and ${m.quietTo} (Lagos time) and sent when they end` : "Off — messages can send at any time", state: m.quietHoursOn ? "good" : "mute" },
          { rule: "Retry on failure", value: `A message the carrier could not take is retried until it has had ${m.maxAttempts} attempts; one the carrier refuses outright is failed at once, with the carrier's reason`, state: "good" },
          { rule: "Daily cap per recipient", value: m.dailyCapPerRecipient ? `${m.dailyCapPerRecipient} a day to any one address; the rest are held and go the next day` : "None", state: m.dailyCapPerRecipient ? "good" : "mute" },
          { rule: "SMS credits", value: "One credit is taken for each SMS before it is sent and given back if the carrier refuses it; with none left the message is held", state: "good" },
          { rule: "Marketing consent", value: "Checked per recipient at send time, for promotional campaigns only — operational messages bypass it", state: "good" },
          { rule: "Administrative messages", value: "Sent regardless of marketing consent — maintenance, billing, and security notices concern the service a school is paying for", state: "good" },
          { rule: "Third-party commercial messages to parents", value: "Not built — no code path composes or sends one", state: "bad" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.rule}
        columns={[
          { key: "rule", header: "Rule", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.rule}</span> },
          { key: "value", header: "Value", render: (item) => item.value },
          {
            key: "state",
            header: "State",
            render: (item) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not set" } }[item.state as "good" | "warn" | "bad" | "mute"];
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
        emptyState="No rules recorded."
      />
      <ReferenceList
        title="Providers in use"
        sub="Read from this deployment's own settings — what is set up to send right now."
        items={[
          { label: "Email", detail: carrier("EMAIL")?.configured ? "Sent over SMTP: signup and sign-in codes, invoices, notices, and the school's own queued mail." : "No mail server is set up on this deployment, so mail is logged, not sent. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.", tone: carrier("EMAIL")?.configured ? "good" : "bad" },
          { label: "SMS", detail: carrier("SMS")?.configured ? `Sent through ${carrier("SMS")?.provider}. ${carriers.enabled ? "The delivery worker is on." : "The delivery worker is off — queued messages wait. Set DELIVERY_ENABLED=true."}` : "No SMS carrier has keys on this deployment (TERMII_API_KEY, TERMII_SENDER_ID). SMS is queued and recorded, not sent.", tone: carrier("SMS")?.configured && carriers.enabled ? "good" : "bad" },
          { label: "WhatsApp Business", detail: carrier("WHATSAPP")?.configured ? `Sent through ${carrier("WHATSAPP")?.provider} as approved templates; delivery and read receipts come back through the webhook at /api/v1/webhooks/whatsapp.` : "Not connected. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID (and WHATSAPP_BUSINESS_ID to submit templates, WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET for the webhook). Until then nothing is sent on it.", tone: carrier("WHATSAPP")?.configured ? "good" : "bad" },
          { label: "In-app", detail: "Real — its own delivery channel, written to the notification log and read back in the parent, teacher, and student portals' own notification inboxes.", tone: "good" }
        ]}
      />
    </section>
  );
}

async function SecurityTab() {
  const carriers = await apiGet<CarrierStatus>("/api/super-admin/delivery-carriers");
  return (
    <TableCard
      title="Internal security"
      description="Applied to FutureRealm team accounts. What's actually true of this system today, not what's planned."
      items={[
        { requirement: "Two-factor authentication", spec: "Every team account, and every Principal, Proprietor and Bursar, confirms each sign-in with a 6-digit code sent by email — valid 10 minutes, 3 attempts. It applies wherever mail can be delivered (SMTP set, or AUTH_EMAIL_MFA=on); an authenticator-app code is available to anyone from Profile.", state: carriers.emailMfa ? "good" : "warn" },
        { requirement: "Password minimum", spec: "8 characters with letters and numbers; no breach-list check", state: "warn" },
        { requirement: "Password reuse", spec: "A password cannot repeat any of the last 3", state: "good" },
        { requirement: "Sign-in lockout", spec: "5 failed attempts in 10 minutes lock the account for 15, counted per account whichever way it is typed", state: "good" },
        { requirement: "Password rotation", spec: "None enforced", state: "mute" },
        { requirement: "Session lifetime", spec: "8 hours by default, 30 days if “Trust this device” is checked at login — no idle timeout", state: "warn" },
        { requirement: "Privilege change effect", spec: "A role change, an offboard or a switched-off account ends the session on its next request (checked every few seconds). A fine-grained permission-grid edit is read from the database on each protected request.", state: "bad" },
        { requirement: "Support access to a school", spec: "A 30-minute logged impersonation with a required reason — not read-only, the acting admin can take any action the account holder could", state: "warn" },
        { requirement: "Acting on a school's behalf beyond support access", spec: "Not built — there's no separate escalation tier that additionally requires the school's own recorded confirmation before proceeding", state: "bad" },
        { requirement: "Reading a student's academic record directly", spec: "Not possible outside the logged impersonation flow above — no platform-level endpoint exposes it", state: "good" },
        { requirement: "Out-of-hours privilege change flagging", spec: "Detected when a Super Admin runs the suspicious-activity scan — not continuous or automatic yet", state: "warn" },
        { requirement: "Audit log", spec: "Append-only in practice — no code path in this system updates or deletes an entry", state: "good" }
      ]}
      pageSize={false}
      getRowKey={(item) => item.requirement}
      columns={[
        { key: "requirement", header: "Requirement", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.requirement}</span> },
        { key: "spec", header: "Specification", render: (item) => <span className="text-[11.5px] leading-5 text-[var(--color-text-secondary)]">{item.spec}</span> },
        {
          key: "state",
          header: "State",
          render: (item) => {
            const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "By design" } }[item.state as "good" | "warn" | "bad" | "mute"];
            return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
          }
        }
      ]}
      emptyState="No requirements recorded."
    />
  );
}

const integrationPurpose: Record<string, string> = {
  "Transactional email (SMTP)": "All email sent by the platform",
  "SMS": "SMS delivery",
  "WhatsApp Business API": "WhatsApp template messages",
  "Paystack": "Card payments",
  "Flutterwave": "Card payments · secondary",
  "Object storage (S3-compatible)": "Files and source exports"
};

async function IntegrationsTab() {
  const monitoring = await apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring");

  return (
    <TableCard
      title="Connected services"
      description="What the platform actually depends on outside itself right now, read live from the same health check Infrastructure uses. The owning team is not recorded against an integration yet."
      items={monitoring.integrations}
      pageSize={false}
      getRowKey={(item) => item.name}
      columns={[
        { key: "name", header: "Service", render: (item) => <div><p className="font-bold text-[var(--color-text-primary)]">{item.name}</p><p className="text-[10px] text-[var(--color-text-muted)]">Checked {item.checkFrequency.toLowerCase()}</p></div> },
        { key: "purpose", header: "Purpose", render: (item) => integrationPurpose[item.name] ?? "—" },
        { key: "onFailure", header: "If it fails", render: (item) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{item.onFailure}</span> },
        { key: "owner", header: "Owner", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
        { key: "status", header: "State", render: (item) => <StatusBadge status={item.status} tone={integrationStatusTone(item.status)} /> }
      ]}
      emptyState="No integrations recorded."
    />
  );
}
