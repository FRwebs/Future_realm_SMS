"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";

type Branding = {
  schoolName: string;
  logoUrl?: string | null;
  primaryColour: string;
  secondaryColour: string;
  status: string;
};

/** Relative luminance, per WCAG — the same maths the save-time contrast check uses. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const channels = [0, 2, 4].map((offset) => {
    const part = Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastWithWhite(hex: string): number {
  try {
    return Math.round(((1 + 0.05) / (luminance(hex) + 0.05)) * 100) / 100;
  } catch {
    return 0;
  }
}

/** Sample content, fixed so two reviewers looking at the same branding see the same page. */
const SAMPLE = {
  student: "Chidinma Okeke",
  admission: "FRS/2026/0184",
  className: "JSS 2 Gold",
  term: "First Term · 2026/2027",
  subjects: [
    { name: "Mathematics", ca: 28, exam: 54, total: 82, grade: "A" },
    { name: "English Language", ca: 24, exam: 48, total: 72, grade: "B" },
    { name: "Basic Science", ca: 26, exam: 51, total: 77, grade: "B" }
  ]
};

/**
 * What a school's branding looks like before it is switched on.
 *
 * Approval used to be a status change made against two hex codes and a URL,
 * which is not something anyone can picture. The things branding actually
 * reaches — the report card a parent is handed, and the header they sign in to
 * — are rendered here with fixed sample content, so the question at approval
 * time is "does this look right" rather than "does #0D2315 look right".
 */
export function BrandingPreview({ branding }: { branding: Branding }) {
  const [open, setOpen] = useState(false);
  const primary = branding.primaryColour || "#0D2315";
  const secondary = branding.secondaryColour || "#12796A";
  const ratio = contrastWithWhite(primary);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11.5px] font-semibold text-(--color-text-accent) hover:underline"
      >
        Preview
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${branding.schoolName} — branding preview`}
        subtitle="The two surfaces this branding reaches, drawn with sample content. Nothing here is live and no school sees this page."
        size="report"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-[14.5px]">
            <p className="max-w-[378px] text-pretty text-[10.5px] leading-normal text-[#5f6e65]">
              A preview is a drawing, not a check. It cannot tell you whether the logo file loads for a parent on a slow
              connection, or whether the school owns the mark.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="whitespace-nowrap rounded-[10px] bg-[#0D2315] px-[16px] py-[10px] text-[11.5px] font-semibold text-white shadow-[0_7px_16px_-7px_rgba(13,35,21,0.5)] transition hover:bg-[#17402A]"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="grid gap-[18px]">
          <section>
            <div className="mb-[10px] flex items-center gap-2">
              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.12em] text-[#5f6e65]">
                Report card header
              </span>
              <span className="h-px flex-1 bg-[#EDF3EF]" />
            </div>
            <div className="overflow-hidden rounded-[11px] border border-[#DEE8E2]">
              <div className="flex items-center gap-[13px] px-[16px] py-[14px]" style={{ background: primary }}>
                {branding.logoUrl ? (
                   
                  <img src={branding.logoUrl} alt="" className="h-[34px] w-[34px] flex-none rounded-[7px] bg-white/90 object-contain" />
                ) : (
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[7px] bg-white/20 text-[12px] font-bold text-white">
                    {branding.schoolName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-(--font-heading) text-[14px] font-extrabold text-white">{branding.schoolName}</p>
                  <p className="text-[10px] text-white/70">Report Card · {SAMPLE.term}</p>
                </div>
                <span className="ml-auto flex-none rounded-full px-[9px] py-[3px] text-[9.5px] font-bold text-white" style={{ background: secondary }}>
                  {SAMPLE.className}
                </span>
              </div>
              <div className="px-[16px] py-[12px]">
                <p className="text-[11.5px] font-bold text-[#0D2315]">{SAMPLE.student}</p>
                <p className="text-[10px] text-[#5f6e65]">{SAMPLE.admission}</p>
                <table className="mt-[10px] w-full border-separate border-spacing-0 text-[11px]">
                  <thead>
                    <tr>
                      {["Subject", "CA", "Exam", "Total", "Grade"].map((head) => (
                        <th
                          key={head}
                          className="border-b border-[#EDF3EF] px-[7px] py-[6px] text-left text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: primary }}
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE.subjects.map((subject) => (
                      <tr key={subject.name}>
                        <td className="border-b border-[#F2F7F4] px-[7px] py-[6px] text-[#0D2315]">{subject.name}</td>
                        <td className="border-b border-[#F2F7F4] px-[7px] py-[6px] text-[#5D6B63]">{subject.ca}</td>
                        <td className="border-b border-[#F2F7F4] px-[7px] py-[6px] text-[#5D6B63]">{subject.exam}</td>
                        <td className="border-b border-[#F2F7F4] px-[7px] py-[6px] font-bold text-[#0D2315]">{subject.total}</td>
                        <td className="border-b border-[#F2F7F4] px-[7px] py-[6px]">
                          <span className="rounded-full px-[7px] py-[2px] text-[9.5px] font-bold text-white" style={{ background: secondary }}>
                            {subject.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-[10px] flex items-center gap-2">
              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.12em] text-[#5f6e65]">
                Parent portal header
              </span>
              <span className="h-px flex-1 bg-[#EDF3EF]" />
            </div>
            <div className="overflow-hidden rounded-[11px] border border-[#DEE8E2]">
              <div className="flex items-center gap-[11px] px-[16px] py-[11px]" style={{ background: primary }}>
                {branding.logoUrl ? (
                   
                  <img src={branding.logoUrl} alt="" className="h-[22px] w-[22px] flex-none rounded-[5px] bg-white/90 object-contain" />
                ) : (
                  <div className="h-[22px] w-[22px] flex-none rounded-[5px] bg-white/20" />
                )}
                <span className="truncate text-[12px] font-bold text-white">{branding.schoolName}</span>
                <span className="ml-auto text-[10.5px] text-white/70">Signed in as a parent</span>
              </div>
              <div className="flex flex-wrap gap-[7px] px-[16px] py-[12px]">
                {["Pay fees", "Report cards", "Attendance"].map((label, index) => (
                  <span
                    key={label}
                    className="rounded-[8px] px-[11px] py-[6px] text-[11px] font-semibold"
                    style={index === 0 ? { background: secondary, color: "#fff" } : { background: "#F7FAF8", color: "#435048", border: "1px solid #DEE8E2" }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[13px] border border-[#E6EEE9] bg-[#F7FAF8] px-[15.5px] py-[13.5px]">
            <p className="mb-[10px] text-[9px] font-bold uppercase tracking-[0.12em] text-[#5f6e65]">What to look at</p>
            {[
              ["Primary against white", `${ratio.toFixed(2)}:1 — ${ratio >= 3 ? "passes the 3:1 the save-time check enforces" : "below 3:1, which the save-time check refuses"}`],
              ["The logo", branding.logoUrl ? "Loaded from the school's own link. A blank square above means it did not load, which is what a parent would get too." : "No logo set — the school's initials are drawn instead."],
              ["Secondary colour", "Used for grades, the class chip and the primary action. Check it is readable as a background for white text."],
              ["Status", branding.status]
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-[11px] py-[6.5px]">
                <div className="min-w-[171px] flex-none text-pretty text-[11.5px] font-semibold text-[#0D2315]">{label}</div>
                <div className="text-pretty text-[11px] leading-normal text-[#5D6B63]">{value}</div>
              </div>
            ))}
          </section>
        </div>
      </Modal>
    </>
  );
}
