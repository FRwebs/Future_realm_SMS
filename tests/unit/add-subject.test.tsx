// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { AddSubject } from "@/components/modules/lesson-notes/add-subject";
import type { AddOptions } from "@/lib/modules/lesson-notes-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); push.mockClear(); });
afterAll(() => server.close());

const term = { id: "t2", name: "Second Term", startsOn: "2026-01-12T00:00:00.000Z", weeks: 3, current: null } as unknown as AddOptions["term"];
const options: AddOptions = {
  term, nextTerm: null, weeks: 3, held: [],
  subjects: [{ id: "s1", name: "Biology", periodsPerWeek: 4, levels: ["JSS_1"], section: "JUNIOR_SECONDARY" }],
  levels: [{ id: "l1", name: "JSS 1", arms: [{ id: "a1", name: "JSS 1 A" }, { id: "a2", name: "JSS 1 B" }] }],
  catalogue: [], curricula: ["Nigerian NERDC"], assessments: ["Test"], defaultLesson: 40,
};

describe("adding a subject", () => {
  it("fills the preview in as the steps are answered, shows the whole scheme, and sends exactly what was planned", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(http.post("*/curriculum/add", async ({ request }) => { sent = (await request.json()) as Record<string, unknown>; return HttpResponse.json({ ok: true, data: { subjectId: "s1", subject: "Biology", arms: ["JSS 1 A"], told: 1 } }); }));
    render(<AddSubject options={options} />);

    // Nothing chosen: the preview names what is missing and will not go on.
    expect(screen.getByText("Choose a subject")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview and add" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Biology/ }));
    expect(screen.getByText("Choose the level and at least one arm.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Level" }), "l1");
    await userEvent.click(await screen.findByRole("checkbox", { name: "JSS 1 A" }));
    expect(screen.getByText("Plan at least one week.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview and add Biology" })).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "Week 1 topic" }), "Cells");
    await userEvent.type(screen.getByRole("textbox", { name: "Week 1 sub-topics" }), "Cell wall; Nucleus");
    expect(screen.getByText("2 weeks are still empty · fine, name them later")).toBeInTheDocument();

    // The preview is a page of its own: every week, nothing saved yet.
    await userEvent.click(screen.getByRole("button", { name: "Preview and add Biology" }));
    expect(await screen.findByText("Preview · Biology")).toBeInTheDocument();
    expect(screen.getByText("Cell wall · Nucleus")).toBeInTheDocument();
    expect(sent).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Add Biology to my curriculum" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("1 of 3")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Add Biology" }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({ subjectId: "s1", classIds: ["a1"], periodsPerWeek: 4, lessonMinutes: 40 });
    const weeks = sent!.weeks as Array<{ topic: string; subtopics: string[] }>;
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toMatchObject({ topic: "Cells", subtopics: ["Cell wall", "Nucleus"] });
  });

  it("goes back to editing from the preview without losing what was typed", async () => {
    render(<AddSubject options={options} />);
    await userEvent.click(screen.getByRole("button", { name: /Biology/ }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Level" }), "l1");
    await userEvent.click(await screen.findByRole("checkbox", { name: "JSS 1 B" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Week 1 topic" }), "Cells");
    await userEvent.click(screen.getByRole("button", { name: "Preview and add Biology" }));
    await userEvent.click(await screen.findByRole("button", { name: "Back to editing" }));
    expect(screen.getByRole("textbox", { name: "Week 1 topic" })).toHaveValue("Cells");
  });

  it("lays a standard outline into the weeks of the term and carries what does not fit into the next", async () => {
    const withOutline: AddOptions = {
      ...options,
      nextTerm: { id: "t3", name: "Third Term" } as unknown as AddOptions["nextTerm"],
      catalogue: [{ id: "c1", curriculum: "Nigerian NERDC", subject: "Biology", stage: "JSS 1", term: 2, source: "NERDC Biology", topics: 4 }],
    };
    server.use(http.get("*/curriculum/add/outline/c1", () => HttpResponse.json({ ok: true, data: { id: "c1", label: "Nigerian NERDC · Biology · JSS 1", source: "NERDC Biology", weeks: [
      { week: 1, topic: "Cells", subtopics: ["Cell wall", "Nucleus"], assessment: "Quiz" }, { week: 2, topic: "Tissues", subtopics: [], assessment: null }, { week: 5, topic: "Ecology", subtopics: ["Habitats"], assessment: null },
    ] } })));
    render(<AddSubject options={withOutline} />);
    await userEvent.click(screen.getByRole("button", { name: /Biology/ }));
    expect(screen.getByRole("radio", { name: /Standard curriculum/ })).toBeDisabled(); // no level yet, so nothing to match
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Level" }), "l1");
    await userEvent.click(screen.getByRole("radio", { name: /Standard curriculum/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Week 1 topic" })).toHaveValue("Cells"));
    expect(screen.getByRole("textbox", { name: "Week 1 sub-topics" })).toHaveValue("Cell wall; Nucleus");
    expect(screen.getByRole("textbox", { name: "Week 3 topic" })).toHaveValue("");
    expect(screen.getAllByText(/1 more topic from the outline goes into Third Term/).length).toBeGreaterThan(0);
  });
});
