const solid: Record<string, string> = { good: "#22A06B", warn: "#D9A22C", bad: "#DB5555", teal: "#12796A", mute: "#9FB8A7", info: "#2B5F8F", ink: "#0D2315", mid: "#4FA898", soft: "#A9D6C9" };

export type BarItem = { label: string; value: string; pct: number; tone: "good" | "warn" | "bad" | "teal" | "mute" | "ink" | "mid" | "soft"; note?: string };

/** The mockup's bar panel: one labelled bar per row, with an optional note underneath. A bar past 100% is drawn full and says so in its note. */
export function BarList({ title, sub, items, empty, footer }: { title: string; sub?: string; items: BarItem[]; empty?: string; footer?: React.ReactNode }) {
  return (
    <section className="surface-card min-w-0 overflow-hidden">
      <div className="px-5 pb-[14px] pt-4">
        <h3 className="text-pretty text-[14px] font-semibold leading-[1.3] text-(--color-text-primary)">{title}</h3>
        {sub ? <p className="mt-1 text-pretty text-[11.5px] leading-normal text-[#5f6e65]">{sub}</p> : null}
      </div>
      <div className="px-5 pb-[18px] pt-1">
        {items.map((item) => (
          <div key={item.label} className="mt-[14px]">
            <div className="mb-[6px] flex items-center justify-between gap-3">
              <span className="min-w-0 text-[12.5px] text-[#435048]">{item.label}</span>
              <span className="flex-none font-(--font-heading) text-[13px] font-bold">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EDF3EF]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, item.pct))}%`, background: solid[item.tone] }} />
            </div>
            {item.note ? <p className="mt-[5px] text-[11px] text-[#9FB8A7]">{item.note}</p> : null}
          </div>
        ))}
        {items.length === 0 ? <p className="mt-[14px] text-[12.5px] text-[#5f6e65]">{empty ?? "Nothing to show yet."}</p> : null}
      </div>
      {footer ? <div className="border-t border-[#F2F7F4] px-5 pb-[18px] pt-[14px]">{footer}</div> : null}
    </section>
  );
}
