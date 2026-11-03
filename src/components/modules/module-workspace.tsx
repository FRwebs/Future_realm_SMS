"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ModuleDrawer } from "@/components/modules/lazy-drawer";
import { PanelRowsWithDrawer } from "@/components/modules/panel-renderer";
import { useHasPhoneBar, usePhoneKind } from "@/components/layout/phone-shell";
import { useUiText } from "@/hooks/use-ui-text";
import type { DrawerSpec, PanelAction, PanelRow } from "@/lib/modules/panels";
import { cn } from "@/lib/utils/cn";

/** The mockup's default glyph for a header's primary action: a plus. */
const PLUS_ICON = "M12 5.5v13M5.5 12h13";
const ARROW_ICON = "M5 12h13M13 6.5l5.5 5.5L13 17.5";

/**
 * The page's primary action, on a phone.
 *
 * The mobile mockups take the one thing a page is for — explain an absence,
 * write this week's note — out of the header and float it above the bottom bar,
 * where a thumb reaches without stretching. It is the same action the header
 * carries on a wider screen, not a second one, so there is never a page with
 * two different "main" things to do.
 */
function MobileFab({ act, openDrawer }: { act: PanelAction; openDrawer: (spec: DrawerSpec) => void }) {
  const className =
    "pointer-events-auto flex h-[56px] max-w-full items-center gap-[10px] rounded-[18px] pl-[8px] pr-[20px] text-[14.5px] font-extrabold text-white active:scale-[0.97] transition-transform";
  const style = { background: "#0D2315", boxShadow: "0 18px 32px -14px rgba(13,35,21,0.75), 0 2px 6px rgba(13,35,21,0.18)" };
  const body = (
    <>
      <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-[13px]" style={{ background: "rgba(95,214,180,0.16)" }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5FD6B4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={act.icon ?? PLUS_ICON} />
        </svg>
      </span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{act.phoneLabel ?? act.label}</span>
    </>
  );
  return (
    // The mockup offsets this by the bar's height, because there its bar is a
    // second sticky layer inside the same scroller. Ours is a sibling below the
    // scroller, so the scrollport already stops at the bar: sticking to 0 puts
    // the button the same 12px above it.
    <div className="pointer-events-none sticky bottom-0 z-[34] mt-auto flex justify-end px-[16px] pb-[12px] md:hidden">
      {act.href ? (
        <Link href={act.href as Route} className={className} style={style}>{body}</Link>
      ) : act.drawer ? (
        <button type="button" onClick={() => openDrawer(act.drawer!)} className={className} style={style}>{body}</button>
      ) : null}
    </div>
  );
}

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
      : "gap-[6px] border border-white/18 bg-white/10 px-[12px] py-[7px] text-[11px] text-white hover:bg-white/20",
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
 * The pages the parent portal's mobile mockup gives no floating button.
 *
 * It chooses per screen rather than floating everything, and it is right to: on
 * a month calendar a floating button sits over the days a parent has to tap, a
 * timetable's own rows run under it, and a page of settings has nothing worth
 * floating. Overview already carries the same action in its first panel. These
 * keep their action in the header, where it covers nothing.
 */
const PHONE_NO_FAB = [
  // The teacher's Today already carries its first job as the deck's own button; a second one floating over it would say it twice.
  "/command-center/today",
  "/portals/parent",
  "/portals/parent/learning",
  "/portals/parent/calendar",
  "/portals/parent/consents",
  "/portals/parent/prefs",
  "/portals/parent/sync",
];

/**
 * The teacher's page head on a phone: no card, just the type — the module and the screen in green capitals, the screen's name, and one line
 * on what it is for. The mockup has no shortcut pills here: a shortcut is another segment, or a row on the page. The curved bar above it
 * already says where you are, and the primary action floats.
 */
function PhoneHead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const ui = useUiText();
  return (
    <div className="px-[4px] pt-[6px] md:hidden">
      <p className="mb-[6px] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#12796A]">{ui(eyebrow)}</p>
      <h1 className="text-pretty text-[23px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0D2315]">{ui(title)}</h1>
      {description ? <p className="mt-[6px] text-pretty text-[13.5px] leading-[1.5] text-[#5F6E65]">{description}</p> : null}
    </div>
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
  floatPrimary,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primary?: PanelAction;
  launchers?: PanelAction[];
  openDrawer: (spec: DrawerSpec) => void;
  /** When the primary floats on a phone, the header does not also carry it. */
  floatPrimary?: boolean;
}) {
  const shortcuts = (launchers ?? []).slice(0, 2);
  const hasPhoneBar = useHasPhoneBar();
  const kind = usePhoneKind();
  const ui = useUiText();

  return (
    <>
    <section
      className={cn(
        "relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] shadow-[0_14px_30px_-24px_rgba(13,35,21,0.8)]",
        kind === "teacher" && "max-md:hidden",
        // The phone mockups give the page head a card that sits *on* something:
        // a pale ledge shows above its shoulders, and the type steps up. The
        // ledge is drawn by the wrapper below, so this card just grows.
        hasPhoneBar && "max-md:rounded-[22px] max-md:px-[18px] max-md:py-[18px] max-md:shadow-[0_18px_30px_-22px_rgba(13,35,21,0.95)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-80px] top-[-132px] h-[336px] w-[336px] rounded-full border border-[rgba(95,214,180,0.12)]" />
        <div className="absolute right-[-18px] top-[-70px] h-[212px] w-[212px] rounded-full border border-[rgba(95,214,180,0.08)]" />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        <div className="min-w-0 max-w-[620px]">
          <div className={cn("mb-[5px] flex items-center gap-[7px]", hasPhoneBar && "max-md:mb-[10px] max-md:gap-[8px]")}>
            {/* The mockup puts a module glyph in a 40px chip here. ModuleHead is
                not given one, and an empty circle says less than the dot does,
                so the dot simply grows a little on a phone. */}
            <span
              className={cn(
                "h-[4.5px] w-[4.5px] flex-none rounded-full bg-[#5FD6B4]",
                hasPhoneBar && "max-md:h-[6px] max-md:w-[6px]",
              )}
            />
            <span
              className={cn(
                "whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/50",
                hasPhoneBar && "max-md:overflow-hidden max-md:text-ellipsis max-md:text-[11px] max-md:tracking-[0.08em] max-md:text-white/74",
              )}
            >
              {ui(eyebrow)}
            </span>
          </div>
          <h1
            className={cn(
              "text-pretty font-(family-name:--font-heading) text-[19px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white",
              hasPhoneBar && "max-md:text-[20px] max-md:tracking-[-0.015em]",
            )}
          >
            {ui(title)}
          </h1>
          <p
            className={cn(
              "mt-1 max-w-[560px] text-pretty text-[11px] leading-[1.45] text-white/60",
              hasPhoneBar && "max-md:mt-[6px] max-md:text-[13px] max-md:leading-[1.5] max-md:text-white/76",
            )}
          >
            {description}
          </p>
        </div>
        {primary || shortcuts.length ? (
          <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
            {shortcuts.map((act) => (
              <HeaderAction key={act.label} act={act} openDrawer={openDrawer} />
            ))}
            {/* On a phone with a bottom bar this action is the floating
                button instead, so it is not offered twice. */}
            {primary ? (
              <span className={hasPhoneBar && floatPrimary ? "hidden md:inline-flex" : "inline-flex"}>
                <HeaderAction act={primary} primary openDrawer={openDrawer} />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
    </>
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
  back,
  floatPrimary,
  phoneEyebrow,
  phoneTitle,
  phoneDesc,
  children,
}: {
  eyebrow: string;
  phoneTitle?: string;
  phoneDesc?: string;
  /** The green line over the title on a teacher's phone, when it says more than the module's name. */
  phoneEyebrow?: string;
  title: string;
  description: string;
  primary?: PanelAction;
  launchers?: PanelAction[];
  rows: PanelRow[];
  /** A way back to the list this page was opened from. */
  back?: { label: string; href: string };
  /** Overrides the per-screen rule below, for a page that knows better. */
  floatPrimary?: boolean;
  /** Rendered between the header and the panels — the tab strip. */
  children?: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const hasPhoneBar = useHasPhoneBar();
  const kind = usePhoneKind();
  const pathname = usePathname();
  const floats = floatPrimary ?? !PHONE_NO_FAB.includes(pathname.replace(/\/$/, ""));

  return (
    <div className={cn("grid min-w-0 gap-[14px]", hasPhoneBar && floats && primary && "max-md:flex max-md:min-h-full max-md:flex-col")}>
      <ModuleDrawer spec={drawer} onClose={() => setDrawer(null)} />

      {back ? (
        <Link
          href={back.href as Route}
          className="inline-flex w-fit items-center gap-[6px] text-[11.5px] font-semibold text-[#12796A] hover:underline"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H6M11 6.5 5.5 12l5.5 5.5" />
          </svg>
          {back.label}
        </Link>
      ) : null}

      {/* On a phone the mockup sets the head card on a pale ledge, so it reads
          as the top of a stack rather than a block dropped on the page. */}
      {/* `min-w-0`: a grid item defaults to min-width:auto, so without it this
          wrapper sizes to its content and pushes the head past the screen. */}
      <div className={hasPhoneBar && kind !== "teacher" ? "relative min-w-0 max-md:pt-[10px]" : "min-w-0"}>
        {hasPhoneBar && kind !== "teacher" ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-[22px] right-[22px] top-0 hidden h-[44px] rounded-[18px] max-md:block"
            style={{ background: "#CFE5DA" }}
          />
        ) : null}
        <ModuleHead
          eyebrow={eyebrow}
          title={title}
          description={description}
          primary={primary}
          launchers={launchers}
          openDrawer={setDrawer}
          floatPrimary={floats}
        />
      </div>

      {children}

      {/* The teacher's phone puts the segments first and the screen's name under them, as its mockup does. */}
      {kind === "teacher" && pathname.replace(/\/$/, "") !== "/command-center/today" ? <PhoneHead eyebrow={phoneEyebrow ?? eyebrow} title={phoneTitle ?? title} description={phoneDesc ?? description} /> : null}

      <PanelRowsWithDrawer rows={rows} openDrawer={setDrawer} />

      {hasPhoneBar && floats && primary ? <MobileFab act={primary} openDrawer={setDrawer} /> : null}
    </div>
  );
}
