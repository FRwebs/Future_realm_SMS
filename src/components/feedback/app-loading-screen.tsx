"use client";

import { CARD_BORDER } from "@/lib/modules/tones";

/** The two hairlines the panel vocabulary rules with: heading band, then rows. */
const BAND_RULE = "#EDF3EF";
const ROW_RULE = "#F2F7F4";

type AppLoadingScreenProps = {
  scope?: "root" | "school" | "super-admin" | "portal";
  label?: string;
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`app-skeleton rounded-[1.25rem] ${className}`} />;
}

function InvertSkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`app-skeleton-invert rounded-full ${className}`} />;
}

/** Matches TableCard/TableCardBody's exact geometry: header, filter strip, rows, pagination. */
function TableCardSkeleton() {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-2">
            <SkeletonBlock className="h-4 w-40 rounded-md" />
            <SkeletonBlock className="h-3 w-64 rounded-full" />
          </div>
          <SkeletonBlock className="h-8 w-24 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#EDF3EF] bg-[#FCFDFC] px-5 py-3.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="hidden md:block">
        <div className="border-b border-[#E6EEE9] bg-[#F7FAF8] px-5 py-[11px]">
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[10.5px] w-16 rounded-full" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="flex gap-8 border-b border-[#F2F7F4] px-5 py-[13px]">
            {Array.from({ length: 5 }).map((_, col) => (
              <SkeletonBlock key={col} className="h-3 w-16 rounded-full" />
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-3 p-5 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[12px] border border-[var(--color-border-default)] p-4">
            <SkeletonBlock className="h-4 w-32 rounded-md" />
            <SkeletonBlock className="mt-3 h-3 w-full rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] px-5 py-3">
        <SkeletonBlock className="h-3 w-32 rounded-full" />
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-8 w-8 rounded-full" />
          <SkeletonBlock className="h-3 w-16 rounded-full" />
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </section>
  );
}

/** Matches DetailTabs' exact geometry so pages with a tab row under the hero don't jump
    when the skeleton is replaced by real content. */
function DetailTabsSkeleton() {
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border-default)]" aria-hidden>
      {[
        { width: "w-16", badge: false, active: true },
        { width: "w-28", badge: true, active: false },
        { width: "w-20", badge: false, active: false },
        { width: "w-24", badge: false, active: false }
      ].map((tab, index) => (
        <div
          key={index}
          className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-3 ${tab.active ? "border-[var(--color-border-strong)]" : "border-transparent"}`}
        >
          <SkeletonBlock className={`h-[13px] ${tab.width} rounded-full`} />
          {tab.badge ? <SkeletonBlock className="h-[15px] w-5 shrink-0 rounded-full" /> : null}
        </div>
      ))}
    </nav>
  );
}

function RootLoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col justify-center">
        <section className="surface-hero relative overflow-hidden px-6 py-8 md:px-10 md:py-12">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,var(--color-accent-primary-glow),transparent_70%)] md:block" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
            <div className="grid gap-4">
              <span className="section-eyebrow">{label}</span>
              <SkeletonBlock className="h-12 w-full max-w-[26rem]" />
              <SkeletonBlock className="h-4 w-full max-w-[34rem]" />
              <SkeletonBlock className="h-4 w-full max-w-[24rem]" />
              <div className="flex flex-wrap gap-3 pt-2">
                <SkeletonBlock className="h-10 w-32 rounded-full" />
                <SkeletonBlock className="h-10 w-36 rounded-full" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.5rem] border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-bg-surface)_92%,transparent)] p-5 shadow-[var(--shadow-sm)]"
                >
                  <SkeletonBlock className="mb-4 h-3 w-20 rounded-full" />
                  <SkeletonBlock className="h-8 w-24" />
                  <SkeletonBlock className="mt-5 h-3 w-28 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Content-only skeleton for a School Admin module tab (`/[module]/[tab]`).
 *
 * Same reasoning as SuperAdminLoadingScreen, and the reason the old
 * DashboardLoadingScreen was wrong: DashboardShell lives in (app)/layout.tsx and
 * stays mounted across navigations, so Next swaps only `{children}` for this
 * fallback. A fallback here must therefore draw the *page* and never the chrome
 * — the sidebar and topbar are already on screen, and drawing them again nested
 * a second <aside>, <header> and <main> inside the real ones.
 *
 * Geometry is matched to ModuleWorkspace, not copied from the Super Admin
 * skeleton: the same 14px row gap, ModuleHead's rounded-[15px] ink card at
 * px-[19px] py-[15px] with its two accent rings, TabBar's 13px/9px tabs on a
 * hairline, then panels in the shared PANEL_SHELL box. Super Admin's hero is a
 * larger rounded-[20px] at py-[26px]; reusing it verbatim would jump the layout
 * the moment real content replaced it.
 */
function ModuleHeadSkeleton({ label }: { label: string }) {
  return (
    <section className="relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] shadow-[0_14px_30px_-24px_rgba(13,35,21,0.8)]">
      <span className="sr-only">{label}</span>
      <div className="pointer-events-none absolute -right-[80px] -top-[132px] h-[336px] w-[336px] rounded-full border border-[rgba(95,214,180,0.12)]" />
      <div className="pointer-events-none absolute -right-[18px] -top-[70px] h-[212px] w-[212px] rounded-full border border-[rgba(95,214,180,0.08)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        <div className="min-w-0 max-w-[620px]">
          {/* The accent dot is real, not a placeholder — it never varies by tab. */}
          <div className="mb-[5px] flex items-center gap-[7px]">
            <span className="h-[4.5px] w-[4.5px] flex-none rounded-full bg-[#5FD6B4]" />
            <InvertSkeletonBlock className="h-[9px] w-24" />
          </div>
          <InvertSkeletonBlock className="h-[22px] w-full max-w-[20rem]" />
          <InvertSkeletonBlock className="mt-[5px] h-[16px] w-full max-w-[33rem]" />
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
          <InvertSkeletonBlock className="h-[30px] w-[104px]" />
          <InvertSkeletonBlock className="h-[33px] w-[124px]" />
        </div>
      </div>
    </section>
  );
}

/** TabBar's strip: flat labels, 3px apart, the first one carrying the accent rule. */
function ModuleTabsSkeleton() {
  return (
    <nav
      className="-mx-1 flex items-center gap-[3px] overflow-hidden border-b border-[var(--color-border-default)] px-1"
      aria-hidden
    >
      {["w-14", "w-24", "w-20", "w-16"].map((width, index) => (
        <div
          key={width}
          className={`flex flex-none items-center border-b-2 px-[13px] py-[9px] ${
            index === 0
              ? "border-b-[var(--color-accent-primary)]"
              : "border-b-transparent"
          }`}
        >
          <SkeletonBlock className={`h-[13px] ${width} rounded-full`} />
        </div>
      ))}
    </nav>
  );
}

/** The panel box every module panel shares: 14px corners, hairline, 18px gutter. */
function ModulePanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] pb-[12px] ${className}`}
      style={{ borderColor: CARD_BORDER }}
    >
      {children}
    </section>
  );
}

/** PanelHeader's band. `flush` drops the rule, as card rows and tile grids do. */
function ModulePanelHeadSkeleton({ flush }: { flush?: boolean }) {
  return (
    <div
      className={`-mx-[18px] flex flex-wrap items-start justify-between gap-[14px] px-[18px] pb-[12px] pt-[14px] ${
        flush ? "mb-0" : "mb-[12px] border-b"
      }`}
      style={flush ? undefined : { borderColor: BAND_RULE }}
    >
      <div className="grid min-w-0 flex-[1_1_260px] gap-[7px]">
        <SkeletonBlock className="h-[14px] w-44 rounded-md" />
        <SkeletonBlock className="h-[12px] w-64 rounded-full" />
      </div>
      <SkeletonBlock className="h-[26px] w-[88px] shrink-0 rounded-[8px]" />
    </div>
  );
}

/**
 * The KPI row. Auto-fit at minmax(176px, 1fr) is what `per: 4` resolves to in
 * PanelView, so the cards break to the same widths the real row breaks to.
 */
function ModuleKpiPanelSkeleton() {
  return (
    <ModulePanel className="pb-[15px]">
      <ModulePanelHeadSkeleton flush />
      <div
        className="grid items-stretch gap-[10px]"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))" }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col rounded-[14px] border bg-[var(--color-bg-surface)] px-[14px] pb-[14px] pt-[13px]"
            style={{ borderColor: CARD_BORDER, minHeight: 86 }}
          >
            <SkeletonBlock className="mb-[10px] h-[10px] w-[72px] rounded-full" />
            <SkeletonBlock className="h-[20px] w-[56px] rounded-md" />
            <SkeletonBlock className="mt-[6px] h-[11px] w-[88px] rounded-full" />
          </div>
        ))}
      </div>
    </ModulePanel>
  );
}

/**
 * A rows panel. Modelled on the `list`/`table` shapes, which share the same
 * anatomy once drawn as placeholders: a ruled heading, then rows on #F2F7F4
 * hairlines at py-[10px], each leading with a 7px tone dot.
 */
function ModuleRowsPanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ModulePanel>
      <ModulePanelHeadSkeleton />
      <ul>
        {Array.from({ length: rows }).map((_, index) => (
          <li
            key={index}
            className="flex items-start gap-[10px] border-b py-[10px]"
            style={{ borderColor: ROW_RULE }}
          >
            <SkeletonBlock className="mt-[4.5px] h-[7px] w-[7px] flex-none rounded-full" />
            <span className="min-w-0 flex-1">
              <SkeletonBlock className="h-[13px] w-full max-w-[17rem] rounded-full" />
              <SkeletonBlock className="mt-[4px] h-[11px] w-full max-w-[24rem] rounded-full" />
            </span>
            <SkeletonBlock className="h-[19px] w-[74px] flex-none rounded-full" />
          </li>
        ))}
      </ul>
    </ModulePanel>
  );
}

function SchoolModuleLoadingScreen({ label }: { label: string }) {
  return (
    <div className="skeleton-instant grid min-w-0 gap-[14px]">
      <ModuleHeadSkeleton label={label} />
      <ModuleTabsSkeleton />
      <ModuleKpiPanelSkeleton />
      <ModuleRowsPanelSkeleton />
    </div>
  );
}

/**
 * Content-only skeleton for routes rendered inside an already-mounted app shell
 * (e.g. /super-admin/*, whose sidebar + topbar live in layout.tsx and stay put
 * across navigations — only `{children}` is swapped for this fallback). Mirrors
 * the real page anatomy used across every Super Admin module: ModuleHero, a KPI
 * row (dark card first, per the mockup convention), then a TableCard.
 */
function SuperAdminLoadingScreen({ label }: { label: string }) {
  return (
    <div className="skeleton-instant grid gap-5">
      <section className="relative overflow-hidden rounded-[20px] bg-[#0d2315] px-[22px] py-[26px] shadow-[0_20px_44px_-30px_rgba(13,35,21,0.8)] md:px-[30px]">
        <span className="sr-only">{label}</span>
        <div className="pointer-events-none absolute -right-[90px] -top-[150px] h-[380px] w-[380px] rounded-full border border-[rgba(95,214,180,0.12)]" />
        <div className="pointer-events-none absolute -right-5 -top-20 h-[240px] w-[240px] rounded-full border border-[rgba(95,214,180,0.08)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-[70px] h-[280px] w-[280px] rounded-full border border-white/5" />
        <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-7">
          <div className="min-w-0 grid gap-[11px] md:max-w-[660px]">
            <InvertSkeletonBlock className="h-[10.5px] w-32" />
            <InvertSkeletonBlock className="h-[25px] w-full max-w-[22rem] md:h-[29px]" />
            <InvertSkeletonBlock className="h-[13.5px] w-full max-w-[30rem]" />
          </div>
          <InvertSkeletonBlock className="h-[42px] w-32 shrink-0" />
        </div>
      </section>

      <DetailTabsSkeleton />

      {/* The first card stands in for the mockup's dark ink card that always leads the KPI row. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="relative min-h-[112px] overflow-hidden rounded-[14px] border border-[#0d2315] bg-[#0d2315] px-[18px] py-4">
          <div className="mb-[11px] flex items-start justify-between gap-2.5">
            <InvertSkeletonBlock className="h-[10.5px] w-20" />
            <InvertSkeletonBlock className="h-[26px] w-[26px] rounded-[9px]" />
          </div>
          <InvertSkeletonBlock className="h-[23px] w-16" />
          <InvertSkeletonBlock className="mt-[7px] h-[11.5px] w-24" />
        </article>
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="surface-card relative min-h-[112px] overflow-hidden px-[18px] py-4">
            <div className="mb-[11px] flex items-start justify-between gap-2.5">
              <SkeletonBlock className="h-[10.5px] w-20 rounded-full" />
              <SkeletonBlock className="h-[26px] w-[26px] rounded-[9px]" />
            </div>
            <SkeletonBlock className="h-[23px] w-16 rounded-md" />
            <SkeletonBlock className="mt-[7px] h-[11.5px] w-24 rounded-full" />
          </article>
        ))}
      </section>

      <TableCardSkeleton />
    </div>
  );
}

/**
 * Content-only skeleton for the (app) group's portal pages that have their own
 * loading.tsx nested under a stable DashboardShell (finance, teacher scores, ...).
 * Same reasoning as SuperAdminLoadingScreen, but these pages use the light
 * `.surface-hero` treatment and a plain (non dark-first) KPI row, matching
 * finance/page.tsx's actual markup instead of the Super Admin mockup's ink card.
 */
function PortalLoadingScreen({ label }: { label: string }) {
  return (
    <div className="skeleton-instant grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <span className="sr-only">{label}</span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid max-w-3xl gap-3">
            <SkeletonBlock className="h-3 w-40 rounded-full" />
            <SkeletonBlock className="h-7 w-full max-w-md rounded-md" />
            <SkeletonBlock className="h-3.5 w-full max-w-xl rounded-full" />
          </div>
          <SkeletonBlock className="h-11 w-40 shrink-0 rounded-full" />
        </div>
      </section>

      <DetailTabsSkeleton />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="surface-card relative min-h-[112px] overflow-hidden px-[18px] py-4">
            <div className="mb-[11px] flex items-start justify-between gap-2.5">
              <SkeletonBlock className="h-[10.5px] w-20 rounded-full" />
              <SkeletonBlock className="h-[26px] w-[26px] rounded-[9px]" />
            </div>
            <SkeletonBlock className="h-[23px] w-16 rounded-md" />
            <SkeletonBlock className="mt-[7px] h-[11.5px] w-24 rounded-full" />
          </article>
        ))}
      </section>

      <TableCardSkeleton />
    </div>
  );
}

export function AppLoadingScreen({
  scope = "root",
  label = "Loading workspace",
}: AppLoadingScreenProps) {
  if (scope === "school") {
    return <SchoolModuleLoadingScreen label={label} />;
  }

  if (scope === "super-admin") {
    return <SuperAdminLoadingScreen label={label} />;
  }

  if (scope === "portal") {
    return <PortalLoadingScreen label={label} />;
  }

  return <RootLoadingScreen label={label} />;
}
