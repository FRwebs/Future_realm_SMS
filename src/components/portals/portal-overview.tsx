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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">{title}</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{snapshot.headline}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/70">{description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {snapshot.stats.map((stat) => (
            <div key={stat.label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{stat.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">What needs attention</h2>
          <div className="mt-5 grid gap-4">
            {snapshot.cards.map((card) => (
              <div key={card.title} className={`rounded-[1.5rem] p-5 ${card.accent}`}>
                <p className="font-semibold">{card.title}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Recent activity</h2>
          <div className="mt-5 grid gap-4">
            {snapshot.timeline.map((event) => (
              <div key={event.id} className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-ink">{event.title}</p>
                  <span className="text-xs uppercase tracking-[0.24em] text-ink/35">{event.time}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/70">{event.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
