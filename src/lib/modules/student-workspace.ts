import type { TeacherRail } from "@/lib/navigation/workflows";

/**
 * A student's own workspace: eleven pages in three sections, the order a school day reads in. It is not driven by role permissions —
 * everything in it is the student's own record — and nothing a student cannot use (fees, staff tools) is in the rail.
 */
export const studentPages = [
  { slug: "today", label: "Today", icon: "M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" },
  { slug: "timetable", label: "Timetable", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  { slug: "subjects", label: "Subjects", icon: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" },
  { slug: "assignments", label: "Assignments", icon: "M8.5 3.5h7v3h-7zM6.5 5H5v15.5h14V5h-1.5M8.5 11.5h7M8.5 15.5h4.5" },
  { slug: "results", label: "Results", icon: "M5 20V11M12 20V5M19 20v-6M3 20h18" },
  { slug: "attendance", label: "Attendance", icon: "M4 5.5h16V20H4zM8 3.5v4M16 3.5v4M4 10h16M8.8 14.6l2 2 4.2-4.2" },
  { slug: "calendar", label: "Calendar", icon: "M4 5.5h16V20H4zM8 3.5v4M16 3.5v4M4 10h16M8 14h2M12 14h2M16 14h.5M8 17h2M12 17h2" },
  { slug: "messages", label: "Messages", icon: "M3.5 6h17v12h-17zM4 7l8 6 8-6" },
  { slug: "profile", label: "My profile", icon: "M3.5 5.5h17v13h-17zM8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.8 16c.5-1.5 1.5-2.2 2.7-2.2s2.2.7 2.7 2.2M14 10h4M14 13.5h3" },
  { slug: "notifications", label: "Notifications", icon: "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5zM10 18.5a2 2 0 0 0 4 0" },
  { slug: "account", label: "Account and security", icon: "M4.5 10.5h15V20h-15zM8 10.5V7.5a4 4 0 0 1 8 0v3M12 14v2.5" },
] as const;

export type StudentPageSlug = (typeof studentPages)[number]["slug"];

export const studentHref = (slug: string) => (slug === "today" ? "/portals/student" : `/portals/student/${slug}`);

const section = (title: string, slugs: StudentPageSlug[]) => ({
  title,
  items: slugs.map((slug) => {
    const page = studentPages.find((entry) => entry.slug === slug)!;
    return { id: `s_${slug}`, href: studentHref(slug), label: page.label, iconPath: page.icon };
  }),
});

/** The school module each page is read from; a page whose module is switched off for the school is left out of the rail. */
const PAGE_MODULE: Record<string, string> = { timetable: "class-timetable", subjects: "class-timetable", attendance: "attendance", results: "report-cards", messages: "communication-center" };

export function studentNavigation(switchedOff: string[] = [], hidden: string[] = []): TeacherRail {
  const off = new Set(switchedOff);
  const left = new Set(hidden);
  const keep = (slugs: StudentPageSlug[]) => slugs.filter((slug) => !off.has(PAGE_MODULE[slug] ?? "") && !left.has(slug));
  const groups = off.has("student-portal")
    ? [section("", ["today"])]
    : [
        section("", ["today"]),
        section("My learning", keep(["timetable", "subjects", "assignments", "results"])),
        section("My school", keep(["attendance", "calendar", "messages"])),
        section("Me", ["profile", "notifications", "account"]),
      ];
  return { items: [], extra: [], groups: groups.filter((group) => group.items.length || !group.title) };
}
