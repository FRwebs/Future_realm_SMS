import Link from "next/link";
import type { Route } from "next";
import { Building2, CheckCircle2, Handshake, LifeBuoy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StatusBadge, getWorkflowStatusTone } from "@/components/data-display/status-badge";
import { MyWorkApprovalActions } from "@/components/super-admin/my-work-approval-actions";
import { apiGet } from "@/lib/api/server";
import type {
  MyWorkNowCard,
  MyWorkNowIcon,
  MyWorkSummary,
  MyWorkTone
} from "@/lib/domain/types";

const nowIcons: Record<MyWorkNowIcon, LucideIcon> = {
  tickets: LifeBuoy,
  approvals: CheckCircle2,
  schools: Building2,
  deals: Handshake
};

const toneToBadge: Record<MyWorkTone, string> = {
  neutral: "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
  accent: "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
  success: "bg-[var(--color-success-dim)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-dim)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-dim)] text-[var(--color-danger)]",
  info: "bg-[var(--color-info-dim)] text-[var(--color-info)]",
  brand: "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
};

const toneToText: Record<MyWorkTone, string> = {
  neutral: "text-[var(--color-text-muted)]",
  accent: "text-[var(--color-text-accent)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-danger)]",
  info: "text-[var(--color-info)]",
  brand: "text-[var(--color-text-accent)]"
};

const toneToBar: Record<MyWorkTone, string> = {
  neutral: "bg-[var(--color-text-muted)]",
  accent: "bg-[var(--color-accent-primary)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-[var(--color-info)]",
  brand: "bg-[var(--color-accent-primary)]"
};

function NowCard({ card }: { card: MyWorkNowCard }) {
  const Icon = nowIcons[card.icon];

  return (
    <div className="surface-card flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${toneToBadge[card.tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${toneToBadge[card.tone]}`}>{card.pill}</span>
      </div>
      <div className="mt-3.5 flex items-baseline gap-1.5">
        <span className="font-[var(--font-mono)] text-[23px] font-black leading-none text-[var(--color-text-primary)]">{card.value}</span>
        <span className="text-[11.5px] text-[var(--color-text-muted)]">{card.unit}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--color-text-primary)]">{card.label}</p>
      <p className="mt-1.5 text-[11.5px] leading-5 text-[var(--color-text-secondary)]">{card.note}</p>
      <Link
        href={card.link as Route}
        className="mt-3.5 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] py-2 text-center text-[11.5px] font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]"
      >
        {card.action}
      </Link>
    </div>
  );
}

export default async function MyWorkPage() {
  const summary = await apiGet<MyWorkSummary>("/api/super-admin/my-work");
  const now = summary?.now ?? [];
  const schools = summary?.schools ?? { source: "account_manager" as const, portfolioTotal: 0, signalTotal: 0, rows: [] };
  const cases = summary?.cases ?? [];
  const approvals = summary?.approvals ?? [];
  const tickets = summary?.tickets ?? [];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Personal worklist</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">My Work</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            Everything assigned to you or awaiting your decision across the platform — tickets, school signals, cases, and
            approvals your role can act on.
          </p>
        </div>
      </section>

      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="whitespace-nowrap font-[var(--font-heading)] text-[14.5px] font-extrabold tracking-[-0.01em] text-[var(--color-text-primary)]">
            Needs me now
          </h2>
          <div className="h-px flex-1 bg-[var(--color-border-default)]" />
          <span className="whitespace-nowrap text-[11.5px] text-[var(--color-text-muted)]">Refreshed just now</span>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {now.map((card) => (
            <NowCard key={card.id} card={card} />
          ))}
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="grid gap-3.5">
          {/* My schools */}
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] px-[18px] py-[13px]">
              <div className="min-w-0">
                <p className="font-[var(--font-heading)] text-[13.5px] font-extrabold text-[var(--color-text-primary)]">My schools</p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                  {schools.portfolioTotal} {schools.source === "account_manager" ? "in your portfolio" : "with a case you own"} · {schools.signalTotal} carrying a signal
                </p>
              </div>
              <Link href={"/super-admin/schools" as Route} className="whitespace-nowrap text-[11.5px] font-semibold text-[var(--color-text-accent)]">
                Open directory
              </Link>
            </div>

            {schools.rows.length === 0 ? (
              <div className="px-[18px] py-6 text-[12.5px] text-[var(--color-text-muted)]">
                {schools.portfolioTotal === 0
                  ? "No schools are assigned to you as account manager, and you have no open cases tied to a school yet."
                  : "None of your schools are currently carrying a signal."}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[2fr_1fr_1.5fr_0.8fr] gap-3 border-b border-[var(--color-border-muted)] bg-[var(--color-bg-subtle)] px-[18px] py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
                  <div>School</div>
                  <div>State</div>
                  <div>Signal</div>
                  <div className="text-right">Action</div>
                </div>
                {schools.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[2fr_1fr_1.5fr_0.8fr] items-center gap-3 border-b border-[var(--color-border-muted)] px-[18px] py-[11px] last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">{row.name}</p>
                      <p className="truncate text-[11px] text-[var(--color-text-muted)]">{row.meta}</p>
                    </div>
                    <div>
                      <StatusBadge status={row.status} tone={getWorkflowStatusTone(row.status)} />
                    </div>
                    <div className="min-w-0 text-[11.5px] leading-5 text-[var(--color-text-secondary)]">{row.signal}</div>
                    <div className="text-right">
                      <Link href={row.link as Route} className="whitespace-nowrap text-[11.5px] font-semibold text-[var(--color-text-accent)]">
                        {row.action}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My cases */}
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] px-[18px] py-[13px]">
              <div className="min-w-0">
                <p className="font-[var(--font-heading)] text-[13.5px] font-extrabold text-[var(--color-text-primary)]">My cases</p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                  Assigned to you across support, migration, data-correction, and privacy-request cases
                </p>
              </div>
              <Link href={"/super-admin/support" as Route} className="whitespace-nowrap text-[11.5px] font-semibold text-[var(--color-text-accent)]">
                Open queue
              </Link>
            </div>

            {cases.length === 0 ? (
              <div className="px-[18px] py-6 text-[12.5px] text-[var(--color-text-muted)]">Nothing assigned to you across case-bearing modules right now.</div>
            ) : (
              <>
                <div className="grid grid-cols-[1.9fr_1.25fr_1fr_0.85fr] gap-3 border-b border-[var(--color-border-muted)] bg-[var(--color-bg-subtle)] px-[18px] py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
                  <div>Subject</div>
                  <div>Type</div>
                  <div>Time left</div>
                  <div className="text-right">Age</div>
                </div>
                {cases.map((row) => (
                  <Link
                    key={row.id}
                    href={row.link as Route}
                    className="grid grid-cols-[1.9fr_1.25fr_1fr_0.85fr] items-center gap-3 border-b border-[var(--color-border-muted)] px-[18px] py-[11px] transition last:border-b-0 hover:bg-[var(--color-bg-subtle)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">{row.subject}</p>
                      <p className="truncate text-[11px] text-[var(--color-text-muted)]">{row.module}</p>
                    </div>
                    <div>
                      <StatusBadge status={row.type} tone="neutral" />
                    </div>
                    <div className={`text-[11.5px] font-semibold ${toneToText[row.slaTone]}`}>{row.sla}</div>
                    <div className="text-right text-[11.5px] text-[var(--color-text-muted)]">{row.age}</div>
                  </Link>
                ))}
                <div className="border-t border-[var(--color-border-muted)] bg-[var(--color-bg-subtle)] px-[18px] py-[11px] text-[11px] text-[var(--color-text-muted)]">
                  Countdowns run in the school&rsquo;s own working hours and time zone.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-3.5">
          {/* Awaiting my approval */}
          <div id="approvals" className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] scroll-mt-6">
            <div className="border-b border-[var(--color-border-muted)] px-[18px] py-[13px]">
              <p className="font-[var(--font-heading)] text-[13.5px] font-extrabold text-[var(--color-text-primary)]">Awaiting my approval</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">Only what your role can approve</p>
            </div>

            {approvals.length === 0 ? (
              <div className="px-[18px] py-6 text-[12.5px] text-[var(--color-text-muted)]">
                Nothing is waiting on your approval right now — either the queue is empty or your role doesn&rsquo;t approve these items.
              </div>
            ) : (
              <>
                {approvals.map((item) => (
                  <div key={item.id} className="border-b border-[var(--color-border-muted)] px-[18px] py-[13px] last:border-b-0">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold leading-5 text-[var(--color-text-primary)]">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{item.meta}</p>
                      </div>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${toneToBadge[item.tone]}`}>{item.pill}</span>
                    </div>
                    <MyWorkApprovalActions item={item} />
                  </div>
                ))}
                <div className="bg-[var(--color-bg-subtle)] px-[18px] py-[11px] text-[11px] text-[var(--color-text-muted)]">
                  Approving asks for a reason where required and logs the decision to the audit trail.
                </div>
              </>
            )}
          </div>

          {/* My tickets */}
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] px-[18px] py-[13px]">
              <p className="font-[var(--font-heading)] text-[13.5px] font-extrabold text-[var(--color-text-primary)]">My tickets</p>
              <Link href={"/super-admin/support" as Route} className="text-[11.5px] font-semibold text-[var(--color-text-accent)]">
                Open board
              </Link>
            </div>
            <div>
              {tickets.map((row) => (
                <div key={row.priority} className="flex items-center gap-3 border-b border-[var(--color-border-muted)] px-[18px] py-[11px] last:border-b-0">
                  <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10.5px] font-bold ${toneToBadge[row.tone]}`}>{row.priority}</span>
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className={`h-full rounded-full ${toneToBar[row.tone]}`} style={{ width: `${row.percent}%` }} />
                  </div>
                  <span className="min-w-[22px] text-right font-[var(--font-heading)] text-[13px] font-bold text-[var(--color-text-primary)]">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently viewed intentionally omitted — no real view-history tracking exists in this app. */}
        </div>
      </div>
    </div>
  );
}
