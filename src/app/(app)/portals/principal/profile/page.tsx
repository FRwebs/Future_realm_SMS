import { AccessDenied } from "@/components/feedback/access-denied";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/utils/formatters";

interface ProfileMe {
  id: string;
  fullName: string;
  role: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  accountStatus: string;
  isActive: boolean;
  lastLoginAt?: string;
  emailVerifiedAt?: string;
  createdAt: string;
  school: {
    name: string;
    slug: string;
    schoolCode?: string | null;
    category: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country: string;
    cacNumber?: string | null;
    ministryApprovalNumber?: string | null;
    verifiedAt?: string;
    verificationRejectedAt?: string;
    verificationRejectionReason?: string | null;
    flaggedForReviewReason?: string | null;
    plan: string;
    status: string;
    billingStatus: string;
    trialEndsAt?: string;
    nextBillingAt?: string;
    staffLimit?: number | null;
    createdAt: string;
    studentCount: number;
    userCount: number;
    planName?: string | null;
    smsBalance: number;
    whatsappBalance: number;
    walletLastToppedUpAt?: string | null;
  };
  documents: Array<{
    id: string;
    title: string;
    type: string;
    fileName?: string | null;
    verificationStatus: string;
    notes?: string | null;
    createdAt: string;
  }>;
  loginHistory: Array<{
    id: string;
    success: boolean;
    ipAddress?: string | null;
    device?: string | null;
    reason?: string | null;
    createdAt: string;
  }>;
}

const DOCUMENT_SLOTS = [
  { type: "CAC_CERTIFICATE", label: "CAC certificate", hint: "Certificate of incorporation." },
  { type: "MINISTRY_APPROVAL", label: "Ministry approval letter", hint: "The approval letter matching your ministry approval number." },
  { type: "GOVERNMENT_ID", label: "Administrator government ID", hint: "NIN slip, driver's licence, or passport data page." },
  { type: "ADDRESS_PROOF", label: "Proof of school address", hint: "Utility bill or tenancy agreement, under 3 months old." }
];

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

function docStatusPill(status: string) {
  if (status === "VERIFIED") return { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Verified" };
  if (status === "REJECTED") return { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Rejected" };
  return { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Pending review" };
}

function tabHref(tab: string) {
  return tab === "overview" ? "/portals/principal/profile" : `/portals/principal/profile?tab=${tab}`;
}

export default async function PrincipalProfilePage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/profile"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  await getServerPermissions(session);
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "overview";
  const profile = await apiGet<ProfileMe>("/api/v1/profile/me");

  const emailVerified = Boolean(profile.emailVerifiedAt);
  const contactVerified = Boolean(profile.phone);
  const schoolVerified = Boolean(profile.school.verifiedAt);
  const adminIdentityDoc = profile.documents.find((doc) => doc.type === "GOVERNMENT_ID" && doc.verificationStatus === "VERIFIED");

  const levels = [
    { n: 1, title: "Email verified", desc: "Account active. Every module unlocked for the trial.", done: emailVerified },
    { n: 2, title: "Contact verified", desc: "A phone number is on file for this account.", done: contactVerified },
    { n: 3, title: "School verified", desc: "CAC and Ministry documents accepted by a Super Admin.", done: schoolVerified },
    { n: 4, title: "Fully verified", desc: "Administrator identity confirmed.", done: Boolean(adminIdentityDoc) }
  ];
  const currentLevel = levels.filter((level) => level.done).length;

  const verificationChecklist = [
    { label: "Email address", detail: profile.email, done: emailVerified, action: emailVerified ? "Verified" : "Not verified" },
    { label: "Phone number", detail: profile.phone || "Not on file", done: contactVerified, action: contactVerified ? "On file" : "Add phone" },
    {
      label: "CAC registration",
      detail: profile.school.cacNumber || "Not supplied",
      done: Boolean(profile.school.cacNumber),
      action: profile.school.cacNumber ? "On file" : "Missing"
    },
    {
      label: "Federal Ministry approval",
      detail: profile.school.ministryApprovalNumber || "Not supplied",
      done: Boolean(profile.school.ministryApprovalNumber),
      action: profile.school.ministryApprovalNumber ? "On file" : "Missing"
    },
    {
      label: "School verification",
      detail: profile.school.verifiedAt
        ? `Verified ${formatDate(profile.school.verifiedAt)}`
        : profile.school.flaggedForReviewReason
          ? `Flagged: ${profile.school.flaggedForReviewReason}`
          : "Awaiting Super Admin review",
      done: schoolVerified,
      action: schoolVerified ? "Verified" : "Pending"
    }
  ];

  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Verification", href: tabHref("verification"), active: tab === "verification" },
    { label: "Security", href: tabHref("security"), active: tab === "security" }
  ];

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
              <p className="mt-1 text-[13px] text-[rgba(255,255,255,0.74)]">{roleLabels[session.role]} · {profile.email}</p>
              <span className="mt-2 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">
                Verification level {currentLevel} of 4
              </span>
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
                { name: "city", label: "City", defaultValue: profile.school.city ?? "" },
                { name: "country", label: "Country", defaultValue: profile.school.country ?? "" }
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

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <section className="grid gap-5 xl:grid-cols-3">
          <article className="surface-card p-6">
            <p className="section-eyebrow">Personal</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Your details</h2>
            <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
              <FieldLine label="Full name" value={profile.fullName} />
              <FieldLine label="Position" value={roleLabels[session.role]} />
              <FieldLine label="User ID" value={profile.id.slice(-6).toUpperCase()} />
              <FieldLine label="Email" value={profile.email} />
              <FieldLine label="Phone" value={profile.phone} />
              <FieldLine label="Gender" value={profile.gender} />
              <FieldLine label="Account created" value={formatDate(profile.createdAt)} />
              <FieldLine label="Last sign-in" value={profile.lastLoginAt ? formatDate(profile.lastLoginAt) : "Never"} />
            </div>
          </article>

          <article className="surface-card p-6">
            <p className="section-eyebrow">School</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">School details</h2>
            <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
              <FieldLine label="School name" value={profile.school.name} />
              <FieldLine label="Web address" value={`${profile.school.slug}.futurerealm.sms`} />
              <FieldLine label="Category" value={profile.school.category.replaceAll("_", " ")} />
              <FieldLine label="Students enrolled" value={profile.school.studentCount.toLocaleString()} />
              <FieldLine label="Staff & users" value={profile.school.userCount.toLocaleString()} />
              <FieldLine label="Country" value={profile.school.country} />
              <FieldLine label="State / City" value={[profile.school.state, profile.school.city].filter(Boolean).join(" / ")} />
              <FieldLine label="Address" value={profile.school.address} />
              <FieldLine label="CAC number" value={profile.school.cacNumber} />
              <FieldLine label="Ministry approval no." value={profile.school.ministryApprovalNumber} />
              <FieldLine label="Registered" value={formatDate(profile.school.createdAt)} />
            </div>
          </article>

          <article className="surface-card p-6">
            <p className="section-eyebrow">Plan</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Subscription & credits</h2>
            <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
              <FieldLine label="Plan" value={profile.school.planName ?? profile.school.plan} />
              <FieldLine label="Status" value={<StatusBadge status={profile.school.status} tone={profile.school.status === "ACTIVE" ? "success" : "warning"} />} />
              <FieldLine label="Billing status" value={profile.school.billingStatus} />
              <FieldLine label="Trial ends" value={profile.school.trialEndsAt ? formatDate(profile.school.trialEndsAt) : "—"} />
              <FieldLine label="Next billing" value={profile.school.nextBillingAt ? formatDate(profile.school.nextBillingAt) : "—"} />
              <FieldLine label="SMS credits" value={profile.school.smsBalance.toLocaleString()} />
              <FieldLine label="WhatsApp credits" value={profile.school.whatsappBalance.toLocaleString()} />
            </div>
          </article>
        </section>
      ) : null}

      {tab === "verification" ? (
        <section className="grid gap-5">
          <section className="surface-card p-6">
            <p className="section-eyebrow">Verification progress</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Level {currentLevel} of 4</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {levels.map((level) => (
                <div key={level.n} className="rounded-[10px] border border-[var(--color-border-default)] p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        background: level.done ? "var(--color-success)" : "var(--color-bg-subtle)",
                        color: level.done ? "white" : "var(--color-text-muted)"
                      }}
                    >
                      {level.n}
                    </span>
                    <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{level.title}</p>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-5 text-[var(--color-text-muted)]">{level.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <TableCard
            title="Verification checklist"
            description="What's on file for your school and administrator identity."
            items={verificationChecklist}
            columns={[
              { key: "label", header: "Item", render: (item) => item.label },
              { key: "detail", header: "Detail", render: (item) => item.detail },
              {
                key: "action",
                header: "Status",
                render: (item) => (
                  <StatusBadge status={item.action} tone={item.done ? "success" : "warning"} />
                )
              }
            ]}
          />

          <section className="surface-card p-6">
            <p className="section-eyebrow">Documents</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Supporting documents</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {DOCUMENT_SLOTS.map((slot) => {
                const doc = profile.documents.find((item) => item.type === slot.type);
                const pill = doc ? docStatusPill(doc.verificationStatus) : { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not submitted" };
                return (
                  <div key={slot.type} className="rounded-[12px] border border-[var(--color-border-default)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{slot.label}</p>
                        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{slot.hint}</p>
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ background: pill.bg, color: pill.fg }}>
                        {pill.label}
                      </span>
                    </div>
                    {doc ? (
                      <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{doc.fileName ?? doc.title} · submitted {formatDate(doc.createdAt)}</p>
                    ) : null}
                    <div className="mt-3">
                      <ResourceActionDialog
                        triggerLabel={doc ? "Replace" : "Submit"}
                        title={`${slot.label} — ${doc ? "replace" : "submit"}`}
                        description="Record a reference for this document. A Super Admin reviews and verifies it."
                        endpoint={`/api/v1/profiles/${profile.id}/documents`}
                        method="POST"
                        variant="secondary"
                        submitLabel="Save"
                        fields={[
                          { name: "title", label: "Title", defaultValue: slot.label, required: true },
                          { name: "type", label: "Type", defaultValue: slot.type },
                          { name: "fileName", label: "File name / reference", required: true },
                          { name: "notes", label: "Notes", type: "textarea" }
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      ) : null}

      {tab === "security" ? (
        <section className="grid gap-5">
          <section className="surface-card p-6">
            <p className="section-eyebrow">Password</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Account security</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Change your password any time using the button in the header above. Every change is written to the audit trail.
            </p>
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
        </section>
      ) : null}
    </div>
  );
}
