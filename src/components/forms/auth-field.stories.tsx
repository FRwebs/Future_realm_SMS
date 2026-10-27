import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Lock, UserRound } from "lucide-react";

import { AuthField } from "./auth-field";

const meta = {
  title: "Forms/AuthField",
  component: AuthField,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="w-[380px]"><Story /></div>],
} satisfies Meta<typeof AuthField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "Email address or User ID", icon: <UserRound className="h-4 w-4" />, placeholder: "you@school.com or 482173" } };
export const WithError: Story = { args: { label: "Email address or User ID", icon: <UserRound className="h-4 w-4" />, placeholder: "you@school.com or 482173", error: "Enter your email address or User ID." } };
export const Password: Story = {
  args: { label: "Password", icon: <Lock className="h-4 w-4" />, type: "password", aside: <a href="/forgot-password" className="text-[11.5px] font-semibold text-[#12796a]">Forgot password?</a> },
};
