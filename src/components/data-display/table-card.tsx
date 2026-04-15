import { ReactNode } from "react";

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
    <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
      <div className="mb-4">
        <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-ink/15 bg-sand/45 p-6 text-sm text-ink/60">
          {emptyState}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-[0.24em] text-ink/40">
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-2 font-semibold">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="rounded-2xl bg-sand/55 text-sm text-ink/80 transition hover:bg-brand-50/70">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4 align-top first:rounded-l-2xl last:rounded-r-2xl">
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
