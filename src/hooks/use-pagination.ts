"use client";

import { useEffect, useState } from "react";

type FetchResult<TItem> = {
  data: TItem[];
  total: number;
};

export function usePagination<TItem, TFilters extends Record<string, unknown> = Record<string, unknown>>({
  fetchFn,
  defaultPageSize = 25,
  defaultFilters,
}: {
  fetchFn: (params: { page: number; pageSize: number } & TFilters) => Promise<FetchResult<TItem>>;
  defaultPageSize?: number;
  defaultFilters: TFilters;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState<TItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchFn({ page: currentPage, pageSize, ...filters })
      .then((result) => {
        if (cancelled) return;
        setData(result.data);
        setTotalItems(result.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load records.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, fetchFn, filters, pageSize]);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setCurrentPage(1);
  }

  function updateFilters(nextFilters: Partial<TFilters>) {
    setFilters((current) => ({ ...current, ...nextFilters }));
    setCurrentPage(1);
  }

  return {
    data,
    totalItems,
    currentPage,
    pageSize,
    isLoading,
    error,
    setCurrentPage,
    setPageSize,
    updateFilters,
  };
}
