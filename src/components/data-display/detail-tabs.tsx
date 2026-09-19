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
    <nav className="flex flex-wrap gap-1 border-b border-[var(--color-border-default)]" aria-label="Detail sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href as Route}
          className={[
            "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-[13px] leading-[1.2] transition-colors",
            tab.active
              ? "border-[var(--color-text-primary)] font-semibold text-[var(--color-text-primary)]"
              : "border-transparent font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          ].join(" ")}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge !== "" ? (
            <span
              className={[
                "inline-flex items-center justify-center rounded-full px-[7px] py-[1px] text-[10.5px] font-bold leading-[1.2]",
                tab.active ? "bg-[var(--color-accent-primary-dim)] text-[var(--color-accent-primary)]" : "bg-[var(--color-bg-overlay)] text-[#8C9A92]"
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
