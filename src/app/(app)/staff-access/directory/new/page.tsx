import type { Metadata } from "next";

import { AddStaffView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Add a staff member", description: "Onboard a member of staff: who they are, what they hold, and what they can open." };

export default async function AddStaffPage() {
  return <AddStaffView />;
}
