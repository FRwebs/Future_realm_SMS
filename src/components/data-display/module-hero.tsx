import type { ReactNode } from "react";

interface ModuleHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * The ink module header at the top of every Super Admin module page.
 *
 * Every value is the mockup's: 20px radius, 23.5/27 padding, 18px below, the
 * three rings at their own offsets, a 26px Manrope title, a 9.5px eyebrow and
 * a 12px description. It sat outside the density pass — that swept
 * app/super-admin and components/super-admin, and this lives in data-display —
 * so it kept the older, larger scale while the pages under it shrank. Seventeen
 * pages use it, which is why the mismatch showed up on all of them at once.
 */
export function ModuleHero({ eyebrow, title, description, action }: ModuleHeroProps) {
  return (
    <section className="relative mb-[18px] overflow-hidden rounded-[20px] bg-[#0d2315] px-[27px] py-[23.5px] shadow-[0_18px_39.5px_-27px_rgba(13,35,21,0.8)]">
      <div className="pointer-events-none absolute right-[-81px] top-[-135px] h-[342px] w-[342px] rounded-full border border-[rgba(95,214,180,0.12)]" />
      <div className="pointer-events-none absolute right-[-18px] top-[-72px] h-[216px] w-[216px] rounded-full border border-[rgba(95,214,180,0.08)]" />
      <div className="pointer-events-none absolute bottom-[-144px] left-[-63px] h-[252px] w-[252px] rounded-full border border-white/5" />
      <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-[25px]">
        <div className="min-w-0 md:max-w-[594px]">
          <div className="mb-[10px] flex items-center gap-[8px]">
            <span className="h-[4.5px] w-[4.5px] shrink-0 rounded-full bg-[#5FD6B4]" />
            <span className="whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.15em] text-white/55">{eyebrow}</span>
          </div>
          <h1 className="text-pretty font-(--font-heading) text-[26px] font-extrabold leading-[1.08] tracking-[-0.028em] text-white">
            {title}
          </h1>
          <p className="mt-[8px] max-w-3xl text-pretty text-[12px] leading-[1.55] text-[rgba(255,255,255,0.62)]">{description}</p>
        </div>
        {action ? <div className="flex-none">{action}</div> : null}
      </div>
    </section>
  );
}

/**
 * Matches the mockup's white pill primary-action button used inside the
 * module hero (e.g. "Add school", "New campaign").
 */
export function ModuleHeroAction({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex flex-none items-center gap-[7px] whitespace-nowrap rounded-full bg-white px-[18px] py-[11px] text-[11.5px] font-semibold text-[#0d2315] shadow-[0_9px_21.5px_-11px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]"
    >
      {children}
    </button>
  );
}
