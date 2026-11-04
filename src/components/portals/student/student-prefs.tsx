"use client";

import { useState } from "react";

import { readCookie } from "@/lib/modules/submit";

export type PrefsProps = {
  base: string; categories: Array<{ key: string; label: string; sub: string }>; channels: Array<{ key: string; label: string; sub: string; locked?: boolean; unavailable?: boolean }>;
  matrix: Record<string, boolean>; defaults: Record<string, boolean>; quiet: string; remind: string; quietOptions: string[]; remindOptions: string[]; foot: string;
  /** What the account keeps for each label in `quietOptions`, when the two are not the same words. */
  quietCodes?: Record<string, string>;
  /** The same for the second row of choices (`remindOptions`). */
  remindCodes?: Record<string, string>;
  /** Words that differ between a student's page and a parent's; the student's are the defaults. */
  copy?: { lead?: string; sub?: string; first?: string; quietTitle?: string; quietSub?: string; remindTitle?: string; remindSub?: string; timing?: string; remindField?: string };
};

const SWITCH = "relative h-[20px] w-[34px] flex-none rounded-full transition-colors duration-150";

/** Which of five kinds of news reach the student, and where; saved the moment it changes. */
export function StudentPrefs({ base, categories, channels, matrix, defaults, quiet, remind, quietOptions, remindOptions, foot, copy, quietCodes, remindCodes }: PrefsProps) {
  const [values, setValues] = useState(matrix);
  const [hours, setHours] = useState(quiet);
  const [reminder, setReminder] = useState(remind);
  const [error, setError] = useState<string | null>(null);
  const cols = `minmax(0,1.7fr) repeat(${channels.length}, minmax(0,0.62fr))`;
  // `locked` is a channel that is always on — the in-app record. `unavailable`
  // is a channel the school cannot send on yet: it is drawn, off and fixed, so
  // the column is honest about itself rather than quietly missing.
  const isOn = (category: string, channel: string, locked?: boolean, unavailable?: boolean) =>
    unavailable ? false : locked || (values[`${category}:${channel}`] ?? defaults[`${category}:${channel}`] ?? false);

  async function save(body: Record<string, unknown>) {
    setError(null);
    const response = await fetch(`${base}/prefs`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("fr_csrf") ?? "" }, body: JSON.stringify(body) });
    if (!response.ok) setError("That could not be saved. Try again.");
  }
  const toggle = (category: string, channel: string, next: boolean) => { setValues((current) => ({ ...current, [`${category}:${channel}`]: next })); void save({ matrix: { [`${category}:${channel}`]: next } }); };
  const chips = (current: string, options: string[], set: (value: string) => void, field: string, codes?: Record<string, string>) => (
    <div className="flex flex-wrap gap-[6px]">
      {options.map((option) => (
        <button key={option} type="button" onClick={() => { set(option); void save({ [field]: codes?.[option] ?? option }); }} className="rounded-full border px-[12px] py-[5px] text-[11px] font-semibold" style={current === option ? { background: "#0D2315", color: "#fff", borderColor: "#0D2315" } : { background: "#fff", color: "#435048", borderColor: "#CFDDD5" }}>{option}</button>
      ))}
    </div>
  );

  return (
    <div className="grid min-w-0 gap-[14px]">
      <section className="min-w-0 rounded-[14px] border bg-(--color-bg-surface) px-[18px] pb-[14px] pt-[14px] max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:pt-0" style={{ borderColor: "#DEE8E2" }}>
        <h2 className="text-[12.5px] font-semibold max-md:text-[17px] max-md:font-extrabold" style={{ color: "#0D2315" }}>{copy?.lead ?? "What reaches you, and where"}</h2>
        <p className="mt-[3.5px] text-[10.5px] max-md:text-[13.5px] max-md:leading-[1.5]" style={{ color: "#5E6D64" }}>{copy?.sub ?? "In-app notifications cannot be turned off — they are your record."}</p>
        {/* A phone reads this a kind at a time. The matrix below is four
            columns wide at its narrowest, so on a 375px screen it either
            scrolls sideways — hiding whole channels behind an edge — or
            squeezes the switches into a column too narrow to hit. The mockup
            splits it into a card per kind, with the channel named beside each
            switch; the matrix is kept for the width that can hold it. */}
        <div className="mt-[12px] grid gap-[10px] md:hidden">
          {categories.map((category) => (
            <div key={category.key} className="rounded-[18px] bg-white px-[16px] py-[14px] shadow-[0_1px_2px_rgba(13,35,21,0.05),0_8px_22px_-16px_rgba(13,35,21,0.22)]">
              <p className="text-[15px] font-extrabold" style={{ color: "#0D2315" }}>{category.label}</p>
              <p className="mt-[2px] text-[12.5px] leading-[1.45]" style={{ color: "#5E6D64" }}>{category.sub}</p>
              <div className="mt-[8px] grid gap-[2px]">
                {channels.map((channel) => {
                  const on = isOn(category.key, channel.key, channel.locked, channel.unavailable);
                  const fixed = Boolean(channel.locked || channel.unavailable);
                  return (
                    <div key={channel.key} className="flex min-h-[48px] items-center justify-between gap-[10px]">
                      <span className="min-w-0 text-[14px]" style={{ color: fixed ? "#5E6D64" : "#0D2315" }}>
                        <span className="font-semibold">{channel.label}</span>
                        <span className="ml-[5px] text-[12.5px]" style={{ color: "#5E6D64" }}>· {channel.sub}</span>
                      </span>
                      <button type="button" role="switch" aria-checked={on} aria-label={`${category.label} by ${channel.label}`} disabled={fixed} onClick={() => toggle(category.key, channel.key, !on)} className={SWITCH} style={{ background: on ? "#12796A" : "#CFDDD5", opacity: fixed ? 0.55 : 1, cursor: fixed ? "not-allowed" : "pointer" }}>
                        <span className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-[left] duration-150" style={{ left: on ? 16 : 2, boxShadow: "0 1px 3px rgba(13,35,21,0.3)" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-[12px] hidden overflow-x-auto md:block">
          <div className="min-w-[420px]">
            <div className="grid items-end gap-[10px] border-b pb-[9px]" style={{ gridTemplateColumns: cols, borderColor: "#EDF3EF" }}>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "#5E6D64" }}>{copy?.first ?? "Notify me about"}</span>
              {channels.map((channel) => (
                <span key={channel.key} className="text-center text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "#435048" }}>{channel.label}<span className="block text-[9px] font-medium normal-case tracking-normal" style={{ color: "#5f6e65" }}>{channel.sub}</span></span>
              ))}
            </div>
            {categories.map((category) => (
              <div key={category.key} className="grid items-center gap-[10px] border-b py-[11px]" style={{ gridTemplateColumns: cols, borderColor: "#EDF3EF" }}>
                <span className="min-w-0"><span className="block text-[12px] font-semibold" style={{ color: "#0D2315" }}>{category.label}</span><span className="block text-[10.5px]" style={{ color: "#5E6D64" }}>{category.sub}</span></span>
                {channels.map((channel) => {
                  const on = isOn(category.key, channel.key, channel.locked, channel.unavailable);
                  const fixed = Boolean(channel.locked || channel.unavailable);
                  return (
                    <span key={channel.key} className="flex justify-center">
                      <button type="button" role="switch" aria-checked={on} aria-label={`${category.label} by ${channel.label}`} disabled={fixed} title={channel.locked ? "Always on" : channel.unavailable ? `${channel.label} is not available yet` : on ? "Turn off" : "Turn on"} onClick={() => toggle(category.key, channel.key, !on)} className={SWITCH} style={{ background: on ? "#12796A" : "#CFDDD5", opacity: fixed ? 0.55 : 1, cursor: fixed ? "not-allowed" : "pointer" }}>
                        <span className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-[left] duration-150" style={{ left: on ? 16 : 2, boxShadow: "0 1px 3px rgba(13,35,21,0.3)" }} />
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-[10px] text-[10.5px]" style={{ color: "#5E6D64" }}>{foot}</p>
        {error ? <p className="mt-[6px] text-[11px]" style={{ color: "#B23B3B" }}>{error}</p> : null}
      </section>
      <section className="min-w-0 rounded-[14px] border bg-(--color-bg-surface) px-[18px] py-[14px]" style={{ borderColor: "#DEE8E2" }}>
        <h2 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{copy?.timing ?? "Timing"}</h2>
        <div className="mt-[10px] grid gap-[14px] sm:grid-cols-2">
          <div><p className="text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>{copy?.quietTitle ?? "Quiet hours"}</p><p className="mb-[8px] mt-[2px] text-[10.5px]" style={{ color: "#5E6D64" }}>{copy?.quietSub ?? "No email in these hours, except safety notices."}</p>{chips(hours, quietOptions, setHours, "quiet", quietCodes)}</div>
          <div><p className="text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>{copy?.remindTitle ?? "Remind me about work that is due"}</p><p className="mb-[8px] mt-[2px] text-[10.5px]" style={{ color: "#5E6D64" }}>{copy?.remindSub ?? "One reminder, at 16:00."}</p>{chips(reminder, remindOptions, setReminder, copy?.remindField ?? "remind", remindCodes)}</div>
        </div>
      </section>
    </div>
  );
}
