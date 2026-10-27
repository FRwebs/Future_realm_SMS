"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

/**
 * A set of sections of which one is open at a time (and which can all be closed), built on Radix: the headers are real headings with
 * buttons in them, arrow keys move between them, Home and End jump to the first and last, and the open state is announced.
 */
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
  return (
    <RadixAccordion.Root type="single" collapsible defaultValue={defaultOpenId ?? items[0]?.id} className="grid gap-3">
      {items.map((item) => (
        <RadixAccordion.Item key={item.id} value={item.id} className="group overflow-hidden rounded-2xl border border-(--color-border-default) bg-(--color-bg-surface) shadow-(--shadow-sm)">
          <RadixAccordion.Header asChild>
            <h3>
              <RadixAccordion.Trigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-(--color-bg-elevated)">
                <span className="block min-w-0">
                  <span className="block text-[14px] font-semibold text-(--color-text-primary)">{item.title}</span>
                  {item.summary ? <span className="mt-1 block text-[12px] text-(--color-text-secondary)">{item.summary}</span> : null}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
              </RadixAccordion.Trigger>
            </h3>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="border-t border-(--color-border-default) px-4 py-4">{item.content}</RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
