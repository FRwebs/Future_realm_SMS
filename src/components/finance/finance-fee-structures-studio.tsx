"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Layers3,
  Pencil,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";
import type { FeeStructureView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import {
  FinanceDrawer,
  FinanceEmptyState,
  FinancePageHeader,
  FinancePanel,
  FinanceStatusBadge,
} from "@/components/finance/finance-studio-ui";

type Props = {
  structures: FeeStructureView[];
  canManageFinance: boolean;
};

type StructureFormState = {
  name: string;
  academicSessionId: string;
  termId: string;
  classId: string;
  studentCategory: string;
  recurrence: "TERM" | "SESSION" | "ONE_TIME";
  dueDate: string;
  items: Array<{
    label: string;
    componentType:
      | "TUITION"
      | "DEVELOPMENT_LEVY"
      | "EXAM_FEE"
      | "ICT_FEE"
      | "PTA_FEE"
      | "TRANSPORT"
      | "HOSTEL"
      | "BOOKS"
      | "UNIFORM"
      | "OTHER";
    amount: number;
    isOptional: boolean;
  }>;
};

type StructureItemType = StructureFormState["items"][number]["componentType"];

const componentTypes = [
  { value: "TUITION", label: "Tuition" },
  { value: "DEVELOPMENT_LEVY", label: "Development Levy" },
  { value: "EXAM_FEE", label: "Exam Fee" },
  { value: "ICT_FEE", label: "ICT Fee" },
  { value: "PTA_FEE", label: "PTA Levy" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "HOSTEL", label: "Hostel" },
  { value: "BOOKS", label: "Books" },
  { value: "UNIFORM", label: "Uniform" },
  { value: "OTHER", label: "Other" },
] as const;

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function emptyState(): StructureFormState {
  return {
    name: "",
    academicSessionId: "",
    termId: "",
    classId: "",
    studentCategory: "",
    recurrence: "TERM",
    dueDate: "",
    items: [
      { label: "Tuition", componentType: "TUITION", amount: 0, isOptional: false },
      { label: "Development Levy", componentType: "DEVELOPMENT_LEVY", amount: 0, isOptional: false },
    ],
  };
}

function formFromStructure(structure: FeeStructureView): StructureFormState {
  const recurrence =
    structure.recurrence === "SESSION" || structure.recurrence === "ONE_TIME"
      ? structure.recurrence
      : "TERM";
  return {
    name: structure.name,
    academicSessionId: "",
    termId: "",
    classId: "",
    studentCategory: structure.studentCategory ?? "",
    recurrence,
    dueDate: structure.dueDate?.slice(0, 10) ?? "",
    items: structure.items.map((item) => ({
      label: item.label,
      componentType: item.componentType as StructureItemType,
      amount: item.amount,
      isOptional: item.isOptional,
    })),
  };
}

export function FinanceFeeStructuresStudio({
  structures,
  canManageFinance,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "generate" | null>(null);
  const [selected, setSelected] = useState<FeeStructureView | null>(null);
  const [form, setForm] = useState<StructureFormState>(emptyState());
  const [dueOn, setDueOn] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return structures.filter((structure) => {
      const matchesQuery =
        !normalized ||
        [
          structure.name,
          structure.className ?? "",
          structure.session ?? "",
          structure.term ?? "",
          structure.studentCategory ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesStatus =
        status === "ALL" ? true : status === "ACTIVE" ? structure.isActive : !structure.isActive;
      return matchesQuery && matchesStatus;
    });
  }, [query, status, structures]);

  const stats = useMemo(() => {
    const active = structures.filter((item) => item.isActive).length;
    const totalValue = structures.reduce((sum, item) => sum + item.total, 0);
    return {
      total: structures.length,
      active,
      inactive: structures.length - active,
      average: structures.length ? totalValue / structures.length : 0,
    };
  }, [structures]);

  function openCreate() {
    setSelected(null);
    setForm(emptyState());
    setDrawerMode("create");
  }

  function openEdit(structure: FeeStructureView) {
    setSelected(structure);
    setForm(formFromStructure(structure));
    setDrawerMode("edit");
  }

  function openGenerate(structure: FeeStructureView) {
    setSelected(structure);
    setDueOn(structure.dueDate?.slice(0, 10) ?? "");
    setDrawerMode("generate");
  }

  async function submitStructure() {
    if (!form.name.trim()) {
      showToast({ variant: "warning", title: "Add a structure name", description: "Every fee template needs a clear bursary-facing name." });
      return;
    }
    const items = form.items.filter((item) => item.label.trim() && item.amount > 0);
    if (!items.length) {
      showToast({ variant: "warning", title: "Add fee items", description: "At least one active fee item with an amount is required." });
      return;
    }

    setSaving(true);
    try {
      const endpoint =
        drawerMode === "edit" && selected
          ? `/api/v1/bursary/fee-structures/${selected.id}`
          : "/api/v1/bursary/fee-structures";
      const response = await fetch(endpoint, {
        method: drawerMode === "edit" ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          name: form.name,
          academicSessionId: form.academicSessionId,
          termId: form.termId,
          classId: form.classId,
          studentCategory: form.studentCategory,
          recurrence: form.recurrence,
          dueDate: form.dueDate,
          items,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Could not save fee structure.");
      }
      showToast({
        variant: "success",
        title: drawerMode === "edit" ? "Fee structure updated" : "Fee structure created",
        description: "The bursary fee template is now ready for invoice generation.",
      });
      setDrawerMode(null);
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Unable to save structure",
        description: error instanceof Error ? error.message : "Please review the form and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function archiveStructure(structure: FeeStructureView) {
    const approved = window.confirm(`Archive ${structure.name}? It will be hidden from active invoice generation but kept in history.`);
    if (!approved) return;
    try {
      const response = await fetch(`/api/v1/bursary/fee-structures/${structure.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-csrf-token": getCookie("fr_csrf") ?? "" },
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "Could not archive the structure.");
      showToast({ variant: "success", title: "Structure archived", description: `${structure.name} was moved out of active bursary use.` });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Archive failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  async function generateInvoices() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/bursary/invoices/generate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          feeStructureId: selected.id,
          dueOn,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; data?: unknown[] };
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Could not generate invoices.");
      }
      showToast({
        variant: "success",
        title: "Invoices generated",
        description: `${Array.isArray(body.data) ? body.data.length : 0} invoice records were created from ${selected.name}.`,
      });
      setDrawerMode(null);
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Invoice generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Fee structures"
        title="Build premium billing templates for every cohort"
        description="Organise tuition, levies, exams, transport, and boarding lines into reusable fee structures that the bursary can push into live student billing with confidence."
        actions={
          canManageFinance ? (
            <button type="button" onClick={openCreate} className="finance-btn-primary">
              <Plus className="h-4 w-4" />
              Add fee structure
            </button>
          ) : undefined
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <FinancePanel className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="finance-eyebrow">Portfolio health</p>
              <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">
                Fee template coverage
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search structure, class, session..."
                className="finance-field min-w-[240px]"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="finance-select min-w-[180px]"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Archived only</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MiniMetric label="Structures" value={String(stats.total)} helper={`${stats.active} live templates`} />
            <MiniMetric label="Average template value" value={formatCurrency(stats.average)} helper="Across active and archived" mono />
            <MiniMetric label="Inactive templates" value={String(stats.inactive)} helper="Available in history only" />
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <p className="finance-eyebrow">Operational cues</p>
          <div className="mt-4 grid gap-3">
            <CueCard
              icon={<ReceiptText className="h-4 w-4" />}
              title="Create a new structure"
              text="Build term-ready templates for tuition, levies, exams, hostel, transport, and other Nigerian school charges."
            />
            <CueCard
              icon={<Sparkles className="h-4 w-4" />}
              title="Generate invoices from templates"
              text="Push an approved structure into student billing and keep the resulting invoice trail tied to the source template."
            />
            <CueCard
              icon={<Layers3 className="h-4 w-4" />}
              title="Archive without losing history"
              text="Soft archive old structures once fees change, while preserving the full bursary audit trail."
            />
          </div>
        </FinancePanel>
      </section>

      {filtered.length ? (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((structure) => (
            <FinancePanel key={structure.id} className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="finance-eyebrow">Fee structure</p>
                  <h3 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">
                    {structure.name}
                  </h3>
                </div>
                <FinanceStatusBadge status={structure.isActive ? "ACTIVE" : "ARCHIVED"} />
              </div>

              <div className="mt-5 grid gap-3">
                <div className="finance-soft-surface rounded-2xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">
                    Total template value
                  </p>
                  <p className="finance-mono mt-3 text-[28px] font-bold text-[var(--finance-text-primary)]">
                    {formatCurrency(structure.total)}
                  </p>
                </div>

                <dl className="grid gap-3 text-sm">
                  <DetailRow label="Category mix" value={`${structure.items.length} fee lines`} />
                  <DetailRow label="Class scope" value={structure.className ?? "All classes"} />
                  <DetailRow label="Session" value={structure.session ?? "Current school context"} />
                  <DetailRow label="Term" value={structure.term ?? "Any term"} />
                  <DetailRow label="Recurrence" value={structure.recurrence.replaceAll("_", " ")} />
                  <DetailRow label="Due date" value={structure.dueDate ? formatDate(structure.dueDate) : "Per invoice"} />
                </dl>

                <div className="finance-soft-surface-strong rounded-2xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">
                    Components
                  </p>
                  <div className="mt-3 grid gap-2">
                    {structure.items.slice(0, 4).map((item) => (
                      <div key={item.id ?? item.label} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[var(--finance-accent-primary)]" />
                          <span className="text-[var(--finance-text-secondary)]">{item.label}</span>
                        </div>
                        <span className="finance-mono text-[var(--finance-text-primary)]">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    {structure.items.length > 4 ? (
                      <p className="pt-1 text-xs text-[var(--finance-text-muted)]">
                        +{structure.items.length - 4} more line items
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {canManageFinance ? (
                  <>
                    <button type="button" onClick={() => openEdit(structure)} className="finance-btn-secondary min-h-[40px] px-4">
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button type="button" onClick={() => openGenerate(structure)} className="finance-btn-ghost min-h-[40px] px-4">
                      <Send className="h-4 w-4" />
                      Generate invoices
                    </button>
                    <button type="button" onClick={() => archiveStructure(structure)} className="finance-btn-secondary min-h-[40px] px-4 text-rose-200 hover:text-rose-100">
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                  </>
                ) : null}
              </div>
            </FinancePanel>
          ))}
        </section>
      ) : (
        <FinanceEmptyState
          title="No fee structures match this view"
          description="Try a different search or create a new structure for the current term’s billing cycle."
          action={
            canManageFinance ? (
              <button type="button" onClick={openCreate} className="finance-btn-primary">
                <Plus className="h-4 w-4" />
                Create fee structure
              </button>
            ) : null
          }
        />
      )}

      <FinanceDrawer
        open={drawerMode === "create" || drawerMode === "edit"}
        onClose={() => setDrawerMode(null)}
        title={drawerMode === "edit" ? "Edit fee structure" : "Create fee structure"}
        subtitle="Use this drawer to define the fee mix, scope, and due date without leaving the bursary workspace."
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setDrawerMode(null)} className="finance-btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={submitStructure} className="finance-btn-primary" disabled={saving}>
              {saving ? "Saving..." : drawerMode === "edit" ? "Save changes" : "Create structure"}
            </button>
          </div>
        }
      >
        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="finance-label mb-0">Structure name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="finance-field"
              placeholder="e.g. JSS 2 Second Term Fees"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="finance-label mb-0">Recurrence</span>
              <select
                value={form.recurrence}
                onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as StructureFormState["recurrence"] }))}
                className="finance-select"
              >
                <option value="TERM">Term</option>
                <option value="SESSION">Session</option>
                <option value="ONE_TIME">One time</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="finance-label mb-0">Default due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="finance-field"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="finance-label mb-0">Session ID (optional)</span>
              <input
                value={form.academicSessionId}
                onChange={(event) => setForm((current) => ({ ...current, academicSessionId: event.target.value }))}
                className="finance-field"
                placeholder="Link to active academic session if available"
              />
            </label>
            <label className="grid gap-2">
              <span className="finance-label mb-0">Term ID (optional)</span>
              <input
                value={form.termId}
                onChange={(event) => setForm((current) => ({ ...current, termId: event.target.value }))}
                className="finance-field"
                placeholder="Link to active term if available"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="finance-label mb-0">Class ID (optional)</span>
              <input
                value={form.classId}
                onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                className="finance-field"
                placeholder="Leave blank for all classes"
              />
            </label>
            <label className="grid gap-2">
              <span className="finance-label mb-0">Student category (optional)</span>
              <input
                value={form.studentCategory}
                onChange={(event) => setForm((current) => ({ ...current, studentCategory: event.target.value }))}
                className="finance-field"
                placeholder="Boarding, day, scholarship..."
              />
            </label>
          </div>

          <div className="finance-soft-surface-strong rounded-[16px] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="finance-label mb-1">Fee items</p>
                <p className="text-sm text-[var(--finance-text-secondary)]">
                  Define each billing line with the correct amount and classification.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      { label: "", componentType: "OTHER", amount: 0, isOptional: false },
                    ],
                  }))
                }
                className="finance-btn-secondary min-h-[40px] px-4"
              >
                <Plus className="h-4 w-4" />
                Add line
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {form.items.map((item, index) => (
                <div key={`${item.label}-${index}`} className="finance-soft-surface rounded-2xl p-4">
                  <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_0.9fr_auto]">
                    <input
                      value={item.label}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((line, lineIndex) =>
                            lineIndex === index ? { ...line, label: event.target.value } : line,
                          ),
                        }))
                      }
                      className="finance-field"
                      placeholder="Fee label"
                    />
                    <select
                      value={item.componentType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((line, lineIndex) =>
                            lineIndex === index
                              ? { ...line, componentType: event.target.value as StructureFormState["items"][number]["componentType"] }
                              : line,
                          ),
                        }))
                      }
                      className="finance-select"
                    >
                      {componentTypes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={item.amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((line, lineIndex) =>
                            lineIndex === index ? { ...line, amount: Number(event.target.value) } : line,
                          ),
                        }))
                      }
                      className="finance-field finance-mono"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.filter((_, lineIndex) => lineIndex !== index),
                        }))
                      }
                      className="finance-icon-btn self-center"
                      aria-label={`Remove ${item.label || "fee line"}`}
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="mt-3 flex items-center gap-3 text-sm text-[var(--finance-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={item.isOptional}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((line, lineIndex) =>
                            lineIndex === index ? { ...line, isOptional: event.target.checked } : line,
                          ),
                        }))
                      }
                      className="h-4 w-4 rounded border-[var(--finance-border)] bg-transparent"
                    />
                    Mark as optional
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FinanceDrawer>

      <FinanceDrawer
        open={drawerMode === "generate" && Boolean(selected)}
        onClose={() => setDrawerMode(null)}
        title="Generate invoices from structure"
        subtitle="Push this approved template into live student billing and create term-ready invoices."
        width="420px"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setDrawerMode(null)} className="finance-btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={generateInvoices} className="finance-btn-primary" disabled={saving}>
              {saving ? "Generating..." : "Generate invoices"}
            </button>
          </div>
        }
      >
        <div className="grid gap-5">
          <div className="finance-soft-surface rounded-[16px] p-4">
            <p className="finance-eyebrow">Selected structure</p>
            <h3 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">
              {selected?.name}
            </h3>
            <div className="mt-4 grid gap-3">
              <DetailRow label="Template value" value={selected ? formatCurrency(selected.total) : "-"} mono />
              <DetailRow label="Class scope" value={selected?.className ?? "All eligible classes"} />
              <DetailRow label="Recurrence" value={selected?.recurrence.replaceAll("_", " ") ?? "-"} />
            </div>
          </div>

          <label className="grid gap-2">
            <span className="finance-label mb-0">Invoice due date</span>
            <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className="finance-field" />
          </label>

          <div
            className="rounded-[16px] border border-amber-500/18 bg-amber-500/10 p-4 text-sm leading-7"
            style={{ color: "var(--finance-warning-text)" }}
          >
            This creates invoices only for students who do not already have a live invoice for this structure. The source structure stays linked for audit and follow-up.
          </div>
        </div>
      </FinanceDrawer>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  helper,
  mono = false,
}: {
  label: string;
  value: string;
  helper: string;
  mono?: boolean;
}) {
  return (
    <div className="finance-soft-surface rounded-2xl px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">
        {label}
      </p>
      <p className={cn("mt-3 text-2xl font-bold text-[var(--finance-text-primary)]", mono && "finance-mono")}>
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--finance-text-secondary)]">{helper}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-[var(--finance-text-secondary)]">{label}</span>
      <span className={cn("text-right text-sm font-semibold text-[var(--finance-text-primary)]", mono && "finance-mono")}>
        {value}
      </span>
    </div>
  );
}

function CueCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="finance-soft-surface rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="finance-icon-surface mt-0.5 grid h-10 w-10 place-items-center rounded-2xl">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-[var(--finance-text-primary)]">{title}</p>
          <p className="mt-2 text-sm leading-7 text-[var(--finance-text-secondary)]">{text}</p>
        </div>
      </div>
    </div>
  );
}
