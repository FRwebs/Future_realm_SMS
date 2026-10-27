import { cn } from "@/lib/utils/cn";

export type WeekProps = {
  title: string; sub: string; foot: string; today: number; now: { day: number; from: string } | null;
  days: string[];
  rows: Array<
    | { brk: true; label: string; time: string }
    | { brk: false; label: string; time: string; from: string; cells: Array<{ subject: string; who: string; lab: boolean } | null> }
  >;
};

/** The week as the school published it: a row for each period, a column for each day; today is lit, and the lesson running now is ringed. */
export function StudentWeek({ title, sub, foot, today, now, days, rows }: WeekProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] pb-[14px]" style={{ borderColor: "#DEE8E2" }}>
      <div className="-mx-[18px] border-b px-[18px] pb-[12px] pt-[14px]" style={{ borderColor: "#EDF3EF" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{title}</h3>
        <p className="mt-[3.5px] text-[10.5px] leading-[1.5]" style={{ color: "#67766D" }}>{sub}</p>
      </div>
      <div className="-mx-[18px] overflow-x-auto px-[18px] pt-[12px]">
        <div className="grid min-w-[640px] gap-[6px]" style={{ gridTemplateColumns: "84px repeat(5, minmax(0, 1fr))" }}>
          <span />
          {days.map((day, index) => (
            <span key={day} className="px-[4px] pb-[3px] text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: index + 1 === today ? "#0D2315" : "#67766D" }}>{day}</span>
          ))}
          {rows.map((entry) =>
            entry.brk ? (
              <div key={`${entry.label}-${entry.time}`} className="col-span-6 rounded-[8px] py-[5px] text-center text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ background: "#F5F8F6", color: "#5f6e65" }}>
                {entry.label} · {entry.time}
              </div>
            ) : (
              <div key={`${entry.label}-${entry.time}`} className="contents">
                <div className="pr-[4px] pt-[8px]">
                  <p className="text-[11px] font-semibold" style={{ color: "#0D2315" }}>{entry.label}</p>
                  <p className="text-[10px] tabular-nums" style={{ color: "#67766D" }}>{entry.time}</p>
                </div>
                {entry.cells.map((cell, index) => {
                  const day = index + 1;
                  const live = now !== null && now.day === day && now.from === entry.from;
                  return (
                    <div
                      key={day}
                      className={cn("min-w-0 rounded-[9px] px-[10px] py-[8px]")}
                      style={live ? { background: "#EBF1FA", border: "1.5px solid #2A5A96" } : day === today ? { background: "#F7FAF8", border: "1px solid #CFE4DB" } : { background: "#fff", border: "1px solid #E6EEE9" }}
                    >
                      {cell ? (
                        <>
                          <p className="truncate text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>{cell.subject}</p>
                          <p className="truncate text-[10px]" style={{ color: "#67766D" }}>{cell.who}{cell.lab ? " · Lab" : ""}</p>
                        </>
                      ) : (
                        <p className="text-[10.5px]" style={{ color: "#C2D2C8" }}>—</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>
      </div>
      <p className="-mx-[18px] -mb-[14px] mt-[12px] border-t px-[18px] py-[10px] text-[10.5px] leading-[1.5]" style={{ borderColor: "#EDF3EF", background: "#F7FAF8", color: "#67766D" }}>{foot}</p>
    </section>
  );
}
