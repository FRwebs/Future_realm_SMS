import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Modal } from "./modal";

function Demo({ closeOnEscape = true }: { closeOnEscape?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>Batch status change</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Batch status change"
        subtitle="Update 3 schools at once. This is fully audited."
        closeOnEscape={closeOnEscape}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn-primary">Update 3 schools</button></div>}
      >
        <label className="grid gap-2 text-[12px] font-semibold">
          Reason
          <textarea className="field-textarea" rows={3} />
        </label>
      </Modal>
    </>
  );
}

const meta = { title: "Overlays/Modal", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

/** Opens, traps focus, closes on Escape and hands focus back to the button that opened it. */
export const KeyboardFlow: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const opener = within(canvasElement).getByRole("button", { name: "Batch status change" });
    await userEvent.click(opener);
    const dialog = await page.findByRole("dialog", { name: "Batch status change" });
    await expect(dialog).toHaveAccessibleDescription("Update 3 schools at once. This is fully audited.");
    await userEvent.keyboard("{Escape}");
    await expect(page.queryByRole("dialog")).toBeNull();
    await expect(opener).toHaveFocus();
  },
};

export const EscapeDisabled: Story = { args: { closeOnEscape: false } };
