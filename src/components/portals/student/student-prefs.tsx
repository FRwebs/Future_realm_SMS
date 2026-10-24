"use client";

import { useState } from "react";

import { readCookie } from "@/lib/modules/submit";

export type PrefsProps = {
  base: string; categories: Array<{ key: string; label: string; sub: string }>; channels: Array<{ key: string; label: string; sub: string; locked?: boolean }>;
  matrix: Record<string, boolean>; defaults: Record<string, boolean>; quiet: string; remind: string; quietOptions: string[]; remindOptions: string[]; foot: string;
};

const SWITCH = "relative h-[20px] w-[34px] flex-none rounded-full transition-colors duration-150";

/** Which of five kinds of news reach the student, and where; saved the moment it changes. */
export function StudentPrefs({ base, categories, channels, matrix, defaults, quiet, remind, quietOptions, remindOptions, foot }: PrefsProps) {
  const [values, setValues] = useState(matrix);
  const [hours, setHours] = useState(quiet);
  const [reminder, setReminder] = useState(remind);
  const [error, setError] = useState<string | null>(null);
  const cols = `minmax(0,1.7fr) repeat(${channels.length}, minmax(0,0.62fr))`;
  const isOn = (category: string, channel: string, locked?: boolean) => locked || (values[`${category}:${channel}`] ?? defaults[`${category}:${channel}`] ?? false);

  async function save(body: Record<string, unknown>) {
    setError(null);
    const response = await fetch(`${base}/prefs`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("fr_csrf") ?? "" }, body: JSON.stringify(body) });
    if (!response.ok) setError("That could not be saved. Try again.");
  }
  const toggle = (category: string, channel: string, next: boolean) => { setValues((current) => ({ ...current, [`${category}:${channel}`]: next })); void save({ matrix: { [`${category}:${channel}`]: next } }); };
  const chips = (current: string, options: string[], set: (value: string) => void, field: "quiet" | "remind") => (
    <div className="flex flex-wrap gap-[6px]">
      {options.map((option) => (
        <button key={option} type="button" onClick={() => { set(option); void save({ [field]: option }); }} className="rounded-full border px-[12px] py-[5px] text-[11px] font-semibold" style={current === option ? { background: "#0D2315", color: "#fff", borderColor: "#0D2315" } : { background: "#fff", color: "#435048", borderColor: "#CFDDD5" }}>{option}</button>
      ))}
    </div>
  );

  return (
    <div className="grid min-w-0 gap-[14px]">
      <section className="min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] pb-[14px] pt-[14px]" style={{ borderColor: "#DEE8E2" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>What reaches you, and where</h3>
        <p className="mt-[3.5px] text-[10.5px]" style={{ color: "#67766D" }}>In-app notifications cannot be turned off — they are your record.</p>
        <div className="mt-[12px] overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid items-end gap-[10px] border-b pb-[9px]" style={{ gridTemplateColumns: cols, borderColor: "#EDF3EF" }}>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "#67766D" }}>Notify me about</span>
              {channels.map((channel) => (
                <span key={channel.key} className="text-center text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "#435048" }}>{channel.label}<span className="block text-[9px] font-medium normal-case tracking-normal" style={{ color: "#8C9A92" }}>{channel.sub}</span></span>
              ))}
            </div>
            {categories.map((category) => (
              <div key={category.key} className="grid items-center gap-[10px] border-b py-[11px]" style={{ gridTemplateColumns: cols, borderColor: "#EDF3EF" }}>
                <span className="min-w-0"><span className="block text-[12px] font-semibold" style={{ color: "#0D2315" }}>{category.label}</span><span className="block text-[10.5px]" style={{ color: "#67766D" }}>{category.sub}</span></span>
                {channels.map((channel) => {
                  const on = isOn(category.key, channel.key, channel.locked);
                  return (
                    <span key={channel.key} className="flex justify-center">
                      <button type="button" role="switch" aria-checked={on} aria-label={`${category.label} by ${channel.label}`} disabled={channel.locked} onClick={() => toggle(category.key, channel.key, !on)} className={SWITCH} style={{ background: on ? "#12796A" : "#CFDDD5", opacity: channel.locked ? 0.55 : 1, cursor: channel.locked ? "not-allowed" : "pointer" }}>
                        <span className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-[left] duration-150" style={{ left: on ? 16 : 2, boxShadow: "0 1px 3px rgba(13,35,21,0.3)" }} />
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-[10px] text-[10.5px]" style={{ color: "#67766D" }}>{foot}</p>
        {error ? <p className="mt-[6px] text-[11px]" style={{ color: "#B23B3B" }}>{error}</p> : null}
      </section>
      <section className="min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] py-[14px]" style={{ borderColor: "#DEE8E2" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>Timing</h3>
        <div className="mt-[10px] grid gap-[14px] sm:grid-cols-2">
          <div><p className="text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>Quiet hours</p><p className="mb-[8px] mt-[2px] text-[10.5px]" style={{ color: "#67766D" }}>No email in these hours, except safety notices.</p>{chips(hours, quietOptions, setHours, "quiet")}</div>
          <div><p className="text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>Remind me about work that is due</p><p className="mb-[8px] mt-[2px] text-[10.5px]" style={{ color: "#67766D" }}>One reminder, at 16:00.</p>{chips(reminder, remindOptions, setReminder, "remind")}</div>
        </div>
      </section>
    </div>
  );
}
