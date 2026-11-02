import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { row } from "@/lib/modules/panels";
import { PW } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";
import type { InboxMessage } from "@/components/portals/parent/parent-inbox";

type Inbox = { school: string; you: string; unread: number; items: Array<Omit<InboxMessage, never> & { category: InboxMessage["category"] }> };

const TABS = ["All", "Unread", "Academic", "Financial", "Events", "Safety"];

export async function messagesPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const data = await apiGet(`${PW}/messages?child=${encodeURIComponent(child)}`, observe<Inbox>(localContracts["src/lib/modules/live/parent/messages.ts#bf70de73"]));
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const shown = data.items.filter((item) => (tab === "All" ? true : tab === "Unread" ? !item.read : item.category === tab));
  const one = child === "all" ? null : data.items.flatMap((item) => item.children).find((entry) => entry.id === child) ?? null;
  return {
    eyebrow: one ? one.first : "Whole family", title: "Messages",
    tabs: TABS.map((label) => ({ label, ...(label === "Unread" && data.unread ? { count: data.unread } : {}) })), tab,
    desc: "Every message from your school, in full.",
    rows: [row("1fr", [{
      type: "embed", component: "parent-inbox",
      props: {
        school: data.school, you: data.you, messages: shown, showChildren: child === "all",
        empty: tab === "Unread" ? "You have read everything." : "No messages here.",
      },
    }])],
  };
}
