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
    <nav className="flex flex-wrap gap-1.5 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1.5 shadow-[var(--shadow-sm)]" aria-label="Detail sections">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className={[
            "inline-flex min-h-10 items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition",
            tab.active
              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_10px_22px_var(--color-accent-primary-glow)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]"
          ].join(" ")}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge !== "" ? (
            <span
              className={[
                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
                tab.active ? "bg-white/20 text-[var(--color-text-inverse)]" : "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
              ].join(" ")}
            >
              {tab.badge}
            </span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}
