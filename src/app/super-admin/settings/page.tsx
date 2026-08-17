import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminSettingsView } from "@/lib/domain/types";

export default async function SuperAdminSettingsPage() {
  const settings = await apiGet<SuperAdminSettingsView>("/api/super-admin/settings");

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Global configuration</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">Control maintenance mode, school-admin announcements, grading defaults, and global module availability.</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
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

        <section className="surface-card p-6">
          <p className="section-eyebrow">Availability</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Global modules</h2>
          <div className="mt-4 grid gap-2">
            {Object.entries(settings.globalModuleAvailability).map(([module, enabled]) => (
              <div key={module} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{module.replaceAll("_", " ")}</span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={
                    enabled
                      ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                      : { background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }
                  }
                >
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <ResourceActionDialog
              triggerLabel="Update modules"
              title="Global module availability"
              description="Paste a JSON object of module flags."
              endpoint="/api/super-admin/settings"
              method="PATCH"
              variant="secondary"
              submitLabel="Save modules"
              fields={[
                { name: "globalModuleAvailability", label: "Module JSON", type: "textarea", parse: "json", defaultValue: JSON.stringify(settings.globalModuleAvailability, null, 2) }
              ]}
            />
          </div>
        </section>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Academic defaults</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Default grading scale</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Used as the platform-level default for new school tenants.</p>
          </div>
          <ResourceActionDialog
            triggerLabel="Edit grading scale"
            title="Default grading scale"
            description="Paste the JSON grading bands used for newly created schools."
            endpoint="/api/super-admin/settings"
            method="PATCH"
            variant="secondary"
            submitLabel="Save grading"
            fields={[
              { name: "defaultGradingScale", label: "Grading JSON", type: "textarea", parse: "json", defaultValue: JSON.stringify(settings.defaultGradingScale, null, 2) }
            ]}
          />
        </div>
        <pre className="mt-5 overflow-x-auto rounded-[12px] bg-[#0D2315] p-5 text-[12px] leading-6 text-white/85">{JSON.stringify(settings.defaultGradingScale, null, 2)}</pre>
      </section>
    </div>
  );
}
