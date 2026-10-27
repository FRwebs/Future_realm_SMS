"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { DocumentPaper } from "@/components/modules/document-paper";
import type { DocAct, DrawerSpec } from "@/lib/modules/panels";
import { INK, toneOf } from "@/lib/modules/tones";

const quiet = "whitespace-nowrap rounded-[9px] border bg-white px-[14px] py-[9px] text-[11.5px] font-semibold";
const dark = "whitespace-nowrap rounded-[9px] px-[16px] py-[9.5px] text-[11.5px] font-semibold text-white";

/**
 * A document over the page it was opened from, as the mockup shows it: a bar saying what it is and
 * what state it is in, the paper on a tinted desk, and the decision beneath. The page behind is still
 * there when it closes. Printing prints the paper alone (see globals.css).
 */
export function DocumentModal({ spec, onClose, onSwap }: { spec: DrawerSpec; onClose: () => void; onSwap: (next: DrawerSpec) => void }) {
  const doc = spec.doc;
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (!doc) return null;
  const state = doc.state ? toneOf(doc.state.tone) : null;

  const act = (item: DocAct, index: number) => {
    const style = item.primary ? { background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" } : { borderColor: "#CFDDD5", color: "#435048" };
    const className = item.primary ? dark : quiet;
    if (item.href) {
      return (
        <Link key={`${item.label}-${index}`} href={item.href as Route} className={className} style={style}>
          {item.label}
        </Link>
      );
    }
    return (
      <button
        key={`${item.label}-${index}`}
        type="button"
        className={className}
        style={style}
        onClick={() => {
          if (item.print) window.print();
          else if (item.drawer) onSwap(item.drawer);
        }}
      >
        {item.label}
      </button>
    );
  };

  return createPortal(
    <div data-doc-print="true" className="fixed inset-0 z-42 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={spec.title}>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 cursor-default" style={{ background: "rgba(13,35,21,0.5)" }} data-print-hide="true" />
      <div className="relative flex max-h-[calc(100vh-48px)] w-full max-w-[940px] flex-col overflow-hidden rounded-[18px] bg-white" style={{ boxShadow: "0 45px 90px -36px rgba(13,35,21,0.6)" }}>
        <div data-print-hide="true" className="flex flex-none items-center justify-between gap-[14px] px-5 py-[13px] text-white" style={{ background: INK }}>
          <div className="flex min-w-0 flex-wrap items-center gap-[10px]">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>{doc.heading}</p>
            {state && doc.state ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold" style={{ background: state.bg, color: state.fg, borderColor: state.bd }}>
                <span className="h-[6px] w-[6px] rounded-full" style={{ background: state.dot }} />
                {doc.state.label}
              </span>
            ) : null}
            {doc.meta ? <p className="text-[11px] leading-normal" style={{ color: "rgba(255,255,255,0.62)" }}>{doc.meta}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[9px]" style={{ background: "rgba(255,255,255,0.1)" }}>
            <X className="h-[12.5px] w-[12.5px] text-white" strokeWidth={2.4} />
          </button>
        </div>

        {doc.peers && doc.peers.items.length > 1 ? (
          <div data-print-hide="true" className="flex flex-none flex-wrap items-center gap-[7px] border-b border-[#EDF3EF] bg-[#FBFDFC] px-5 py-[10px]">
            <p className="mr-[2px] text-[9px] font-bold uppercase tracking-[0.06em] text-[#5f6e65]">{doc.peers.label}</p>
            {doc.peers.items.map((peer) => (
              <button
                key={peer.load}
                type="button"
                aria-current={peer.active ? "true" : undefined}
                onClick={() => (peer.active ? undefined : onSwap({ mode: "document", title: peer.label, load: peer.load }))}
                className="whitespace-nowrap rounded-full border px-[10px] py-[5px] text-[10.5px]"
                style={{ fontWeight: peer.active ? 700 : 500, borderColor: peer.active ? "#12796A" : "#DEE8E2", background: peer.active ? "#E4F1EC" : "#fff", color: peer.active ? "#12796A" : "#5F6E65" }}
              >
                {peer.label}
              </button>
            ))}
          </div>
        ) : null}

        <div data-print-scroll="true" className="min-h-0 flex-1 overflow-auto p-[22px]" style={{ background: "#F4F8F6" }}>
          <DocumentPaper doc={doc} className="mx-auto max-w-[820px]" />
        </div>

        <div data-print-hide="true" className="flex flex-none flex-wrap items-center justify-between gap-[14px] border-t border-[#EDF3EF] bg-[#FBFDFC] px-5 py-[13px]">
          <p className="max-w-[340px] text-pretty text-[10.5px] leading-[1.45] text-[#5E6D64]">{doc.note}</p>
          <div className="flex flex-none flex-wrap items-center gap-2">{(doc.acts ?? []).map(act)}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
