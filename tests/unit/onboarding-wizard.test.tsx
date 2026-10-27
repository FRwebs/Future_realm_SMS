// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { OnboardingWizard } from "@/components/forms/onboarding-wizard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const server = setupServer(
  http.get("/api/v1/onboarding/countries", () => HttpResponse.json({ ok: true, data: ["Nigeria", "Ghana"] })),
  http.get("/api/v1/onboarding/slug-check", () => HttpResponse.json({ ok: true, data: { tone: "good", badge: "Available", note: "ok" } })),
  http.get("/api/v1/onboarding/school-search", () => HttpResponse.json({ ok: true, data: [] })),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const renderWizard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OnboardingWizard />
    </QueryClientProvider>,
  );

describe("the sign-up wizard", () => {
  it("marks every missing detail beside its field before it lets the first step go", async () => {
    renderWizard();
    await userEvent.click(await screen.findByRole("button", { name: /Continue as school administrator/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Continue|^Next/ }));

    expect(await screen.findByText("Enter your first name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your last name.")).toBeInTheDocument();
    expect(screen.getByText("Select a gender.")).toBeInTheDocument();
    expect(screen.getByText("Enter a phone number.")).toBeInTheDocument();
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Select your position.")).toBeInTheDocument();
    // The notice says there is more to do.
    expect(screen.getByText("This step needs a little more")).toBeInTheDocument();
  });

  it("clears a field's message as soon as it is put right", async () => {
    renderWizard();
    await userEvent.click(await screen.findByRole("button", { name: /Continue as school administrator/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Continue|^Next/ }));
    expect(await screen.findByText("Enter your first name.")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/Nk/), "Ngozi");
    expect(screen.queryByText("Enter your first name.")).not.toBeInTheDocument();
    expect(screen.getByText("Enter your last name.")).toBeInTheDocument();
  });
});
