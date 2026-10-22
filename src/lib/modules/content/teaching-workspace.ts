import type { ModuleContent, TabContent } from "@/lib/modules/panels";

/**
 * The teaching workspace's three modules — Lesson Notes, My Employment, Training — and Staff & Access's Learning tab are read from
 * the school's own records for whoever is signed in. They have no written example figures: a teacher must never be shown another
 * school's example as if it were their own. If one of these pages is ever drawn from here, it is because the live page could not be
 * reached, and it says so.
 */
export const unreachable = (title: string, desc: string, what: string): TabContent => ({
  title,
  desc,
  rows: [
    {
      cols: "1fr",
      panels: [
        {
          type: "note",
          tone: "attention",
          title: "This page could not be loaded",
          body: `${what} is read from your school’s own records, and there are no example figures to show instead. Try again, and if it keeps failing, raise it in Sync & Support.`,
        },
      ],
    },
  ],
});

export const lessonNotesContent: ModuleContent = {
  curriculum: unreachable("Curriculum", "Your scheme of work, subject by subject.", "Your scheme of work"),
  notes: unreachable("Notes", "A note for every week you teach.", "Your lesson notes"),
  review: unreachable("Review", "Notes waiting to be signed.", "The notes in your scope"),
  coverage: unreachable("Coverage", "What was due against what was taught.", "Coverage"),
};

export const myEmploymentContent: ModuleContent = {
  leave: unreachable("Leave", "Your balance, your requests, and where each one is.", "Your leave"),
  "my-assignments": unreachable("My assignments", "What you hold, and the cover you hold for others.", "Your assignments"),
  appraisal: unreachable("Appraisal", "This cycle, and what it is measured on.", "Your appraisal"),
  payslips: unreachable("Payslips", "What you were paid, and the documents on your record.", "Your payslips"),
};

export const trainingContent: ModuleContent = {
  "for-you": unreachable("Training", "Courses that fit the work you already do.", "Your courses"),
  catalogue: unreachable("Catalogue", "Every course open to you.", "The catalogue"),
  certificates: unreachable("Certificates", "Everything you have earned.", "Your certificates"),
};

export const learningContent: TabContent = unreachable("Learning", "The courses your staff take, and what came of them.", "Your school’s courses");
