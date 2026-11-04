import { accountPage } from "@/lib/modules/live/parent/account";
import { attendancePage } from "@/lib/modules/live/parent/attendance";
import { calendarPage } from "@/lib/modules/live/parent/calendar";
import { consentsPage } from "@/lib/modules/live/parent/consents";
import { feesPage } from "@/lib/modules/live/parent/fees";
import { prefsPage } from "@/lib/modules/live/parent/prefs";
import { profilePage } from "@/lib/modules/live/parent/profile";
import { learningPage } from "@/lib/modules/live/parent/learning";
import { meetingsPage } from "@/lib/modules/live/parent/meetings";
import { messagesPage } from "@/lib/modules/live/parent/messages";
import { overviewPage } from "@/lib/modules/live/parent/overview";
import { syncPage } from "@/lib/modules/live/parent/sync";
import { requestsPage } from "@/lib/modules/live/parent/requests";
import { resultsPage } from "@/lib/modules/live/parent/results";
import type { ParentContent } from "@/lib/modules/live/parent/shared";
import { parentPages } from "@/lib/modules/parent-workspace";

/**
 * Which builder answers which page.
 *
 * A page with no builder yet is not a 404 — the rail offers it, so it has to
 * say something. `buildParentPage` returns undefined for those and the view
 * renders an honest "not built yet" rather than a broken page or a page of
 * invented data.
 */
const BUILDERS: Partial<Record<string, (child: string, query: Record<string, string | undefined>) => Promise<ParentContent>>> = {
  overview: (child) => overviewPage(child),
  attendance: (child, query) => attendancePage(child, query),
  fees: (child, query) => feesPage(child, query),
  learning: (child, query) => learningPage(child, query),
  results: (child, query) => resultsPage(child, query),
  consents: (child, query) => consentsPage(child, query),
  messages: (child, query) => messagesPage(child, query),
  calendar: (child, query) => calendarPage(child, query),
  sync: () => syncPage(),
  meetings: (child) => meetingsPage(child),
  requests: (child, query) => requestsPage(child, query),
  profile: (child, query) => profilePage(child, query),
  account: (_child, query) => accountPage(query),
  prefs: () => prefsPage(),
};

export const parentPageSlugs = (): string[] => parentPages.map((page) => page.slug);

export function buildParentPage(page: string, child: string, query: Record<string, string | undefined>) {
  const builder = BUILDERS[page];
  return builder ? builder(child, query) : undefined;
}

/** Which Back Office module switches a parent page off. */
export const PAGE_MODULE: Record<string, string> = {
  attendance: "attendance",
  results: "score-entry-results",
  learning: "class-timetable",
  fees: "fee-management",
  messages: "communication-center",
  consents: "parents-guardians",
  requests: "parents-guardians",
  meetings: "parents-guardians",
};
