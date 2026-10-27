import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ActionMenu, ActionMenuButton, ActionMenuLink } from "./action-menu";

const meta = {
  title: "Overlays/ActionMenu",
  component: ActionMenu,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="flex h-[260px] w-[360px] items-start justify-end"><Story /></div>],
} satisfies Meta<typeof ActionMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = (
  <>
    <ActionMenuLink href="/super-admin/schools/greenfield">Open school profile</ActionMenuLink>
    <ActionMenuButton onClick={() => {}}>Send notification</ActionMenuButton>
    <ActionMenuButton destructive onClick={() => {}}>Suspend account</ActionMenuButton>
  </>
);

export const IconTrigger: Story = { args: { triggerLabel: "Actions for Greenfield College", children: items } };
export const TextTrigger: Story = { args: { triggerText: "Manage", triggerLabel: "Manage Greenfield College", children: items } };
export const Compact: Story = { args: { compact: true, triggerLabel: "Actions for Greenfield College", children: items } };
