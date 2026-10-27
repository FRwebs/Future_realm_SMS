import Link from "next/link";
import type { Route } from "next";
import { Building2, CheckCircle2, Handshake, LifeBuoy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge, getWorkflowStatusTone } from "@/components/data-display/status-badge";
import { MyWorkApprovalActions } from "@/components/super-admin/my-work-approval-actions";
import { apiGet } from "@/lib/api/server";
import type {
  MyWorkNowCard,
  MyWorkNowIcon,
  MyWorkSummary,
  MyWorkTone
} from "@/lib/domain/types";

function timeAgoShort(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

const nowIcons: Record<MyWorkNowIcon, LucideIcon> = {
  tickets: LifeBuoy,
  approvals: CheckCircle2,
  schools: Building2,
  deals: Handshake
};

const toneToBadge: Record<MyWorkTone, string> = {
  neutral: "bg-(--color-bg-subtle) text-(--color-text-muted)",
  accent: "bg-(--color-accent-primary-dim) text-(--color-text-accent)",
  success: "bg-(--color-success-dim) text-(--color-success)",
  warning: "bg-(--color-warning-dim) text-(--color-warning)",
  danger: "bg-(--color-danger-dim) text-danger",
  info: "bg-(--color-info-dim) text-(--color-info)",
  brand: "bg-(--color-accent-primary-dim) text-(--color-text-accent)"
};

const toneToCardBorder: Record<MyWorkTone, string> = {
  neutral: "border-(--color-border-default)",
  accent: "border-(--color-border-default)",
  success: "border-(--color-border-default)",
  warning: "border-[#F2E4C6]",
  danger: "border-[#F0D9D9]",
  info: "border-(--color-border-default)",
  brand: "border-(--color-border-default)"
};

const toneToValueColor: Record<MyWorkTone, string> = {
  neutral: "text-(--color-text-primary)",
  accent: "text-(--color-text-accent)",
  success: "text-(--color-text-primary)",
  warning: "text-(--color-warning)",
  danger: "text-danger",
  info: "text-(--color-info)",
  brand: "text-(--color-text-accent)"
};

const toneToText: Record<MyWorkTone, string> = {
  neutral: "text-(--color-text-muted)",
  accent: "text-(--color-text-accent)",
  success: "text-(--color-success)",
  warning: "text-(--color-warning)",
  danger: "text-danger",
  info: "text-(--color-info)",
  brand: "text-(--color-text-accent)"
};

const toneToBar: Record<MyWorkTone, string> = {
  neutral: "bg-(--color-text-muted)",
  accent: "bg-(--color-accent-primary)",
  success: "bg-(--color-success)",
  warning: "bg-(--color-warning)",
  danger: "bg-danger",
  info: "bg-(--color-info)",
  brand: "bg-(--color-accent-primary)"
};

function NowCard({ card }: { card: MyWorkNowCard }) {
  const Icon = nowIcons[card.icon];

  return (
    <div className={`flex flex-col rounded-[14px] border bg-(--color-bg-surface) px-[15.5px] pb-[15.5px] pt-4 ${toneToCardBorder[card.tone]}`}>
      <div className="flex items-center justify-between gap-2.5">
        <div className={`flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[8px] ${toneToBadge[card.tone]}`}>
          <Icon className="h-[13.5px] w-[13.5px]" />
        </div>
        <span className={`whitespace-nowrap rounded-full px-[8px] py-[2.5px] text-[10px] font-bold ${toneToBadge[card.tone]}`}>{card.pill}</span>
      </div>
      <div className="mt-[11.5px] flex items-baseline gap-[6.5px]">
        <span className={`font-(--font-body) text-[24.5px] font-extrabold leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums] ${toneToValueColor[card.tone]}`}>{card.value}</span>
        <span className="whitespace-nowrap text-[10.5px] text-[#5f6e65]">{card.unit}</span>
      </div>
      <p className="mt-[4.5px] text-[11.5px] font-semibold text-(--color-text-primary)">{card.label}</p>
      <p className="mt-1.5 text-[10.5px] leading-normal text-[#5f6e65]">{card.note}</p>
      <Link
        href={card.link as Route}
        className="mt-[11.5px] rounded-[7px] border border-[#e1ebe5] bg-[#f2f7f4] py-2 text-center text-[10.5px] font-semibold text-(--color-text-primary) transition hover:border-(--color-accent-primary) hover:text-(--color-text-accent)"
      >
        {card.action}
      </Link>
    </div>
  );
}

export default async function MyWorkPage() {
  const summary = await apiGet<MyWorkSummary>("/api/super-admin/my-work");
  const recentViews = await apiGet<Array<{ id: string; label: string; href: string; viewedAt: string }>>("/api/super-admin/my-work/views").catch(() => []);
  const now = summary?.now ?? [];
  const schools = summary?.schools ?? { source: "account_manager" as const, portfolioTotal: 0, signalTotal: 0, rows: [] };
  const cases = summary?.cases ?? [];
  const approvals = summary?.approvals ?? [];
  const tickets = summary?.tickets ?? [];

  return (
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="OVERVIEW"
        title="My Work"
        description="What is mine today — assembled for you, not by you."
      />

      <div>
        <div className="mb-[10px] flex items-center gap-[10px]">
          <h2 className="whitespace-nowrap text-[12.5px] font-semibold tracking-[-0.01em] text-(--color-text-primary)">
            Needs me now
          </h2>
          <div className="h-px flex-1 bg-(--color-border-default)" />
          <span className="whitespace-nowrap text-[10.5px] text-(--color-text-muted)">Refreshed just now</span>
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
          <div className="overflow-hidden rounded-[14px] border border-(--color-border-default) bg-(--color-bg-surface)">
            <div className="flex items-center justify-between gap-3 border-b border-(--color-border-muted) px-[16px] pb-[11.5px] pt-[13.5px]">
              <div className="min-w-0">
                <p className="font-(--font-heading) text-[12px] font-extrabold text-(--color-text-primary)">My schools</p>
                <p className="mt-0.5 text-[10.5px] text-(--color-text-muted)">
                  {schools.portfolioTotal} {schools.source === "account_manager" ? "in your portfolio" : "with a case you own"} · {schools.signalTotal} carrying a signal
                </p>
              </div>
              <Link href={"/super-admin/schools" as Route} className="whitespace-nowrap text-[10.5px] font-semibold text-(--color-text-accent)">
                Open directory
              </Link>
            </div>

            {schools.rows.length === 0 ? (
              <div className="px-[16px] py-6 text-[11.5px] text-(--color-text-muted)">
                {schools.portfolioTotal === 0
                  ? "No schools are assigned to you as account manager, and you have no open cases tied to a school yet."
                  : "None of your schools are currently carrying a signal."}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[2fr_1fr_1.5fr_0.8fr] gap-3 border-b border-(--color-border-muted) bg-(--color-bg-subtle) px-[16px] py-[8px] text-[9px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  <div>School</div>
                  <div>State</div>
                  <div>Signal</div>
                  <div className="text-right">Action</div>
                </div>
                {schools.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[2fr_1fr_1.5fr_0.8fr] items-center gap-3 border-b border-(--color-border-muted) px-[16px] py-[10px] last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-semibold text-(--color-text-primary)">{row.name}</p>
                      <p className="truncate text-[10px] text-(--color-text-muted)">{row.meta}</p>
                    </div>
                    <div>
                      <StatusBadge status={row.status} tone={getWorkflowStatusTone(row.status)} />
                    </div>
                    <div className="min-w-0 text-[10.5px] leading-5 text-(--color-text-secondary)">{row.signal}</div>
                    <div className="text-right">
                      <Link href={row.link as Route} className="whitespace-nowrap text-[10.5px] font-semibold text-(--color-text-accent)">
                        {row.action}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My cases */}
          <div className="overflow-hidden rounded-[14px] border border-(--color-border-default) bg-(--color-bg-surface)">
            <div className="flex items-center justify-between gap-3 border-b border-(--color-border-muted) px-[16px] pb-[11.5px] pt-[13.5px]">
              <div className="min-w-0">
                <p className="font-(--font-heading) text-[12px] font-extrabold text-(--color-text-primary)">My cases</p>
                <p className="mt-0.5 text-[10.5px] text-(--color-text-muted)">
                  Assigned to you across support, migration, data-correction, and privacy-request cases
                </p>
              </div>
              <Link href={"/super-admin/support" as Route} className="whitespace-nowrap text-[10.5px] font-semibold text-(--color-text-accent)">
                Open queue
              </Link>
            </div>

            {cases.length === 0 ? (
              <div className="px-[16px] py-6 text-[11.5px] text-(--color-text-muted)">Nothing assigned to you across case-bearing modules right now.</div>
            ) : (
              <>
                <div className="grid grid-cols-[1.9fr_1.25fr_1fr_0.85fr] gap-3 border-b border-(--color-border-muted) bg-(--color-bg-subtle) px-[16px] py-[8px] text-[9px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  <div>Subject</div>
                  <div>Type</div>
                  <div>Time left</div>
                  <div className="text-right">Age</div>
                </div>
                {cases.map((row) => (
                  <Link
                    key={row.id}
                    href={row.link as Route}
                    className="grid grid-cols-[1.9fr_1.25fr_1fr_0.85fr] items-center gap-3 border-b border-(--color-border-muted) px-[16px] py-[10px] transition last:border-b-0 hover:bg-(--color-bg-subtle)"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-semibold text-(--color-text-primary)">{row.subject}</p>
                      <p className="truncate text-[10px] text-(--color-text-muted)">{row.module}</p>
                    </div>
                    <div>
                      <StatusBadge status={row.type} tone="neutral" />
                    </div>
                    <div className={`text-[10.5px] font-semibold ${toneToText[row.slaTone]}`}>{row.sla}</div>
                    <div className="text-right text-[10.5px] text-(--color-text-muted)">{row.age}</div>
                  </Link>
                ))}
                <div className="border-t border-(--color-border-muted) bg-(--color-bg-subtle) px-[16px] py-[10px] text-[10px] text-(--color-text-muted)">
                  Countdowns run in the school&rsquo;s own working hours and time zone.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-3.5">
          {/* Awaiting my approval */}
          <div id="approvals" className="overflow-hidden rounded-[14px] border border-(--color-border-default) bg-(--color-bg-surface) scroll-mt-6">
            <div className="border-b border-(--color-border-muted) px-[16px] pb-[11.5px] pt-[13.5px]">
              <p className="font-(--font-heading) text-[12px] font-extrabold text-(--color-text-primary)">Awaiting my approval</p>
              <p className="mt-0.5 text-[10.5px] text-(--color-text-muted)">Only what your role can approve</p>
            </div>

            {approvals.length === 0 ? (
              <div className="px-[16px] py-6 text-[11.5px] text-(--color-text-muted)">
                Nothing is waiting on your approval right now — either the queue is empty or your role doesn&rsquo;t approve these items.
              </div>
            ) : (
              <>
                {approvals.map((item) => (
                  <div key={item.id} className="border-b border-(--color-border-muted) px-[16px] py-[11.5px] last:border-b-0">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold leading-5 text-(--color-text-primary)">{item.title}</p>
                        <p className="mt-0.5 text-[10px] text-(--color-text-muted)">{item.meta}</p>
                      </div>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-bold ${toneToBadge[item.tone]}`}>{item.pill}</span>
                    </div>
                    <MyWorkApprovalActions item={item} />
                  </div>
                ))}
                <div className="bg-(--color-bg-subtle) px-[16px] py-[10px] text-[10px] text-(--color-text-muted)">
                  Approving asks for a reason where required and logs the decision to the audit trail.
                </div>
              </>
            )}
          </div>

          {/* My tickets */}
          <div className="overflow-hidden rounded-[14px] border border-(--color-border-default) bg-(--color-bg-surface)">
            <div className="flex items-center justify-between gap-3 border-b border-(--color-border-muted) px-[16px] pb-[11.5px] pt-[13.5px]">
              <p className="font-(--font-heading) text-[12px] font-extrabold text-(--color-text-primary)">My tickets</p>
              <Link href={"/super-admin/support" as Route} className="text-[10.5px] font-semibold text-(--color-text-accent)">
                Open board
              </Link>
            </div>
            <div>
              {tickets.map((row) => (
                <div key={row.priority} className="flex items-center gap-3 border-b border-(--color-border-muted) px-[16px] py-[10px] last:border-b-0">
                  <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[9.5px] font-bold ${toneToBadge[row.tone]}`}>{row.priority}</span>
                  <div className="h-[4.5px] flex-1 overflow-hidden rounded-full bg-(--color-bg-subtle)">
                    <div className={`h-full rounded-full ${toneToBar[row.tone]}`} style={{ width: `${row.percent}%` }} />
                  </div>
                  <span className="min-w-[20px] text-right font-(--font-heading) text-[11.5px] font-bold text-(--color-text-primary)">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently viewed */}
          <div className="overflow-hidden rounded-[14px] border border-(--color-border-default) bg-(--color-bg-surface)">
            <div className="border-b border-(--color-border-muted) px-[16px] pb-[11.5px] pt-[13.5px]">
              <p className="font-(--font-heading) text-[12px] font-extrabold text-(--color-text-primary)">Recently viewed</p>
              <p className="mt-0.5 text-[10.5px] text-[#5f6e65]">For resuming interrupted work</p>
            </div>
            {recentViews.length === 0 ? (
              <div className="px-[16px] py-6 text-[11.5px] text-(--color-text-muted)">Nothing yet — a school or ticket you open will appear here so you can pick it up again.</div>
            ) : (
              <div className="grid">
                {recentViews.map((view) => (
                  <Link key={view.id} href={view.href as never} className="flex items-center justify-between gap-3 border-b border-(--color-border-muted) px-[16px] py-3 last:border-b-0 hover:bg-(--color-bg-subtle)">
                    <span className="min-w-0 truncate text-[11.5px] font-semibold text-(--color-text-primary)">{view.label}</span>
                    <span className="shrink-0 text-[10px] text-(--color-text-muted)">{timeAgoShort(view.viewedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
