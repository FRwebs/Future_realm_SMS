import { AccessDenied } from "@/components/feedback/access-denied";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AnnouncementView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type CommunicationsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function tabHref(tab: string) {
  return tab === "compose" ? "/communications" : `/communications?tab=${tab}`;
}

const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: "In-app",
  SMS: "SMS",
  EMAIL: "Email",
  PUSH: "Push"
};

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/communications"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const announcements = await apiGet<AnnouncementView[]>("/api/v1/communications/announcements");
  const canManageCommunications = canManagePath(session.role, "/communications");

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "compose";

  const tabs = [
    { label: "Compose", href: tabHref("compose"), active: tab === "compose" },
    { label: "Delivery", href: tabHref("delivery"), active: tab === "delivery" },
    { label: "Templates", href: tabHref("templates"), active: tab === "templates" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Communications</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Communication & Notification Center</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Broadcast announcements by audience and channel, and track what has gone out across the school community.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "compose" ? (
        <ComposeTab announcements={announcements} canManageCommunications={canManageCommunications} />
      ) : null}
      {tab === "delivery" ? <DeliveryTab announcements={announcements} /> : null}
      {tab === "templates" ? <TemplatesTab announcements={announcements} /> : null}
    </div>
  );
}

function ComposeTab({
  announcements,
  canManageCommunications
}: {
  announcements: AnnouncementView[];
  canManageCommunications: boolean;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      {canManageCommunications ? (
        <ResourceForm
          title="Broadcast communication"
          description="Send announcements by audience and delivery channel for reminders, events, and operational notices."
          endpoint="/api/v1/communications/announcements"
          submitLabel="Publish announcement"
          fields={[
            { name: "title", label: "Title", required: true, placeholder: "Fee deadline reminder" },
            {
              name: "audience",
              label: "Audience",
              required: true,
              placeholder: "Parents, JSS 2, School-wide"
            },
            {
              name: "channel",
              label: "Channel",
              type: "select",
              options: [
                { label: "In-app", value: "IN_APP" },
                { label: "SMS", value: "SMS" },
                { label: "Email", value: "EMAIL" },
                { label: "Push", value: "PUSH" }
              ]
            },
            {
              name: "body",
              label: "Announcement body",
              type: "textarea",
              required: true,
              placeholder: "Fee balances should be cleared before Friday..."
            }
          ]}
        />
      ) : (
        <section className="surface-card p-6">
          <p className="section-eyebrow">Read-only</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">You can view but not publish</h2>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Your role does not have permission to broadcast new announcements. The feed on the right shows everything already sent.
          </p>
        </section>
      )}
      <TableCard
        title="Announcement feed"
        description="Published messages, channels, and audience segments across the school community."
        items={announcements}
        columns={[
          {
            key: "title",
            header: "Announcement",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.body}</p>
              </div>
            )
          },
          { key: "audience", header: "Audience", render: (item) => item.audience },
          { key: "channel", header: "Channel", render: (item) => CHANNEL_LABELS[item.channel] ?? item.channel },
          { key: "publishedAt", header: "Published", render: (item) => formatDate(item.publishedAt) }
        ]}
      />
    </div>
  );
}

function DeliveryTab({ announcements }: { announcements: AnnouncementView[] }) {
  const byChannel = new Map<string, AnnouncementView[]>();
  for (const item of announcements) {
    byChannel.set(item.channel, [...(byChannel.get(item.channel) ?? []), item]);
  }
  const channelRows = Array.from(byChannel.entries()).sort((a, b) => b[1].length - a[1].length);
  const last30 = announcements.filter((item) => {
    const days = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    return Number.isFinite(days) && days <= 30;
  });

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Total sent</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{announcements.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Sent in last 30 days</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{last30.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Channels in use</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{byChannel.size}</p>
        </article>
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">Channel mix</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Where messages are going out</h2>
        <div className="mt-4 grid gap-3">
          {channelRows.map(([channel, items]) => {
            const pct = announcements.length ? Math.round((items.length / announcements.length) * 100) : 0;
            return (
              <div key={channel} className="grid gap-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-[var(--color-text-primary)]">{CHANNEL_LABELS[channel] ?? channel}</span>
                  <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">{items.length} · {pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {channelRows.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-secondary)]">No announcements have been sent yet.</p>
          ) : null}
        </div>
      </section>

      <TableCard
        title="Delivery log"
        description="Every announcement published, with the channel and audience it went out to."
        items={announcements}
        emptyState="No announcements have been published yet."
        columns={[
          {
            key: "title",
            header: "Announcement",
            render: (item) => <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
          },
          { key: "channel", header: "Channel", render: (item) => CHANNEL_LABELS[item.channel] ?? item.channel },
          { key: "audience", header: "Audience", render: (item) => item.audience },
          { key: "publishedAt", header: "Published", render: (item) => formatDate(item.publishedAt) }
        ]}
      />
    </div>
  );
}

function TemplatesTab({ announcements }: { announcements: AnnouncementView[] }) {
  const recent = [...announcements]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 6);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">No template library yet</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Reuse a past message as a starting point</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          There is no saved-template feature yet — copy the wording from a recent announcement below into the Compose tab
          instead of writing from scratch.
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {recent.map((item) => (
          <article key={item.id} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {CHANNEL_LABELS[item.channel] ?? item.channel} · {item.audience}
            </p>
            <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{item.title}</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{item.body}</p>
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{formatDate(item.publishedAt)}</p>
          </article>
        ))}
        {recent.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-secondary)]">No past announcements to reuse yet.</p>
        ) : null}
      </div>
    </div>
  );
}
