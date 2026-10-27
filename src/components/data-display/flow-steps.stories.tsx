import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FlowSteps } from "./flow-steps";

const meta = {
  title: "Data display/FlowSteps",
  component: FlowSteps,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FlowSteps>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ScoreApproval: Story = {
  args: {
    title: "How a score sheet is approved",
    sub: "Each step names who acts and what they can see.",
    steps: [
      { label: "Teacher enters", note: "Scores saved as a draft", tone: "ink" },
      { label: "Form master reviews", note: "Flags anything odd", tone: "warn" },
      { label: "Exam officer approves", note: "Locks the sheet", tone: "good" },
      { label: "Sent back", note: "With the reason, to the teacher", tone: "bad" },
    ],
  },
};
