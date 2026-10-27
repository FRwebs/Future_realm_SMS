const node: Record<string, { bg: string; fg: string; bd: string }> = {
  ink: { bg: "#0D2315", fg: "#fff", bd: "#0D2315" },
  bad: { bg: "#FDF3F3", fg: "#B23B3B", bd: "#F3E0E0" },
  warn: { bg: "#FDF6E7", fg: "#8A6410", bd: "#F2E4C6" },
  good: { bg: "#EAF6F0", fg: "#17714F", bd: "#CFE4DB" },
  plain: { bg: "#fff", fg: "#0D2315", bd: "#DEE8E2" }
};

export type FlowStep = { label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" };

/** The mockup's process panel: a title and a line of context, then connected steps. */
export function FlowSteps({ title, sub, steps }: { title: string; sub?: string; steps: FlowStep[] }) {
  return (
    <section className="surface-card min-w-0 overflow-hidden">
      <div className="px-5 pb-[14px] pt-4">
        <h3 className="text-pretty text-[14px] font-semibold leading-[1.3] text-(--color-text-primary)">{title}</h3>
        {sub ? <p className="mt-1 text-pretty text-[11.5px] leading-normal text-[#5f6e65]">{sub}</p> : null}
      </div>
      <div className="flex flex-wrap items-stretch gap-[9px] px-5 pb-5 pt-1">
        {steps.map((step, index) => {
          const tone = node[step.tone ?? "plain"];
          return (
            <div key={`${step.label}-${index}`} className="flex items-center gap-[9px]">
              <div className="min-w-[126px] max-w-[190px] rounded-[11px] border px-[14px] py-[11px]" style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
                <p className="text-[12.5px] font-semibold leading-[1.3]">{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-[1.4]">{step.note}</p>
              </div>
              {index < steps.length - 1 ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B4C4BB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12h14M13 7l5 5-5 5" /></svg>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
