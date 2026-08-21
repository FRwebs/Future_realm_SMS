import { PortalSnapshot } from "@/lib/domain/types";

export function PortalOverview({
  title,
  description,
  snapshot
}: {
  title: string;
  description: string;
  snapshot: PortalSnapshot;
}) {
  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{title}</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{snapshot.headline}</h1>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {snapshot.stats.map((stat) => (
            <div key={stat.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{stat.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card p-6">
          <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">What needs attention</h2>
          <div className="mt-5 grid gap-4">
            {snapshot.cards.map((card) => (
              <div key={card.title} className={`rounded-[10px] p-5 ${card.accent}`}>
                <p className="font-semibold">{card.title}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="surface-card p-6">
          <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">Recent activity</h2>
          <div className="mt-5 grid gap-4">
            {snapshot.timeline.map((event) => (
              <div key={event.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-[var(--color-text-primary)]">{event.title}</p>
                  <span className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">{event.time}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{event.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
