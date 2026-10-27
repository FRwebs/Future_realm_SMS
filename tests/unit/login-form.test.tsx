// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { NextIntlClientProvider } from "next-intl";
import { setupServer } from "msw/node";

import { LoginForm } from "@/components/forms/login-form";
import messages from "@/messages/en.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/api/wake", () => ({ wakeApi: async () => "ready", useApiState: () => "ready" }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); push.mockClear(); });
afterAll(() => server.close());

const renderForm = () => render(<NextIntlClientProvider locale="en" messages={messages}><LoginForm /></NextIntlClientProvider>);

describe("the sign-in form", () => {
  it("ties every label to its field", () => {
    renderForm();
    expect(screen.getByLabelText("Email address or User ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("says what is missing beside each field, and how many things in total", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your email address or User ID.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByText("Two things are needed to sign in")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("names a single gap as one thing", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("Email address or User ID"), "a@school.ng");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("One thing is needed to sign in")).toBeInTheDocument();
  });

  it("shows the server's own words when the details are wrong", async () => {
    server.use(http.post("/api/v1/auth/login", () => HttpResponse.json({ ok: false, error: "Wrong email or password." }, { status: 401 })));
    renderForm();
    await userEvent.type(screen.getByLabelText("Email address or User ID"), "a@school.ng");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Sign-in failed")).toBeInTheDocument();
    expect(screen.getByText("Wrong email or password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("asks for the code when the account needs one, then signs in", async () => {
    let calls = 0;
    server.use(
      http.post("/api/v1/auth/login", async ({ request }) => {
        calls += 1;
        const body = (await request.json()) as { mfaCode?: string };
        if (!body.mfaCode) return HttpResponse.json({ ok: false, code: "MFA_REQUIRED", channel: "APP" }, { status: 401 });
        return HttpResponse.json({ ok: true, data: { user: { role: "TEACHER" } } });
      }),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText("Email address or User ID"), "t@school.ng");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const code = await screen.findByLabelText("Authentication code");
    expect(code).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByText("Enter the 6-digit code.")).toBeInTheDocument();

    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByText("Signed in")).toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls).toBe(2);
  });
});
