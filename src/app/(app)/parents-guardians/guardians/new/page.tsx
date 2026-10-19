import type { Metadata } from "next";

import { AddGuardianView } from "@/components/modules/guardians-views";

export const metadata: Metadata = { title: "Parents & Guardians · Add a guardian", description: "Add a guardian: who they are, which children they look after, and the consent behind it." };

export default async function AddGuardianPage() {
  return <AddGuardianView />;
}
