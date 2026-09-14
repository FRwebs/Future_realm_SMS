"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";

type Option = { label: string; value: string };

interface CampaignComposerProps {
  templateOptions: Option[];
  planFilterOptions: Option[];
}

type AudiencePreview = { recipientCount: number; sample: Array<{ name: string; email: string; role: string; school: string }> };

const channelDefs = [
  { key: "EMAIL", label: "Email", dot: "#2B5F8F" },
  { key: "SMS", label: "SMS", dot: "#12796A" },
  { key: "WHATSAPP", label: "WhatsApp", dot: "#D9A22C" }
] as const;

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function CampaignComposer({ templateOptions, planFilterOptions }: CampaignComposerProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [type, setType] = useState<"OPERATIONAL" | "PROMOTIONAL">("OPERATIONAL");
  const [channel, setChannel] = useState<"EMAIL" | "SMS" | "WHATSAPP">("EMAIL");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [lastLoginWithinDays, setLastLoginWithinDays] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const filters: Record<string, unknown> = {};
    if (role.trim()) filters.role = role.trim();
    if (plan) filters.plan = plan;
    if (state.trim()) filters.state = state.trim();
    if (city.trim()) filters.city = city.trim();
    if (lastLoginWithinDays) filters.lastLoginWithinDays = Number(lastLoginWithinDays);

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch("/api/super-admin/communications/audience-preview", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" },
          body: JSON.stringify(filters)
        });
        const json = (await response.json()) as { data?: AudiencePreview };
        if (response.ok && json.data) setPreview(json.data);
      } catch {
        // Reach estimate is a convenience — a failed preview just leaves the last known count showing.
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [role, plan, state, city, lastLoginWithinDays]);

  function closeComposer() {
    router.push("/super-admin/communications?tab=campaigns");
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) {
      showToast({ variant: "error", title: "Missing required fields", description: "Campaign name and message body are required." });
      return;
    }
    if (channel === "SMS" && body.length > 160) {
      showToast({ variant: "error", title: "SMS is limited to 160 characters", description: `Current message is ${body.length} characters.` });
      return;
    }
    setPending(true);
    try {
      const payload: Record<string, unknown> = { name, type, channel, body };
      if (subject.trim()) payload.subject = subject.trim();
      if (templateId) payload.templateId = templateId;
      if (role.trim()) payload.role = role.trim();
      if (plan) payload.plan = plan;
      if (state.trim()) payload.state = state.trim();
      if (city.trim()) payload.city = city.trim();
      if (lastLoginWithinDays) payload.lastLoginWithinDays = Number(lastLoginWithinDays);
      if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();

      const response = await fetch("/api/super-admin/communications/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || json.ok === false) throw new Error(json.error ?? "Unable to save the draft");

      showToast({ variant: "success", title: "Campaign drafted", description: name });
      router.push("/super-admin/communications?tab=campaigns");
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: "Unable to save draft", description: error instanceof Error ? error.message : "Something went wrong" });
    } finally {
      setPending(false);
    }
  }

  const audienceFilters = [
    { label: "Role", node: <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. SCHOOL_ADMIN, PARENT" style={fieldInputStyle} /> },
    {
      label: "Plan tier",
      node: (
        <select value={plan} onChange={(e) => setPlan(e.target.value)} style={fieldInputStyle}>
          {planFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    },
    { label: "State", node: <input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Lagos" style={fieldInputStyle} /> },
    { label: "City", node: <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ikeja" style={fieldInputStyle} /> },
    {
      label: "Active within (days)",
      node: <input type="number" min={1} value={lastLoginWithinDays} onChange={(e) => setLastLoginWithinDays(e.target.value)} placeholder="e.g. 30" style={fieldInputStyle} />
    }
  ];

  const smsCount = `${body.length} / 160 characters`;
  const overLimit = channel === "SMS" && body.length > 160;

  const approvalNote =
    type === "PROMOTIONAL"
      ? {
          title: "Super Admin or Marketing Lead sign-off required",
          body: "Promotional campaigns are opt-in only — opted-out recipients are excluded automatically for this channel and cannot be manually overridden. There is no third-party commercial campaign type in this build, so a send to parents on behalf of another organisation isn't possible in any form.",
          style: { background: "#FDF6E7", border: "1px solid #F2E4C6", color: "#8A6410" }
        }
      : {
          title: "Department Lead approval required",
          body: "Operational campaigns cover platform management and school success — maintenance notices, renewal reminders, feature alerts. They bypass opt-out status and are always delivered to the computed audience.",
          style: { background: "#E4F1EC", border: "1px solid #CFE4DB", color: "#17604F" }
        };

  const channelRules = [
    { channel: "Email", rule: "No enforced format — a subject and body are accepted as written; there's no unsubscribe-link requirement in this codebase." },
    { channel: "SMS", rule: "160 characters, enforced by the server — a longer message is rejected on save." },
    { channel: "WhatsApp", rule: "Not enforced — picking a template that isn't yet Approved by Meta doesn't block sending here." }
  ];

  return (
    <div className="grid gap-3.5 xl:grid-cols-[1fr_1.25fr_0.85fr]">
      <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-5">
        <p className="mb-3.5 text-[14px] font-semibold text-[#0D2315]">Audience builder</p>
        <div className="mb-4 flex gap-1.5 rounded-[10px] bg-[#F2F7F4] p-1">
          {(["OPERATIONAL", "PROMOTIONAL"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="flex-1 rounded-[8px] px-2.5 py-2 text-[12px] font-semibold transition"
              style={{ background: type === t ? "#fff" : "transparent", color: type === t ? "#0D2315" : "#8C9A92", boxShadow: type === t ? "0 2px 6px rgba(13,35,21,0.08)" : "none" }}
            >
              {t === "OPERATIONAL" ? "Operational" : "Promotional"}
            </button>
          ))}
        </div>

        {audienceFilters.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3 border-b border-[#F2F7F4] py-2.5">
            <div className="text-[12.5px] text-[#77857C]">{f.label}</div>
            <div className="w-[55%]">{f.node}</div>
          </div>
        ))}

        <div className="mt-4 rounded-[12px] bg-[#0D2315] p-4 text-white">
          <p className="mb-1.5 text-[11.5px] text-white/60">Estimated reach</p>
          <p className="font-[var(--font-display)] text-[26px] font-bold">
            {previewLoading ? "…" : (preview?.recipientCount ?? 0).toLocaleString()}
          </p>
          <p className="mt-1.5 text-[11.5px] text-white/65">
            Live count from the real audience filter · recomputed at save time too
          </p>
        </div>
      </section>

      <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[14px] font-semibold text-[#0D2315]">Message composer</p>
          <p className="text-[11.5px] text-[#8C9A92]">Campaign name is internal — recipients never see it</p>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name *" style={{ ...fieldInputStyle, marginBottom: 14, background: "#F7FAF8", border: "1px solid #E1EBE5", borderRadius: 9, padding: "11px 13px" }} />

        <div className="mb-4 flex gap-1.5">
          {channelDefs.map((c) => {
            const on = c.key === channel;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setChannel(c.key)}
                className="flex items-center gap-2 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold transition"
                style={{ background: on ? "#0D2315" : "#F2F7F4", color: on ? "#fff" : "#77857C", border: `1px solid ${on ? "#0D2315" : "#E1EBE5"}` }}
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "#fff" : c.dot }} />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mb-1.5 text-[11px] font-semibold text-[#77857C]">Start from a template (optional)</div>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ ...fieldInputStyle, marginBottom: 14, background: "#F7FAF8", border: "1px solid #E1EBE5", borderRadius: 9, padding: "11px 13px" }}>
          {templateOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="mb-1.5 text-[11px] font-semibold text-[#77857C]">Subject line (email only)</div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Term 2 fee reminder" style={{ ...fieldInputStyle, marginBottom: 14, background: "#F7FAF8", border: "1px solid #E1EBE5", borderRadius: 9, padding: "11px 13px" }} />

        <div className="mb-1.5 text-[11px] font-semibold text-[#77857C]">Message body *</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Write the message..."
          style={{ width: "100%", fontSize: 13, lineHeight: 1.6, color: "#2F3B34", minHeight: 118, background: "#F7FAF8", border: `1px solid ${overLimit ? "#DB5555" : "#E1EBE5"}`, borderRadius: 9, padding: 13, outline: "none", resize: "vertical" }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#12796A]">{"{{school_name}}"}</span>
          <span className="text-[11.5px] font-semibold" style={{ color: channel === "SMS" ? (overLimit ? "#DB5555" : "#8A6410") : "#8C9A92" }}>
            {channel === "SMS" ? smsCount : `${body.length} characters`}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <div className="ml-auto flex items-center gap-2.5">
            <label className="text-[12px] text-[#8C9A92]">
              Schedule for
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="ml-2" style={{ fontSize: 12, border: "1px solid #DEE8E2", borderRadius: 8, padding: "6px 9px" }} />
            </label>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2.5">
          <button type="button" onClick={handleSave} disabled={pending} className="btn-primary px-5">
            {pending ? "Saving..." : "Save draft"}
          </button>
          <button type="button" onClick={closeComposer} className="btn-secondary px-5">
            Cancel
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-3.5">
        <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-5">
          <p className="mb-3.5 text-[14px] font-semibold text-[#0D2315]">Live preview</p>
          <div className="rounded-[14px] bg-[#F2F7F4] p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-[#0D2315] font-[var(--font-display)] text-[10px] font-bold text-white">N</div>
              <div>
                <div className="text-[12px] font-semibold">Nooria</div>
                <div className="text-[10.5px] text-[#8C9A92]">{channel === "EMAIL" ? "Email · inbox preview" : channel === "SMS" ? "SMS · Termii gateway" : "WhatsApp Business"}</div>
              </div>
            </div>
            <div className="rounded-[11px] bg-white p-3.5 text-[12.5px] leading-relaxed text-[#2F3B34]">
              {subject && channel === "EMAIL" ? <p className="mb-1.5 font-semibold">{subject}</p> : null}
              {body ? body : <span className="text-[#B4C4BB]">Nothing written yet — start typing in the message composer.</span>}
            </div>
          </div>
        </section>

        <div className="rounded-[14px] p-4" style={approvalNote.style}>
          <p className="mb-1.5 text-[12.5px] font-semibold">{approvalNote.title}</p>
          <p className="text-[11.5px] leading-relaxed">{approvalNote.body}</p>
        </div>

        <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-5">
          <p className="mb-2.5 text-[13px] font-semibold text-[#0D2315]">Channel rules</p>
          {channelRules.map((cr) => (
            <div key={cr.channel} className="border-b border-[#F2F7F4] py-2 last:border-0">
              <p className="text-[12.5px] font-semibold text-[#0D2315]">{cr.channel}</p>
              <p className="mt-0.5 text-[11.5px] text-[#8C9A92]">{cr.rule}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

const fieldInputStyle: CSSProperties = {
  width: "100%",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#0D2315",
  background: "transparent",
  border: "none",
  outline: "none",
  textAlign: "right"
};
