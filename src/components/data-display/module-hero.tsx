import type { ReactNode } from "react";

interface ModuleHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * The ink module header used at the top of every Super Admin module page
 * (Schools, Billing, Support, etc). Values are matched exactly to the
 * "Nooria Back-Office Admin" mockup's module hero: 20px radius, 26px/30px
 * padding, three concentric decorative rings, and precise type scale.
 */
export function ModuleHero({ eyebrow, title, description, action }: ModuleHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[20px] bg-[#0d2315] px-[22px] py-[26px] shadow-[0_20px_44px_-30px_rgba(13,35,21,0.8)] md:px-[30px]">
      <div className="pointer-events-none absolute -right-[90px] -top-[150px] h-[380px] w-[380px] rounded-full border border-[rgba(95,214,180,0.12)]" />
      <div className="pointer-events-none absolute -right-5 -top-20 h-[240px] w-[240px] rounded-full border border-[rgba(95,214,180,0.08)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-[70px] h-[280px] w-[280px] rounded-full border border-white/5" />
      <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-7">
        <div className="min-w-0 md:max-w-[660px]">
          <div className="mb-[11px] flex items-center gap-[9px]">
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#5FD6B4]" />
            <span className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.15em] text-white/55">{eyebrow}</span>
          </div>
          <h1 className="text-pretty font-[var(--font-heading)] text-[25px] font-extrabold leading-[1.08] tracking-[-0.028em] text-white md:text-[29px]">
            {title}
          </h1>
          <p className="mt-[9px] max-w-3xl text-pretty text-[13.5px] leading-[1.55] text-white/62">{description}</p>
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
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]"
    >
      {children}
    </button>
  );
}
