"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, CreditCard, FileText, HeartPulse, ShieldCheck } from "lucide-react";

import { SidePanel } from "@/components/ui/side-panel";
import type { StudentProfileView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/formatters";

type StudentQuickViewPanelProps = {
  studentId: string | null;
  open: boolean;
  onClose: () => void;
};

async function apiJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok || body.ok === false || body.success === false) {
    throw new Error(body.error ?? body.message ?? "Request failed.");
  }
  return body.data as T;
}

function QuickStat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof CalendarDays; tone: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <Icon className={`h-4 w-4 ${tone}`} />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export function StudentQuickViewPanel({ studentId, open, onClose }: StudentQuickViewPanelProps) {
  const [profile, setProfile] = useState<StudentProfileView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<StudentProfileView>(`/api/v1/students/${studentId}`)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProfile(null);
          setError(err instanceof Error ? err.message : "Unable to load student profile.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="lg"
      title={profile?.fullName ?? "Student quick view"}
      subtitle={profile ? `${profile.admissionNumber} · ${formatNigeriaClassName(profile.className)} · ${profile.status}` : "Preview learner context without leaving the class page."}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--color-text-muted)]">Open the full profile for complete records, documents, and actions.</p>
          {studentId ? (
            <Link href={`/students/${studentId}`} className="btn-primary px-5">
              Open full profile
            </Link>
          ) : null}
        </div>
      )}
    >
      {loading ? <div className="h-40 animate-pulse rounded-[10px] bg-[var(--color-bg-subtle)]" /> : null}
      {error ? <div className="rounded-[10px] border border-[var(--color-danger)] bg-[var(--color-danger-dim)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">{error}</div> : null}
      {!loading && !error && profile ? (
        <div className="grid gap-5">
          <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">Learner snapshot</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Guardian: <span className="font-semibold text-[var(--color-text-primary)]">{profile.guardianName}</span> · {profile.guardianPhone}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(profile.riskFlags.length ? profile.riskFlags : ["Stable profile"]).slice(0, 3).map((flag) => (
                  <span key={flag} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-secondary)]">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <QuickStat label="Attendance" value={formatPercentage(profile.attendanceRate)} icon={CalendarDays} tone="text-[var(--color-success)]" />
            <QuickStat label="Average score" value={`${profile.averageScore.toFixed(1)}%`} icon={FileText} tone="text-[var(--color-info)]" />
            <QuickStat label="Outstanding" value={formatCurrency(profile.outstandingBalance)} icon={CreditCard} tone="text-[var(--color-warning)]" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Student details</p>
              <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                <p><span className="font-semibold text-[var(--color-text-primary)]">Gender:</span> {profile.gender}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">Date of birth:</span> {formatDate(profile.dateOfBirth)}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">Admission date:</span> {formatDate(profile.admissionDate)}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">State of origin:</span> {profile.stateOfOrigin ?? "Not recorded"}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">Guardian email:</span> {profile.guardianEmail ?? "Not recorded"}</p>
              </div>
            </section>

            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                <HeartPulse className="h-4 w-4 text-[var(--color-danger)]" />
                Medical readiness
              </p>
              <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                <p><span className="font-semibold text-[var(--color-text-primary)]">Blood group:</span> {profile.medical.bloodGroup ?? "Not recorded"}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">Genotype:</span> {profile.medical.genotype ?? "Not recorded"}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">Allergies:</span> {profile.medical.allergies ?? "None recorded"}</p>
                <p><span className="font-semibold text-[var(--color-text-primary)]">Conditions:</span> {profile.medical.conditions ?? "None recorded"}</p>
              </div>
            </section>
          </div>

          <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <ShieldCheck className="h-4 w-4 text-[var(--color-accent-primary)]" />
              Welfare timeline
            </p>
            {profile.behaviorLogs.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">No welfare or behavior notes recorded yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {profile.behaviorLogs.slice(0, 3).map((item) => (
                  <article key={item.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.category}</p>
                      <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                        {formatDate(item.loggedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {profile.riskFlags.length > 0 ? (
            <div className="rounded-[10px] border border-[var(--color-warning)] bg-[var(--color-warning-dim)] p-4 text-sm text-[var(--color-warning)]">
              <p className="inline-flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Active watch-outs
              </p>
              <p className="mt-2">{profile.riskFlags.join(" · ")}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
