"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";

import { Modal } from "@/components/ui/modal";

export interface StructureField {
  label: string;
  value: string;
  note?: string;
  /** Renders a section heading above this field when it differs from the previous field's section. */
  section?: string;
}

interface StructurePreviewDialogProps {
  triggerLabel: string;
  title: string;
  description: string;
  fields: StructureField[];
  /** Real place to actually do this today, if one exists. */
  cta?: { label: string; href: string };
}

/**
 * For a mockup action that has no real, working backend behind it at all — shows the mockup's
 * structure honestly (sections, fields, locked notes) with no submit, since there is nothing to
 * submit to. Points at the real, narrower flow that does exist, where one does.
 */
export function StructurePreviewDialog({ triggerLabel, title, description, fields, cta }: StructurePreviewDialogProps) {
  const [open, setOpen] = useState(false);

  let lastSection: string | undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]"
      >
        {triggerLabel}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={description} size="report">
        <div className="grid gap-5">
          {fields.map((field, index) => {
            const showHeader = field.section && field.section !== lastSection;
            lastSection = field.section;
            return (
              <div key={`${field.label}-${index}`}>
                {showHeader ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8C9A92", whiteSpace: "nowrap" }}>
                      {field.section}
                    </div>
                    <div style={{ height: 1, flex: 1, background: "#EDF3EF" }} />
                  </div>
                ) : null}
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#435048", marginBottom: 6 }}>{field.label}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 10,
                    padding: "11px 13px",
                    background: "#F7FAF8",
                    border: "1px solid #E6EEE9"
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "#5D6B63", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {field.value}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B4C4BB" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none", marginLeft: "auto" }}>
                    <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                  </svg>
                </div>
                {field.note ? <div style={{ fontSize: 11, color: "#8C9A92", marginTop: 5, lineHeight: 1.45 }}>{field.note}</div> : null}
              </div>
            );
          })}
        </div>

        <div className="sticky -bottom-[22px] -mx-[26px] -mb-[22px] mt-5 flex items-center justify-end gap-2 border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]">
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-10 px-5">
            Close
          </button>
          {cta ? (
            <Link href={cta.href as Route} className="btn-primary flex h-10 items-center px-6 text-[13px] font-semibold">
              {cta.label}
            </Link>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
