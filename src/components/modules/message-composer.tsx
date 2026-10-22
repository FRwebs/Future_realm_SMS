"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMemo, useRef, useState } from "react";

import { PANEL_SHELL, PanelHeader } from "@/components/modules/panel-renderer";
import { MERGE_FIELDS, joinNames, mergeBody, reachOf, smsSegments, unknownFields, type Channel } from "@/lib/messaging/merge";
import type { DrawerSpec, PanelTone } from "@/lib/modules/panels";
import { sendJsonForData } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";

/**
 * Writing to the families of a class. Everything a teacher needs to be sure before it goes is on this page, live: who it reaches, who it
 * cannot reach and why, what each family will actually read (their own name, their own child), and what it costs the school — a long SMS
 * is more than one credit. The server works all of it out again when the message is sent; this is only the same sum, shown early.
 */
export type ComposerFamily = { id: string; name: string; phone: string; email: string; children: string[]; arms: string[]; canSms: boolean; canEmail: boolean; portal: string; language: string };
export type ComposerDraft = { id: string; body: string; channel: string; audience: string; families: string[]; acknowledge: boolean; savedAt: string };
export type ComposerProps = {
  arms: string[]; families: ComposerFamily[]; wallet: number; threshold: number | null; sender: string; smsNaira: number; drafts: ComposerDraft[];
  prefill?: { audience?: string; families?: string[]; channel?: string; body?: string; draftId?: string; acknowledge?: boolean };
  base: string; sentHref: string;
  openDrawer?: (spec: DrawerSpec) => void;
};

type Audience = "all" | "selected" | "one";
const CHANNELS: Array<{ code: Channel; label: string; sub: string }> = [
  { code: "IN_APP", label: "In-app", sub: "Free" },
  { code: "SMS", label: "SMS", sub: "1 credit a part" },
  { code: "EMAIL", label: "Email", sub: "Free" },
];
const asAudience = (value: string | undefined): Audience => (value === "selected" || value === "one" ? value : "all");
const asChannel = (value: string | undefined): Channel => (value === "SMS" || value === "EMAIL" ? value : "IN_APP");
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

export function MessageComposer({ arms, families, wallet, threshold, sender, smsNaira, drafts, prefill, base, sentHref, openDrawer }: ComposerProps) {
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);
  const [audience, setAudience] = useState<Audience>(asAudience(prefill?.audience));
  const [picked, setPicked] = useState<string[]>(prefill?.families ?? []);
  const [channel, setChannel] = useState<Channel>(asChannel(prefill?.channel));
  const [body, setBody] = useState(prefill?.body ?? "");
  const [ack, setAck] = useState(Boolean(prefill?.acknowledge));
  const [draftId, setDraftId] = useState<string | undefined>(prefill?.draftId);
  const [find, setFind] = useState("");
  const [step, setStep] = useState<"write" | "preview" | "done">("write");
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ reach: number; credits: number; needsApproval: boolean; draft: boolean } | null>(null);
  const armLabel = arms.length ? arms.join(" and ") : "your class";
  const everyone = arms.length > 3 ? `Every family of your ${arms.length} classes` : `Every ${armLabel} family`;

  const chosen = useMemo(() => (audience === "all" ? families : families.filter((family) => picked.includes(family.id))), [audience, families, picked]);
  const plan = useMemo(() => chosen.map((family) => {
    const text = mergeBody(body, { Guardian: family.name, Child: joinNames(family.children) || "your child", Class: joinNames(family.arms) || "your child’s class" });
    const reach = reachOf(channel, family);
    return { family, text, reachable: reach.ok, reason: reach.ok ? null : reach.reason, segments: channel === "SMS" && reach.ok ? smsSegments(text) : 0 };
  }), [chosen, body, channel]);
  const reach = plan.filter((row) => row.reachable).length;
  const left = plan.filter((row) => !row.reachable);
  const credits = plan.reduce((sum, row) => sum + row.segments, 0);
  const unknown = unknownFields(body);
  const held = threshold !== null && reach > threshold;
  const short = credits > wallet;
  const parts = channel === "SMS" ? smsSegments(body) : 0;
  const ready = body.trim().length >= 8 && reach > 0 && unknown.length === 0 && !short && chosen.length > 0;
  const sample = plan.find((row) => row.reachable) ?? plan[0];
  const channelName = CHANNELS.find((entry) => entry.code === channel)?.label ?? "In-app";
  const noteTone: PanelTone = short ? "negative" : held ? "attention" : "positive";

  function insert(field: string) {
    const el = box.current;
    const token = `{${field}}`;
    if (!el) return setBody((current) => `${current}${token}`);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  }
  const toggle = (id: string) => setPicked((current) => (audience === "one" ? [id] : current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  const payload = (draft: boolean) => ({ audience, families: audience === "all" ? [] : picked, channel, body, acknowledge: ack, draft, draftId });

  async function submit(draft: boolean) {
    setBusy(draft ? "draft" : "send");
    setMessage(null);
    try {
      const out = (await sendJsonForData(`${base}/messages`, "POST", payload(draft))) as { id?: string; reach?: number; credits?: number; needsApproval?: boolean; draft?: boolean } | undefined;
      if (draft) {
        setDraftId(out?.id);
        setMessage("Saved as a draft. It is not sent, and nothing has been charged.");
        router.refresh();
      } else {
        setResult({ reach: out?.reach ?? reach, credits: out?.credits ?? credits, needsApproval: Boolean(out?.needsApproval), draft: false });
        setStep("done");
        router.refresh();
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That could not be sent.");
      if (!draft) setStep("write");
    } finally {
      setBusy(null);
    }
  }
  async function discard(id: string) {
    try {
      await sendJsonForData(`${base}/messages/drafts/${id}`, "DELETE", {});
      if (draftId === id) setDraftId(undefined);
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That draft could not be discarded.");
    }
  }
  function open(draft: ComposerDraft) {
    setAudience(asAudience(draft.audience));
    setPicked(draft.families);
    setChannel(asChannel(draft.channel));
    setBody(draft.body);
    setAck(draft.acknowledge);
    setDraftId(draft.id);
    setStep("write");
    setMessage(null);
  }
  function again() {
    setBody(""); setAck(false); setDraftId(undefined); setStep("write"); setResult(null); setMessage(null);
  }

  const shown = families.filter((family) => `${family.name} ${family.children.join(" ")}`.toLowerCase().includes(find.trim().toLowerCase()));
  const tile = (key: Audience, label: string, sub: string) => (
    <button key={key} type="button" role="radio" aria-checked={audience === key} onClick={() => { setAudience(key); if (key === "one") setPicked((current) => current.slice(0, 1)); }}
      className="flex min-w-0 flex-col gap-[3px] rounded-[11px] px-[13px] py-[11px] text-left" style={{ border: `1.5px solid ${audience === key ? "#12796A" : CARD_BORDER}`, background: audience === key ? "#EAF6F0" : "#fff" }}>
      <span className="text-[12px] font-bold" style={{ color: INK }}>{label}</span>
      <span className="text-[10.5px]" style={{ color: MUTED }}>{audience === key ? "Selected" : sub}</span>
    </button>
  );
  const noop = openDrawer ?? (() => undefined);
  const btn = "inline-flex rounded-[8px] px-[13px] py-[8px] text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50";

  if (step === "done" && result) {
    return (
      <section className={`${PANEL_SHELL} pb-[16px]`} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader title={result.needsApproval ? "Held for the Principal" : "Message sent"} sub={result.needsApproval ? "It is above the school’s threshold, so it waits for a decision before it leaves." : `It is on its way as ${sender}. It also appears in the school’s Outbound Review.`} tag={`${result.reach} ${result.reach === 1 ? "family" : "families"}`} tagTone={result.needsApproval ? "attention" : "positive"} openDrawer={noop} />
        <div className="grid gap-[10px] px-[16px]">
          <p className="rounded-[9px] px-[11px] py-[9px] text-[12px]" style={{ background: toneOf(result.needsApproval ? "attention" : "positive").bg, color: toneOf(result.needsApproval ? "attention" : "positive").fg }}>
            {result.needsApproval ? `${result.reach} families is more than the school lets one person send without a second pair of eyes. Nothing has been charged and nothing has left; you will see it go in Sent once it is approved.` : channel === "SMS" ? `${result.credits} credit${result.credits === 1 ? "" : "s"} taken from the school’s balance. A text is “delivered” in Sent only when the carrier says so.` : "Families will find it in their portal inbox."}
          </p>
          <div className="flex flex-wrap justify-end gap-[8px]">
            <button type="button" onClick={again} className={`${btn} border bg-white`} style={{ borderColor: CARD_BORDER, color: INK }}>Write another</button>
            <button type="button" onClick={() => router.push(sentHref as Route)} className={`${btn} text-white`} style={{ background: INK }}>See it in Sent</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-[14px]">
      <section className={`${PANEL_SHELL} pb-[16px]`} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader title="Who it goes to" tag={`${reach} recipient${reach === 1 ? "" : "s"}`} tagTone="progress" sub={arms.length > 3 ? "The families of the classes you teach, and nobody else’s." : `${armLabel}’s families, and nobody else’s.`} flush openDrawer={noop} />
        <div className="grid gap-[10px] px-[16px]">
          <div className="grid gap-[8px] sm:grid-cols-3" role="radiogroup" aria-label="Who it goes to">
            {tile("all", everyone, `${families.length} ${families.length === 1 ? "family" : "families"}`)}
            {tile("selected", "Selected families", "Pick the ones you mean")}
            {tile("one", "One family", "A single family")}
          </div>
          {audience !== "all" ? (
            <div className="grid gap-[8px]">
              <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Search by guardian or child" aria-label="Search families" className="w-full min-w-0 rounded-[10px] border-[1.5px] bg-white px-[11.5px] py-[9px] text-[12px] outline-none focus:border-[#12796A]" style={{ borderColor: CARD_BORDER, color: INK }} />
              <div className="grid max-h-[220px] gap-[4px] overflow-y-auto rounded-[10px] border p-[6px]" style={{ borderColor: CARD_BORDER }}>
                {shown.length ? shown.map((family) => (
                  <label key={family.id} className="flex cursor-pointer items-center gap-[9px] rounded-[8px] px-[8px] py-[6px] hover:bg-[#F6FAF8]">
                    <input type={audience === "one" ? "radio" : "checkbox"} name="family" checked={picked.includes(family.id)} onChange={() => toggle(family.id)} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold" style={{ color: INK }}>{family.name}</span><span className="block truncate text-[10.5px]" style={{ color: MUTED }}>{family.children.join(", ")}</span></span>
                  </label>
                )) : <p className="px-[8px] py-[6px] text-[11.5px]" style={{ color: MUTED }}>No family matches that.</p>}
              </div>
              <p className="text-[10.5px]" style={{ color: MUTED }}>{picked.length} picked</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-[14px] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className={`${PANEL_SHELL} pb-[16px]`} style={{ borderColor: CARD_BORDER }}>
          <PanelHeader title="Message" sub="{Guardian}, {Child} and {Class} become each family’s own words before it goes." tag={`${channelName} · ${channel === "SMS" ? "1 credit a part" : "free"}`} tagTone={channel === "SMS" ? "attention" : "positive"} meta={channel === "SMS" ? "An SMS over 160 characters costs a second credit" : undefined} openDrawer={noop} />
          <div className="grid gap-[12px] px-[16px]">
            <div className="grid gap-[6px]">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Channel</span>
              <div className="grid gap-[8px] sm:grid-cols-3" role="radiogroup" aria-label="Channel">
                {CHANNELS.map((entry) => (
                  <button key={entry.code} type="button" role="radio" aria-checked={channel === entry.code} onClick={() => setChannel(entry.code)} className="flex min-w-0 flex-col gap-[2px] rounded-[10px] px-[12px] py-[9px] text-left" style={{ border: `1.5px solid ${channel === entry.code ? "#12796A" : CARD_BORDER}`, background: channel === entry.code ? "#EAF6F0" : "#fff" }}>
                    <span className="text-[12px] font-bold" style={{ color: INK }}>{entry.label}</span>
                    <span className="text-[10.5px]" style={{ color: MUTED }}>{entry.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-[6px]">
              <span className="flex items-center justify-between gap-[8px]">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Message <span style={{ color: "#B23B3B" }}>Required</span></span>
                <span className="flex flex-wrap gap-[5px]">
                  {MERGE_FIELDS.map((field) => <button key={field} type="button" onClick={() => insert(field)} className="rounded-full border px-[8px] py-[2px] text-[10px] font-bold" style={{ borderColor: CARD_BORDER, color: "#12796A", background: "#fff" }}>{`{${field}}`}</button>)}
                </span>
              </span>
              <textarea ref={box} value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Dear {Guardian}, …" aria-label="Message" className="min-h-[110px] w-full min-w-0 resize-y rounded-[10px] border-[1.5px] bg-white px-[11.5px] py-[10px] text-[12px] font-medium leading-[1.55] outline-none focus:border-[#12796A]" style={{ borderColor: CARD_BORDER, color: INK }} />
              <span className="flex flex-wrap items-center justify-between gap-[6px] text-[10.5px]" style={{ color: unknown.length ? "#B23B3B" : MUTED }}>
                <span>{unknown.length ? `${unknown.map((name) => `{${name}}`).join(", ")} ${unknown.length === 1 ? "is not a merge field" : "are not merge fields"} — use {"{Guardian}"}, {"{Child}"} or {"{Class}"}.` : "Families see this from the school, and replies reach the office."}</span>
                <span>{[...body].length} characters{channel === "SMS" && parts > 1 ? ` · ${parts} parts` : ""}</span>
              </span>
            </div>
            <label className="flex cursor-pointer items-start gap-[9px] rounded-[10px] border px-[12px] py-[10px]" style={{ borderColor: CARD_BORDER }}>
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} className="mt-[2px]" />
              <span><span className="block text-[12px] font-semibold" style={{ color: INK }}>Ask families to acknowledge</span><span className="block text-[10.5px]" style={{ color: MUTED }}>{ack ? "A reply is asked for — you will see who has acknowledged in Sent." : "No reply needed."}</span></span>
            </label>
            {message ? <p className="rounded-[9px] px-[11px] py-[9px] text-[11.5px]" style={{ background: message.startsWith("Saved") ? toneOf("positive").bg : "#FDF3F3", color: message.startsWith("Saved") ? toneOf("positive").fg : "#B23B3B" }}>{message}</p> : null}
            {step === "preview" && sample ? (
              <div className="grid gap-[8px] rounded-[11px] border p-[12px]" style={{ borderColor: "#BFDCD1", background: "#F6FAF8" }}>
                <span className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>What {sample.family.name} will read</span>
                <p className="whitespace-pre-wrap text-[12.5px] leading-[1.55]" style={{ color: INK }}>{sample.text}</p>
                <span className="text-[10.5px]" style={{ color: MUTED }}>From {sender} · {channelName}{channel === "SMS" ? ` · ${smsSegments(sample.text)} credit${smsSegments(sample.text) === 1 ? "" : "s"} for this family` : ""}</span>
                {left.length ? <p className="rounded-[8px] px-[10px] py-[7px] text-[11px]" style={{ background: toneOf("attention").bg, color: toneOf("attention").fg }}>{left.length} {left.length === 1 ? "family" : "families"} left out: {left.slice(0, 3).map((row) => `${row.family.name} (${row.reason?.replace(/ — nothing was sent\.$/, "")})`).join("; ")}{left.length > 3 ? ` and ${left.length - 3} more` : ""}.</p> : null}
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-[8px]">
              {step === "preview" ? (
                <>
                  <button type="button" onClick={() => setStep("write")} className={`${btn} border bg-white`} style={{ borderColor: CARD_BORDER, color: INK }}>Back to editing</button>
                  <button type="button" disabled={!ready || busy !== null} onClick={() => void submit(false)} className={`${btn} text-white`} style={{ background: INK }}>{busy === "send" ? "Sending…" : held ? "Send it for approval" : "Send it"}</button>
                </>
              ) : (
                <>
                  <button type="button" disabled={body.trim().length < 8 || chosen.length === 0 || busy !== null} onClick={() => void submit(true)} className={`${btn} border bg-white`} style={{ borderColor: CARD_BORDER, color: INK }}>{busy === "draft" ? "Saving…" : "Save as a draft"}</button>
                  <button type="button" disabled={!ready} onClick={() => { setMessage(null); setStep("preview"); }} className={`${btn} text-white`} style={{ background: INK }}>Preview and send</button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className={`${PANEL_SHELL} pb-[16px]`} style={{ borderColor: CARD_BORDER }}>
          <PanelHeader title="Before it leaves" sub="The cost is shown before every send, whatever the audience." tag={`${credits} credit${credits === 1 ? "" : "s"}`} tagTone={credits ? "attention" : "positive"} openDrawer={noop} />
          <dl className="grid gap-[0px] px-[16px]">
            {([
              ["Recipients", String(reach), audience === "all" ? everyone : audience === "one" ? "One family" : "Selected families"],
              ["Channel", channelName, channel === "SMS" ? "1 credit for each part of the message" : "Free"],
              ["Cost", `${credits} credit${credits === 1 ? "" : "s"}${credits ? ` · ₦${(credits * smsNaira).toFixed(2)}` : ""}`, channel === "SMS" ? `School balance ${wallet.toLocaleString("en-NG")} → ${Math.max(0, wallet - credits).toLocaleString("en-NG")}` : "Nothing is charged"],
              ["Left out", String(left.length), left.length ? `${left[0]!.family.name}${left.length > 1 ? ` and ${left.length - 1} more` : ""} — ${(left[0]!.reason ?? "").replace(/ — nothing was sent\.$/, "").toLowerCase()}` : "Everybody chosen can be reached"],
              ["Your audience limit", arms.length > 3 ? "The classes you teach, only" : `${armLabel} families only`, "Set on your account, not by this screen"],
              ["Above the threshold", threshold === null ? "Never routes for approval" : `${threshold} recipients`, threshold === null ? "" : held ? "This send will wait for the Principal" : "Below it — this sends now"],
              ["Needs a connection", "Yes", "A cost cannot be shown truthfully against a stale balance"],
            ] as Array<[string, string, string]>).map(([label, value, sub], index) => (
              <div key={label} className="grid gap-[2px] py-[9px]" style={{ borderTop: index ? "1px solid #EDF3EF" : undefined }}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</dt>
                <dd className="text-[12.5px] font-bold" style={{ color: INK }}>{value}</dd>
                {sub ? <dd className="text-[10.5px]" style={{ color: MUTED }}>{sub}</dd> : null}
              </div>
            ))}
          </dl>
          {short || held ? <p className="mx-[16px] mt-[4px] rounded-[9px] px-[11px] py-[9px] text-[11.5px]" style={{ background: toneOf(noteTone).bg, color: toneOf(noteTone).fg }}>{short ? `This would cost ${credits} credits and the school has ${wallet}. Send it in-app, or ask the office to top up.` : `More than ${threshold} recipients: it will be held for the Principal before it leaves.`}</p> : null}
        </section>
      </div>

      <section className="surface-card p-[14px] text-[11.5px]" style={{ color: MUTED }}>
        <strong style={{ color: INK }}>Families see the school, not you.</strong> Every message is sent as {sender}. Replies reach the office, not your phone.
      </section>

      {drafts.length ? (
        <section className={`${PANEL_SHELL} pb-[12px]`} style={{ borderColor: CARD_BORDER }}>
          <PanelHeader title="Your drafts" sub="Written but not sent. Nothing is charged for a draft." tag={`${drafts.length}`} openDrawer={noop} />
          <ul className="grid px-[16px]">
            {drafts.map((draft, index) => (
              <li key={draft.id} className="flex items-center justify-between gap-[10px] py-[9px]" style={{ borderTop: index ? "1px solid #EDF3EF" : undefined }}>
                <span className="min-w-0"><span className="block truncate text-[12px] font-semibold" style={{ color: INK }}>{draft.body}</span><span className="block text-[10.5px]" style={{ color: MUTED }}>Saved {day(draft.savedAt)} · {draft.channel === "SMS" ? "SMS" : draft.channel === "EMAIL" ? "Email" : "In-app"}</span></span>
                <span className="flex flex-none gap-[10px] text-[11px] font-semibold">
                  <button type="button" onClick={() => open(draft)} style={{ color: "#12796A" }}>Continue</button>
                  <button type="button" onClick={() => void discard(draft.id)} style={{ color: "#B23B3B" }}>Discard</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
