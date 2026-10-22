"use client";

import type { DrawerSpec } from "@/lib/modules/panels";
import { AddSubject } from "@/components/modules/lesson-notes/add-subject";
import { TrainingCheckout } from "@/components/modules/training-checkout";
import { LessonPlayer } from "@/components/modules/lesson-player";
import { NoteDocument, NoteReader } from "@/components/modules/lesson-notes/note-document";
import { SchemeWorkspace } from "@/components/modules/lesson-notes/scheme-workspace";
import { StudentWorking } from "@/components/modules/subject-comment";
import { TeacherSheet } from "@/components/modules/teacher-sheet";
import { SubjectNotes } from "@/components/modules/lesson-notes/subject-notes";

/**
 * The bespoke surfaces a tab can embed (see the `embed` panel). A component is named on the server, by a string, because a tab's
 * content is data; the name is looked up here.
 */
const registry: Record<string, React.ComponentType<never>> = {
  "scheme-workspace": SchemeWorkspace as React.ComponentType<never>,
  "add-subject": AddSubject as React.ComponentType<never>,
  "subject-notes": SubjectNotes as React.ComponentType<never>,
  "note-document": NoteDocument as React.ComponentType<never>,
  "note-reader": NoteReader as React.ComponentType<never>,
  "teacher-sheet": TeacherSheet as React.ComponentType<never>,
  "student-working": StudentWorking as React.ComponentType<never>,
  "lesson-player": LessonPlayer as React.ComponentType<never>,
  "training-checkout": TrainingCheckout as React.ComponentType<never>,
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
