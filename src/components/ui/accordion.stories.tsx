import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AccordionGroup } from "./accordion";

const meta = {
  title: "Disclosure/AccordionGroup",
  component: AccordionGroup,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="w-[480px]"><Story /></div>],
} satisfies Meta<typeof AccordionGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Topics: Story = {
  args: {
    items: [
      { id: "w1", title: "Week 1 · Cell structure", summary: "3 sub-topics", content: <p className="text-[12.5px]">Cell membrane, nucleus, cytoplasm.</p> },
      { id: "w2", title: "Week 2 · Cell division", summary: "2 sub-topics", content: <p className="text-[12.5px]">Mitosis and meiosis.</p> },
      { id: "w3", title: "Week 3 · Revision", content: <p className="text-[12.5px]">Past questions.</p> },
    ],
  },
};
