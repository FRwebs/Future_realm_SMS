import { moduleLabel } from "./_shared";

interface StateAdoptionTableProps {
  heatmapByState: Array<{ state: string; schoolCount: number; cells: number[] }>;
  stateHeatmapModules: string[];
}

function heatCellDenseStyle(pct: number | null) {
  if (pct === null) return { background: "#F2F7F4", color: "#C2D2C8" };
  if (pct < 45) {
    const alpha = (0.07 + (pct / 45) * 0.33).toFixed(3);
    return { background: `rgba(18,121,106,${alpha})`, color: "#0d2315" };
  }
  const t = (pct - 45) / 55;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return { background: `rgb(${lerp(18, 6)},${lerp(121, 56)},${lerp(106, 47)})`, color: "#fff" };
}

function DenseHeatCell({ value }: { value: number | null }) {
  const style = heatCellDenseStyle(value);
  return (
    <span
      className="inline-flex min-w-11 items-center justify-center rounded-[7px] px-0.5 py-[6px] font-[var(--font-heading)] text-[10.5px] font-semibold"
      style={{ background: style.background, color: style.color, border: value === null ? "1px solid #E9F0EC" : "1px solid transparent" }}
    >
      {value === null ? "—" : `${value}%`}
    </span>
  );
}

export function StateAdoptionTable({ heatmapByState, stateHeatmapModules }: StateAdoptionTableProps) {
  const cols = `1.6fr repeat(${stateHeatmapModules.length},1fr)`;

  const platformAverages = stateHeatmapModules.map((_, moduleIndex) => {
    const values = heatmapByState.map((row) => row.cells[moduleIndex]).filter((v): v is number => v !== null && v !== undefined);
    if (values.length === 0) return null;
    return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
  });

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-default)] px-5 py-4">
        <div>
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Adoption by state — where the product is actually landing</p>
          <p className="mt-1 max-w-2xl text-[11.5px] text-[var(--color-text-muted)]">Same metric grouped by region, to separate a product problem from a connectivity or training problem.</p>
        </div>
        <p className="whitespace-nowrap text-[11.5px] text-[#8C9A92]">Rolling 4-week average</p>
      </div>

      <div className="px-5 py-3.5">
        <div className="grid items-end gap-1.5 border-b border-[#EDF3EF] pb-2.5" style={{ gridTemplateColumns: cols }}>
          <div className="min-w-0 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8C9A92]">State / region</div>
          {stateHeatmapModules.map((module) => (
            <div key={module} className="min-w-0 text-center text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[#8C9A92]">
              {moduleLabel(module)}
            </div>
          ))}
        </div>

        {heatmapByState.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No school location data yet.</p>
        ) : (
          heatmapByState.map((row) => (
            <div key={row.state} className="grid items-center gap-1.5 py-[3px]" style={{ gridTemplateColumns: cols }}>
              <div className="min-w-0">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[#0D2315]">{row.state}</div>
                <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] text-[#9FB8A7]">
                  {row.schoolCount} school{row.schoolCount === 1 ? "" : "s"}
                </div>
              </div>
              {stateHeatmapModules.map((module, index) => (
                <div key={module} className="flex justify-center">
                  <DenseHeatCell value={row.cells[index] ?? null} />
                </div>
              ))}
            </div>
          ))
        )}

        {heatmapByState.length > 0 ? (
          <div className="mt-2.5 grid items-center gap-1.5 border-t border-[#EDF3EF] pt-2.5" style={{ gridTemplateColumns: cols }}>
            <div className="text-[11px] font-semibold text-[#77857C]">Platform average</div>
            {platformAverages.map((value, index) => (
              <div key={stateHeatmapModules[index]} className="text-center font-[var(--font-mono)] text-[11.5px] font-bold text-[#0D2315]">
                {value === null ? "—" : `${value}%`}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
