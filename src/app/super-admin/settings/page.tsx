import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminSettingsView } from "@/lib/domain/types";

export default async function SuperAdminSettingsPage() {
  const settings = await apiGet<SuperAdminSettingsView>("/api/super-admin/settings");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Global configuration</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Settings</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Control maintenance mode, school-admin announcements, grading defaults, and global module availability.</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Maintenance and announcement</h2>
          <p className="mt-2 text-sm text-ink/60">Maintenance blocks non-Super Admin logins. The announcement is shown to school admins after login.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${settings.maintenanceMode ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
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

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Global modules</h2>
          <div className="mt-4 grid gap-3">
            {Object.entries(settings.globalModuleAvailability).map(([module, enabled]) => (
              <div key={module} className="flex items-center justify-between rounded-2xl bg-sand/60 p-4 text-sm">
                <span className="font-semibold text-ink">{module.replaceAll("_", " ")}</span>
                <span className={enabled ? "text-emerald-700" : "text-rose-700"}>{enabled ? "Enabled" : "Disabled"}</span>
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

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Default grading scale</h2>
            <p className="mt-2 text-sm text-ink/60">Used as the platform-level default for new school tenants.</p>
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
        <pre className="mt-5 overflow-x-auto rounded-[1.5rem] bg-ink p-5 text-xs leading-6 text-white/85">{JSON.stringify(settings.defaultGradingScale, null, 2)}</pre>
      </section>
    </div>
  );
}
