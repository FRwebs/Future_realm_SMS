"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";

import { Field } from "@/components/modules/field";
import { PANEL_SHELL, PanelHeader, PanelView } from "@/components/modules/panel-renderer";
import type { DrawerSpec, Panel } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";

/**
 * One child in one subject, as the teacher mockup lays it out: how the total was reached beside the comment that prints on the report
 * card, then a few sentences to start from. The comment is the teacher's own; a suggestion is a starting point, never the comment.
 */
export type StudentWorkingProps = {
  components: Panel;
  endpoint: string;
  initial: string;
  first: string;
  subject: string;
  own: boolean;
  suggestions: Array<{ text: string; sub: string }>;
  /** Where "Save and next" goes; null on the last child. */
  nextHref: string | null;
  doneHref: string;
  openDrawer?: (spec: DrawerSpec) => void;
};

const act = (primary?: boolean) =>
  `inline-flex items-center whitespace-nowrap rounded-[8px] text-[10.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-[#0D2315] px-[11px] py-[6.5px] text-white hover:bg-[#1B3A28]" : "border border-[#DEE8E2] bg-white px-[10px] py-[5.5px] text-[#435048] hover:border-[#BFDCD1] hover:bg-[#F1F8F4]"}`;

export function StudentWorking(props: StudentWorkingProps) {
  const router = useRouter();
  const openDrawer = props.openDrawer ?? (() => undefined);
  const [text, setText] = useState(props.initial);
  const [saved, setSaved] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const written = saved.trim().length > 0;

  async function save(then?: "next") {
    setBusy(true);
    setMessage(null);
    try {
      await sendJson(props.endpoint, "PUT", { text });
      setSaved(text);
      if (then === "next") {
        router.push((props.nextHref ?? props.doneHref) as Route);
        return;
      }
      setMessage({ tone: "ok", text: text.trim() ? "Comment saved. It prints beside the subject line on the report card." : "Comment cleared." });
      router.refresh();
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "The comment could not be saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-[14px]">
      <div className="grid min-w-0 items-start gap-[14px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0"><PanelView panel={props.components} openDrawer={openDrawer} /></div>
        <section className={`${PANEL_SHELL} pb-[16px]`} style={{ borderColor: CARD_BORDER }}>
          <PanelHeader title="Your subject comment" tag={written ? "Written" : "Not written"} tagTone={written ? "positive" : "attention"} sub={`It prints on the report card beside the ${props.subject} line, under the form master’s remark.`} openDrawer={openDrawer} />
          <Field
            field={{ kind: "area", label: "Comment", placeholder: `One or two sentences about ${props.first} in ${props.subject}.`, hint: "About 25 words. Specific to this child — a suggestion below is a starting point, not the comment." }}
            value={text}
            setValue={(next) => { setText(String(next)); setMessage(null); }}
          />
          {props.own ? null : <p className="mt-[8px] text-[10.5px]" style={{ color: MUTED }}>You hold this on cover, so its comments are the subject teacher’s to write.</p>}
          <p className="mt-[9px] text-[10.5px]" style={{ color: message?.tone === "error" ? "#B23B3B" : MUTED }}>
            {message ? message.text : text !== saved ? "Not saved yet." : "Saved comments print on the report card."}
          </p>
          {props.own ? (
            <div className="mt-[12px] flex flex-wrap justify-end gap-[7px]">
              <button type="button" disabled={busy || text === saved} onClick={() => save()} className={act()}>{busy ? "Saving…" : "Save"}</button>
              <button type="button" disabled={busy} onClick={() => save("next")} className={act(true)}>{props.nextHref ? "Save and next" : "Save"}</button>
            </div>
          ) : null}
        </section>
      </div>

      {props.own ? (
        <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
          <PanelHeader title="Suggested from this result" sub={`Tap one to start from it, then make it about ${props.first}.`} openDrawer={openDrawer} />
          <ul>
            {props.suggestions.map((suggestion) => (
              <li key={suggestion.text} className="flex items-start gap-[10px] border-b py-[10px]" style={{ borderColor: "#F2F7F4" }}>
                <span className="mt-[4.5px] h-[7px] w-[7px] flex-none rounded-full" style={{ background: toneOf("neutral").dot }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-pretty text-[11.5px] font-semibold leading-[1.4]" style={{ color: INK }}>{suggestion.text}</span>
                  <span className="mt-[2.5px] block text-pretty text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>{suggestion.sub}</span>
                </span>
                <button type="button" onClick={() => { setText(suggestion.text); setMessage(null); }} className="flex flex-none items-center gap-[4px] whitespace-nowrap rounded-full border px-[9px] py-[3.5px] text-[10.5px] font-semibold transition hover:border-[#BFDCD1]" style={{ color: "#12796A", background: "#F2F7F4", borderColor: "#E1EBE5" }}>Use</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
