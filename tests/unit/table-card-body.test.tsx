// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { TableCardBody, type PreparedColumn, type PreparedRow } from "@/components/data-display/table-card-body";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const columns: PreparedColumn[] = [
  { key: "name", header: "Student", sortable: true },
  { key: "score", header: "Score", sortable: true },
  { key: "note", header: "Note", sortable: false },
];
const data = [["Chidi", 72], ["Ada", 95], ["Bola", null], ["Emeka", 40], ["Dayo", 88], ["Femi", 61], ["Gina", 77]] as const;
const rows: PreparedRow[] = data.map(([name, score], index) => ({
  key: `r${index}`,
  cells: { name, score: score ?? "—", note: `note ${index}` },
  sortValues: { name, score, note: null },
}));

const renderBody = (extra = {}, searchParams = "") =>
  render(
    <NuqsTestingAdapter searchParams={searchParams}>
      <TableCardBody title="Results" emptyState="Nothing yet." columns={columns} rows={rows} featuredColumnKeys={[]} pageSize={5} {...extra} />
    </NuqsTestingAdapter>,
  );

const names = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row").map((row) => within(row).getAllByRole("cell")[0]!.textContent);

describe("the standard table", () => {
  it("pages, five to a page", async () => {
    renderBody();
    expect(names()).toHaveLength(5);
    expect(screen.getByText("Showing 1–5 of 7")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(names()).toEqual(["Femi", "Gina"]);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("sorts by the prepared value, ascending then descending, with empty values last", async () => {
    renderBody({ pageSize: false });
    await userEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(names()).toEqual(["Emeka", "Femi", "Chidi", "Gina", "Dayo", "Ada", "Bola"]);
    expect(screen.getByRole("columnheader", { name: /Score/ })).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(screen.getByRole("columnheader", { name: /Score/ })).toHaveAttribute("aria-sort", "descending");
    expect(names()[0]).toBe("Bola");
    await userEvent.click(screen.getByRole("button", { name: "Student" }));
    expect(names()).toEqual(["Ada", "Bola", "Chidi", "Dayo", "Emeka", "Femi", "Gina"]);
  });

  it("hides a column from the Columns menu but never the last one", async () => {
    renderBody({ pageSize: false });
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Note" }));
    // While a menu is open the page behind it is hidden from assistive technology, so read the table with the menu shut.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("columnheader", { name: "Note" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Score" }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Student" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("columnheader", { name: /Student/ })).toBeInTheDocument();
  });

  it("ticks rows and offers the actions", async () => {
    renderBody({ pageSize: false, selection: { noun: "student", nounPlural: "students", actions: [{ label: "Email parents", endpoint: "/x", idsField: "ids" }] } });
    await userEvent.click(screen.getAllByRole("checkbox", { name: "Select this row" })[0]!);
    expect(screen.getByText("1 student selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));
    expect(screen.getByText("7 students selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email parents" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it("opens sorted and paged as the address says", () => {
    renderBody({}, "?results.sort=score:desc&results.page=2");
    expect(screen.getByRole("columnheader", { name: /Score/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("ignores a sort the table does not offer", () => {
    renderBody({}, "?results.sort=note:asc");
    expect(screen.getByRole("columnheader", { name: /Note/ })).toHaveAttribute("aria-sort", "none");
  });
});
