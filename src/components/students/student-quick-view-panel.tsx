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
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
      <Icon className={`h-4 w-4 ${tone}`} />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
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
          <p className="text-[12px] text-slate-500">Open the full profile for complete records, documents, and actions.</p>
          {studentId ? (
            <Link href={`/students/${studentId}`} className="btn-primary px-5">
              Open full profile
            </Link>
          ) : null}
        </div>
      )}
    >
      {loading ? <div className="h-40 animate-pulse rounded-[1.5rem] bg-slate-100" /> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {!loading && !error && profile ? (
        <div className="grid gap-5">
          <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">Learner snapshot</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Guardian: <span className="font-semibold text-slate-900">{profile.guardianName}</span> · {profile.guardianPhone}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(profile.riskFlags.length ? profile.riskFlags : ["Stable profile"]).slice(0, 3).map((flag) => (
                  <span key={flag} className="rounded-full border border-white/70 bg-white px-3 py-1 text-[12px] font-medium text-slate-700">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <QuickStat label="Attendance" value={formatPercentage(profile.attendanceRate)} icon={CalendarDays} tone="text-emerald-600" />
            <QuickStat label="Average score" value={`${profile.averageScore.toFixed(1)}%`} icon={FileText} tone="text-blue-600" />
            <QuickStat label="Outstanding" value={formatCurrency(profile.outstandingBalance)} icon={CreditCard} tone="text-amber-600" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Student details</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-900">Gender:</span> {profile.gender}</p>
                <p><span className="font-semibold text-slate-900">Date of birth:</span> {formatDate(profile.dateOfBirth)}</p>
                <p><span className="font-semibold text-slate-900">Admission date:</span> {formatDate(profile.admissionDate)}</p>
                <p><span className="font-semibold text-slate-900">State of origin:</span> {profile.stateOfOrigin ?? "Not recorded"}</p>
                <p><span className="font-semibold text-slate-900">Guardian email:</span> {profile.guardianEmail ?? "Not recorded"}</p>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                <HeartPulse className="h-4 w-4 text-rose-500" />
                Medical readiness
              </p>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-900">Blood group:</span> {profile.medical.bloodGroup ?? "Not recorded"}</p>
                <p><span className="font-semibold text-slate-900">Genotype:</span> {profile.medical.genotype ?? "Not recorded"}</p>
                <p><span className="font-semibold text-slate-900">Allergies:</span> {profile.medical.allergies ?? "None recorded"}</p>
                <p><span className="font-semibold text-slate-900">Conditions:</span> {profile.medical.conditions ?? "None recorded"}</p>
              </div>
            </section>
          </div>

          <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              Welfare timeline
            </p>
            {profile.behaviorLogs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No welfare or behavior notes recorded yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {profile.behaviorLogs.slice(0, 3).map((item) => (
                  <article key={item.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{item.category}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        {formatDate(item.loggedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {profile.riskFlags.length > 0 ? (
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
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
