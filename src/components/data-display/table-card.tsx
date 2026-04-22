import { ReactNode } from "react";

import { PaginatedTable } from "@/components/data-display/paginated-table";

export interface TableColumn<TItem> {
  key: string;
  header: string;
  render: (item: TItem) => ReactNode;
}

interface TableCardProps<TItem> {
  title: string;
  description: string;
  columns: TableColumn<TItem>[];
  items: TItem[];
  emptyState?: string;
}

export function TableCard<TItem>({ title, description, columns, items, emptyState = "No records found." }: TableCardProps<TItem>) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 md:px-6">
        <p className="section-eyebrow">Data overview</p>
        <h3 className="mt-2 text-[20px] font-bold text-slate-900">{title}</h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600">{description}</p>
      </div>

      <div className="p-5 md:p-6">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <span className="text-lg font-bold">+</span>
            </div>
            <p className="mt-4 text-[15px] font-semibold text-slate-800">Nothing to display yet</p>
            <p className="mt-1 max-w-md text-[13px] text-slate-500">{emptyState}</p>
          </div>
        ) : (
          <PaginatedTable
            header={
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
            }
          >
            {items.map((item, index) => (
              <tr
                key={index}
                className="border-b border-slate-50 bg-white text-[13px] text-slate-700 transition hover:bg-slate-50/70"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-top">
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </PaginatedTable>
        )}
      </div>
    </section>
  );
}
