import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { PanelRows } from "./panel-renderer";
import { name, pill, row, text, type PanelRow } from "@/lib/modules/panels";

const meta = {
  title: "Panels/PanelRows",
  component: PanelRows,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="w-[880px] max-w-full"><Story /></div>],
} satisfies Meta<typeof PanelRows>;
export default meta;
type Story = StoryObj<typeof meta>;

const people = [
  ["Adaeze Okafor", "JSS 1 A", "Present", "positive"],
  ["Tunde Bello", "JSS 1 A", "Late", "attention"],
  ["Ifeoma Nwosu", "JSS 1 B", "Absent", "negative"],
  ["Musa Danjuma", "JSS 2 A", "Present", "positive"],
  ["Chiamaka Eze", "JSS 2 B", "Present", "positive"],
] as const;

const register: PanelRow[] = [
  row("1fr", [
    {
      type: "table",
      title: "Today's register",
      sub: "Taken before 08:30",
      head: ["Student", "Class", "Status"],
      rows: people.map(([who, arm, status, tone]) => ({ cells: [name(who, arm), text(arm), pill(status, tone)], keywords: `${who} ${arm} ${status}` })),
      search: "Search students",
      noun: "student",
      nounPlural: "students",
      per: 3,
    },
  ]),
];

/** The table as a person first meets it: search, a page of rows, and a count. */
export const Table: Story = { args: { rows: register } };

export const TableSearchNarrowsRows: Story = {
  args: { rows: register },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search students" }), "Tunde");
    await expect(canvas.getByText("Tunde Bello")).toBeVisible();
    await expect(canvas.queryByText("Adaeze Okafor")).toBeNull();
  },
};

export const TableWithNothingToShow: Story = {
  args: { rows: [row("1fr", [{ type: "table", title: "Returned scores", head: ["Subject", "Class"], rows: [], emptyTitle: "Nothing was returned", emptyBody: "Scores sent back for correction will appear here." }])] },
};

export const NoticesAndFacts: Story = {
  args: {
    rows: [
      row("1fr 1fr", [
        { type: "note", tone: "attention", title: "Two registers are not taken", body: "JSS 2 A and SS 1 B have no register for today. The cut-off was 08:30." },
        { type: "facts", title: "This term", facts: [["Term", "Second Term"], ["Days open", "63", "of 113"], ["Attendance", "94%", "", "positive"]], per: 1 },
      ]),
    ],
  },
};
