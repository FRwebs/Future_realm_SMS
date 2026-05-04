interface DetailTab {
  label: string;
  href: string;
  active?: boolean;
}

interface DetailTabsProps {
  tabs: DetailTab[];
}

export function DetailTabs({ tabs }: DetailTabsProps) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-[2rem] border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-bg-surface)_92%,transparent)] p-2 shadow-panel backdrop-blur" aria-label="Detail sections">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            tab.active
              ? "bg-[linear-gradient(90deg,var(--color-accent-primary),var(--color-bg-surface))] text-[var(--color-text-inverse)] shadow-[0_14px_30px_var(--color-accent-primary-glow)]"
              : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          ].join(" ")}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
