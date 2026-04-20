"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Search, ShieldCheck, X } from "lucide-react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { Pagination } from "@/components/ui/pagination";
import type { PermissionGroupView, SchoolRoleView, StaffRoleDetailView, StaffRoleRowView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function apiRequest<T>(endpoint: string, options?: RequestInit) {
  const response = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookie("fr_csrf") ?? "",
      ...(options?.headers ?? {}),
    },
  });
  const body = (await response.json()) as { ok?: boolean; data?: T; error?: string; message?: string };
  if (!response.ok || body.ok === false) {
    throw new Error(body.error ?? body.message ?? "Request failed.");
  }
  return body.data as T;
}

export function StaffRoleManager({
  schoolId,
  staff,
  roles,
  permissionGroups,
}: {
  schoolId: string;
  staff: StaffRoleRowView[];
  roles: SchoolRoleView[];
  permissionGroups: PermissionGroupView[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StaffRoleDetailView | null>(null);
  const [roleId, setRoleId] = useState("");
  const [overridePermissionId, setOverridePermissionId] = useState("");
  const [overrideType, setOverrideType] = useState<"grant" | "revoke">("grant");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((member) =>
      [member.name, member.email, member.department, member.roles.map((role) => role.name).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [staff, search]);
  const visibleStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const flatPermissions = permissionGroups.flatMap((group) =>
    group.permissions.map((permission) => ({ ...permission, module: group.module }))
  );

  async function openManager(userId: string) {
    setSelectedUserId(userId);
    setMessage(null);
    setDetail(null);
    const payload = await apiRequest<StaffRoleDetailView>(`/api/v1/school/${schoolId}/roles-management/staff-roles/${userId}`);
    setDetail(payload);
  }

  function closeManager() {
    setSelectedUserId(null);
    setDetail(null);
    setRoleId("");
    setOverridePermissionId("");
    setMessage(null);
  }

  async function refreshDetail(userId = selectedUserId) {
    if (!userId) return;
    const payload = await apiRequest<StaffRoleDetailView>(`/api/v1/school/${schoolId}/roles-management/staff-roles/${userId}`);
    setDetail(payload);
    router.refresh();
  }

  async function handleAssignRole() {
    if (!selectedUserId || !roleId) return;
    setPending(true);
    setMessage(null);
    try {
      await apiRequest(`/api/v1/school/${schoolId}/roles-management/staff-roles/assign`, {
        method: "POST",
        body: JSON.stringify({ userId: selectedUserId, roleIds: [roleId] }),
      });
      setRoleId("");
      setMessage("Role assigned.");
      await refreshDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign role.");
    } finally {
      setPending(false);
    }
  }

  async function handleRevokeRole(revokeRoleId: string) {
    if (!selectedUserId || !confirm("Remove this role from the staff member?")) return;
    setPending(true);
    setMessage(null);
    try {
      await apiRequest(`/api/v1/school/${schoolId}/roles-management/staff-roles/revoke`, {
        method: "DELETE",
        body: JSON.stringify({ userId: selectedUserId, roleId: revokeRoleId }),
      });
      setMessage("Role revoked.");
      await refreshDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke role.");
    } finally {
      setPending(false);
    }
  }

  async function handleCreateOverride() {
    if (!selectedUserId || !overridePermissionId) return;
    setPending(true);
    setMessage(null);
    try {
      await apiRequest(`/api/v1/school/${schoolId}/roles-management/staff-roles/${selectedUserId}/overrides`, {
        method: "POST",
        body: JSON.stringify({ permissionId: overridePermissionId, type: overrideType }),
      });
      setOverridePermissionId("");
      setMessage("Override saved.");
      await refreshDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save override.");
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteOverride(overrideId: string) {
    if (!selectedUserId || !confirm("Remove this user-level permission override?")) return;
    setPending(true);
    setMessage(null);
    try {
      await apiRequest(`/api/v1/school/${schoolId}/roles-management/staff-roles/${selectedUserId}/overrides/${overrideId}`, {
        method: "DELETE",
      });
      setMessage("Override removed.");
      await refreshDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove override.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Staff role assignment</h2>
            <p className="mt-2 text-sm text-ink/60">Assign one or more roles to staff and preview their resolved permissions.</p>
          </div>
          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search staff, department, or role"
              className="h-12 w-full rounded-2xl border border-ink/10 bg-white pl-11 pr-4 text-sm font-semibold text-ink shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left">
            <thead className="text-xs uppercase tracking-[0.24em] text-ink/40">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Current Roles</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((member) => (
                <tr key={member.id} className="bg-sand/55 text-sm text-ink/80">
                  <td className="rounded-l-2xl px-4 py-4 font-semibold text-ink">{member.name}</td>
                  <td className="px-4 py-4">{member.email}</td>
                  <td className="px-4 py-4">{member.department}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {member.roles.length ? member.roles.map((role) => (
                        <span key={role.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink ring-1 ring-ink/8">
                          {role.name}
                        </span>
                      )) : <span className="text-ink/45">No roles assigned</span>}
                    </div>
                  </td>
                  <td className="rounded-r-2xl px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openManager(member.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-800"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Manage Roles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStaff.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-ink/15 bg-sand/45 p-6 text-sm text-ink/60">
              No staff match your search.
            </div>
          ) : null}
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredStaff.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 25]}
          className="mt-4"
        />
      </section>

      {selectedUserId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-[3px]">
          <section className="max-h-[92vh] w-[min(1100px,100%)] overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-4 border-b border-ink/6 px-6 py-5">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Staff access control</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
                  {detail?.name ?? "Loading staff profile"}
                </h2>
                <p className="mt-1 text-sm text-ink/60">{detail?.email}</p>
              </div>
              <button type="button" onClick={closeManager} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/8 bg-white text-ink shadow-sm">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-6">
              {!detail ? (
                <div className="rounded-[1.5rem] border border-dashed border-ink/15 bg-sand/45 p-6 text-sm text-ink/60">Loading role details...</div>
              ) : (
                <div className="grid gap-6">
                  {message ? (
                    <div className={cn("rounded-2xl px-4 py-3 text-sm font-semibold", message.includes("Unable") ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800")}>
                      {message}
                    </div>
                  ) : null}

                  <section className="rounded-[1.5rem] border border-ink/8 bg-sand/35 p-5">
                    <h3 className="font-[var(--font-heading)] text-xl font-bold text-ink">Assigned roles</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detail.roles.map((role) => (
                        <span key={role.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink ring-1 ring-ink/8">
                          {role.name}
                          <button type="button" onClick={() => handleRevokeRole(role.id)} disabled={pending} className="text-rose-700">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <select
                        value={roleId}
                        onChange={(event) => setRoleId(event.target.value)}
                        className="h-12 min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm outline-none"
                      >
                        <option value="">Search and add a role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={handleAssignRole} disabled={!roleId || pending} className="h-12 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:bg-ink/35">
                        Add Role
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-ink/8 bg-white p-5">
                    <h3 className="font-[var(--font-heading)] text-xl font-bold text-ink">Permission overrides</h3>
                    <div className="mt-4 grid gap-3">
                      {detail.overrides.map((override) => (
                        <div key={override.id} className="flex flex-col gap-3 rounded-2xl bg-sand/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-ink">{override.permission.label}</p>
                            <p className="text-xs text-ink/55">{override.permission.key} · Set by {override.setBy}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={override.type} />
                            <button type="button" onClick={() => handleDeleteOverride(override.id)} disabled={pending} className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {detail.overrides.length === 0 ? <p className="text-sm text-ink/55">No user-level overrides yet.</p> : null}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                      <select value={overridePermissionId} onChange={(event) => setOverridePermissionId(event.target.value)} className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm">
                        <option value="">Select permission</option>
                        {flatPermissions.map((permission) => (
                          <option key={permission.id} value={permission.id}>{permission.module} · {permission.label}</option>
                        ))}
                      </select>
                      <select value={overrideType} onChange={(event) => setOverrideType(event.target.value as "grant" | "revoke")} className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm">
                        <option value="grant">Grant</option>
                        <option value="revoke">Revoke</option>
                      </select>
                      <button type="button" onClick={handleCreateOverride} disabled={!overridePermissionId || pending} className="h-12 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:bg-ink/35">
                        Add Override
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-ink/8 bg-ink p-5 text-white">
                    <div className="mb-4 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <h3 className="font-[var(--font-heading)] text-xl font-bold">Resolved permissions preview</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {detail.groupedPermissions.map((group) => (
                        <div key={group.module} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                          <p className="font-semibold text-white">{group.module}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.permissions.map((permission) => (
                              <span key={permission.key} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                                {permission.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
