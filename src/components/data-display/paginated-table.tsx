"use client";

import { Children, ReactNode, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/ui/pagination";

export function PaginatedTable({
  header,
  children,
  initialPageSize = 10,
}: {
  header: ReactNode;
  children: ReactNode;
  initialPageSize?: number;
}) {
  const rows = useMemo(() => Children.toArray(children), [children]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const start = (currentPage - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            {header}
            <tbody>{visibleRows}</tbody>
          </table>
        </div>
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={rows.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        className="border-x border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3"
      />
    </>
  );
}
