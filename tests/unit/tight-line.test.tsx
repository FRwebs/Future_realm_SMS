// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";

import { PhoneKindProvider } from "@/components/layout/phone-shell";
import { useTightLine } from "@/components/modules/tight-line";

/**
 * Who the phone's copy rule is for.
 *
 * The rule shortens a line for a narrow window, so the window has to decide it. What the component
 * knows is which portal it is in, which is not the same thing — a panel heading is the same element
 * on a laptop as on a phone. So both forms are written into the markup and CSS chooses: `md:hidden`
 * carries the phone's, `max-md:hidden` the full one. jsdom applies no CSS, so these tests read the
 * classes rather than what is on screen.
 */
function Line({ text, kind }: { text: string; kind: "admin" | null }) {
  const Inner = () => {
    const { node, hidePhone } = useTightLine("bsub", text);
    return <p data-testid="line" className={hidePhone ? "max-md:hidden" : ""}>{node}</p>;
  };
  return <PhoneKindProvider value={kind}><Inner /></PhoneKindProvider>;
}

const long = "How each arm performed. Open one for its broadsheet, then any child for their full result.";
const dropped = "The whole school's day, arm by arm, as each form master recorded it on the morning register this term.";

describe("the phone’s copy rule, where one element serves both widths", () => {
  it("writes both forms, so a laptop keeps the sentence a phone cannot hold", () => {
    render(<Line text={long} kind="admin" />);
    const phone = screen.getByText("How each arm performed.");
    expect(phone.className).toBe("md:hidden");
    const full = screen.getByText(long);
    expect(full.className).toBe("max-md:hidden");
  });

  it("takes the whole line off a phone when the rule drops it, and leaves it on a laptop", () => {
    render(<Line text={dropped} kind="admin" />);
    expect(screen.getByText(dropped).className).toBe("max-md:hidden");
    // nothing for a phone to show, so the paragraph itself goes rather than leaving its margin
    expect(screen.getByTestId("line").className).toBe("max-md:hidden");
  });

  it("leaves a line alone outside a portal that has a phone design", () => {
    render(<Line text={long} kind={null} />);
    const only = screen.getByText(long);
    expect(only.tagName).toBe("P");
    expect(only.className).toBe("");
  });

  it("leaves a line the rule would not touch as one piece of text", () => {
    const short = "Every form master, and the arms they answer for.";
    render(<Line text={short} kind="admin" />);
    const only = screen.getByText(short);
    expect(only.tagName).toBe("P");
    expect(only.children).toHaveLength(0);
  });
});
