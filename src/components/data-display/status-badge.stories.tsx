import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusBadge } from "./status-badge";

const meta = {
  title: "Data display/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The tone follows the workflow status unless one is given. */
export const Published: Story = { args: { status: "PUBLISHED" } };
export const InReview: Story = { args: { status: "IN_REVIEW" } };
export const Returned: Story = { args: { status: "CORRECTION_REQUESTED" } };
export const NotAWorkflowStatus: Story = { args: { status: "Boarding" } };
export const ToneGiven: Story = { args: { status: "Needs a look", tone: "warning" } };

export const EveryTone: Story = {
  args: { status: "Neutral" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["neutral", "success", "warning", "danger", "brand"] as const).map((tone) => <StatusBadge key={tone} status={tone} tone={tone} />)}
    </div>
  ),
};
