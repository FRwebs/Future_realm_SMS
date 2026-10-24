"use client";

import dynamic from "next/dynamic";

import type { DrawerSpec } from "@/lib/modules/panels";

/**
 * The bespoke surfaces a tab can embed (see the `embed` panel). A component is named on the server, by a string, because a tab's
 * content is data; the name is looked up here.
 *
 * Each is its own piece of the page: a tab that embeds the lesson player does not make every other tab carry the lesson player, the
 * scheme workspace, the sheet and the composer. They still render on the server, so the page arrives whole.
 */
const registry: Record<string, React.ComponentType<never>> = {
  "scheme-workspace": dynamic(() => import("@/components/modules/lesson-notes/scheme-workspace").then((loaded) => loaded.SchemeWorkspace as React.ComponentType<never>)) as React.ComponentType<never>,
  "add-subject": dynamic(() => import("@/components/modules/lesson-notes/add-subject").then((loaded) => loaded.AddSubject as React.ComponentType<never>)) as React.ComponentType<never>,
  "subject-notes": dynamic(() => import("@/components/modules/lesson-notes/subject-notes").then((loaded) => loaded.SubjectNotes as React.ComponentType<never>)) as React.ComponentType<never>,
  "note-document": dynamic(() => import("@/components/modules/lesson-notes/note-document").then((loaded) => loaded.NoteDocument as React.ComponentType<never>)) as React.ComponentType<never>,
  "note-reader": dynamic(() => import("@/components/modules/lesson-notes/note-document").then((loaded) => loaded.NoteReader as React.ComponentType<never>)) as React.ComponentType<never>,
  "teacher-sheet": dynamic(() => import("@/components/modules/teacher-sheet").then((loaded) => loaded.TeacherSheet as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-working": dynamic(() => import("@/components/modules/subject-comment").then((loaded) => loaded.StudentWorking as React.ComponentType<never>)) as React.ComponentType<never>,
  "lesson-player": dynamic(() => import("@/components/modules/lesson-player").then((loaded) => loaded.LessonPlayer as React.ComponentType<never>)) as React.ComponentType<never>,
  "training-checkout": dynamic(() => import("@/components/modules/training-checkout").then((loaded) => loaded.TrainingCheckout as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-now": dynamic(() => import("@/components/portals/student/student-now").then((loaded) => loaded.StudentNow as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-week": dynamic(() => import("@/components/portals/student/student-week").then((loaded) => loaded.StudentWeek as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-subjects": dynamic(() => import("@/components/portals/student/student-subjects").then((loaded) => loaded.StudentSubjects as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-calendar": dynamic(() => import("@/components/portals/student/student-calendar").then((loaded) => loaded.StudentCalendar as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-inbox": dynamic(() => import("@/components/portals/student/student-inbox").then((loaded) => loaded.StudentInbox as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-prefs": dynamic(() => import("@/components/portals/student/student-prefs").then((loaded) => loaded.StudentPrefs as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-attendance": dynamic(() => import("@/components/portals/student/student-attendance").then((loaded) => loaded.StudentAttendance as React.ComponentType<never>)) as React.ComponentType<never>,
  "student-two-step": dynamic(() => import("@/components/portals/student/student-two-step").then((loaded) => loaded.StudentTwoStep as React.ComponentType<never>)) as React.ComponentType<never>,
  "message-composer": dynamic(() => import("@/components/modules/message-composer").then((loaded) => loaded.MessageComposer as React.ComponentType<never>)) as React.ComponentType<never>,
};

export function EmbeddedPanel({ component, props, openDrawer }: { component: string; props: Record<string, unknown>; openDrawer?: (spec: DrawerSpec) => void }) {
  const Component = registry[component] as React.ComponentType<Record<string, unknown>> | undefined;
  if (!Component) {
    return (
      <section className="surface-card border-dashed p-4 md:p-5">
        <p className="text-[12px] font-bold text-[var(--color-text-primary)]">This part of the page could not be drawn</p>
        <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">“{component}” is not a component this build knows.</p>
      </section>
    );
  }
  return <Component {...props} openDrawer={openDrawer} />;
}
