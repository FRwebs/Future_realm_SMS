import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FieldMessage, InlineNotice } from "./inline-notice";

const meta = {
  title: "Feedback/InlineNotice",
  component: InlineNotice,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="w-[420px]"><Story /></div>],
} satisfies Meta<typeof InlineNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { notice: { variant: "success", title: "Signed in", description: "Opening your workspace now." } } };
export const Failure: Story = { args: { notice: { variant: "error", title: "Sign-in failed", description: "Wrong email or password." }, onDismiss: () => {} } };
export const Requirement: Story = { args: { notice: { variant: "warning", title: "Two things are needed to sign in", description: "Fill in the highlighted fields, then sign in." } } };
export const Information: Story = { args: { notice: { variant: "info", title: "Not built yet", description: "This action arrives in a later release." }, compact: true } };

/** What a field says under itself when what was typed cannot be used. */
export const UnderAField: StoryObj<typeof FieldMessage> = {
  render: () => <FieldMessage id="demo-error">Enter your email address or User ID.</FieldMessage>,
};
