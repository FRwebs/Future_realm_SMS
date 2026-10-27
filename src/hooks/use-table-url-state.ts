"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";

/** `Schools & plans` -> `schools-plans`: a table's name, as something safe to put in an address. */
export const tableSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "table";

/**
 * What a person has done to a table — the page they are on, the words they searched, the column they sorted by — kept in the address so a
 * refresh, the back button and a link sent to a colleague all land on the same view. Each table keys its own entries by its title
 * (`?schools.q=ibadan&schools.page=2`), so several tables on one page do not trample each other. Nothing is written until it differs from
 * the table's starting view, so a clean address stays clean.
 */
export function useTableUrlState(title: string) {
  const slug = tableSlug(title);
  const options = { clearOnDefault: true, history: "replace" as const };
  const [query, setQuery] = useQueryState(`${slug}.q`, parseAsString.withDefault("").withOptions(options));
  const [page, setPage] = useQueryState(`${slug}.page`, parseAsInteger.withDefault(1).withOptions(options));
  const [sort, setSort] = useQueryState(`${slug}.sort`, parseAsString.withDefault("").withOptions(options));
  return { query, setQuery, page, setPage, sort, setSort };
}
