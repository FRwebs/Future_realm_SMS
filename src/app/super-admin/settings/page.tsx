import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminInfraMonitoring, SuperAdminSettingsView } from "@/lib/domain/types";

function integrationStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "HEALTHY") return "success";
  if (status === "WARNING" || status === "PARTIAL") return "warning";
  if (status === "CRITICAL") return "danger";
  return "neutral";
}

function tabHref(tab: string) {
  return tab === "platform" ? "/super-admin/settings" : `/super-admin/settings?tab=${tab}`;
}

function ReferenceList({ title, sub, items }: { title: string; sub?: string; items: Array<{ label: string; detail: string; tone?: "good" | "warn" | "bad" | "mute" }> }) {
  const toneStyle = {
    good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
    warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
    bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
    mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
  } as const;
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</p>
        {sub ? <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{sub}</p> : null}
      </div>
      <div className="grid gap-3 p-5">
        {items.map((item) => {
          const tone = toneStyle[item.tone ?? "mute"];
          return (
            <div key={item.label} className="flex items-start gap-3 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone.fg }} />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
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
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Global configuration"
        title="Settings"
        description="Platform-wide defaults, what a new school starts with, and the reference facts for how notifications, security, and outside integrations actually behave on this platform."
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
  const settings = await apiGet<SuperAdminSettingsView>("/api/super-admin/settings");

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Platform-wide</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Maintenance and announcement</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Maintenance blocks non-Super Admin logins. The announcement is shown to school admins after login.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold"
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
        description="The things that appear in front of a school or a parent."
        items={[
          { setting: "Platform name", value: "FutureRealm SMS" },
          { setting: "School web address", value: "A custom slug chosen at signup, or a slugified school name with a generated suffix if none is chosen" },
          { setting: "Support contact", value: "Handled by the assigned account manager per school, not a single fixed address or number" },
          { setting: "Platform default time zone", value: "Africa/Lagos — the default every new school starts on and can change" },
          { setting: "Currency", value: "Naira (NGN) — every plan is priced and billed in Naira, not converted from another currency" },
          { setting: "Countries open for signup", value: "Nigeria only — onboarding hard-codes the country at signup" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.setting}
        columns={[
          { key: "setting", header: "Setting", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.setting}</span> },
          { key: "value", header: "Value", render: (item) => <span className="text-[var(--color-text-secondary)]">{item.value}</span> }
        ]}
      />

      <TableCard
        title="Trial and grace defaults"
        items={[
          { setting: "Trial length", value: "30 calendar days", state: "Enforced automatically at signup" },
          { setting: "Grace period after a lapsed subscription", value: "Set manually by a Super Admin per school", state: "Not on an automatic day count yet" },
          { setting: "Dormancy notice", value: "21 days with no login during trial, 7 days' notice before the web address is released", state: "Enforced" },
          { setting: "Risk review SLA", value: "Cleared before trial end, escalated at 3 days remaining", state: "Enforced" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.setting}
        columns={[
          { key: "setting", header: "Setting", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.setting}</span> },
          { key: "value", header: "Value", render: (item) => item.value },
          { key: "state", header: "State", render: (item) => <span className="text-[12px] text-[var(--color-text-muted)]">{item.state}</span> }
        ]}
      />
    </section>
  );
}

async function DefaultsTab() {
  const settings = await apiGet<SuperAdminSettingsView>("/api/super-admin/settings");

  return (
    <section className="grid gap-5">
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
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
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
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Default grading scale</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
        <pre className="mt-5 overflow-x-auto rounded-[12px] bg-[#0D2315] p-5 text-[12px] leading-6 text-[rgba(255,255,255,0.85)]">{JSON.stringify(settings.defaultGradingScale, null, 2)}</pre>
      </section>
    </section>
  );
}

async function NotificationsTab() {
  return (
    <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <TableCard
        title="Sending rules"
        description="How the platform actually behaves when it sends something, above any individual template."
        items={[
          { rule: "Quiet hours", value: "Not enforced — messages can send at any time", state: "mute" },
          { rule: "Retry on failure", value: "Not implemented — a failed send is not automatically retried", state: "bad" },
          { rule: "Daily cap per recipient", value: "Not enforced", state: "mute" },
          { rule: "Marketing consent", value: "Checked per recipient at send time, for promotional campaigns only — operational messages bypass it", state: "good" },
          { rule: "Email", value: "Real SMTP send when configured; otherwise logged to the server console, not delivered", state: "warn" }
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
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not enforced" } }[item.state as "good" | "warn" | "bad" | "mute"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
        emptyState="No rules recorded."
      />
      <ReferenceList
        title="Channels in use"
        sub="What actually sends a message today, stated plainly rather than as an aspiration."
        items={[
          { label: "Email", detail: "Real, over SMTP, when SMTP credentials are configured — otherwise the message is logged, not delivered.", tone: "good" },
          { label: "SMS", detail: "No real provider is wired in — every SMS send today is simulated.", tone: "bad" },
          { label: "WhatsApp Business", detail: "Credit wallets exist and are topped up manually, but no real WhatsApp API call happens on send yet.", tone: "bad" },
          { label: "In-app", detail: "Not modeled as a separate delivery channel in this system today.", tone: "mute" }
        ]}
      />
    </section>
  );
}

async function SecurityTab() {
  return (
    <TableCard
      title="Internal security"
      description="Applied to Nooria team accounts. What's actually true of this system today, not what's planned."
      items={[
        { requirement: "Two-factor authentication", spec: "Not implemented — sign-in is email and password only. A 6-digit email code exists for onboarding verification, not for login.", state: "bad" },
        { requirement: "Password minimum", spec: "8 characters, no breach-list check", state: "warn" },
        { requirement: "Password rotation", spec: "None enforced", state: "mute" },
        { requirement: "Session lifetime", spec: "8 hours by default, 30 days if “Trust this device” is checked at login — no idle timeout", state: "warn" },
        { requirement: "Privilege change effect", spec: "Immediate for fine-grained permission checks; role-level checks apply on the next token refresh or re-login", state: "warn" },
        { requirement: "Support access to a school", spec: "A 30-minute logged impersonation with a required reason — not read-only, the acting admin can take any action the account holder could", state: "warn" },
        { requirement: "Reading a student's academic record directly", spec: "Not possible outside the logged impersonation flow above — no platform-level endpoint exposes it", state: "good" },
        { requirement: "Out-of-hours privilege change flagging", spec: "Detected when a Super Admin runs the suspicious-activity scan — not continuous or automatic yet", state: "warn" },
        { requirement: "Audit log", spec: "Append-only in practice — no code path in this system updates or deletes an entry", state: "good" }
      ]}
      pageSize={false}
      getRowKey={(item) => item.requirement}
      columns={[
        { key: "requirement", header: "Requirement", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.requirement}</span> },
        { key: "spec", header: "Specification", render: (item) => <span className="text-[12.5px] leading-5 text-[var(--color-text-secondary)]">{item.spec}</span> },
        {
          key: "state",
          header: "State",
          render: (item) => {
            const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "By design" } }[item.state as "good" | "warn" | "bad" | "mute"];
            return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
          }
        }
      ]}
      emptyState="No requirements recorded."
    />
  );
}

async function IntegrationsTab() {
  const monitoring = await apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring");

  return (
    <TableCard
      title="Connected services"
      description="What the platform actually depends on outside itself right now, read live from the same health check Infrastructure uses."
      items={monitoring.integrations}
      pageSize={false}
      getRowKey={(item) => item.name}
      columns={[
        { key: "name", header: "Service", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "frequency", header: "Checked", render: (item) => item.checkFrequency },
        { key: "onFailure", header: "If it fails", render: (item) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.onFailure}</span> },
        { key: "status", header: "State", render: (item) => <StatusBadge status={item.status} tone={integrationStatusTone(item.status)} /> }
      ]}
      emptyState="No integrations recorded."
    />
  );
}
