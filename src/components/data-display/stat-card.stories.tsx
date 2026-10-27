import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Users } from "lucide-react";

import { StatCard } from "./stat-card";

const meta = {
  title: "Data display/StatCard",
  component: StatCard,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="w-[240px]"><Story /></div>],
} satisfies Meta<typeof StatCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = { args: { label: "Students", value: 412, detail: "Across 14 arms" } };
export const WithIcon: Story = { args: { label: "Students", value: 412, detail: "Across 14 arms", icon: Users, tone: "accent" } };
export const Warning: Story = { args: { label: "Awaiting approval", value: 7, detail: "Oldest is 3 days old", tone: "warning" } };
export const Danger: Story = { args: { label: "Overdue", value: "₦1,240,000", detail: "31 families", tone: "danger" } };
/** The first card of a KPI row is the dark one. */
export const Dark: Story = { args: { label: "Collected this term", value: "₦18.6m", detail: "81% of what was billed", tone: "dark" } };
