"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, Search, Trash2, X } from "lucide-react";

import { usePermissions } from "@/components/auth/permission-provider";
import { ActionMenu, ActionMenuButton } from "@/components/ui/action-menu";
import { cn } from "@/lib/utils/cn";
import { configApi } from "./api";

type ConfigRecord = Record<string, unknown> & { id: string; name?: string; title?: string; code?: string; status?: string; isCurrent?: boolean; terms?: ConfigRecord[] };
type ResourcePayload = { mode: string; records?: ConfigRecord[]; record?: ConfigRecord };

const resourceLabels: Record<string, string> = {
  "sessions-terms": "Sessions & Terms",
  "school-information": "School Information",
  "class-levels": "Class Levels",
  "class-arms": "Class Arms",
  "school-calendar": "School Calendar",
  admissions: "Admissions",
  finance: "Finance",
  "payment-settings": "Payment Settings",
  fees: "Fees Configuration",
  "chart-of-accounts": "Chart of Accounts",
  "expense-items": "Expense Items",
  "inventory-settings": "Inventory Settings",
  "payroll-settings": "Payroll Settings",
  subjects: "Subjects",
  "performance-configuration": "Performance Configuration",
  "report-templates": "Report Templates",
  promotions: "Promotions",
  exam: "Exam",
  attendance: "Attendance",
  "id-card": "ID Card",
  messaging: "Messaging",
  "login-history": "Login History",
};

function permissionKey(resource: string, action: string) {
  return `config.${resource.replace(/-/g, "_")}.${action}`;
}

function inputValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function recordTitle(record: ConfigRecord) {
  return inputValue(record.name ?? record.title ?? record.email ?? record.code ?? record.id);
}

function Field({ name, label, type = "text", defaultValue, options }: { name: string; label: string; type?: string; defaultValue?: unknown; options?: Array<{ label: string; value: string }> }) {
  const base = "field-control h-10";
  if (type === "textarea") {
    return (
      <label className="grid gap-1.5">
        <span className="field-label">{label}</span>
        <textarea name={name} defaultValue={inputValue(defaultValue)} rows={4} className="field-textarea" />
      </label>
    );
  }
  if (type === "select") {
    return (
      <label className="grid gap-1.5">
        <span className="field-label">{label}</span>
        <select name={name} defaultValue={inputValue(defaultValue)} className={cn(base, "field-select")}>
          {(options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="grid gap-1.5">
      <span className="field-label">{label}</span>
      <input name={name} type={type} defaultValue={inputValue(defaultValue)} className={base} />
    </label>
  );
}

function fieldsFor(resource: string, record?: ConfigRecord, sessions?: ConfigRecord[]) {
  if (resource === "school-information") {
    return [
      <Field key="name" name="name" label="School name" defaultValue={record?.name} />,
      <Field key="schoolCode" name="schoolCode" label="School code" defaultValue={record?.schoolCode} />,
      <Field key="address" name="address" label="Address" defaultValue={record?.address} />,
      <Field key="city" name="city" label="City" defaultValue={record?.city} />,
      <Field key="state" name="state" label="State" defaultValue={record?.state} />,
      <Field key="country" name="country" label="Country" defaultValue={record?.country ?? "Nigeria"} />,
      <Field key="ownerName" name="ownerName" label="Owner / Proprietor" defaultValue={record?.ownerName} />,
      <Field key="ownerEmail" name="ownerEmail" label="Owner email" type="email" defaultValue={record?.ownerEmail} />,
      <Field key="ownerPhone" name="ownerPhone" label="Owner phone" defaultValue={record?.ownerPhone} />,
      <Field key="timezone" name="timezone" label="Timezone" defaultValue={record?.timezone ?? "Africa/Lagos"} />,
      <Field key="primaryColor" name="primaryColor" label="Primary color" defaultValue={record?.primaryColor} />,
      <Field key="secondaryColor" name="secondaryColor" label="Secondary color" defaultValue={record?.secondaryColor} />,
    ];
  }
  if (resource === "sessions-terms") {
    return [
      <Field key="recordType" name="recordType" label="Record type" type="select" defaultValue={record?.recordType ?? "session"} options={[{ label: "Session", value: "session" }, { label: "Term", value: "term" }]} />,
      <Field key="name" name="name" label="Name" defaultValue={record?.name} />,
      <Field key="academicSessionId" name="academicSessionId" label="Academic session ID" type="select" defaultValue={record?.academicSessionId} options={[{ label: "Select session for term", value: "" }, ...(sessions ?? []).map((item) => ({ label: recordTitle(item), value: item.id }))]} />,
      <Field key="startDate" name="startDate" label="Start date" type="date" defaultValue={record?.startDate} />,
      <Field key="endDate" name="endDate" label="End date" type="date" defaultValue={record?.endDate} />,
      <Field key="order" name="order" label="Term order" type="number" defaultValue={record?.order ?? 1} />,
      <Field key="isCurrent" name="isCurrent" label="Current?" type="select" defaultValue={String(record?.isCurrent ?? false)} options={[{ label: "No", value: "false" }, { label: "Yes", value: "true" }]} />,
    ];
  }
  if (resource === "class-levels") {
    return [
      <Field key="name" name="name" label="Name" defaultValue={record?.name} />,
      <Field key="section" name="section" label="School category" type="select" defaultValue={record?.section ?? "PRIMARY"} options={[{ label: "Nursery", value: "NURSERY" }, { label: "Primary", value: "PRIMARY" }, { label: "Secondary", value: "SECONDARY" }]} />,
      <Field key="schoolSection" name="schoolSection" label="School section" type="select" defaultValue={record?.schoolSection ?? "PRIMARY"} options={["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"].map((item) => ({ label: item.replace(/_/g, " "), value: item }))} />,
      <Field key="order" name="order" label="Display order" type="number" defaultValue={record?.order ?? 0} />,
      <Field key="isActive" name="isActive" label="Active?" type="select" defaultValue={String(record?.isActive ?? true)} options={[{ label: "Yes", value: "true" }, { label: "No", value: "false" }]} />,
    ];
  }
  if (resource === "school-calendar") {
    return [
      <Field key="title" name="title" label="Title" defaultValue={record?.title} />,
      <Field key="description" name="description" label="Description" type="textarea" defaultValue={record?.description} />,
      <Field key="audience" name="audience" label="Audience" defaultValue={record?.audience ?? "ALL"} />,
      <Field key="startsAt" name="startsAt" label="Start date" type="date" defaultValue={record?.startsAt} />,
      <Field key="endsAt" name="endsAt" label="End date" type="date" defaultValue={record?.endsAt} />,
    ];
  }
  if (resource === "subjects") {
    return [
      <Field key="name" name="name" label="Subject name" defaultValue={record?.name} />,
      <Field key="code" name="code" label="Subject code" defaultValue={record?.code} />,
      <Field key="section" name="section" label="Section" type="select" defaultValue={record?.section ?? ""} options={[{ label: "All", value: "" }, ...["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"].map((item) => ({ label: item.replace(/_/g, " "), value: item }))]} />,
      <Field key="isCore" name="isCore" label="Core subject?" type="select" defaultValue={String(record?.isCore ?? false)} options={[{ label: "No", value: "false" }, { label: "Yes", value: "true" }]} />,
      <Field key="isOptional" name="isOptional" label="Optional?" type="select" defaultValue={String(record?.isOptional ?? false)} options={[{ label: "No", value: "false" }, { label: "Yes", value: "true" }]} />,
      <Field key="status" name="status" label="Status" defaultValue={record?.status ?? "ACTIVE"} />,
    ];
  }
  return [
    <Field key="name" name="name" label="Name" defaultValue={record?.name} />,
    <Field key="code" name="code" label="Code" defaultValue={record?.code} />,
    <Field key="description" name="description" label="Description" type="textarea" defaultValue={record?.description} />,
    <Field key="status" name="status" label="Status" type="select" defaultValue={record?.status ?? "ACTIVE"} options={[{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }, { label: "Archived", value: "ARCHIVED" }]} />,
    <Field key="displayOrder" name="displayOrder" label="Display order" type="number" defaultValue={record?.displayOrder ?? 0} />,
    <Field key="isDefault" name="isDefault" label="Default?" type="select" defaultValue={String(record?.isDefault ?? false)} options={[{ label: "No", value: "false" }, { label: "Yes", value: "true" }]} />,
    <Field key="data" name="data" label="Additional JSON / metadata" type="textarea" defaultValue={record?.data ?? {}} />,
  ];
}

function flattenRecords(resource: string, payload: ResourcePayload | null) {
  if (!payload?.records) return [];
  if (resource !== "sessions-terms") return payload.records;
  return payload.records.flatMap((session) => [session, ...((session.terms as ConfigRecord[] | undefined) ?? [])]);
}

export function ConfigurationResourceClient({ resource, embedded = false, title }: { resource: string; embedded?: boolean; title?: string }) {
  const { hasPermission } = usePermissions();
  const [payload, setPayload] = useState<ResourcePayload | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ConfigRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const label = title ?? resourceLabels[resource] ?? resource.replace(/-/g, " ");
  const canCreate = hasPermission(permissionKey(resource, "create")) || hasPermission(permissionKey(resource, "manage")) || hasPermission("config.manage");
  const canUpdate = hasPermission(permissionKey(resource, "update")) || hasPermission(permissionKey(resource, "manage")) || hasPermission("config.manage");
  const canDelete = hasPermission(permissionKey(resource, "delete")) || hasPermission(permissionKey(resource, "manage")) || hasPermission("config.manage");

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      setPayload(await configApi<ResourcePayload>(`/api/v1/configuration/${resource}${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load configuration.");
    }
  }, [resource, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const records = useMemo(() => flattenRecords(resource, payload), [payload, resource]);
  const isSettings = payload?.mode === "settings";
  const isReadonly = payload?.mode === "readonly";
  const schoolRecord = payload?.record;

  async function submit(form: HTMLFormElement, record?: ConfigRecord) {
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    setError(null);
    setMessage(null);
    try {
      if (isSettings && resource === "school-information") {
        await configApi(`/api/v1/configuration/${resource}/school`, { method: "PATCH", body: JSON.stringify(body) });
      } else if (record) {
        await configApi(`/api/v1/configuration/${resource}/${record.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await configApi(`/api/v1/configuration/${resource}`, { method: "POST", body: JSON.stringify(body) });
      }
      setMessage("Saved successfully.");
      setCreating(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save configuration.");
    }
  }

  async function remove(record: ConfigRecord) {
    if (!confirm(`Archive or delete ${recordTitle(record)}? This action is audited.`)) return;
    setError(null);
    try {
      await configApi(`/api/v1/configuration/${resource}/${record.id}`, { method: "DELETE" });
      setMessage("Configuration removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove configuration.");
    }
  }

  return (
    <div className={embedded ? "grid gap-4" : "grid gap-5"}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{label}</h3>
          {!isReadonly && canCreate && !isSettings ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[var(--color-accent-primary)] px-3.5 text-[12.5px] font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          ) : null}
        </div>
      ) : (
        <section className="surface-hero p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link href="/school/configuration" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)]">
                <ArrowLeft className="h-4 w-4" />
                Configuration
              </Link>
              <h1 className="mt-3 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">{label}</h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">School-scoped configuration with permission-aware actions and audited changes.</p>
            </div>
            {!isReadonly && canCreate && !isSettings ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[var(--color-accent-primary)] px-4 text-[13px] font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            ) : null}
          </div>
        </section>
      )}

      {message ? (
        <div className="flex items-center gap-2 rounded-[10px] px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[10px] px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>{error}</div>
      ) : null}

      {isSettings && schoolRecord ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget, schoolRecord);
          }}
          className={embedded ? "" : "surface-card p-6"}
        >
          <div className="grid gap-4 md:grid-cols-2">{fieldsFor(resource, schoolRecord)}</div>
          {canUpdate ? (
            <button className="btn-primary mt-5 px-5">Save settings</button>
          ) : null}
        </form>
      ) : null}

      {!isSettings ? (
        <label className="relative block max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="h-9 w-full rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pl-8 pr-3 text-[12.5px] text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)]"
          />
        </label>
      ) : null}

      {!payload && !error ? <div className="app-skeleton h-32 rounded-[10px]" /> : null}
      {payload && records.length === 0 && !isSettings ? (
        <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-8 text-center text-[13px] text-[var(--color-text-muted)]">No records yet.</div>
      ) : null}

      {records.length > 0 ? (
        <div className="overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-[var(--color-bg-subtle)] text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code / Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-muted)]">
                {records.map((record) => (
                  <tr key={record.id} className="bg-[var(--color-bg-surface)] transition hover:bg-[var(--color-bg-subtle)]">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{recordTitle(record)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{inputValue(record.code ?? record.recordType ?? record.ipAddress ?? "—")}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={
                          record.isCurrent
                            ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                            : record.status === "INACTIVE"
                              ? { background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }
                              : { background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }
                        }
                      >
                        {record.isCurrent ? "CURRENT" : inputValue(record.status ?? (record.success === false ? "FAILED" : record.success === true ? "SUCCESS" : "ACTIVE"))}
                      </span>
                    </td>
                    <td className="max-w-sm truncate px-4 py-3 text-[var(--color-text-muted)]">{inputValue(record.description ?? record.reason ?? record.audience ?? record.startDate ?? record.createdAt ?? "—")}</td>
                    <td className="px-4 py-3">
                      <ActionMenu triggerLabel={`Actions for ${recordTitle(record)}`}>
                        {!isReadonly && canUpdate ? (
                          <ActionMenuButton onClick={() => setEditing(record)}>Edit</ActionMenuButton>
                        ) : null}
                        {!isReadonly && canDelete ? (
                          <ActionMenuButton onClick={() => void remove(record)} destructive>
                            <span className="inline-flex items-center gap-2">
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </span>
                          </ActionMenuButton>
                        ) : null}
                      </ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {(creating || editing) ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(event.currentTarget, editing ?? undefined);
            }}
            className="modal-surface w-full max-w-2xl overflow-hidden rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-start justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-5">
              <div>
                <p className="section-eyebrow">{label}</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">{editing ? "Edit record" : "Create record"}</h2>
              </div>
              <button
                type="button"
                onClick={() => { setCreating(false); setEditing(null); }}
                className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2.5 text-[var(--color-text-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-6 md:grid-cols-2">{fieldsFor(resource, editing ?? undefined, flattenRecords("sessions-terms", payload))}</div>
            <div className="flex justify-end gap-3 border-t border-[var(--color-border-default)] px-6 py-4">
              <button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="btn-secondary px-5">Cancel</button>
              <button className="btn-primary px-5">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
