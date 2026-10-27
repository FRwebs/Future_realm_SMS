import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { UnbuiltAction } from "./unbuilt-action";

const meta = {
  title: "Feedback/UnbuiltAction",
  component: UnbuiltAction,
  parameters: { layout: "padded" },
} satisfies Meta<typeof UnbuiltAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = { args: { label: "Export to Excel", note: "Spreadsheet export arrives in a later release." } };

/** Pressing it says so, right under the control, and nothing else happens. */
export const AfterPressing: Story = {
  args: Resting.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Export to Excel" }));
    await expect(canvas.getByText("Not built yet")).toBeVisible();
  },
};
