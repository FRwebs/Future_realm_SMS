// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
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

const term = { id: "t2", name: "Second Term" } as unknown as AddOptions["term"];
const options: AddOptions = {
  term, nextTerm: null, weeks: 2, held: [],
  subjects: [{ id: "s1", name: "Biology", periodsPerWeek: 4, levels: ["JSS_1"], section: "JUNIOR_SECONDARY" }],
  levels: [{ id: "l1", name: "JSS 1", arms: [{ id: "a1", name: "JSS 1 A" }, { id: "a2", name: "JSS 1 B" }] }],
  catalogue: [], curricula: ["Nigerian NERDC"], assessments: ["Test"], defaultLesson: 40,
};

describe("adding a subject", () => {
  it("says what is missing until the subject, the arm and a week are chosen, then sends exactly what was planned", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(http.post("*/curriculum/add", async ({ request }) => { sent = (await request.json()) as Record<string, unknown>; return HttpResponse.json({ ok: true, data: { subjectId: "s1", subject: "Biology", arms: ["JSS 1 A"], told: 1 } }); }));
    render(<AddSubject options={options} />);
    expect(screen.getByText("Choose the subject.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Biology/ }));
    expect(screen.getByText("Choose the level and at least one arm.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Level" }), "l1");
    await userEvent.click(await screen.findByRole("checkbox", { name: /JSS 1 A/ }));
    expect(screen.getByText("Plan at least one week.")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Week 1 topic" }), "Cells");
    expect(screen.queryByText("Plan at least one week.")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Add the subject" }));
    await userEvent.click(await screen.findByRole("button", { name: "Add it" }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({ subjectId: "s1", classIds: ["a1"], periodsPerWeek: 4, lessonMinutes: 40 });
    expect((sent!.weeks as Array<{ topic: string }>)[0]!.topic).toBe("Cells");
  });
});
