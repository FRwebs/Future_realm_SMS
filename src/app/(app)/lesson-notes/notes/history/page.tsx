import type { Metadata } from "next";

import { NotesHistoryView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Note history", description: "Every subject you have written notes for in earlier terms." };

export default function NotesHistoryPage() {
  return <NotesHistoryView />;
}
