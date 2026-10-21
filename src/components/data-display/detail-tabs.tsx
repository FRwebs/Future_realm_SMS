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
    <nav className="mb-2 flex items-center gap-1 overflow-x-auto border-b border-[#DEE8E2]" aria-label="Detail sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href as Route}
          className={[
            "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-[13px] leading-[normal] transition-colors",
            tab.active
              ? "border-[#0D2315] font-semibold text-[#0D2315]"
              : "border-transparent font-medium text-[#77857C] hover:border-[#BFDCD1] hover:text-[#12796A]"
          ].join(" ")}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge !== "" ? (
            <span
              className={[
                "rounded-full px-[7px] py-[1px] text-[10.5px] font-bold",
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
