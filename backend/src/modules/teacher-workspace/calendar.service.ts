import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { DAY_MS, addDays, dayOf, iso, isSchoolDay, loadPolicy, schoolDaysBetween, today } from "../attendance-management/attendance.shared";
import { liveFramework, loadBands, type SectionName } from "../score-results/scores.shared";
import { TeacherWorkspaceService } from "./workspace.service";

export type CalendarKind = "Assessment" | "Closed" | "Event" | "Deadline" | "Attention";


/**
 * The school's calendar as one teacher meets it: set once by the school, read-only to every staff role, with each date said in terms of
 * what it means for their own work. Every deadline a teacher has is driven by these dates, so nothing here is typed for them.
 */
@Injectable()
export class TeacherCalendarService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  async calendar(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no calendar to read.");
    const schoolId = session.schoolId;
    const now = new Date();
    const date = today(now);
    const term = await prisma.term.findUniqueOrThrow({ where: { id: me.term.id } });
    const early = me.persona === "early-years";

    const [termsInSession, windows, events, policy, bands, sheetCount] = await Promise.all([
      prisma.term.count({ where: { schoolId, academicSessionId: term.academicSessionId } }),
      prisma.assessmentWindow.findMany({ where: { schoolId, termId: term.id }, include: { component: { select: { name: true } } }, orderBy: { opensAt: "asc" } }),
      prisma.calendarEvent.findMany({ where: { schoolId, endsAt: { gte: dayOf(term.startDate) }, startsAt: { lte: addDays(dayOf(term.endDate), 1) }, OR: [{ visibleTo: { has: "Staff" } }, { visibleTo: { isEmpty: true } }] }, orderBy: { startsAt: "asc" } }),
      loadPolicy(schoolId),
      loadBands(schoolId),
      prisma.classSubject.count({ where: { schoolId, isActive: true, teacherId: session.userId } })
    ]);

    const start = dayOf(term.startDate);
    const end = dayOf(term.endDate);
    const soFar = schoolDaysBetween(term, start, date < end ? date : end).length;
    const upcoming = (when: Date) => Math.ceil((when.getTime() - now.getTime()) / DAY_MS);

    /* the dates, each with what it means for this person */
    const dates: Array<{ from: string; to: string | null; what: string; kind: CalendarKind; means: string; days: number }> = [];
    const add = (from: Date, to: Date | null, what: string, kind: CalendarKind, means: string) => dates.push({ from: iso(from), to: to ? iso(to) : null, what, kind, means, days: upcoming(from) });

    const byWindow = new Map<string, typeof windows>();
    for (const window of windows) {
      const key = `${iso(window.opensAt)}|${iso(window.closesAt)}`;
      byWindow.set(key, [...(byWindow.get(key) ?? []), window]);
    }
    for (const [, group] of byWindow) {
      const first = group[0]!;
      const names = [...new Set(group.map((entry) => entry.component.name))];
      add(dayOf(first.opensAt), dayOf(first.closesAt), early ? "Observation window" : `${names.slice(0, 2).join(" and ")}${names.length > 2 ? " and more" : ""} score window`, "Assessment",
        early ? "Every child observed in every area this half-term" : sheetCount ? `Your ${sheetCount} sheet${sheetCount === 1 ? "" : "s"} must be submitted inside it` : "No sheets of yours");
    }
    const release = windows.length ? windows.reduce((latest, entry) => (entry.releaseAt > latest ? entry.releaseAt : latest), windows[0]!.releaseAt) : null;
    if (release) add(dayOf(release), null, "Report cards published", "Deadline", "The Principal publishes · nothing is editable after");
    if (term.breakStart && term.breakEnd) {
      const days = Math.round((dayOf(term.breakEnd).getTime() - dayOf(term.breakStart).getTime()) / DAY_MS) + 1;
      add(dayOf(term.breakStart), dayOf(term.breakEnd), "Mid-term break", "Closed", `No registers are expected for ${days} day${days === 1 ? "" : "s"}`);
      add(addDays(dayOf(term.breakEnd), 1), null, "School reopens", "Event", `Registers resume · cutoff ${policy.markCutoff}`);
    }
    add(end, null, "Term ends", "Event", "Nothing may be entered after the windows close");
    for (const event of events) {
      const kind: CalendarKind = event.schoolClosed || event.type === "Holiday" ? "Closed" : event.type === "Examination" ? "Assessment" : event.type === "Deadline" ? "Deadline" : "Event";
      add(dayOf(event.startsAt), dayOf(event.endsAt) > dayOf(event.startsAt) ? dayOf(event.endsAt) : null, event.title, kind, event.schoolClosed ? "The school is closed — no registers are expected" : event.description ?? event.location ?? "On the school calendar");
    }
    dates.sort((a, b) => a.from.localeCompare(b.from));

    /* the window that is open, or the next to open */
    const openWindow = dates.find((entry) => entry.kind === "Assessment" && entry.to && new Date(entry.to) >= date);
    const closed = new Set<string>();
    if (term.breakStart && term.breakEnd) for (let day = dayOf(term.breakStart); day <= dayOf(term.breakEnd); day = addDays(day, 1)) if (day >= date) closed.add(iso(day));
    for (const event of events.filter((entry) => entry.schoolClosed)) for (let day = dayOf(event.startsAt); day <= dayOf(event.endsAt); day = addDays(day, 1)) if (day >= date && day <= end) closed.add(iso(day));
    const nextClosed = dates.find((entry) => entry.kind === "Closed" && (entry.to ?? entry.from) >= iso(date));

    return {
      term: { name: term.name, order: term.order, of: termsInSession, startsOn: iso(start), endsOn: iso(end), week: me.term.week, weeks: me.term.weeks, schoolDaysSoFar: soFar, session: me.term.session },
      window: openWindow ? { label: openWindow.what, closes: openWindow.to!, daysLeft: Math.max(0, upcoming(new Date(openWindow.to!))), opens: openWindow.from } : null,
      release: release ? { date: iso(dayOf(release)), daysAway: upcoming(release) } : null,
      closedAhead: { days: closed.size, label: nextClosed ? nextClosed.what : null, from: nextClosed?.from ?? null, to: nextClosed?.to ?? null },
      dates, early,
      rules: {
        cutoff: policy.markCutoff,
        components: (await liveFramework(schoolId, term.id, await this.sectionOf(me))).map((column) => ({ name: column.name, max: column.max })),
        bandRange: bands.bands.length ? { top: bands.bands[0]!.label, bottom: bands.bands[bands.bands.length - 1]!.label, scheme: bands.scheme } : null,
        schoolDays: isSchoolDay(term, date)
      }
    };
  }

  /** The school section of the first arm this person answers for or teaches — assessment components are set by section. */
  private async sectionOf(me: Awaited<ReturnType<TeacherWorkspaceService["me"]>>) {
    const classId = me.formArms[0]?.id ?? me.teaching[0]?.classId;
    if (!classId) return null;
    const room = await prisma.classRoom.findUnique({ where: { id: classId }, select: { classLevel: { select: { schoolSection: true } } } });
    return (room?.classLevel.schoolSection ?? null) as SectionName | null;
  }

  /** The same dates as a file a phone's calendar can take — all-day entries, each with what it means for the reader. */
  async ics(session: SessionPayload) {
    const view = await this.calendar(session);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const day = (value: string) => value.replace(/-/g, "");
    const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FutureRealm//Teacher calendar//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escape(`${view.term.name} ${view.term.session}`)}`];
    view.dates.forEach((entry, index) => {
      const last = new Date(`${entry.to ?? entry.from}T00:00:00Z`);
      last.setUTCDate(last.getUTCDate() + 1);
      lines.push("BEGIN:VEVENT", `UID:${index}-${day(entry.from)}@futurerealm`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(entry.from)}`, `DTEND;VALUE=DATE:${day(iso(last))}`, `SUMMARY:${escape(entry.what)}`, `DESCRIPTION:${escape(entry.means)}`, "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
}
