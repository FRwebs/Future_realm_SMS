import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleHero } from "@/components/data-display/module-hero";
import { PanelRows } from "@/components/modules/panel-renderer";
import { TabBar } from "@/components/modules/tab-bar";
import { accountContentFor, accountTabs, type MyProfile } from "@/lib/modules/account";
import { getServerSession } from "@/lib/auth/session";
import { apiGet } from "@/lib/api/server";
import type { SchoolContextView } from "@/lib/domain/types";

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

  // The page is about the person, so it is written against them and the school
  // they are signed in to — never a fixed name.
  const schoolContext = await apiGet<SchoolContextView>("/api/v1/dashboard/context").catch(
    () => null,
  );
  const schoolName = schoolContext?.schoolName ?? "your school";

  // What is actually on file, so a field that has a value shows it and one that
  // does not says so — rather than the page assuming either way.
  const profile = await apiGet<MyProfile>("/api/v1/profile/me").catch(() => ({}) as MyProfile);

  const content = accountContentFor(session, schoolName, profile)[tab.slug];

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
