import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TabBar } from "./tab-bar";

const meta = {
  title: "Navigation/TabBar",
  component: TabBar,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/attendance/mark" } } },
} satisfies Meta<typeof TabBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Attendance: Story = {
  args: {
    ariaLabel: "Attendance tabs",
    items: [
      { href: "/attendance/register", label: "Register" },
      { href: "/attendance/mark", label: "Mark" },
      { href: "/attendance/compliance", label: "Compliance", count: "3" },
      { href: "/attendance/log", label: "Log" },
    ],
  },
};
/** A strip with one tab is not drawn at all. */
export const OneTabIsHidden: Story = { args: { ariaLabel: "Only one", items: [{ href: "/attendance/mark", label: "Mark" }] } };
