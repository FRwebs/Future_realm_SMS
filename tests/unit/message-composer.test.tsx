// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MessageComposer, type ComposerFamily } from "@/components/modules/message-composer";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const family = (id: string, name: string): ComposerFamily => ({ id, name, phone: "+2348030000000", email: `${id}@example.ng`, children: ["Ada"], arms: ["JSS 1 A"], canSms: true, canEmail: true, portal: "ACTIVE", language: "en" });
const props = { arms: ["JSS 1 A"], families: [family("f1", "Mrs Okafor"), family("f2", "Mr Bello")], wallet: 100, threshold: null, sender: "Greenfield College", smsNaira: 4, drafts: [], base: "/api/x", sentHref: "/sent" };

describe("the message composer's text field", () => {
  it("keeps Preview and send off until the message is long enough, and says what is wrong rather than staying silent", async () => {
    render(<MessageComposer {...props} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    const preview = screen.getByRole("button", { name: "Preview and send" });
    expect(preview).toBeDisabled();

    await userEvent.type(box, "Hi");
    expect(await screen.findByText(/at least a sentence/i)).toBeInTheDocument();
    expect(preview).toBeDisabled();

    await userEvent.type(box, " everyone, school is closed on Friday.");
    expect(screen.queryByText(/at least a sentence/i)).toBeNull();
    expect(preview).toBeEnabled();
  });

  it("adds a merge field where the cursor is", async () => {
    render(<MessageComposer {...props} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "Dear , please note");
    (box as HTMLTextAreaElement).setSelectionRange(5, 5);
    await userEvent.click(screen.getByRole("button", { name: "{Guardian}" }));
    expect((box as HTMLTextAreaElement).value).toBe("Dear {Guardian}, please note");
  });
});
