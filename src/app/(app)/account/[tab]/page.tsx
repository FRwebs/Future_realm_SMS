import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleHero } from "@/components/data-display/module-hero";
import { PanelRows } from "@/components/modules/panel-renderer";
import { TabBar } from "@/components/modules/tab-bar";
import { accountContent, accountTabs } from "@/lib/modules/account";
import { getServerSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ tab: string }> };

export async function generateStaticParams() {
  return accountTabs.map((tab) => ({ tab: tab.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tab: tabSlug } = await params;
  const tab = accountTabs.find((entry) => entry.slug === tabSlug);
  return tab ? { title: `My account · ${tab.label}` } : {};
}

export default async function AccountTabPage({ params }: PageProps) {
  const { tab: tabSlug } = await params;

  const tab = accountTabs.find((entry) => entry.slug === tabSlug);
  if (!tab) notFound();

  const session = await getServerSession();
  if (!session) return null;

  const content = accountContent[tab.slug];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="My account"
        title={content?.title ?? tab.label}
        description={content?.desc ?? ""}
      />

      <TabBar
        ariaLabel="Account tabs"
        items={accountTabs.map((entry) => ({ href: `/account/${entry.slug}`, label: entry.label }))}
      />

      {content ? <PanelRows rows={content.rows} /> : null}
    </div>
  );
}
