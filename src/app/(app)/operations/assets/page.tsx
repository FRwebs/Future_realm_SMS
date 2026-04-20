import { CanDo } from "@/components/auth/permission-provider";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";

type InventoryItem = {
  id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  location?: string | null;
  reorderLevel: number;
};

type FacilityLog = {
  id: string;
  facilityName: string;
  category: string;
  issue: string;
  priority: string;
  status: string;
  assignedTo?: string | null;
  reportedAt: string;
};

type Vehicle = {
  id: string;
  plateNumber: string;
  model?: string | null;
  capacity: number;
  driverName?: string | null;
  status: string;
  route?: { name: string } | null;
};

async function safeList<T>(path: string) {
  try {
    return await apiGet<T[]>(path);
  } catch {
    return [];
  }
}

export default async function AssetsOperationsPage() {
  const [inventory, facilities, vehicles] = await Promise.all([
    safeList<InventoryItem>("/api/v1/operations/inventory"),
    safeList<FacilityLog>("/api/v1/operations/facilities"),
    safeList<Vehicle>("/api/v1/operations/transport-vehicles")
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
          Assets and facilities
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Inventory, Maintenance & Transport
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Track supplies, low stock, facility faults, buses, drivers, and route readiness for VP Admin and operations staff.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CanDo permission="inventory.create">
              <ResourceActionDialog
                triggerLabel="Add Inventory"
                title="Add inventory item"
                description="Record supplies for school stores, hostel, sick bay, ICT, or academic departments."
                endpoint="/api/v1/operations/inventory"
                fields={[
                  { name: "category", label: "Category", required: true },
                  { name: "name", label: "Item name", required: true },
                  { name: "sku", label: "SKU" },
                  { name: "quantity", label: "Quantity", type: "number", required: true, min: 0 },
                  { name: "unit", label: "Unit", defaultValue: "unit" },
                  { name: "location", label: "Location" },
                  { name: "reorderLevel", label: "Reorder level", type: "number", min: 0, defaultValue: 0 }
                ]}
                submitLabel="Save Item"
              />
            </CanDo>
            <CanDo permission="facilities.create">
              <ResourceActionDialog
                triggerLabel="Log Facility Issue"
                title="Log facility issue"
                description="Create a maintenance record and assign it to the responsible internal unit or contractor."
                endpoint="/api/v1/operations/facilities"
                fields={[
                  { name: "facilityName", label: "Facility", required: true },
                  { name: "category", label: "Category", required: true },
                  { name: "issue", label: "Issue", type: "textarea", required: true },
                  { name: "priority", label: "Priority", type: "select", defaultValue: "NORMAL", options: ["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ label: value, value })) },
                  { name: "assignedTo", label: "Assigned to" },
                  { name: "cost", label: "Estimated cost", type: "number", min: 0 }
                ]}
                submitLabel="Save Issue"
              />
            </CanDo>
          </div>
        </div>
      </section>

      <TableCard
        title="Inventory Register"
        description="Store, hostel, sick bay, and department supplies with reorder visibility."
        items={inventory}
        emptyState="No inventory items found."
        columns={[
          { key: "item", header: "Item", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
          { key: "category", header: "Category", render: (item) => item.category },
          { key: "quantity", header: "Quantity", render: (item) => `${item.quantity} ${item.unit}` },
          { key: "stock", header: "Stock", render: (item) => item.quantity <= item.reorderLevel ? <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Low stock</span> : <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">OK</span> },
          { key: "location", header: "Location", render: (item) => item.location ?? "Not set" }
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Facility Maintenance"
          description="Open and resolved maintenance records."
          items={facilities}
          emptyState="No facility logs found."
          columns={[
            { key: "facility", header: "Facility", render: (item) => <span className="font-semibold text-ink">{item.facilityName}</span> },
            { key: "issue", header: "Issue", render: (item) => item.issue },
            { key: "priority", header: "Priority", render: (item) => item.priority },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
        <TableCard
          title="Transport Vehicles"
          description="Fleet records connected to school routes."
          items={vehicles}
          emptyState="No transport vehicles recorded."
          columns={[
            { key: "plate", header: "Plate", render: (item) => <span className="font-semibold text-ink">{item.plateNumber}</span> },
            { key: "model", header: "Model", render: (item) => item.model ?? "Not set" },
            { key: "route", header: "Route", render: (item) => item.route?.name ?? "Unassigned" },
            { key: "driver", header: "Driver", render: (item) => item.driverName ?? "Not set" },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
      </div>
    </div>
  );
}
