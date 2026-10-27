import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Tooltip } from "./tooltip";

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  decorators: [(Story) => <div className="p-16"><Story /></div>],
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on hover and on keyboard focus, closes on Escape. */
export const OnAButton: Story = {
  args: { content: "Assign or change the teacher handling this subject.", children: <button type="button" className="btn-secondary">Assign teacher</button> },
};
