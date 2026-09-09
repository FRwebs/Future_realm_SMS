export function heatCellStyle(pct: number) {
  if (pct < 45) {
    const alpha = (0.07 + (pct / 45) * 0.33).toFixed(3);
    return { background: `rgba(18,121,106,${alpha})`, color: "#0d2315" };
  }
  const t = (pct - 45) / 55;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return { background: `rgb(${lerp(18, 6)},${lerp(121, 56)},${lerp(106, 47)})`, color: "#fff" };
}

export function HeatCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="inline-flex min-w-14 items-center justify-center rounded-[7px] border border-[#E9F0EC] bg-[#F2F7F4] px-1 py-[9px] font-[var(--font-heading)] text-[11.5px] font-semibold text-[#C2D2C8]">—</span>;
  }
  const style = heatCellStyle(value);
  return (
    <span className="inline-flex min-w-14 items-center justify-center rounded-[7px] px-1 py-[9px] font-[var(--font-heading)] text-[11.5px] font-semibold" style={{ background: style.background, color: style.color }}>
      {value}%
    </span>
  );
}

export function moduleLabel(module: string) {
  return module.charAt(0).toUpperCase() + module.slice(1);
}
