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
    <nav className="flex flex-wrap gap-2 rounded-[2rem] border border-white/50 bg-white/85 p-2 shadow-panel" aria-label="Detail sections">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            tab.active ? "bg-ink text-white" : "bg-sand text-ink hover:bg-white"
          ].join(" ")}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
