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
    <div className="flex items-center justify-between gap-4 border-b border-[#F2F7F4] px-5 py-[11px] last:border-b-0">
      <dt className="text-[12.5px] text-[#77857C]">{label}</dt>
      <dd className="text-right text-[12.5px] font-semibold text-[var(--color-text-primary)]">{value || "Not recorded"}</dd>
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
  const fullAccessCount = permissionRows.filter((row) => row.level === "Full").length;

  return (
    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.15fr_1fr] xl:items-start">
      <div className="flex min-w-0 flex-col gap-3.5">
        <section className="flex items-start gap-[18px] rounded-2xl bg-[#0d2315] p-[22px] text-white">
          <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.14] font-[var(--font-heading)] text-[20px] font-extrabold text-white">
            {initials(profile.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[var(--font-heading)] text-[21px] font-extrabold tracking-[-0.01em] text-white">{profile.fullName}</h1>
            <p className="mt-[3px] text-[12.5px] text-white/66">
              {session ? roleLabels[session.role] : profile.role.replaceAll("_", " ")} · {profile.email}
            </p>
            <div className="mt-[13px] flex flex-wrap items-center gap-[7px]">
              <span className="rounded-full bg-white/[0.14] px-2.5 py-1 text-[11px] font-bold text-white">
                {session ? roleLabels[session.role] : profile.role.replaceAll("_", " ")}
              </span>
              <span
                className={
                  profile.isActive
                    ? "rounded-full bg-[rgba(62,224,138,0.16)] px-2.5 py-1 text-[11px] font-bold text-[#8FE9BB]"
                    : "rounded-full bg-white/[0.14] px-2.5 py-1 text-[11px] font-bold text-white"
                }
              >
                {profile.accountStatus.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-white/[0.14] px-2.5 py-1 text-[11px] font-bold text-white">
                {isProduction ? "Production access" : "Development access"}
              </span>
            </div>
          </div>
        </section>

        <article className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#EDF3EF] px-5 py-[15px]">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Your details</p>
            <ResourceActionDialog
              triggerLabel="Edit details"
              title="Update contact details"
              description="These self-service fields update immediately — no approval required."
              endpoint="/api/v1/profile/me"
              method="PATCH"
              variant="textAction"
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
          </div>
          <FieldLine label="Full name" value={profile.fullName} />
          <FieldLine label="Preferred name" value={profile.preferredName} />
          <FieldLine label="Role" value={profile.role.replaceAll("_", " ")} />
          <FieldLine label="Email" value={profile.email} />
          <FieldLine label="Phone" value={profile.phone} />
          <FieldLine label="City" value={profile.contact.city} />
          <FieldLine label="Country" value={profile.contact.country} />
          <FieldLine label="Member since" value={formatDate(profile.createdAt)} />
        </article>

        <article className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#EDF3EF] px-5 py-[15px]">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Recent actions by you</p>
            <p className="whitespace-nowrap text-[11.5px] text-[#8C9A92]">Immutable audit trail</p>
          </div>
          <div>
            {myActions.length ? (
              myActions.map((log) => (
                <div key={log.id} className="flex items-start gap-[11px] border-b border-[#F2F7F4] px-5 py-3 last:border-b-0">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-primary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-pretty text-[12.5px] text-[var(--color-text-primary)]">
                      {log.action.replaceAll("_", " ")} — {log.target}
                      {log.schoolName ? ` · ${log.schoolName}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#9FB8A7]">{formatDate(log.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-center text-[12.5px] text-[var(--color-text-secondary)]">No actions recorded yet.</p>
            )}
          </div>
        </article>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <article className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">What you can do</p>
          <p className="mb-3.5 mt-1 text-[11.5px] leading-[1.5] text-[#8C9A92]">
            Derived from your role&apos;s real permission grant — not editable here.
          </p>
          {permissionRows.length ? (
            permissionRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 border-t border-[#F2F7F4] py-[9px] first:border-t-0">
                <p className="min-w-0 text-[12.5px] text-[#435048]">{row.label}</p>
                <span
                  className={
                    row.level === "Full"
                      ? "shrink-0 rounded-full bg-[var(--color-success-dim)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-success)]"
                      : "shrink-0 rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-secondary)]"
                  }
                >
                  {row.level}
                </span>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-[12.5px] text-[var(--color-text-secondary)]">No platform permissions granted.</p>
          )}
        </article>

        <article className="rounded-[14px] border border-[#E1EBE5] bg-[var(--color-bg-subtle)] p-[18px]">
          <p className="mb-3 text-[13.5px] font-semibold text-[var(--color-text-primary)]">Your portfolio</p>
          <div className="flex items-center justify-between gap-3 border-t border-[#E7EEEA] py-2 first:border-t-0">
            <p className="text-[12px] text-[#77857C]">Active sessions</p>
            <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{mySessions.length}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#E7EEEA] py-2">
            <p className="text-[12px] text-[#77857C]">Full-access modules</p>
            <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{fullAccessCount}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#E7EEEA] py-2">
            <p className="text-[12px] text-[#77857C]">Actions logged (recent)</p>
            <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{myActions.length}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#E7EEEA] py-2">
            <p className="text-[12px] text-[#77857C]">Last login</p>
            <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{profile.lastLoginAt ? formatDate(profile.lastLoginAt) : "Never"}</p>
          </div>
        </article>

        <article className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#EDF3EF] px-5 py-[15px]">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Sessions &amp; security</p>
          </div>
          <div className="flex items-center justify-between gap-3.5 border-b border-[#F2F7F4] px-5 py-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">Password</p>
              <p className="text-pretty mt-0.5 text-[11px] text-[#8C9A92]">Keep your account secure with a strong password.</p>
            </div>
            <ResourceActionDialog
              triggerLabel="Change"
              title="Change your password"
              description="You'll need your current password to confirm this change."
              endpoint="/api/v1/profile/me/password"
              method="PATCH"
              variant="textAction"
              submitLabel="Change password"
              confirmLabel="Confirm"
              confirmMessage="This immediately changes your account password."
              fields={[
                { name: "currentPassword", label: "Current password", type: "text", required: true },
                { name: "newPassword", label: "New password (min 8 characters)", type: "text", required: true }
              ]}
            />
          </div>
          {mySessions.length ? (
            mySessions.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3.5 border-b border-[#F2F7F4] px-5 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.device ?? "Unknown device"}</p>
                  <p className="text-pretty mt-0.5 text-[11px] text-[#8C9A92]">
                    {item.ipAddress ?? "Unknown IP"} · expires {formatDate(item.expiresAt)}
                  </p>
                </div>
                <ResourceActionDialog
                  triggerLabel="Revoke"
                  title="Revoke session"
                  description="This immediately signs this device out. You'll need to sign in again there."
                  endpoint={`/api/super-admin/internal-team/sessions/${item.id}/revoke`}
                  method="PATCH"
                  variant="textActionDanger"
                  submitLabel="Revoke session"
                  confirmLabel="Confirm"
                  confirmMessage="This device will be signed out immediately."
                  fields={[]}
                />
              </div>
            ))
          ) : (
            <p className="px-5 py-4 text-[12px] text-[var(--color-text-secondary)]">No other active sessions.</p>
          )}
        </article>
      </div>

      <div className="xl:col-span-2">
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
    </div>
  );
}
