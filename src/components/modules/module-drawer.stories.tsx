import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { ModuleDrawer } from "./module-drawer";

const meta = {
  title: "Panels/ModuleDrawer",
  component: ModuleDrawer,
  parameters: { layout: "fullscreen" },
  args: { onClose: () => {} },
} satisfies Meta<typeof ModuleDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A record opened for reading: its facts, and nothing to change. */
export const Record: Story = {
  args: {
    spec: {
      kicker: "Student",
      title: "Adaeze Okafor",
      sub: "JSS 1 A · Admission 0042",
      mode: "view",
      facts: [["Form master", "Mrs Bello"], ["House", "Blue"], ["Attendance", "94%", "This term", "positive"]],
    },
  },
};

/** A form: a required field refuses to go on empty, and says so beside the field. */
export const FormNeedsAField: Story = {
  args: {
    spec: {
      kicker: "Account",
      title: "Change your password",
      mode: "form",
      fields: [{ kind: "text", type: "password", label: "Current password", required: true, value: "", placeholder: "Your password now" }],
      commitLabel: "Update password",
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Update password" }));
    await expect(await body.findByRole("dialog")).toBeVisible();
  },
};

/** A decision that cannot be undone asks first, in the drawer's own words. */
export const Confirmation: Story = {
  args: {
    spec: {
      kicker: "Account",
      title: "Sign out of this device?",
      sub: "Chrome on Mac is signed out straight away.",
      mode: "commit",
      tone: "attention",
      commitLabel: "Sign out",
      commitDone: "Signed out",
    },
  },
};
