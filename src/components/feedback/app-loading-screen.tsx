"use client";

type AppLoadingScreenProps = {
  scope?: "root" | "dashboard" | "super-admin" | "portal";
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

function DashboardLoadingScreen({ label }: { label: string }) {
  return (
    <div className="finance-shell flex h-screen overflow-hidden">
      <aside className="hidden w-[280px] shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-5 md:flex md:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <SkeletonBlock className="h-11 w-11 rounded-2xl" />
          <div className="grid flex-1 gap-2">
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <SkeletonBlock className="h-3 w-32 rounded-full" />
          </div>
        </div>

        <div className="grid gap-6">
          {Array.from({ length: 4 }).map((_, groupIndex) => (
            <div key={groupIndex} className="grid gap-3">
              <SkeletonBlock className="h-3 w-20 rounded-full" />
              {Array.from({ length: 3 }).map((__, itemIndex) => (
                <SkeletonBlock key={itemIndex} className="h-11 w-full rounded-[1rem]" />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-[var(--color-border-default)] bg-[var(--surface-topbar)] px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-2xl md:hidden" />
              <div className="grid gap-2">
                <SkeletonBlock className="h-3 w-24 rounded-full" />
                <SkeletonBlock className="h-4 w-40 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <SkeletonBlock className="h-10 w-36 rounded-full" />
            </div>
          </div>
        </header>

        <main className="finance-scroll min-w-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 md:px-6 md:pb-8 md:pt-5">
          <div className="mx-auto grid w-full max-w-[1600px] gap-6">
            <section className="surface-hero px-6 py-6 md:px-8">
              <div className="grid gap-4">
                <span className="section-eyebrow">{label}</span>
                <SkeletonBlock className="h-10 w-full max-w-[24rem]" />
                <SkeletonBlock className="h-4 w-full max-w-[38rem]" />
                <div className="flex flex-wrap gap-3 pt-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-9 w-28 rounded-full" />
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="surface-card p-5">
                  <SkeletonBlock className="mb-4 h-3 w-24 rounded-full" />
                  <SkeletonBlock className="h-8 w-20" />
                  <SkeletonBlock className="mt-5 h-3 w-28 rounded-full" />
                </div>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
              <div className="surface-card p-5">
                <SkeletonBlock className="mb-5 h-5 w-48" />
                <div className="grid gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-14 w-full rounded-[1rem]" />
                  ))}
                </div>
              </div>

              <div className="surface-card p-5">
                <SkeletonBlock className="mb-5 h-5 w-40" />
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-20 w-full rounded-[1rem]" />
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
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
  if (scope === "dashboard") {
    return <DashboardLoadingScreen label={label} />;
  }

  if (scope === "super-admin") {
    return <SuperAdminLoadingScreen label={label} />;
  }

  if (scope === "portal") {
    return <PortalLoadingScreen label={label} />;
  }

  return <RootLoadingScreen label={label} />;
}
