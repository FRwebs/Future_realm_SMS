// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { BackOfficeTable } from "@/components/data-display/back-office-table";
import type { PreparedColumn, PreparedRow } from "@/components/data-display/table-card-body";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const columns = [
  { key: "name", header: "School" },
  { key: "town", header: "Town" },
] as unknown as PreparedColumn[];

const towns = ["Ibadan", "Lagos", "Abuja", "Kano", "Enugu", "Jos"];
const rows: PreparedRow[] = Array.from({ length: 20 }, (_, index) => ({
  key: `s${index + 1}`,
  cells: { name: `School ${index + 1}`, town: towns[index % towns.length]! },
  sortValues: {},
}));

const renderTable = (extra: Partial<React.ComponentProps<typeof BackOfficeTable>> = {}, searchParams = "") =>
  render(
    <NuqsTestingAdapter searchParams={searchParams}>
      <BackOfficeTable title="Schools" emptyState="No schools yet." columns={columns} rows={rows} pageSize={8} {...extra} />
    </NuqsTestingAdapter>,
  );

const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");

describe("the Back Office table", () => {
  it("pages long tables eight to a page and says where you are", async () => {
    renderTable();
    expect(bodyRows()).toHaveLength(8);
    expect(screen.getByText("Showing 1–8 of 20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 9–16 of 20")).toBeInTheDocument();
    expect(screen.getByText("School 9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(bodyRows()).toHaveLength(4);
  });

  it("searches the words each cell shows, and starts again from page one", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.type(screen.getByLabelText("Search this table"), "kano");
    expect(await screen.findByText("3 of 20 shown")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search this table"), "zzz");
    expect(await screen.findByText("Nothing matches “kanozzz” in this table.")).toBeInTheDocument();
  });

  it("keeps short tables on one page without a search box", () => {
    renderTable({ rows: rows.slice(0, 5) });
    expect(bodyRows()).toHaveLength(5);
    expect(screen.queryByLabelText("Search this table")).not.toBeInTheDocument();
  });

  it("selects rows, counts them across pages, and clears", async () => {
    renderTable({ selection: { noun: "school", nounPlural: "schools", actions: [] } as never });
    const boxes = screen.getAllByRole("checkbox", { name: "Select this row" });
    await userEvent.click(boxes[0]!);
    await userEvent.click(boxes[1]!);
    expect(screen.getByText("2 schools selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));
    expect(screen.getByText("10 schools selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear the selection" }));
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it("opens on the page and search kept in the address", async () => {
    renderTable({}, "?schools.page=2&schools.q=school");
    expect(screen.getByLabelText("Search this table")).toHaveValue("school");
    expect(screen.getByText("Showing 9–16 of 20")).toBeInTheDocument();
  });

  it("writes the page and the search to the address as they change", async () => {
    const onUrlUpdate = vi.fn();
    render(
      <NuqsTestingAdapter onUrlUpdate={onUrlUpdate}>
        <BackOfficeTable title="Schools" emptyState="No schools yet." columns={columns} rows={rows} pageSize={8} />
      </NuqsTestingAdapter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?schools.page=2");
    await userEvent.type(screen.getByLabelText("Search this table"), "lagos");
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?schools.q=lagos");
  });
});
