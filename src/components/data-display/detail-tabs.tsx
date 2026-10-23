import type { Route } from "next";
import Link from "next/link";

interface DetailTab {
  label: string;
  href: string;
  active?: boolean;
  badge?: number | string;
}

interface DetailTabsProps {
  tabs: DetailTab[];
}

export function DetailTabs({ tabs }: DetailTabsProps) {
  return (
    <nav className="mb-[6px] flex items-center gap-[3.5px] overflow-x-auto border-b border-[#DEE8E2]" aria-label="Detail sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href as Route}
          className={[
            "-mb-px inline-flex flex-none items-center gap-[7px] whitespace-nowrap border-b-2 px-[12.5px] py-[11px] text-[11.5px] leading-[normal] transition-[color,border-color] duration-150",
            tab.active
              ? "border-[#0D2315] font-semibold text-[#0D2315]"
              : "border-transparent font-medium text-[#77857C] hover:border-[#BFDCD1] hover:text-[#12796A]"
          ].join(" ")}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge !== "" ? (
            <span
              className={[
                "rounded-full px-[6.5px] py-px text-[9.5px] font-bold",
                tab.active ? "bg-[#E4F1EC] text-[#12796A]" : "bg-[#F0F5F2] text-[#8C9A92]"
              ].join(" ")}
            >
              {tab.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
