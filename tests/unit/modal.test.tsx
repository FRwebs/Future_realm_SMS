// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { SidePanel } from "@/components/ui/side-panel";

function Harness({ closeOnEscape = true }: { closeOnEscape?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open it</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Batch status change" subtitle="Update schools at once." closeOnEscape={closeOnEscape} footer={<button type="button">Save</button>}>
        <input aria-label="Reason" />
      </Modal>
    </>
  );
}

describe("the dialog", () => {
  it("is announced by its title and description, and focus moves inside", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    const dialog = await screen.findByRole("dialog", { name: "Batch status change" });
    expect(dialog).toHaveAccessibleDescription("Update schools at once.");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("keeps Tab inside, closes on Escape, and gives focus back to the button that opened it", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open it" });
    await userEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    for (let step = 0; step < 8; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("stays open on Escape when it has been told not to close that way", async () => {
    render(<Harness closeOnEscape={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides the page behind it from assistive technology while it is open", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Open it" })).toBeNull();
  });
});

describe("the side panel", () => {
  it("opens as a dialog with its title and closes from its own button", async () => {
    function Panel() {
      const [open, setOpen] = useState(true);
      return <SidePanel open={open} onClose={() => setOpen(false)} title="Quick view" subtitle="One learner">body</SidePanel>;
    }
    render(<Panel />);
    expect(await screen.findByRole("dialog", { name: "Quick view" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close side panel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
