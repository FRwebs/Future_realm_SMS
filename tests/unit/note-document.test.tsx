// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { NoteDocument } from "@/components/modules/lesson-notes/note-document";
import type { NoteData } from "@/lib/modules/lesson-notes-types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); refresh.mockClear(); });
afterAll(() => server.close());

const note = {
  subjectId: "s1", subject: "Biology", arms: ["JSS 1 A"], earlyYears: false, readOnly: false, week: 3, dates: "20–24 Oct", weeks: 12,
  term: { id: "t2", name: "Second Term" }, topic: "Cells", subtopics: [], schemeStatus: "Approved", assessment: null, periods: 3, resources: [], taughtTo: [],
  sections: [
    { key: "objectives", label: "Objectives", hint: "What pupils will be able to do", placeholder: "By the end…", required: true },
    { key: "activities", label: "Activities", hint: "What happens in the lesson", placeholder: "Pupils…", required: false },
  ],
  text: { objectives: "Name the parts of a cell." }, planId: "p1", state: "Draft", version: 1, thread: [], returned: null, resubmitReply: null, signedBy: null, signedAt: null,
  submittedAt: null, signer: { name: "Mrs Bello" }, reuse: null, draft: {}, letterhead: { name: "Greenfield College" }, previous: null, next: null, person: "Mr Ade", updatedAt: "2026-10-20T08:00:00.000Z",
} as unknown as NoteData;

describe("writing a lesson note", () => {
  it("says there are unsaved changes only once something differs from what was saved, and not after it has been saved", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(http.post("*/teacher-workspace/notes/s1/3", async ({ request }) => { sent = (await request.json()) as Record<string, unknown>; return HttpResponse.json({ ok: true, data: { id: "p1", state: "Draft", written: 2, updatedAt: "2026-10-20T08:05:00.000Z" } }); }));
    render(<NoteDocument data={note} />);
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    const saveButton = screen.getByRole("button", { name: "Save draft" });
    expect(saveButton).toBeDisabled();

    const box = screen.getByRole("textbox", { name: "Activities" });
    await userEvent.type(box, "Draw a cell");
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    expect(saveButton).toBeEnabled();

    // Put back exactly as it was: nothing differs, so nothing is unsaved.
    await userEvent.clear(box);
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).toBeNull());
    await userEvent.type(box, "Draw a cell");

    await userEvent.click(saveButton);
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({ sections: { objectives: "Name the parts of a cell.", activities: "Draw a cell" }, termId: "t2", base: "2026-10-20T08:00:00.000Z" });
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).toBeNull());
    expect(refresh).toHaveBeenCalled();
  });
});
