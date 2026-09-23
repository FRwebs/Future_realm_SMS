"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

import { ModuleHero } from "@/components/data-display/module-hero";
import { ModuleDrawer } from "@/components/modules/module-drawer";
import { PanelRowsWithDrawer } from "@/components/modules/panel-renderer";
import type { DrawerSpec, PanelAction, PanelRow } from "@/lib/modules/panels";
import { cn } from "@/lib/utils/cn";

function HeaderAction({
  act,
  primary,
  openDrawer,
}: {
  act: PanelAction;
  primary?: boolean;
  openDrawer: (spec: DrawerSpec) => void;
}) {
  const className = cn(
    "inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-5 text-[13px] font-semibold transition",
    primary
      ? "bg-white text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] hover:bg-[#eaf3ee]"
      : "border border-white/25 text-white/85 hover:border-white/50 hover:text-white",
  );

  if (act.href) {
    return (
      <Link href={act.href as Route} className={className}>
        {act.label}
      </Link>
    );
  }

  if (act.drawer) {
    const spec = act.drawer;
    return (
      <button type="button" onClick={() => openDrawer(spec)} className={className}>
        {act.label}
      </button>
    );
  }

  return (
    <span className={cn(className, "cursor-default opacity-70")} title="Not wired up yet">
      {act.label}
    </span>
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
    <div className="grid min-w-0 gap-5">
      <ModuleDrawer spec={drawer} onClose={() => setDrawer(null)} />

      <ModuleHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          primary || launchers?.length ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {launchers?.map((act) => (
                <HeaderAction key={act.label} act={act} openDrawer={setDrawer} />
              ))}
              {primary ? <HeaderAction act={primary} primary openDrawer={setDrawer} /> : null}
            </div>
          ) : undefined
        }
      />

      {children}

      <PanelRowsWithDrawer rows={rows} openDrawer={setDrawer} />
    </div>
  );
}
