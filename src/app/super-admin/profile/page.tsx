import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import { roleLabels } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";
import type { SuperAdminInternalSession } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type AuditLogRow = {
  id: string;
  timestamp: string;
  action: string;
  superAdmin: string;
  target: string;
  schoolName?: string | null;
};

function moduleLabelFor(key: string) {
  const labels: Record<string, string> = {
    dashboard: "Command Center",
    schools: "School Accounts",
    migration: "Onboarding & Migration",
    billing: "Subscriptions & Billing",
    partners: "Partners & Commission",
    users: "Users",
    communications: "Communications",
    support: "Support",
    feature_flags: "Plans & Features",
    security: "Security & Compliance",
    crm: "CRM & Sales",
    settings: "Settings",
    audit_logs: "Audit Logs",
    revenue_reports: "Revenue Reports",
    my_work: "My Work"
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

function permissionSummary(permissions: string[]) {
  if (permissions.includes("sa.*")) {
    return [{ label: "Every platform module", level: "Full" }];
  }
  const byModule = new Map<string, Set<string>>();
  for (const permission of permissions) {
    const [, moduleKey, action] = permission.split(".");
    if (!moduleKey) continue;
    const set = byModule.get(moduleKey) ?? new Set<string>();
    if (action) set.add(action);
    byModule.set(moduleKey, set);
  }
  return Array.from(byModule.entries()).map(([moduleKey, actions]) => {
    const hasWrite = ["manage", "edit", "create", "reset_password", "edit_plan"].some((verb) => actions.has(verb));
    return { label: moduleLabelFor(moduleKey), level: hasWrite ? "Full" : "View" };
  });
}

type SuperAdminMyProfile = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  role: string;
  email: string;
  phone?: string | null;
  secondaryPhone?: string | null;
  alternateEmail?: string | null;
  accountStatus: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  contact: { homeAddress?: string | null; residentialAddress?: string | null; city?: string | null; country?: string | null };
  loginHistory: Array<{ id: string; success: boolean; ipAddress?: string | null; device?: string | null; reason?: string | null; createdAt: string }>;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function FieldLine({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 odd:bg-[var(--color-bg-subtle)]">
      <dt className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-right text-[13px] font-semibold text-[var(--color-text-primary)]">{value || "Not recorded"}</dd>
    </div>
  );
}

export default async function SuperAdminProfilePage() {
  const session = await getServerSession();
  const [profile, sessionsEnvelope, auditEnvelope] = await Promise.all([
    apiGet<SuperAdminMyProfile>("/api/v1/profile/me"),
    apiGetEnvelope<SuperAdminInternalSession[]>("/api/super-admin/internal-team/sessions").catch(() => null),
    apiGetEnvelope<AuditLogRow[]>("/api/super-admin/audit-logs?limit=50").catch(() => null)
  ]);

  const myPermissions = session ? getDefaultPermissionsForRole(session.role) : [];
  const permissionRows = permissionSummary(myPermissions);
  const mySessions = (sessionsEnvelope?.data ?? []).filter((item) => item.userId === session?.userId);
  const myActions = (auditEnvelope?.data ?? []).filter((log) => log.superAdmin === profile.fullName).slice(0, 8);
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-[20px] font-bold text-white">
              {initials(profile.fullName)}
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">My profile</p>
              <h1 className="mt-1 font-[var(--font-heading)] text-[26px] font-bold text-white">{profile.fullName}</h1>
              <p className="mt-1 text-[13px] text-[rgba(255,255,255,0.74)]">{profile.role.replaceAll("_", " ")} · {profile.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-white/14 px-2.5 py-1 text-[10.5px] font-bold text-white">
                  {session ? roleLabels[session.role] : profile.role.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-white/14 px-2.5 py-1 text-[10.5px] font-bold text-white">
                  {isProduction ? "Production access" : "Development access"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ResourceActionDialog
              triggerLabel="Edit contact details"
              title="Update contact details"
              description="These self-service fields update immediately — no approval required."
              endpoint="/api/v1/profile/me"
              method="PATCH"
              variant="secondary"
              submitLabel="Save changes"
              fields={[
                { name: "phone", label: "Phone", defaultValue: profile.phone ?? "" },
                { name: "secondaryPhone", label: "Secondary phone", defaultValue: profile.secondaryPhone ?? "" },
                { name: "alternateEmail", label: "Alternate email", type: "email", defaultValue: profile.alternateEmail ?? "" },
                { name: "city", label: "City", defaultValue: profile.contact.city ?? "" },
                { name: "country", label: "Country", defaultValue: profile.contact.country ?? "" },
                { name: "residentialAddress", label: "Address", defaultValue: profile.contact.residentialAddress ?? "" }
              ]}
            />
            <ResourceActionDialog
              triggerLabel="Change password"
              title="Change your password"
              description="You'll need your current password to confirm this change."
              endpoint="/api/v1/profile/me/password"
              method="PATCH"
              variant="danger"
              submitLabel="Change password"
              confirmLabel="Confirm"
              confirmMessage="This immediately changes your account password."
              fields={[
                { name: "currentPassword", label: "Current password", type: "text", required: true },
                { name: "newPassword", label: "New password (min 8 characters)", type: "text", required: true }
              ]}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface-card p-6">
          <p className="section-eyebrow">Account</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Account details</h2>
          <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
            <FieldLine label="Full name" value={profile.fullName} />
            <FieldLine label="Preferred name" value={profile.preferredName} />
            <FieldLine label="Role" value={profile.role.replaceAll("_", " ")} />
            <FieldLine label="Email" value={profile.email} />
            <FieldLine label="Status" value={<StatusBadge status={profile.accountStatus} tone={profile.isActive ? "success" : "danger"} />} />
            <FieldLine label="Member since" value={formatDate(profile.createdAt)} />
            <FieldLine label="Last login" value={profile.lastLoginAt ? formatDate(profile.lastLoginAt) : "Never"} />
          </div>
        </article>

        <article className="surface-card p-6">
          <p className="section-eyebrow">Reach you at</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Contact details</h2>
          <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
            <FieldLine label="Phone" value={profile.phone} />
            <FieldLine label="Secondary phone" value={profile.secondaryPhone} />
            <FieldLine label="Alternate email" value={profile.alternateEmail} />
            <FieldLine label="City" value={profile.contact.city} />
            <FieldLine label="Country" value={profile.contact.country} />
            <FieldLine label="Address" value={profile.contact.residentialAddress ?? profile.contact.homeAddress} />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface-card p-6">
          <p className="section-eyebrow">Access</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What you can do</h2>
          <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Derived from your role's real permission grant — not editable here.</p>
          <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
            {permissionRows.length ? (
              permissionRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 odd:bg-[var(--color-bg-subtle)]">
                  <dt className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">{row.label}</dt>
                  <dd>
                    <span
                      className={
                        row.level === "Full"
                          ? "rounded-full bg-[var(--color-success-dim)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-success)]"
                          : "rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-secondary)]"
                      }
                    >
                      {row.level}
                    </span>
                  </dd>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[12.5px] text-[var(--color-text-secondary)]">No platform permissions granted.</p>
            )}
          </div>
        </article>

        <article className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-eyebrow">Immutable audit trail</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Recent actions by you</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-1">
            {myActions.length ? (
              myActions.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-b border-[var(--color-border-default)] py-2.5 last:border-b-0">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-primary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-[var(--color-text-primary)]">
                      {log.action.replaceAll("_", " ")} — {log.target}
                      {log.schoolName ? ` · ${log.schoolName}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{formatDate(log.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-[12.5px] text-[var(--color-text-secondary)]">No actions recorded yet.</p>
            )}
          </div>
        </article>
      </section>

      <TableCard
        title="Sessions & security"
        description="Every currently active sign-in session on your account. Revoking a session logs that device out immediately."
        items={mySessions}
        emptyState="No active sessions found."
        getRowKey={(item) => item.id}
        columns={[
          { key: "device", header: "Device", render: (item) => item.device ?? "Unknown device" },
          { key: "ip", header: "IP address", render: (item) => item.ipAddress ?? "—" },
          { key: "lastActivity", header: "Last activity", render: (item) => formatDate(item.lastActivityAt) },
          { key: "expires", header: "Expires", render: (item) => formatDate(item.expiresAt) },
          {
            key: "action",
            header: "",
            sortable: false,
            render: (item) => (
              <ResourceActionDialog
                triggerLabel="Revoke"
                title="Revoke session"
                description="This immediately signs this device out. You'll need to sign in again there."
                endpoint={`/api/super-admin/internal-team/sessions/${item.id}/revoke`}
                method="PATCH"
                variant="danger"
                submitLabel="Revoke session"
                confirmLabel="Confirm"
                confirmMessage="This device will be signed out immediately."
                fields={[]}
              />
            )
          }
        ]}
      />

      <TableCard
        title="Recent login activity"
        description="Your own login history — most recent first."
        items={profile.loginHistory}
        emptyState="No login activity recorded yet."
        columns={[
          { key: "status", header: "Result", render: (item) => <StatusBadge status={item.success ? "SUCCESS" : "FAILED"} tone={item.success ? "success" : "danger"} /> },
          { key: "ip", header: "IP", render: (item) => item.ipAddress ?? "-" },
          { key: "device", header: "Device", render: (item) => item.device ?? "Unknown" },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "-" },
          { key: "when", header: "When", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
