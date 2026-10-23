import Link from "next/link";
import { ArrowLeft, Building2, CalendarPlus, Clock3, Monitor, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ImpersonateUserDialog } from "@/components/super-admin/impersonate-user-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminUserProfile } from "@/lib/domain/types";
import { deviceLabel } from "@/lib/utils/device";
import { formatDate } from "@/lib/utils/formatters";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const roleName = (role: string) => role.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** "Today, 08:12", "Yesterday", "3 days ago" — the same way the registry says it. */
function ago(value?: string): string {
  if (!value) return "Never";
  const at = new Date(value);
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (at.toDateString() === new Date().toDateString()) return `Today, ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  return days <= 1 ? "Yesterday" : `${days} days ago`;
}

function activityRows(summary: SuperAdminUserProfile["activitySummary"]): Array<{ label: string; value: number; note: string }> {
  if (summary.type === "STAFF") {
    return [
      { label: "Score entries submitted", value: summary.scoreEntriesSubmitted, note: "Marks this person entered" },
      { label: "Attendance marked", value: summary.attendanceMarked, note: "Register entries they took" }
    ];
  }
  if (summary.type === "PARENT") return [{ label: "Notifications received", value: summary.notificationsReceived, note: "Messages the school and platform sent them" }];
  return [{ label: "Admin actions taken", value: summary.adminActionsTaken, note: "Changes they made in the school's workspace" }];
}

/** A white card with the project's own title strip, used for every block under the banner. */
function Card({ title, sub, children, aside }: { title: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#EDF3EF] px-[18px] pb-[12.5px] pt-[14.5px]">
        <div className="min-w-0">
          <h2 className="text-[12.5px] font-semibold text-[#0D2315]">{title}</h2>
          {sub ? <p className="mt-[3.5px] text-pretty text-[10.5px] leading-[1.5] text-[#8C9A92]">{sub}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F2F7F4] px-[18px] py-[9.5px] last:border-b-0">
      <dt className="shrink-0 text-[11px] text-[#77857C]">{label}</dt>
      <dd className="min-w-0 text-right text-[11.5px] font-semibold text-[#0D2315]">{children}</dd>
    </div>
  );
}

export default async function SuperAdminUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await apiGet<SuperAdminUserProfile>(`/api/super-admin/users/${userId}`);
  const suspended = user.status === "SUSPENDED";
  const pending = !suspended && !user.lastLoginAt;
  const live = user.recentSessions.filter((session) => session.active).length;
  const lastDevice = user.recentSessions[0]?.device ?? null;
  const state = suspended ? { label: "Suspended", bg: "#FDF3F3", fg: "#B23B3B" } : pending ? { label: "Pending activation", bg: "#FDF6E7", fg: "#8A6410" } : { label: "Active", bg: "#EAF6F0", fg: "#17714F" };

  return (
    <div className="grid gap-[14px]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-3">
        <Link
          href="/super-admin/users"
          className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-[#DEE8E2] bg-white px-[13px] py-[7px] text-[11px] font-semibold text-[#435048] transition hover:border-[#BFDCD1] hover:bg-[#EFF6F2]"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#12796A]" strokeWidth={2.2} />
          Back to users
        </Link>
        <span className="truncate text-[11px] text-[#8C9A92]">Users <span aria-hidden>/</span> <span className="font-semibold text-[#435048]">{user.name}</span></span>
      </nav>

      <section className="relative overflow-hidden rounded-[20px] bg-[#0d2315] px-[27px] py-[23.5px] shadow-[0_18px_39.5px_-27px_rgba(13,35,21,0.8)]">
        <div className="pointer-events-none absolute -right-[81px] -top-[135px] h-[342px] w-[342px] rounded-full border border-[rgba(95,214,180,0.12)]" />
        <div className="pointer-events-none absolute -right-[18px] -top-[72px] h-[216px] w-[216px] rounded-full border border-[rgba(95,214,180,0.08)]" />
        <div className="pointer-events-none absolute -bottom-[144px] -left-[63px] h-[252px] w-[252px] rounded-full border border-white/5" />

        <div className="relative">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-[15px]">
              <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[16px] bg-white/10 font-[var(--font-heading)] text-[17px] font-extrabold text-white ring-1 ring-white/10">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="mb-[7px] flex items-center gap-2">
                  <span className="h-[4.5px] w-[4.5px] shrink-0 rounded-full bg-[#5FD6B4]" />
                  <span className="whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.15em] text-white/55">User profile · {user.profileType.toLowerCase()}</span>
                </div>
                <h1 className="truncate font-[var(--font-heading)] text-[26px] font-extrabold leading-[1.08] tracking-[-0.028em] text-white">{user.name}</h1>
                <p className="mt-[7px] truncate text-[12px] text-white/[62%]">
                  {[user.email, user.phone].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-[11px] flex flex-wrap items-center gap-[6.5px]">
                  <span className="inline-block whitespace-nowrap rounded-full px-[9px] py-[3.5px] text-[10px] font-bold" style={{ background: state.bg, color: state.fg }}>{state.label}</span>
                  <span className="inline-block whitespace-nowrap rounded-full bg-white/[0.14] px-[9px] py-[3.5px] text-[10px] font-bold text-white">{roleName(user.role)}</span>
                  <Link href={`/super-admin/schools/${user.school.id}`} className="inline-block whitespace-nowrap rounded-full bg-[#E4F1EC] px-[9px] py-[3.5px] text-[10px] font-bold text-[#17604F] transition hover:bg-white">
                    {user.school.name}
                  </Link>
                  {live > 0 ? <span className="inline-block whitespace-nowrap rounded-full bg-[#E4F1EC] px-[9px] py-[3.5px] text-[10px] font-bold text-[#17604F]">{live} live session{live === 1 ? "" : "s"}</span> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-none flex-wrap items-center gap-2">
              <Link
                href={`/super-admin/schools/${user.school.id}`}
                className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-white/25 px-[16px] py-[10px] text-[11.5px] font-semibold text-white transition hover:bg-white/10"
              >
                <Building2 className="h-3.5 w-3.5" />
                Open school
              </Link>
              <ResourceActionDialog
                triggerLabel="Reset password"
                title={`Reset password for ${user.name}`}
                description="Generates a temporary password and requires the user to change it at their next sign-in."
                endpoint={`/api/super-admin/users/${user.id}/reset-password`}
                method="PATCH"
                variant="heroWhite"
                submitLabel="Reset password"
                confirmLabel="Confirm reset"
                confirmMessage="This audit-sensitive action invalidates the current password."
                fields={[]}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="School" value={user.school.name} detail={`${user.school.plan} · ${user.school.status.replaceAll("_", " ").toLowerCase()}`} icon={Building2} tone="dark" />
        <StatCard label="Last login" value={ago(user.lastLoginAt)} detail={lastDevice ? deviceLabel(lastDevice) : "No device recorded yet"} icon={Clock3} tone="success" />
        <StatCard label="Profile type" value={roleName(user.profileType)} detail={roleName(user.role)} icon={UserRound} tone="info" />
        <StatCard label="Joined" value={formatDate(user.createdAt)} detail={`${user.recentSessions.length} session${user.recentSessions.length === 1 ? "" : "s"} on record`} icon={CalendarPlus} tone="neutral" />
      </section>

      <div className="grid items-start gap-[14px] lg:grid-cols-[1.45fr_1fr]">
        <div className="grid gap-[14px]">
          <Card title="Account" sub="Who this is, and where they belong">
            <dl>
              <Fact label="Name">{user.name}</Fact>
              <Fact label="Email">{user.email || "—"}</Fact>
              <Fact label="Phone">{user.phone || "Not recorded"}</Fact>
              <Fact label="Role">{roleName(user.role)}</Fact>
              <Fact label="School">
                <Link href={`/super-admin/schools/${user.school.id}`} className="text-[#12796A] hover:underline">{user.school.name}</Link>
              </Fact>
              <Fact label="Status">
                <span className="inline-block whitespace-nowrap rounded-full px-2 py-[2.5px] text-[10px] font-bold" style={{ background: state.bg, color: state.fg }}>{state.label}</span>
              </Fact>
              <Fact label="Joined">{formatDate(user.createdAt)}</Fact>
            </dl>
          </Card>

          <Card title="Activity" sub="What this person has done in the last 90 days">
            <div className="grid gap-2.5 p-[18px] sm:grid-cols-2">
              {activityRows(user.activitySummary).map((item) => (
                <div key={item.label} className="rounded-[11px] border border-[#EDF3EF] bg-[#FBFDFC] px-[14px] py-[12px]">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#77857C]">{item.label}</p>
                  <p className="mt-[7px] text-[20.5px] font-extrabold leading-none tracking-[-0.03em] text-[#0D2315] tabular-nums">{item.value.toLocaleString()}</p>
                  <p className="mt-[6.5px] text-[10.5px] leading-[1.4] text-[#8C9A92]">{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-[14px]">
          <Card title="Account actions" sub="Every one is logged to the audit trail against your name">
            <div className="grid gap-3 p-[18px]">
              <div>
                <p className="text-[11.5px] font-semibold text-[#0D2315]">{suspended ? "Reinstate access" : "Suspend access"}</p>
                <p className="mb-2 mt-[3px] text-[10.5px] leading-[1.5] text-[#8C9A92]">
                  {suspended ? "Restores sign-in for this account after the suspension is resolved." : "Stops this account signing in. School records are kept untouched."}
                </p>
                {suspended ? (
                  <ResourceActionDialog triggerLabel="Reinstate" title={`Reinstate ${user.name}`} description="Restores access for this account." endpoint={`/api/super-admin/users/${user.id}/reinstate`} method="PATCH" variant="secondary" submitLabel="Reinstate" fields={[]} />
                ) : (
                  <ResourceActionDialog triggerLabel="Suspend" title={`Suspend ${user.name}`} description="Suspends this account without deleting school records." endpoint={`/api/super-admin/users/${user.id}/suspend`} method="PATCH" variant="secondary" submitLabel="Suspend" fields={[]} />
                )}
              </div>
              <div className="border-t border-[#F2F7F4] pt-3">
                <p className="text-[11.5px] font-semibold text-[#0D2315]">Account recovery</p>
                <p className="mb-2 mt-[3px] text-[10.5px] leading-[1.5] text-[#8C9A92]">For someone locked out with no email access. Verify their identity first — how you verified is logged.</p>
                <ResourceActionDialog
                  triggerLabel="Recover account"
                  title={`Recover account — ${user.name}`}
                  description="Verify identity by phone before completing this — the verification method is logged."
                  endpoint={`/api/super-admin/users/${user.id}/recovery`}
                  method="POST"
                  variant="secondary"
                  submitLabel="Complete recovery"
                  confirmLabel="Confirm"
                  confirmMessage="This resets the account's password and is fully audited."
                  fields={[
                    { name: "verificationMethod", label: "Verification details (school name, proprietress name, phone, recent activity)", type: "textarea", required: true },
                    { name: "newEmail", label: "New verified email (optional)", type: "email" }
                  ]}
                />
              </div>
              <div className="border-t border-[#F2F7F4] pt-3">
                <p className="text-[11.5px] font-semibold text-[#0D2315]">Support access</p>
                <p className="mb-2 mt-[3px] text-[10.5px] leading-[1.5] text-[#8C9A92]">See the platform as this person does. Read-only unless the school approves more, and the school is told.</p>
                <ImpersonateUserDialog userId={user.id} userName={user.name} />
              </div>
            </div>
          </Card>

          {user.linkedAccounts.length > 0 || user.profileType === "PARENT" ? (
            <Card title="Linked students" sub="Student records tied to this guardian account">
              <div className="p-[18px]">
                {user.linkedAccounts.length === 0 ? (
                  <p className="rounded-[9px] bg-[#F7FAF8] px-4 py-5 text-center text-[11.5px] text-[#8C9A92]">No linked student accounts.</p>
                ) : (
                  <ul className="grid gap-2">
                    {user.linkedAccounts.map((child) => (
                      <li key={child.studentId} className="flex items-center justify-between gap-3 rounded-[9px] bg-[#F7FAF8] px-[13px] py-[10px]">
                        <span className="truncate text-[11.5px] font-semibold text-[#0D2315]">{child.studentName}</span>
                        {child.isPrimary ? <span className="rounded-full bg-[#EAF6F0] px-2 py-[2.5px] text-[10px] font-bold text-[#17714F]">Primary</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <TableCard
        title="Last 10 login sessions"
        description="When each session started, what it last did, the device, and where it came from"
        meta={`${live} live now`}
        items={user.recentSessions}
        pageSize={false}
        columns={[
          { key: "started", header: "Started", render: (item) => <span className="font-semibold text-[#0D2315]">{formatDate(item.startedAt)}</span> },
          { key: "activity", header: "Last activity", render: (item) => <span className="text-[#77857C]">{ago(item.lastActivityAt)}</span> },
          { key: "device", header: "Device", render: (item) => <span className="inline-flex items-center gap-[7px]"><Monitor className="h-3 w-3 text-[#9FB8A7]" />{deviceLabel(item.device)}</span> },
          { key: "ip", header: "IP address", render: (item) => <span className="text-[#77857C]">{item.ipAddress ?? "Unknown"}</span> },
          { key: "status", header: "Status", render: (item) => <span className="inline-block whitespace-nowrap rounded-full px-2 py-[2.5px] text-[10px] font-bold" style={item.active ? { background: "#EAF6F0", color: "#17714F" } : { background: "#F1F4F2", color: "#5C6A62" }}>{item.active ? "Live" : "Ended"}</span> }
        ]}
        emptyState="No login sessions recorded yet."
        footnote="Sessions are kept for as long as the retention schedule says, and are visible to Support Agents and above."
      />
    </div>
  );
}
