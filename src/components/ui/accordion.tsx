"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

export function AccordionGroup({
  items,
  defaultOpenId,
}: {
  items: Array<{
    id: string;
    title: React.ReactNode;
    summary?: React.ReactNode;
    content: React.ReactNode;
  }>;
  defaultOpenId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <AccordionItem
            key={item.id}
            title={item.title}
            summary={item.summary}
            open={open}
            onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
          >
            {item.content}
          </AccordionItem>
        );
      })}
    </div>
  );
}

export function AccordionItem({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-slate-900">{title}</div>
          {summary ? (
            <div className="mt-1 text-[12px] text-slate-500">{summary}</div>
          ) : null}
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 py-4">{children}</div>
      ) : null}
    </article>
  );
}
