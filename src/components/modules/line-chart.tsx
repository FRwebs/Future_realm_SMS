"use client";

import Link from "next/link";
import type { Route } from "next";

import { toneOf } from "@/lib/modules/tones";
import type { PanelTone } from "@/lib/modules/panels";

/**
 * The one line chart in this product.
 *
 * It came from the student portal's attendance mockup, and it is the shape
 * every measure-over-time should take: a line with an area under it, a circle
 * at each point, and — where the thing being measured has a target — a dashed
 * rule across the plot at that target.
 *
 * The scale is the part that matters. A measure that lives between about 85%
 * and 100%, as attendance and term averages do, is destroyed by a 0–100 axis:
 * every point lands in the top sixth of the panel and a good term looks exactly
 * like a poor one. So the floor drops to the round step below the lowest point
 * instead, and only falls to zero when something is genuinely near it.
 *
 * It is deliberately not used for comparing categories. A line between "grade
 * A" and "grade B" draws a slope through a gap where no value exists; those
 * stay as bars.
 */

export type LinePoint = {
  /** What goes under the point on the x-axis. */
  label: string;
  /** The value, or null where there is nothing on record — the line breaks there. */
  v: number | null;
  /** Shown above the point instead of the figure, for a point whose value is a state rather than a number. */
  vLabel?: string;
  tone?: PanelTone;
  /** The hover title: the full date, the period, whatever names the point. */
  tip?: string;
  /** Marks the point as the one being read — this week, this term. */
  on?: boolean;
};

/** A legend entry under the plot. */
export type LineKey = { label: string; tone: PanelTone };

export type LineChartProps = {
  points: LinePoint[];
  /** The top of the scale. 100 for a percentage; for anything else, the figure the measure is out of. */
  ceiling?: number;
  /** A line the measure is meant to stay above, drawn dashed behind the plot. */
  target?: { value: number; label: string } | null;
  /** The key under the plot. Left out, nothing is drawn — a chart whose colours mean nothing does not need one. */
  keys?: LineKey[];
  /** How a value reads: "94.2%", "73.6". */
  format?: (value: number) => string;
  /** What a point does when clicked, by index — for a chart inside a client view that holds its own state. */
  onPoint?: (index: number) => (() => void) | undefined;
  /** Where a point goes, by index — for a chart built on the server, where a trigger is data. */
  hrefFor?: (index: number) => string | undefined;
  /** The tone for a value when the point does not carry its own. */
  toneFor?: (value: number) => PanelTone;
};

/**
 * Where the scale starts.
 *
 * A round step below the lowest point, so the range the values actually
 * occupy fills the plot. It drops to zero when a point is near it — a measure
 * that genuinely reaches the floor should be drawn reaching the floor — and
 * never climbs past 85% of the ceiling, so a target rule always stays visible.
 */
export function chartFloor(values: number[], ceiling = 100): number {
  const lowest = values.length ? Math.min(...values) : ceiling * 0.9;
  if (lowest < ceiling * 0.5) return 0;
  const step = ceiling / 20;
  return Math.max(0, Math.min(ceiling * 0.85, Math.floor((lowest - ceiling * 0.04) / step) * step));
}

/** A value as a percentage down the plot, with room above for a figure and below for the axis. */
export function chartY(value: number, floor: number, ceiling = 100): number {
  return 8 + ((ceiling - value) / (ceiling - floor)) * 84;
}

/** A point's place across the plot. One point sits in the middle rather than against the axis. */
export function chartX(index: number, count: number): number {
  return count === 1 ? 50 : 3 + (index / (count - 1)) * 94;
}

/** The three figures down the side: the top, the floor, and the midpoint between them. */
export function chartTicks(floor: number, ceiling = 100): number[] {
  return floor === 0 ? [ceiling, ceiling / 2, 0] : [ceiling, Math.round((ceiling + floor) / 2), floor];
}

const defaultTone = (): PanelTone => "progress";

export function LineChart({ points, ceiling = 100, target = null, keys, format, onPoint, hrefFor, toneFor = defaultTone }: LineChartProps) {
  const values = points.map((point) => point.v).filter((value): value is number => value !== null);
  const n = points.length;
  const lowest = values.length ? Math.min(...values) : ceiling;
  const highest = values.length ? Math.max(...values) : ceiling;
  const floor = chartFloor(values, ceiling);
  const y = (value: number) => chartY(value, floor, ceiling);
  const x = (index: number) => chartX(index, n);
  const ticks = chartTicks(floor, ceiling);
  const show = format ?? ((value: number) => `${Math.round(value * 10) / 10}%`);
  const toneOfPoint = (point: LinePoint) => point.tone ?? (point.v === null ? "neutral" : toneFor(point.v));

  // One path per unbroken run of points, so a gap is not drawn across.
  let line = "";
  let area = "";
  let run: Array<[number, number]> = [];
  const flush = () => {
    if (run.length) {
      line += `${run.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ")} `;
      area += `M${run[0]![0].toFixed(2)} 100 ${run.map((p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ")} L${run[run.length - 1]![0].toFixed(2)} 100 Z `;
    }
    run = [];
  };
  points.forEach((point, index) => { if (point.v === null) flush(); else run.push([x(index), y(point.v)]); });
  flush();

  // With many points only the lowest, the highest and the latest carry a
  // figure, so the line stays readable.
  const showAll = values.length <= 9;
  const lastWithValue = points.map((point) => point.v !== null).lastIndexOf(true);
  const step = Math.max(1, Math.ceil(n / 15));
  const highestAt = points.findIndex((point) => point.v === highest);
  const lowestAt = points.findIndex((point) => point.v === lowest);
  const showTarget = target !== null && floor < target.value && target.value <= ceiling;

  return (
    <>
      <div className="mt-[12px] flex gap-[8px]">
        <div className="relative h-[188px] w-[34px] flex-none">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2 text-[9.5px] tabular-nums" style={{ top: `${y(tick)}%`, color: "#8A9A92" }}>
              {show(tick)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-[188px] border-b" style={{ borderColor: "#DEE8E2" }}>
            {ticks.map((tick) => (
              <span key={tick} className="absolute left-0 right-0 border-t" style={{ top: `${y(tick)}%`, borderColor: "#EEF3F0" }} />
            ))}
            {showTarget ? (
              <span className="absolute left-0 right-0 border-t-[1.5px] border-dashed" style={{ top: `${y(target.value)}%`, borderColor: "#E5C77A" }} />
            ) : null}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <path d={area.trim() || "M0 0"} fill="rgba(18,121,106,0.09)" stroke="none" />
              <path d={line.trim() || "M0 0"} fill="none" stroke="#12796A" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {points.map((point, index) => {
              if (point.v === null) return null;
              const go = onPoint?.(index);
              const href = hrefFor?.(index);
              const swatch = toneOf(toneOfPoint(point));
              const style = { left: `${x(index)}%`, top: `${y(point.v)}%`, borderColor: swatch.dot, boxShadow: point.on ? "0 0 0 4px rgba(18,121,106,0.2)" : undefined };
              const className = "absolute box-border h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] bg-white transition-transform duration-120 hover:scale-125";
              if (go) return <button key={`${point.label}-${index}`} type="button" title={point.tip} onClick={go} className={`${className} cursor-pointer`} style={style} />;
              if (href) return <Link key={`${point.label}-${index}`} href={href as Route} title={point.tip} className={`${className} cursor-pointer`} style={style} />;
              return <span key={`${point.label}-${index}`} title={point.tip} className={className} style={style} />;
            })}
            {points.map((point, index) => {
              if (point.v === null) return null;
              const carries = showAll || index === highestAt || (point.v === lowest && (lowest !== highest || index === lowestAt)) || index === lastWithValue;
              if (!carries) return null;
              return (
                <span
                  key={`v-${point.label}-${index}`}
                  className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[9.5px] font-bold"
                  style={{ left: `${x(index)}%`, top: `calc(${y(point.v)}% - 20px)`, color: toneOf(toneOfPoint(point)).fg }}
                >
                  {point.vLabel ?? show(point.v)}
                </span>
              );
            })}
          </div>
          <div className="relative h-[30px]">
            {points.map((point, index) => {
              if (!(index % step === 0 || index === n - 1)) return null;
              const go = onPoint?.(index);
              const href = hrefFor?.(index);
              const style = { left: `${x(index)}%`, top: 7, color: point.on ? "#0D2315" : point.v === null ? "#AAB8B0" : "#67766D", fontWeight: point.on ? 700 : 500 };
              const labelClass = "absolute -translate-x-1/2 whitespace-nowrap text-[9.5px]";
              if (go) return <button key={`x-${point.label}-${index}`} type="button" onClick={go} className={`${labelClass} cursor-pointer`} style={style}>{point.label}</button>;
              if (href) return <Link key={`x-${point.label}-${index}`} href={href as Route} className={`${labelClass} cursor-pointer`} style={style}>{point.label}</Link>;
              return <span key={`x-${point.label}-${index}`} className={labelClass} style={style}>{point.label}</span>;
            })}
          </div>
        </div>
      </div>
      {keys?.length || showTarget ? (
        <div className="mt-[4px] flex flex-wrap items-center gap-x-[16px] gap-y-[5px] text-[10.5px]" style={{ color: "#435048" }}>
          {keys?.map((entry) => (
            <span key={entry.label} className="flex items-center gap-[6px]">
              <span className="h-[8px] w-[8px] flex-none rounded-full" style={{ background: toneOf(entry.tone).dot }} />
              {entry.label}
            </span>
          ))}
          {showTarget ? (
            <span className="flex items-center gap-[6px]">
              <span className="h-0 w-[16px] flex-none border-t-[1.5px] border-dashed" style={{ borderColor: "#D9B45A" }} />
              {target.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
