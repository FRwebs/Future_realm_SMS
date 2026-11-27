/**
 * Rows per page, for every table. The mockup pages at twelve and so does this.
 *
 * It lives here, in a file with no `"use client"` above it, because the server reads it too: a long table is cut to its page on the
 * server. A constant imported from a client file reaches server code as a reference to it, not as its value — the page size came out
 * as nothing, every page was empty, and a table that said "82 subject-arms" listed none.
 */
export const TABLE_PAGE_SIZE = 12;
