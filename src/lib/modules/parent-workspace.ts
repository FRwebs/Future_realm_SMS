import type { TeacherRail } from "@/lib/navigation/workflows";

/**
 * A parent's own workspace: thirteen pages in six groups, in the order a parent
 * reads them — their children first, then what the school is telling them, then
 * money, then anything they owe the school an answer to.
 *
 * It is not driven by role permissions. Everything in it is this family's own
 * record. What it *is* driven by is the school's guardian-visibility policy: a
 * school that keeps results or fees back from parents has those pages removed
 * from the rail, not left in to fail.
 */
export const parentPages = [
  { slug: "overview", label: "Overview", icon: "M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" },
  { slug: "profile", label: "Child profiles", icon: "M3.5 5.5h17v13h-17zM8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.8 16c.5-1.5 1.5-2.2 2.7-2.2s2.2.7 2.7 2.2M14 10h4M14 13.5h3" },
  { slug: "attendance", label: "Attendance", icon: "M4 5.5h16V20H4zM8 3.5v4M16 3.5v4M4 10h16M8.8 14.6l2 2 4.2-4.2" },
  { slug: "learning", label: "Timetable and lessons", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  { slug: "results", label: "Results and reports", icon: "M5 20V11M12 20V5M19 20v-6M3 20h18" },
  { slug: "messages", label: "Messages", icon: "M3.5 6h17v12h-17zM4 7l8 6 8-6" },
  { slug: "calendar", label: "Calendar", icon: "M4 5.5h16V20H4zM8 3.5v4M16 3.5v4M4 10h16M8 14h2M12 14h2M16 14h.5M8 17h2M12 17h2" },
  { slug: "meetings", label: "Meetings", icon: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.4c1.9.7 3 2.6 3 5.6" },
  { slug: "fees", label: "Fees and payments", icon: "M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v4M18 10v4" },
  { slug: "consents", label: "Forms and consents", icon: "M12 3.2 19 6v6c0 4-3 7.4-7 8.3-4-.9-7-4.3-7-8.3V6zM9.3 12l2 2 3.4-3.7" },
  { slug: "requests", label: "Requests", icon: "M8.5 3.5h7v3h-7zM6.5 5H5v15.5h14V5h-1.5M8.5 11.5h7M8.5 15.5h4.5" },
  { slug: "prefs", label: "Notifications", icon: "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5zM10 18.5a2 2 0 0 0 4 0" },
  { slug: "account", label: "Account and security", icon: "M4.5 10.5h15V20h-15zM8 10.5V7.5a4 4 0 0 1 8 0v3M12 14v2.5" },
  // The phone's own page: the mobile mockup has it, the desktop one does not, so it is in the phone's More sheet and never in the rail.
  { slug: "sync", label: "Sync and this phone", icon: "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3M19.7 19.5v-4.3h-4.3" },
] as const;

export type ParentPageSlug = (typeof parentPages)[number]["slug"];

/** Pages that read one child at a time, and so carry the switcher's choice in their address. */
export const childScopedPages: ParentPageSlug[] = ["profile", "attendance", "learning", "results", "consents"];

/** Pages the switcher is hidden on, because they are about the parent rather than a child. */
export const familyOnlyPages: ParentPageSlug[] = ["prefs", "account", "sync"];

export const parentHref = (slug: string, child?: string) => {
  const base = slug === "overview" ? "/portals/parent" : `/portals/parent/${slug}`;
  return child && child !== "all" && !familyOnlyPages.includes(slug as ParentPageSlug) ? `${base}?child=${child}` : base;
};

/** What a school's visibility policy hides maps onto whole pages of this rail. */
const NEEDS_POLICY: Partial<Record<ParentPageSlug, string>> = {
  results: "Results",
  attendance: "Attendance",
  fees: "Fees",
  learning: "Timetable",
};

/** The pages a school's visibility policy leaves standing — the rail and the phone's bar share this. */
export const visibleParentPages = (sees: string[]): string[] =>
  parentPages.filter((page) => { const needed = NEEDS_POLICY[page.slug]; return !needed || sees.includes(needed); }).map((page) => page.slug);

const section = (title: string, slugs: ParentPageSlug[], sees: string[], child: string | undefined, firstName: string | undefined) => ({
  title,
  items: slugs
    .filter((slug) => { const needed = NEEDS_POLICY[slug]; return !needed || sees.includes(needed); })
    .map((slug) => {
      const page = parentPages.find((entry) => entry.slug === slug)!;
      // The profile page is named after whoever is selected, as the mockup does —
      // "Chioma's profile" reads as this child's record rather than a list.
      const label = slug === "profile" && firstName ? `${firstName}’s profile` : page.label;
      return { id: `p_${slug}`, href: parentHref(slug, child), label, iconPath: page.icon };
    }),
});

export function parentNavigation(sees: string[], child?: string, firstName?: string): TeacherRail {
  return {
    items: [],
    extra: [],
    groups: [
      section("", ["overview"], sees, child, firstName),
      section("Your children", ["profile", "attendance", "learning", "results"], sees, child, firstName),
      section("School updates", ["messages", "calendar", "meetings"], sees, child, firstName),
      section("Payments", ["fees"], sees, child, firstName),
      section("Forms and requests", ["consents", "requests"], sees, child, firstName),
      section("Settings", ["prefs", "account"], sees, child, firstName),
    ].filter((group) => group.items.length),
  };
}
