"use client";

type AppLoadingScreenProps = {
  scope?: "root" | "dashboard";
  label?: string;
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`app-skeleton rounded-[1.25rem] ${className}`} />;
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

export function AppLoadingScreen({
  scope = "root",
  label = "Loading workspace",
}: AppLoadingScreenProps) {
  if (scope === "dashboard") {
    return <DashboardLoadingScreen label={label} />;
  }

  return <RootLoadingScreen label={label} />;
}
