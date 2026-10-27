"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";

type Option = { label: string; value: string };

const campaignSchema = (smsPrefix: string) =>
  z
    .object({
      type: z.enum(["OPERATIONAL", "PROMOTIONAL"]),
      channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
      name: z.string().trim().min(1, "Give the campaign a name."),
      subject: z.string(),
      body: z.string().trim().min(1, "Write what the campaign says."),
      templateId: z.string(),
      role: z.string(),
      plan: z.string(),
      state: z.string(),
      city: z.string(),
      lastLoginWithinDays: z.string(),
      scheduledAt: z.string(),
      recurrence: z.string(),
    })
    .superRefine((value, context) => {
      if (value.channel === "SMS" && smsPrefix.length + value.body.length > 160) {
        context.addIssue({ code: "custom", path: ["body"], message: `It opens with “${smsPrefix.trim().replace(/:$/, "")}”, which makes this ${smsPrefix.length + value.body.length} characters. An SMS is limited to 160 — shorten the message.` });
      }
    });
type CampaignValues = z.infer<ReturnType<typeof campaignSchema>>;

interface CampaignComposerProps {
  templateOptions: Option[];
  planFilterOptions: Option[];
  /** What the platform calls itself — the sender every recipient sees. */
  platformName: string;
}

type AudiencePreview = { recipientCount: number; schoolCount: number; sample: Array<{ name: string; email: string; role: string; school: string }> };

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

/** The fields a campaign may use; each is filled in for every person it reaches, on every channel. */
const MERGE_FIELDS = ["school_name", "first_name", "last_name", "admin_name"] as const;

export function CampaignComposer({ templateOptions, planFilterOptions, platformName }: CampaignComposerProps) {
  const router = useRouter();
  const notice = useNotice();

  const smsPrefix = `${platformName}: `;
  const schema = useMemo(() => campaignSchema(smsPrefix), [smsPrefix]);
  const form = useForm<CampaignValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "OPERATIONAL", channel: "EMAIL", name: "", subject: "", body: "", templateId: "", role: "", plan: "", state: "", city: "", lastLoginWithinDays: "", scheduledAt: "", recurrence: "" },
  });
  const { type, channel, name, subject, body, templateId, role, plan, state, city, lastLoginWithinDays, scheduledAt, recurrence } = form.watch();
  const setType = (value: CampaignValues["type"]) => form.setValue("type", value);
  const setChannel = (value: CampaignValues["channel"]) => form.setValue("channel", value);
  const setBody = (update: (current: string) => string) => form.setValue("body", update(form.getValues("body")), { shouldValidate: form.formState.isSubmitted });

  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);

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

  async function save() {
    notice.clear();
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
      if (recurrence) payload.recurrence = recurrence;

      const response = await fetch("/api/super-admin/communications/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || json.ok === false) throw new Error(json.error ?? "Unable to save the draft");

      // Said where the button is, then on to the list: long enough to read, short enough not to be in the way.
      notice.success("Campaign drafted", `“${name}” is saved. Taking you to the campaigns list.`);
      window.setTimeout(() => {
        router.push("/super-admin/communications?tab=campaigns");
        router.refresh();
      }, 900);
    } catch (error) {
      notice.error("The draft was not saved", error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  /** A campaign that cannot be saved says which part, beside the part and in the notice, rather than failing quietly. */
  const handleSave = form.handleSubmit(save, (errors) => {
    const first = errors.name ?? errors.body;
    notice.warning("The campaign is not ready", first?.message ?? "Check the highlighted fields.");
  });

  async function handleTest() {
    if (!body.trim()) {
      notice.warning("Write the message first", "A test is sent exactly as written.");
      return;
    }
    notice.clear();
    setTesting(true);
    try {
      const response = await fetch("/api/super-admin/communications/campaigns/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" },
        body: JSON.stringify({ channel, subject: subject.trim() || undefined, body })
      });
      const json = (await response.json()) as { ok?: boolean; error?: string; message?: string; data?: { note?: string | null } };
      if (!response.ok || json.ok === false) throw new Error(json.error ?? "The test could not be sent.");
      notice.success(json.message ?? "Test sent", json.data?.note ?? "Check how it reads before you schedule it.");
    } catch (error) {
      notice.error("The test did not go", error instanceof Error ? error.message : "Try again.");
    } finally {
      setTesting(false);
    }
  }

  const audienceFilters = [
    { label: "Role", node: <input {...form.register("role")} placeholder="e.g. SCHOOL_ADMIN, PARENT" style={fieldInputStyle} /> },
    {
      label: "Plan tier",
      node: (
        <select {...form.register("plan")} style={fieldInputStyle}>
          {planFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    },
    { label: "State", node: <input {...form.register("state")} placeholder="e.g. Lagos" style={fieldInputStyle} /> },
    { label: "City", node: <input {...form.register("city")} placeholder="e.g. Ikeja" style={fieldInputStyle} /> },
    {
      label: "Active within (days)",
      node: <input type="number" min={1} {...form.register("lastLoginWithinDays")} placeholder="e.g. 30" style={fieldInputStyle} />
    }
  ];

  const smsCount = `${smsPrefix.length + body.length} / 160 characters`;
  const overLimit = channel === "SMS" && smsPrefix.length + body.length > 160;

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
    { channel: "Email", rule: "Sent over SMTP when a mail server is set up; otherwise queued and shown as waiting. A subject and body are accepted as written." },
    { channel: "SMS", rule: "160 characters, enforced by the server — a longer message is rejected on save." },
    { channel: "WhatsApp", rule: "Sent from a template Meta has approved, to people who opted in to WhatsApp. Choose the approved template; its {{fields}} are filled in per person. Needs the WhatsApp keys set on this deployment." }
  ];

  return (
    <div className="grid gap-3.5 xl:grid-cols-[1fr_1.25fr_0.85fr]">
      <section className="rounded-[14px] border border-(--color-border-default) bg-white p-5">
        <p className="mb-3.5 text-[12.5px] font-semibold text-[#0D2315]">Audience builder</p>
        <div className="mb-4 flex gap-1.5 rounded-[9px] bg-[#F2F7F4] p-1">
          {(["OPERATIONAL", "PROMOTIONAL"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="flex-1 rounded-[7px] px-2.5 py-2 text-[11px] font-semibold transition"
              style={{ background: type === t ? "#fff" : "transparent", color: type === t ? "#0D2315" : "#5E6D64", boxShadow: type === t ? "0 2px 6px rgba(13,35,21,0.08)" : "none" }}
            >
              {t === "OPERATIONAL" ? "Operational" : "Promotional"}
            </button>
          ))}
        </div>

        {audienceFilters.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3 border-b border-[#F2F7F4] py-2.5">
            <div className="text-[11.5px] text-[#5f6e65]">{f.label}</div>
            <div className="w-[55%]">{f.node}</div>
          </div>
        ))}

        <div className="mt-4 rounded-[11px] bg-[#0D2315] p-4 text-white">
          <p className="mb-1.5 text-[10.5px] text-white/60">Estimated reach</p>
          <p className="font-(--font-display) text-[23.5px] font-bold">
            {previewLoading ? "…" : (preview?.recipientCount ?? 0).toLocaleString()}
          </p>
          <p className="mt-1.5 text-[10.5px] text-white/65">
            {(preview?.schoolCount ?? 0).toLocaleString()} school{(preview?.schoolCount ?? 0) === 1 ? "" : "s"} · {type === "PROMOTIONAL" ? "opted-in recipients only" : "everyone the audience matches"}
          </p>
        </div>
      </section>

      <section className="rounded-[14px] border border-(--color-border-default) bg-white p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[12.5px] font-semibold text-[#0D2315]">Message composer</p>
          <p className="text-[10.5px] text-[#5f6e65]">Sender is always “{platformName}”</p>
        </div>
        <input {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} aria-label="Campaign name" placeholder="Campaign name * — internal, recipients never see it" style={{ ...fieldInputStyle, marginBottom: 14, background: "#F7FAF8", border: "1px solid #E1EBE5", borderRadius: 9, padding: "11px 13px" }} />

        <div className="mb-4 flex gap-1.5">
          {channelDefs.map((c) => {
            const on = c.key === channel;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setChannel(c.key)}
                className="flex items-center gap-2 rounded-[8px] px-3.5 py-2 text-[11.5px] font-semibold transition"
                style={{ background: on ? "#0D2315" : "#F2F7F4", color: on ? "#fff" : "#77857C", border: `1px solid ${on ? "#0D2315" : "#E1EBE5"}` }}
              >
                <span className="h-[6.5px] w-[6.5px] rounded-full" style={{ background: on ? "#fff" : c.dot }} />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mb-1.5 text-[10px] font-semibold text-[#5f6e65]">Start from a template (optional)</div>
        <select {...form.register("templateId")} aria-label="Template" style={{ ...fieldInputStyle, marginBottom: 14, background: "#F7FAF8", border: "1px solid #E1EBE5", borderRadius: 9, padding: "11px 13px" }}>
          {templateOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="mb-1.5 text-[10px] font-semibold text-[#5f6e65]">Subject line (email only)</div>
        <input {...form.register("subject")} aria-label="Subject line" placeholder="e.g. Term 2 fee reminder" style={{ ...fieldInputStyle, marginBottom: 14, background: "#F7FAF8", border: "1px solid #E1EBE5", borderRadius: 9, padding: "11px 13px" }} />

        <div className="mb-1.5 text-[10px] font-semibold text-[#5f6e65]">Message body *</div>
        <textarea
          {...form.register("body")}
          aria-label="Message body"
          aria-invalid={Boolean(form.formState.errors.body)}
          rows={5}
          placeholder="Write the message..."
          style={{ width: "100%", fontSize: 13, lineHeight: 1.6, color: "#2F3B34", minHeight: 118, background: "#F7FAF8", border: `1px solid ${overLimit ? "#DB5555" : "#E1EBE5"}`, borderRadius: 9, padding: 13, outline: "none", resize: "vertical" }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((field) => (
              <button key={field} type="button" onClick={() => setBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}{{${field}}}`)} className="rounded-[6px] bg-[#E4F1EC] px-[7px] py-[3.5px] text-[10px] font-semibold text-[#12796A] hover:bg-[#D5EBE2]">{`{{${field}}}`}</button>
            ))}
          </span>
          <span className="text-[10.5px] font-semibold" style={{ color: channel === "SMS" ? (overLimit ? "#DB5555" : "#8A6410") : "#5E6D64" }}>
            {channel === "SMS" ? smsCount : `${body.length} characters`}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <div className="ml-auto flex items-center gap-2.5">
            <label className="text-[11px] text-[#5f6e65]">
              Schedule for
              <input type="datetime-local" {...form.register("scheduledAt")} className="ml-2" style={{ fontSize: 12, border: "1px solid #DEE8E2", borderRadius: 8, padding: "6px 9px" }} />
            </label>
            <label className="text-[11px] text-[#5f6e65]">
              Repeat
              <select {...form.register("recurrence")} disabled={!scheduledAt} className="ml-2" style={{ fontSize: 12, border: "1px solid #DEE8E2", borderRadius: 8, padding: "6px 9px" }}>
                <option value="">Once</option>
                <option value="WEEKLY">Every week</option>
                <option value="MONTHLY">Every month</option>
              </select>
            </label>
          </div>
        </div>
        <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mt-4" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void handleSave()} disabled={pending} className="whitespace-nowrap rounded-[10px] bg-[#0D2315] px-4 py-2.5 text-[11.5px] font-semibold text-white transition hover:bg-[#17402A] disabled:opacity-60">
            {pending ? "Saving..." : scheduledAt ? "Schedule campaign" : "Save draft"}
          </button>
          <button type="button" onClick={handleTest} disabled={testing} className="whitespace-nowrap rounded-[10px] border border-[#DEE8E2] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#435048] transition hover:bg-[#EFF6F2] disabled:opacity-60">
            {testing ? "Sending…" : "Send test"}
          </button>
          <button type="button" onClick={closeComposer} className="rounded-[10px] px-3 py-2.5 text-[11.5px] font-semibold text-[#5f6e65] hover:text-[#0D2315]">Cancel</button>
          <span className="w-full text-[11px] text-[#5f6e65]">Nothing sends until it is approved</span>
        </div>
      </section>

      <div className="flex flex-col gap-3.5">
        <section className="rounded-[14px] border border-(--color-border-default) bg-white p-5">
          <p className="mb-3.5 text-[12.5px] font-semibold text-[#0D2315]">Live preview</p>
          <div className="rounded-[14px] bg-[#F2F7F4] p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <div className="flex h-[23.5px] w-[23.5px] items-center justify-center rounded-[8px] bg-[#0D2315] font-(--font-display) text-[9px] font-bold text-white">{platformName.charAt(0).toUpperCase()}</div>
              <div>
                <div className="text-[11px] font-semibold">{platformName}</div>
                <div className="text-[9.5px] text-[#5f6e65]">{channel === "EMAIL" ? "Email · inbox preview" : channel === "SMS" ? "SMS · Termii gateway" : "WhatsApp Business"}</div>
              </div>
            </div>
            <div className="rounded-[10px] bg-white p-3.5 text-[11.5px] leading-relaxed text-[#2F3B34]">
              {subject && channel === "EMAIL" ? <p className="mb-1.5 font-semibold">{subject}</p> : null}
              {body ? (channel === "SMS" ? `${smsPrefix}${body}` : body) : <span className="text-[#B4C4BB]">Nothing written yet — start typing in the message composer.</span>}
            </div>
          </div>
        </section>

        <div className="rounded-[14px] p-4" style={approvalNote.style}>
          <p className="mb-1.5 text-[11.5px] font-semibold">{approvalNote.title}</p>
          <p className="text-[10.5px] leading-relaxed">{approvalNote.body}</p>
        </div>

        <section className="rounded-[14px] border border-(--color-border-default) bg-white p-5">
          <p className="mb-2.5 text-[11.5px] font-semibold text-[#0D2315]">Channel rules</p>
          {channelRules.map((cr) => (
            <div key={cr.channel} className="border-b border-[#F2F7F4] py-2 last:border-0">
              <p className="text-[11.5px] font-semibold text-[#0D2315]">{cr.channel}</p>
              <p className="mt-0.5 text-[10.5px] text-[#5f6e65]">{cr.rule}</p>
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
