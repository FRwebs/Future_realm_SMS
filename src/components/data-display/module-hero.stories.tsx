import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModuleHero } from "./module-hero";

const meta = {
  title: "Data display/ModuleHero",
  component: ModuleHero,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="p-4"><Story /></div>],
} satisfies Meta<typeof ModuleHero>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { eyebrow: "Platform", title: "School Accounts", description: "Every school on the platform, its plan and its standing." },
};
export const WithAnAction: Story = {
  args: { ...Default.args, action: <button type="button" className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#0d2315]">Add a school</button> },
};
