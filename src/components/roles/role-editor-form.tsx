"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ShieldCheck, XCircle } from "lucide-react";

import type { PermissionGroupView, SchoolRoleView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function submitJson(endpoint: string, method: "POST" | "PATCH", payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookie("fr_csrf") ?? "",
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string; message?: string };
  if (!response.ok || body.ok === false) {
    throw new Error(body.error ?? body.message ?? "Unable to save role.");
  }
}

export function RoleEditorForm({
  schoolId,
  permissionGroups,
  role,
}: {
  schoolId: string;
  permissionGroups: PermissionGroupView[];
  role?: SchoolRoleView;
}) {
  const router = useRouter();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []));
  const [openModules, setOpenModules] = useState(() => new Set(permissionGroups.slice(0, 3).map((group) => group.module)));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("success");

  const selectedCount = selected.size;
  const totalCount = useMemo(
    () => permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0),
    [permissionGroups]
  );

  function togglePermission(permission: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  function toggleModule(module: string) {
    setOpenModules((current) => {
      const next = new Set(current);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  function setModulePermissions(group: PermissionGroupView, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const permission of group.permissions) {
        if (checked) next.add(permission.key);
        else next.delete(permission.key);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await submitJson(
        role
          ? `/api/v1/school/${schoolId}/roles-management/roles/${role.id}`
          : `/api/v1/school/${schoolId}/roles-management/roles`,
        role ? "PATCH" : "POST",
        { name, description, permissions: Array.from(selected) }
      );
      setTone("success");
      setMessage(role ? "Role updated successfully." : "Role created successfully.");
      router.push("/school/settings/roles");
      router.refresh();
    } catch (error) {
      setTone("danger");
      setMessage(error instanceof Error ? error.message : "Unable to save role.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Role name *</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Senior Bursary Officer"
              className="mt-2 h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
            />
          </label>

          <label>
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Description</span>
            <input
              value={description ?? ""}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short note explaining where this role applies"
              className="mt-2 h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
        <div className="border-b border-ink/6 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Permission matrix</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">Select what this role can do</h2>
              <p className="mt-2 text-sm text-ink/60">
                {selectedCount} of {totalCount} permissions selected. Module-level checkboxes support select-all behavior.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
              <ShieldCheck className="h-4 w-4" />
              Server-enforced RBAC
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:p-6">
          {permissionGroups.map((group) => {
            const groupKeys = group.permissions.map((permission) => permission.key);
            const selectedInGroup = groupKeys.filter((key) => selected.has(key)).length;
            const allSelected = selectedInGroup === group.permissions.length;
            const isOpen = openModules.has(group.module);
            return (
              <section key={group.module} className="overflow-hidden rounded-[1.5rem] border border-ink/8 bg-sand/35">
                <div className="flex flex-col gap-3 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleModule(group.module)}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{group.module}</span>
                      <span className="block text-xs text-ink/55">
                        {selectedInGroup}/{group.permissions.length} selected
                      </span>
                    </span>
                  </button>

                  <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-ink/8 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => setModulePermissions(group, event.target.checked)}
                      className="h-4 w-4 rounded border-ink/20 text-brand-700"
                    />
                    <span>Select all</span>
                  </label>
                </div>

                {isOpen ? (
                  <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.permissions.map((permission) => (
                      <label key={permission.key} className="flex cursor-pointer gap-3 rounded-2xl border border-white/70 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/35">
                        <input
                          type="checkbox"
                          checked={selected.has(permission.key)}
                          onChange={() => togglePermission(permission.key)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-ink/20 text-brand-700"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-ink">{permission.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-ink/55">{permission.description}</span>
                          <span className="mt-2 block font-mono text-[0.68rem] text-ink/40">{permission.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-ink/6 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-6">
            {message ? (
              <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold", tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
                {tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {message}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/school/settings/roles" className="inline-flex h-12 items-center rounded-full border border-ink/10 bg-white px-5 text-sm font-semibold text-ink shadow-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink/35"
            >
              {pending ? "Saving..." : "Save Role"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
