// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReadOnlyTable } from "@/components/data-display/read-only-table";

type Row = { name: string; students: number };
const rows: Row[] = [{ name: "Greenfield", students: 340 }, { name: "Crestwood", students: 120 }, { name: "Sunrise", students: 480 }];
const columns = [
  { id: "name", header: "School", cell: (row: Row) => row.name, sortValue: (row: Row) => row.name },
  { id: "students", header: "Students", cell: (row: Row) => row.students, sortValue: (row: Row) => row.students },
  { id: "note", header: "Note", cell: () => "—" },
];
const draw = (list: Row[] = rows) => render(<ReadOnlyTable columns={columns} rows={list} getRowId={(row) => row.name} caption="Schools" empty={<p>None yet.</p>} />);
const names = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0]!.textContent);

describe("a read-only table", () => {
  it("is a table with a name, column headings, and rows in the order they came", () => {
    draw();
    expect(screen.getByRole("table", { name: "Schools" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(names()).toEqual(["Greenfield", "Crestwood", "Sunrise"]);
  });

  it("sorts a column that has something to sort by, says so with aria-sort, and sorts back the other way on a second press", async () => {
    draw();
    const students = screen.getByRole("columnheader", { name: /Students/ });
    expect(students).toHaveAttribute("aria-sort", "none");
    await userEvent.click(within(students).getByRole("button"));
    expect(names()).toEqual(["Crestwood", "Greenfield", "Sunrise"]);
    expect(students).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(within(students).getByRole("button"));
    expect(names()).toEqual(["Sunrise", "Greenfield", "Crestwood"]);
    expect(students).toHaveAttribute("aria-sort", "descending");
  });

  it("leaves a column with nothing to sort by as plain text, and shows what it was given when there are no rows", () => {
    draw();
    expect(within(screen.getByRole("columnheader", { name: "Note" })).queryByRole("button")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Note" })).not.toHaveAttribute("aria-sort");
  });

  it("shows the empty message instead of a table when there are no rows", () => {
    draw([]);
    expect(screen.getByText("None yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
