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
    <nav className="flex flex-wrap gap-2 rounded-[2rem] border border-white/60 bg-white/88 p-2 shadow-panel backdrop-blur" aria-label="Detail sections">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            tab.active
              ? "bg-gradient-to-r from-brand-700 via-emerald-500 to-brand-800 text-white shadow-[0_14px_30px_rgba(37,89,63,0.18)]"
              : "bg-sand text-ink hover:bg-white hover:text-brand-800"
          ].join(" ")}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
