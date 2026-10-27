const dot: Record<string, string> = { good: "#22A06B", teal: "#12796A", warn: "#D9A22C", bad: "#DB5555", mute: "#9FB8A7", info: "#2B5F8F", ink: "#0D2315" };
const pillTone: Record<string, { bg: string; fg: string }> = {
  good: { bg: "#EAF6F0", fg: "#17714F" },
  teal: { bg: "#E4F1EC", fg: "#17604F" },
  warn: { bg: "#FDF6E7", fg: "#8A6410" },
  bad: { bg: "#FDF3F3", fg: "#B23B3B" },
  mute: { bg: "#F1F4F2", fg: "#5C6A62" },
  info: { bg: "#E7F1FB", fg: "#2B5F8F" }
};

export type ReferenceItem = { label: string; detail?: string; pill?: string; value?: string; action?: React.ReactNode; tone?: "good" | "teal" | "warn" | "bad" | "mute" | "info" };

/** The mockup's list panel: a title and a line of context, then rows of a coloured dot, a label, what it means, and an optional pill. */
export function ReferenceList({ title, sub, items, emptyText }: { title: string; sub?: string; items: ReferenceItem[]; emptyText?: string }) {
  return (
    <section className="surface-card min-w-0 overflow-hidden">
      <div className="px-5 pb-[14px] pt-4">
        <h3 className="text-pretty text-[14px] font-semibold leading-[1.3] text-[var(--color-text-primary)]">{title}</h3>
        {sub ? <p className="mt-1 text-pretty text-[11.5px] leading-[1.5] text-[#5f6e65]">{sub}</p> : null}
      </div>
      <div className="px-5 pb-[14px] pt-[2px]">
        {items.length === 0 ? <p className="py-[11px] text-[12.5px] text-[#5f6e65]">{emptyText ?? "Nothing to show yet."}</p> : null}
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-[11px] border-b border-[#F2F7F4] py-[11px]">
            <span className="mt-[5px] h-2 w-2 flex-none rounded-[3px]" style={{ background: dot[item.tone ?? "teal"] }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-[1.4] text-[var(--color-text-primary)]">{item.label}</p>
              {item.detail ? <p className="mt-[3px] text-pretty text-[11.5px] leading-[1.5] text-[#5f6e65]">{item.detail}</p> : null}
            </div>
            {item.pill ? (
              <span className="inline-block flex-none rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: (pillTone[item.tone ?? "mute"]).bg, color: (pillTone[item.tone ?? "mute"]).fg }}>{item.pill}</span>
            ) : null}
            {item.action ? <div className="flex-none">{item.action}</div> : null}
            {item.value ? <p className="flex-none text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.value}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
