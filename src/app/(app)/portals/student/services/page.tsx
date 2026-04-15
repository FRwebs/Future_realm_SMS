import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import {
  StudentPortalHostelView,
  StudentPortalLibraryLoanView,
  StudentPortalTransportView
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type StudentServicesPayload = {
  library: StudentPortalLibraryLoanView[];
  hostel: StudentPortalHostelView[];
  transport: StudentPortalTransportView[];
};

export default async function StudentServicesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const services = await apiGet<StudentServicesPayload>("/api/v1/student-portal/services");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Library, hostel, and transport</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Read-only student service allocations and active library loan records.
        </p>
      </section>

      <TableCard
        title="Library loans"
        description="Borrowed books, due dates, returns, and fines."
        items={services.library}
        columns={[
          { key: "title", header: "Book", render: (item) => item.title },
          { key: "author", header: "Author", render: (item) => item.author },
          { key: "dueAt", header: "Due", render: (item) => formatDate(item.dueAt) },
          { key: "returnedAt", header: "Returned", render: (item) => (item.returnedAt ? formatDate(item.returnedAt) : "Not yet") },
          { key: "fine", header: "Fine", render: (item) => formatCurrency(item.fineAmount) }
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Hostel allocation"
          description="Current or recent room allocation."
          items={services.hostel}
          columns={[
            { key: "building", header: "Building", render: (item) => item.building },
            { key: "room", header: "Room", render: (item) => item.room },
            { key: "startDate", header: "Start", render: (item) => formatDate(item.startDate) },
            { key: "endDate", header: "End", render: (item) => (item.endDate ? formatDate(item.endDate) : "Active") }
          ]}
        />
        <TableCard
          title="Transport route"
          description="Route, stop, driver, and vehicle summary."
          items={services.transport}
          columns={[
            { key: "routeName", header: "Route", render: (item) => item.routeName },
            { key: "stopName", header: "Stop", render: (item) => item.stopName },
            { key: "driver", header: "Driver", render: (item) => `${item.driverName} · ${item.driverPhone}` },
            { key: "vehicle", header: "Vehicle", render: (item) => item.vehicleRegNo }
          ]}
        />
      </section>
    </div>
  );
}
