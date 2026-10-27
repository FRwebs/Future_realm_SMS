// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { ResourceForm, type ResourceField } from "@/components/forms/resource-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const posted: unknown[] = [];
const server = setupServer(http.post("/api/v1/things", async ({ request }) => { posted.push(await request.json()); return HttpResponse.json({ ok: true }); }));
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { posted.length = 0; refresh.mockClear(); });
afterAll(() => server.close());

const fields: ResourceField[] = [
  { name: "tenant", label: "School", type: "hidden", defaultValue: "greenfield" },
  { name: "name", label: "Name", required: true },
  { name: "email", label: "Contact email", type: "email" },
  { name: "seats", label: "Seats", type: "number", min: 1, max: 50, defaultValue: 10 },
  { name: "tier", label: "Tier", type: "select", options: [{ label: "Basic", value: "basic" }, { label: "Elite", value: "elite" }] },
  { name: "audience", label: "Audience", type: "multiselect", options: [{ label: "Parents", value: "parents" }, { label: "Staff", value: "staff" }] },
  { name: "notify", label: "Notify the school", type: "switch", on: true },
  { name: "locked", label: "Fixed by policy", type: "locked" },
  { name: "reason", label: "Reason", type: "textarea", required: true },
];

const renderForm = () => render(<ResourceForm title="New thing" description="d" endpoint="/api/v1/things" fields={fields} submitLabel="Save thing" chrome="plain" showHeader={false} />);

describe("the resource form", () => {
  it("says what each field needs, beside it, and sends nothing until they are in order", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/Contact email/), "nope");
    await userEvent.clear(screen.getByLabelText(/Seats/));
    await userEvent.type(screen.getByLabelText(/Seats/), "99");
    await userEvent.click(screen.getByRole("button", { name: "Save thing" }));

    expect(await screen.findByText("Name is needed.")).toBeInTheDocument();
    expect(screen.getByText("Reason is needed.")).toBeInTheDocument();
    expect(screen.getByText("That does not look like an email address.")).toBeInTheDocument();
    expect(screen.getByText("Use 50 or less.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("aria-invalid", "true");
    expect(posted).toEqual([]);
  });

  it("posts what was chosen, in the shape the API reads", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/Name/), "Term fee");
    await userEvent.selectOptions(screen.getByLabelText(/Tier/), "elite");
    await userEvent.click(screen.getByRole("button", { name: "Staff" }));
    await userEvent.click(screen.getByRole("switch", { name: /Notify the school/ }));
    await userEvent.type(screen.getByLabelText(/Reason/), "Board decision");
    await userEvent.click(screen.getByRole("button", { name: "Save thing" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      tenant: "greenfield",
      name: "Term fee",
      email: "",
      seats: "10",
      tier: "elite",
      audience: JSON.stringify(["staff"]),
      notify: "false",
      reason: "Board decision",
    });
    expect(await screen.findByText("Saved successfully.")).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
