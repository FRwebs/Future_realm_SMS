"use client";

import { useState } from "react";
import { CheckCircle2, Edit3, RefreshCcw, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { usePermissions } from "@/components/auth/permission-provider";
import type { SchemeOfWorkDetailView, SchemeOfWorkTopicView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { schemeApi } from "./api";
import { SchemeOfWorkStatusBadge } from "./status-badge";
import { SchemeOfWorkTopicList } from "./topic-list";

function ActionDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(18,33,23,0.28)]">
        <div className="flex items-start justify-between border-b border-ink/8 px-6 py-5">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Scheme of Work</p>
            <h3 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-ink/8 bg-white text-ink/55 transition hover:bg-sand/70"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function ProgressCard({ sow }: { sow: SchemeOfWorkDetailView }) {
  const stats = sow.stats;
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/88 p-5 shadow-[0_14px_36px_rgba(18,33,23,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-ink">Term coverage progress</p>
          <p className="mt-1 text-sm text-ink/58">
            {stats.coveredWeeks} of {stats.teachingWeeks} teaching weeks covered
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "font-[var(--font-heading)] text-3xl font-black",
              stats.coveragePercent >= 80
                ? "text-emerald-700"
                : stats.coveragePercent >= 50
                  ? "text-amber-700"
                  : "text-rose-700"
            )}
          >
            {stats.coveragePercent}%
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/42">
            {stats.isOnTrack ? "On track" : "Behind schedule"}
          </p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink/8">
        <span
          className={cn(
            "block h-full rounded-full transition-all",
            stats.coveragePercent >= 80
              ? "bg-emerald-500"
              : stats.coveragePercent >= 50
                ? "bg-amber-500"
                : "bg-rose-500"
          )}
          style={{ width: `${stats.coveragePercent}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: Math.max(stats.teachingWeeks, 1) }, (_, index) => {
          const week = index + 1;
          const covered = week <= stats.coveredWeeks;
          const current = stats.currentWeek === week;
          return (
            <span
              key={week}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.72rem] font-black",
                covered
                  ? "bg-emerald-600 text-white"
                  : current
                    ? "bg-amber-500 text-white ring-4 ring-amber-100"
                    : "bg-sand/80 text-ink/55"
              )}
            >
              {week}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TopicForm({
  sowId,
  topic,
  onClose,
  onSaved,
}: {
  sowId: string;
  topic: SchemeOfWorkTopicView;
  onClose: () => void;
  onSaved: (updated: SchemeOfWorkDetailView) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    topic: topic.topic,
    subtopics: topic.subtopics?.join("\n") ?? "",
    behaviouralObjectives: topic.behaviouralObjectives ?? "",
    content: topic.content ?? "",
    teachingMethods: topic.teachingMethods?.join("\n") ?? "",
    teachingAids: topic.teachingAids?.join("\n") ?? "",
    referenceMaterials: topic.referenceMaterials?.join("\n") ?? "",
    evaluation: topic.evaluation ?? "",
    assignment: topic.assignment ?? "",
  });

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const updated = await schemeApi<SchemeOfWorkDetailView>(`/api/v1/scheme-of-work/${sowId}/topics/${topic.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          topic: form.topic,
          subtopics: form.subtopics.split("\n").map((item) => item.trim()).filter(Boolean),
          behaviouralObjectives: form.behaviouralObjectives,
          content: form.content,
          teachingMethods: form.teachingMethods.split("\n").map((item) => item.trim()).filter(Boolean),
          teachingAids: form.teachingAids.split("\n").map((item) => item.trim()).filter(Boolean),
          referenceMaterials: form.referenceMaterials.split("\n").map((item) => item.trim()).filter(Boolean),
          evaluation: form.evaluation,
          assignment: form.assignment,
        }),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update topic.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {[
        ["Topic", "topic", "text"],
        ["Subtopics (one per line)", "subtopics", "textarea"],
        ["Behavioural Objectives", "behaviouralObjectives", "textarea"],
        ["Content", "content", "textarea"],
        ["Teaching Methods (one per line)", "teachingMethods", "textarea"],
        ["Teaching Aids (one per line)", "teachingAids", "textarea"],
        ["Reference Materials (one per line)", "referenceMaterials", "textarea"],
        ["Evaluation", "evaluation", "textarea"],
        ["Assignment", "assignment", "textarea"],
      ].map(([label, key, type]) => (
        <label key={key} className="grid gap-2">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</span>
          {type === "textarea" ? (
            <textarea
              rows={4}
              value={form[key as keyof typeof form]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
            />
          ) : (
            <input
              value={form[key as keyof typeof form]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
            />
          )}
        </label>
      ))}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/65">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save Topic"}
        </button>
      </div>
    </div>
  );
}

function CoverForm({
  sowId,
  topic,
  onClose,
  onSaved,
}: {
  sowId: string;
  topic: SchemeOfWorkTopicView;
  onClose: () => void;
  onSaved: (updated: SchemeOfWorkDetailView) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coveredDate, setCoveredDate] = useState(new Date().toISOString().slice(0, 10));
  const [actualTopicTaught, setActualTopicTaught] = useState("");
  const [coverageNotes, setCoverageNotes] = useState("");

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await schemeApi(`/api/v1/scheme-of-work/${sowId}/topics/${topic.id}/cover`, {
        method: "PATCH",
        body: JSON.stringify({
          coveredDate,
          actualTopicTaught,
          coverageNotes,
        }),
      });
      const refreshed = await schemeApi<SchemeOfWorkDetailView>(`/api/v1/scheme-of-work/${sowId}`);
      onSaved(refreshed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark topic as covered.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
        <p className="text-sm font-bold text-ink">{topic.topic}</p>
        <p className="mt-1 text-xs text-ink/55">Week {topic.weekNumber}</p>
      </div>
      <label className="grid gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Date covered</span>
        <input
          type="date"
          value={coveredDate}
          onChange={(event) => setCoveredDate(event.target.value)}
          className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Actual topic taught</span>
        <input
          value={actualTopicTaught}
          onChange={(event) => setActualTopicTaught(event.target.value)}
          placeholder={topic.topic}
          className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Coverage notes</span>
        <textarea
          rows={4}
          value={coverageNotes}
          onChange={(event) => setCoverageNotes(event.target.value)}
          className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
        />
      </label>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/65">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Mark Covered"}
        </button>
      </div>
    </div>
  );
}

export function SchemeOfWorkDetailClient({
  initialSow,
  isAssignedTeacher = false,
}: {
  initialSow: SchemeOfWorkDetailView;
  isAssignedTeacher?: boolean;
}) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [sow, setSow] = useState(initialSow);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coverTopic, setCoverTopic] = useState<SchemeOfWorkTopicView | null>(null);
  const [editTopic, setEditTopic] = useState<SchemeOfWorkTopicView | null>(null);

  const canSubmit = hasPermission("sow.submit") && isAssignedTeacher;
  const canApprove = hasPermission("sow.approve");
  const canEdit = hasPermission("sow.edit");
  const canMarkCovered = hasPermission("sow.mark_covered");

  async function refresh() {
    setError(null);
    try {
      const updated = await schemeApi<SchemeOfWorkDetailView>(`/api/v1/scheme-of-work/${sow.id}`);
      setSow(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh scheme of work.");
    }
  }

  async function runAction(action: "submit" | "approve" | "return") {
    setPending(action);
    setError(null);
    try {
      if (action === "submit") {
        await schemeApi(`/api/v1/scheme-of-work/${sow.id}/submit`, { method: "PATCH", body: JSON.stringify({}) });
      } else {
        const returnReason = action === "return" ? window.prompt("Why are you returning this scheme of work?") ?? "" : "";
        if (action === "return" && !returnReason.trim()) {
          setPending(null);
          return;
        }
        await schemeApi(`/api/v1/scheme-of-work/${sow.id}/approve`, {
          method: "PATCH",
          body: JSON.stringify({
            action,
            returnReason,
          }),
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete the action.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Scheme of Work</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{sow.subjectName}</h1>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              {sow.className} · {sow.termName} · {sow.academicSessionName}
            </p>
            <p className="mt-2 text-sm text-ink/58">Teacher: {sow.teacherName ?? "Not yet assigned"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SchemeOfWorkStatusBadge status={sow.status} />
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink/65 transition hover:bg-sand/70"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            {canSubmit && ["DRAFT", "RETURNED"].includes(sow.status) ? (
              <button
                type="button"
                disabled={pending === "submit"}
                onClick={() => void runAction("submit")}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {pending === "submit" ? "Submitting..." : "Submit for Review"}
              </button>
            ) : null}
            {canApprove && sow.status === "SUBMITTED" ? (
              <>
                <button
                  type="button"
                  disabled={pending === "approve"}
                  onClick={() => void runAction("approve")}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {pending === "approve" ? "Approving..." : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={pending === "return"}
                  onClick={() => void runAction("return")}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Return
                </button>
              </>
            ) : null}
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {sow.returnReason ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-bold">Returned for revision</p>
            <p className="mt-1">{sow.returnReason}</p>
          </div>
        ) : null}
      </section>

      <ProgressCard sow={sow} />

      {!sow.stats.isOnTrack ? (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800">
          This scheme of work is behind the current school week. The next pending teaching week is Week {sow.stats.currentWeek ?? "N/A"}.
        </div>
      ) : null}

      <section className="grid gap-3">
        {sow.topics.map((topic) => (
          <div key={topic.id} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_14px_36px_rgba(18,33,23,0.05)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em]", topic.isCovered ? "bg-emerald-100 text-emerald-800" : "bg-sand/80 text-ink/55")}>
                    Week {topic.weekNumber}
                  </span>
                  <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink/48">
                    {topic.weekType.toLowerCase()}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-ink">{topic.topic}</h2>
                <p className="mt-2 text-sm text-ink/60">
                  {topic.isCovered
                    ? `Covered${topic.coveredDate ? ` on ${new Date(topic.coveredDate).toLocaleDateString("en-NG")}` : ""}.`
                    : "Pending coverage."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canMarkCovered && !topic.isCovered && topic.weekType === "TEACHING" ? (
                  <button
                    type="button"
                    onClick={() => setCoverTopic(topic)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Covered
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditTopic(topic)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink/65 transition hover:bg-sand/70"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Topic
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-5">
              <SchemeOfWorkTopicList topics={[topic]} />
            </div>
          </div>
        ))}
      </section>

      <ActionDialog open={Boolean(coverTopic)} title="Mark topic as covered" onClose={() => setCoverTopic(null)}>
        {coverTopic ? (
          <CoverForm
            sowId={sow.id}
            topic={coverTopic}
            onClose={() => setCoverTopic(null)}
            onSaved={(updated) => setSow(updated)}
          />
        ) : null}
      </ActionDialog>

      <ActionDialog open={Boolean(editTopic)} title="Edit weekly topic" onClose={() => setEditTopic(null)}>
        {editTopic ? (
          <TopicForm
            sowId={sow.id}
            topic={editTopic}
            onClose={() => setEditTopic(null)}
            onSaved={(updated) => setSow(updated)}
          />
        ) : null}
      </ActionDialog>
    </div>
  );
}
