import type { StudentContent } from "@/lib/modules/live/student/shared";
import { assignmentsPage, resultsPage, subjectsPage, timetablePage } from "@/lib/modules/live/student/learning";
import { accountPage, notificationsPage, profilePage } from "@/lib/modules/live/student/me";
import { attendancePage, calendarPage, messagesPage } from "@/lib/modules/live/student/school";
import { todayPage } from "@/lib/modules/live/student/today";

type Builder = (query: Record<string, string | undefined>) => Promise<StudentContent>;

const pages: Record<string, Builder> = {
  today: () => todayPage(),
  timetable: (query) => timetablePage(query),
  subjects: () => subjectsPage(),
  assignments: (query) => assignmentsPage(query),
  results: (query) => resultsPage(query),
  attendance: () => attendancePage(),
  calendar: (query) => calendarPage(query),
  messages: (query) => messagesPage(query),
  profile: () => profilePage(),
  notifications: () => notificationsPage(),
  account: () => accountPage(),
};

export const studentPageSlugs = () => Object.keys(pages);
export const buildStudentPage = (page: string, query: Record<string, string | undefined>) => pages[page]?.(query);
