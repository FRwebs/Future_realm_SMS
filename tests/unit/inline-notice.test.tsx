import { renderToStaticMarkup } from "react-dom/server";

import { FieldMessage, InlineNotice } from "@/components/ui/inline-notice";

describe("inline notices", () => {
  it("renders nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(<InlineNotice notice={null} />)).toBe("");
    expect(renderToStaticMarkup(<FieldMessage id="x" />)).toBe("");
  });

  it("announces failures and warnings as alerts, and successes politely", () => {
    const error = renderToStaticMarkup(<InlineNotice notice={{ variant: "error", title: "Sign-in failed", description: "Wrong password." }} />);
    expect(error).toContain('role="alert"');
    expect(error).toContain("Sign-in failed");
    expect(error).toContain("Wrong password.");

    const warning = renderToStaticMarkup(<InlineNotice notice={{ variant: "warning", title: "Enter your password." }} />);
    expect(warning).toContain('role="alert"');

    const success = renderToStaticMarkup(<InlineNotice notice={{ variant: "success", title: "Saved" }} />);
    expect(success).toContain('role="status"');
    expect(success).not.toContain('role="alert"');
  });

  it("can always be put away, whether or not the caller owns the dismissal", () => {
    const notice = { variant: "info" as const, title: "Heads up" };
    // A message you have read should never be something you have to read around. Where the caller
    // passes nothing, the bar closes itself; where it does, dismissing is the caller's to define.
    expect(renderToStaticMarkup(<InlineNotice notice={notice} />)).toContain("Dismiss this message");
    expect(renderToStaticMarkup(<InlineNotice notice={notice} onDismiss={() => {}} />)).toContain("Dismiss this message");
  });

  it("ties a field message to its field by id", () => {
    const html = renderToStaticMarkup(<FieldMessage id="email-error">Enter your email address.</FieldMessage>);
    expect(html).toContain('id="email-error"');
    expect(html).toContain("Enter your email address.");
  });
});
