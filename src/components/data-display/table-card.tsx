import { ReactNode } from "react";

export interface TableColumn<TItem> {
  key: string;
  header: string;
  render: (item: TItem) => ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

interface TableCardProps<TItem> {
  title: string;
  description: ReactNode;
  columns: TableColumn<TItem>[];
  items: TItem[];
  emptyState?: string;

  /**
   * Strongly recommended so rows keep stable identity.
   */
  getRowKey?: (item: TItem, index: number) => string | number;

  /**
   * The column that should act like the main label on mobile.
   * For example: "name", "student", "subject", "className".
   */
  primaryColumnKey?: string;

  /**
   * Columns that should be visually emphasized on mobile.
   * Use this for grade, status, score, result, or completion fields.
   */
  featuredColumnKeys?: string[];

  /**
   * Optional action slot for buttons like Add, Export, Filter, etc.
   */
  actions?: ReactNode;
}

export function TableCard<TItem>({
  title,
  description,
  columns,
  items,
  emptyState = "No records found.",
  getRowKey,
  primaryColumnKey,
  featuredColumnKeys = [],
  actions,
}: TableCardProps<TItem>) {
  const primaryColumn =
    columns.find((column) => column.key === primaryColumnKey) ?? columns[0];

  const featuredColumns = columns.filter((column) =>
    featuredColumnKeys.includes(column.key),
  );

  const secondaryColumns = columns.filter(
    (column) => column.key !== primaryColumn?.key && !featuredColumnKeys.includes(column.key),
  );

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-eyebrow">Data overview</p>
            <h3 className="mt-2 font-[var(--font-display)] text-[20px] font-bold text-[var(--color-text-primary)]">{title}</h3>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {description}
            </p>
          </div>

          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>

      <div className="p-5 md:p-6">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
              <span className="text-lg font-bold">+</span>
            </div>
            <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">
              Nothing to display yet
            </p>
            <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">{emptyState}</p>
          </div>
        ) : (
          <>
            {/* Mobile view: stacked cards so important fields like grades are always visible */}
            <div className="grid gap-3 md:hidden">
              {items.map((item, index) => {
                const rowKey = getRowKey ? getRowKey(item, index) : index;

                return (
                  <article
                    key={rowKey}
                    className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {primaryColumn?.header ?? "Record"}
                        </p>
                        <div className="mt-1 text-[15px] font-semibold text-[var(--color-text-primary)]">
                          {primaryColumn ? primaryColumn.render(item) : null}
                        </div>
                      </div>

                      {featuredColumns.length > 0 ? (
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          {featuredColumns.map((column) => (
                            <div
                              key={column.key}
                              className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-accent)]"
                            >
                              {column.render(item)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {secondaryColumns.length > 0 ? (
                      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {secondaryColumns.map((column) => (
                          <div
                            key={column.key}
                            className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2"
                          >
                            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                              {column.header}
                            </dt>
                            <dd className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                              {column.render(item)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {/* Desktop view: table with sticky header */}
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)]">
                <div className="max-h-[70vh] overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <caption className="sr-only">{title}</caption>
                    <thead className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--color-bg-subtle)_92%,transparent)] backdrop-blur">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            scope="col"
                            className={[
                              "border-b border-[var(--color-border-default)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]",
                              column.headerClassName ?? "",
                            ].join(" ")}
                          >
                            {column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item, index) => {
                        const rowKey = getRowKey ? getRowKey(item, index) : index;

                        return (
                          <tr
                            key={rowKey}
                            className="border-b border-[var(--color-border-muted)] bg-[var(--color-bg-surface)] text-[13px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-elevated)]"
                          >
                            {columns.map((column) => (
                              <td
                                key={column.key}
                                className={[
                                  "px-4 py-3 align-top",
                                  column.cellClassName ?? "",
                                ].join(" ")}
                              >
                                {column.render(item)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
