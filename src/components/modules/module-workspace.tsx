"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

import { ModuleDrawer } from "@/components/modules/module-drawer";
import { PanelRowsWithDrawer } from "@/components/modules/panel-renderer";
import type { DrawerSpec, PanelAction, PanelRow } from "@/lib/modules/panels";
import { cn } from "@/lib/utils/cn";

/** The mockup's default glyph for a header's primary action: a plus. */
const PLUS_ICON = "M12 5.5v13M5.5 12h13";
const ARROW_ICON = "M5 12h13M13 6.5l5.5 5.5L13 17.5";

function HeaderAction({
  act,
  primary,
  openDrawer,
}: {
  act: PanelAction;
  primary?: boolean;
  openDrawer: (spec: DrawerSpec) => void;
}) {
  // The primary is a solid white pill with a lift on hover; a launcher is a
  // translucent pill that leads with an arrow, since it takes you elsewhere.
  const className = cn(
    "inline-flex flex-none items-center whitespace-nowrap rounded-full font-semibold transition",
    primary
      ? "gap-[7px] bg-white px-[15px] py-[8px] text-[11.5px] text-[#0D2315] shadow-[0_9px_20px_-11px_rgba(0,0,0,0.65)] hover:-translate-y-px hover:bg-[#EAF3EE]"
      : "gap-[6px] border border-white/[0.18] bg-white/10 px-[12px] py-[7px] text-[11px] text-white hover:bg-white/20",
  );
  const body = (
    <>
      <svg
        width={primary ? 13 : 12}
        height={primary ? 13 : 12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={primary ? 2.3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={primary ? (act.icon ?? PLUS_ICON) : ARROW_ICON} />
      </svg>
      <span>{act.label}</span>
    </>
  );

  if (act.href) {
    return (
      <Link href={act.href as Route} className={className}>
        {body}
      </Link>
    );
  }

  if (act.drawer) {
    const spec = act.drawer;
    return (
      <button
        type="button"
        onClick={() => openDrawer(spec)}
        className={className}
      >
        {body}
      </button>
    );
  }

  return (
    <span
      className={cn(className, "cursor-default opacity-70")}
      title="Not wired up yet"
    >
      {body}
    </span>
  );
}

/**
 * The ink header at the top of every tab: the module as its eyebrow, the tab
 * as its title, and at most three decisions — the primary and two shortcuts.
 * Anything further down the authored list lives on the page itself.
 */
function ModuleHead({
  eyebrow,
  title,
  description,
  primary,
  launchers,
  openDrawer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primary?: PanelAction;
  launchers?: PanelAction[];
  openDrawer: (spec: DrawerSpec) => void;
}) {
  const shortcuts = (launchers ?? []).slice(0, 2);

  return (
    <section className="relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] shadow-[0_14px_30px_-24px_rgba(13,35,21,0.8)]">
      <div className="pointer-events-none absolute -right-[80px] -top-[132px] h-[336px] w-[336px] rounded-full border border-[rgba(95,214,180,0.12)]" />
      <div className="pointer-events-none absolute -right-[18px] -top-[70px] h-[212px] w-[212px] rounded-full border border-[rgba(95,214,180,0.08)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        <div className="min-w-0 max-w-[620px]">
          <div className="mb-[5px] flex items-center gap-[7px]">
            <span className="h-[4.5px] w-[4.5px] flex-none rounded-full bg-[#5FD6B4]" />
            <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
              {eyebrow}
            </span>
          </div>
          <h1 className="text-pretty font-[family-name:var(--font-heading)] text-[19px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white">
            {title}
          </h1>
          <p className="mt-1 max-w-[560px] text-pretty text-[11px] leading-[1.45] text-white/60">
            {description}
          </p>
        </div>
        {primary || shortcuts.length ? (
          <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
            {shortcuts.map((act) => (
              <HeaderAction key={act.label} act={act} openDrawer={openDrawer} />
            ))}
            {primary ? (
              <HeaderAction act={primary} primary openDrawer={openDrawer} />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One tab of a module: its header, its panels, and the drawer they share.
 *
 * The drawer lives here rather than inside the panels so that the header's
 * primary action opens the same surface a table row does — a decision reads
 * identically wherever it is reached from.
 */
export function ModuleWorkspace({
  eyebrow,
  title,
  description,
  primary,
  launchers,
  rows,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primary?: PanelAction;
  launchers?: PanelAction[];
  rows: PanelRow[];
  /** Rendered between the header and the panels — the tab strip. */
  children?: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);

  return (
    <div className="grid min-w-0 gap-[14px]">
      <ModuleDrawer spec={drawer} onClose={() => setDrawer(null)} />

      <ModuleHead
        eyebrow={eyebrow}
        title={title}
        description={description}
        primary={primary}
        launchers={launchers}
        openDrawer={setDrawer}
      />

      {children}

      <PanelRowsWithDrawer rows={rows} openDrawer={setDrawer} />
    </div>
  );
}
