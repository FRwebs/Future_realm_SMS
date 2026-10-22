/** What `/api/v1/sync` and `/api/v1/support` answer with — the shapes the Sync & Support tabs read. */

export type SyncConflict = { id: string; kind: string; record: string; school: { summary: string; by: string; at: string | null }; device: { summary: string; by: string; at: string | null }; differing: number; deviceLabel: string | null };

export type SyncOverview = {
  pending: number;
  oldestMinutes: number | null;
  devices: number;
  synced: number;
  lastSyncedAt: string | null;
  lastWriteAt: string | null;
  lastWriteMineAt: string | null;
  queue: Array<{ type: string; count: number; oldestMinutes: number; who: string; role: string | null; refused: boolean; message: string | null }>;
  conflicts: SyncConflict[];
};

export type TicketMessage = { id: string; body: string; author: string; authorRole: string | null; createdAt: string };

export type Ticket = {
  id: string;
  ticketNo: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  open: boolean;
  waitingOnSchool: boolean;
  slaDueAt: string | null;
  slaBreached: boolean;
  assignedTo: string | null;
  raisedBy: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  ageDays: number;
  resolvedAt: string | null;
  createdAt: string;
  messages: TicketMessage[];
};

export type Article = { id: string; title: string; category: string; roleTarget: string | null; video: boolean; views: number; helpful: number; unhelpful: number; forMe: boolean; summary: string; body: string; slug: string };

export type SupportOverview = {
  status: { ok: boolean; checkedAt: string; databaseMs: number; uptimeMinutes: number };
  articles: Article[];
  satisfaction: { average: number | null; responses: number };
  contact?: { platformName: string; email: string; phone: string };
  accountManager?: { state: "assigned" | "unassigned" | "not-in-plan"; name: string | null; email: string | null; phone: string | null; why?: string };
  tickets: { tickets: Ticket[]; open: number; waitingOnSchool: number; breached: number; resolved: number };
  responseTarget: string;
};
