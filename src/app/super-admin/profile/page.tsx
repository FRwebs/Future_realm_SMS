import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/utils/formatters";

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
  const profile = await apiGet<SuperAdminMyProfile>("/api/v1/profile/me");

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
