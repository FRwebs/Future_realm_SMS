// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { PanelRows } from "@/components/modules/panel-renderer";
import { name, row, text, type Panel, type TableRow, type TableWindow } from "@/lib/modules/panels";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh: vi.fn() }) }));

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // jsdom's AbortSignal is not the one Node's fetch knows; the browser has only one, so the test lets the request go without it.
  const intercepted = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => intercepted(typeof input === "string" && input.startsWith("/") ? `http://localhost${input}` : input, { ...init, signal: undefined })) as typeof fetch;
});
afterEach(() => { server.resetHandlers(); replace.mockClear(); push.mockClear(); window.history.replaceState(null, "", "/"); });
afterAll(() => server.close());

const people = ["Ada", "Bola", "Chidi", "Dayo", "Efe"];
const rowsFor = (names: string[]): TableRow[] => names.map((who) => ({ id: who, cells: [name(who), text("JSS 1")], keywords: who }));
const windowOf = (page: number, matched: number, q = ""): TableWindow => ({ key: "t0_0", page, size: 2, matched, total: 5, q, filters: {}, exportUrl: "/table-export?m=a&t=b&r=0&p=0", pageUrl: "/table-window?m=a&t=b&r=0&p=0" });
const panelOf = (page: number, names: string[], matched = 5, q = ""): Panel => ({ type: "table", title: "Students", head: ["Student", "Class"], rows: rowsFor(names), window: windowOf(page, matched, q), search: "Search students", noun: "student", nounPlural: "students", selectable: true });

function renderTable(panel: Panel) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PanelRows rows={[row("1fr", [panel])]} /></QueryClientProvider>);
}

/** The page asked for, as the server is told it. */
const askedOf = (request: Request) => JSON.parse(new URL(request.url).searchParams.get("q") ?? "{}") as Record<string, string>;

describe("a long list that arrives a page at a time", () => {
  it("fetches the page asked for, keeps the address in step, and never redraws the page around it", async () => {
    const asked: Array<Record<string, string>> = [];
    server.use(http.get("*/table-window", ({ request }) => {
      const query = askedOf(request);
      asked.push(query);
      const page = Number(query.t0_0_p ?? 1);
      return HttpResponse.json({ ok: true, data: { rows: rowsFor(people.slice((page - 1) * 2, page * 2)), window: windowOf(page, 5) } });
    }));
    renderTable(panelOf(1, ["Ada", "Bola"]));

    // The first view was drawn with the page; nothing was fetched to show it.
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(asked).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Chidi")).toBeInTheDocument();
    expect(screen.queryByText("Ada")).toBeNull();
    expect(asked.some((query) => query.t0_0_p === "2")).toBe(true);
    expect(window.location.search).toContain("t0_0_p=2");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the rows on screen while the next page loads, then swaps them", async () => {
    let release: () => void = () => undefined;
    server.use(http.get("*/table-window", async ({ request }) => {
      const query = askedOf(request);
      if (query.t0_0_p === "3") await new Promise<void>((resolve) => { release = resolve; });
      const page = Number(query.t0_0_p ?? 1);
      return HttpResponse.json({ ok: true, data: { rows: rowsFor(people.slice((page - 1) * 2, page * 2)), window: windowOf(page, 5) } });
    }));
    renderTable(panelOf(1, ["Ada", "Bola"]));
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Chidi");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    // Page 3 has not arrived: page 2 is still there, and says it is busy.
    expect(screen.getByText("Chidi")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[aria-busy='true']")).not.toBeNull());
    release();
    expect(await screen.findByText("Efe")).toBeInTheDocument();
  });

  it("searches on the server after a pause, and says so plainly when a page cannot be had", async () => {
    server.use(http.get("*/table-window", ({ request }) => {
      const query = askedOf(request);
      if (query.t0_0_q === "boom") return HttpResponse.json({ ok: false, error: "The school list is not available." }, { status: 500 });
      return HttpResponse.json({ ok: true, data: { rows: rowsFor(["Dayo"]), window: windowOf(1, 1, query.t0_0_q ?? "") } });
    }));
    renderTable(panelOf(1, ["Ada", "Bola"]));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search students" }), "dayo");
    expect(await screen.findByText("Dayo")).toBeInTheDocument();
    expect(window.location.search).toContain("t0_0_q=dayo");

    await userEvent.clear(screen.getByRole("searchbox", { name: "Search students" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search students" }), "boom");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The school list is not available.")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("lets a row be ticked on the page that is showing, and starts clean on the next", async () => {
    server.use(http.get("*/table-window", ({ request }) => {
      const page = Number(askedOf(request).t0_0_p ?? 1);
      return HttpResponse.json({ ok: true, data: { rows: rowsFor(people.slice((page - 1) * 2, page * 2)), window: windowOf(page, 5) } });
    }));
    renderTable({ ...panelOf(1, ["Ada", "Bola"]), bulkActs: [{ label: "Send notice" }] } as Panel);
    await userEvent.click(screen.getAllByRole("checkbox", { name: "Select this student" })[0]!);
    expect(screen.getByText(/1 student\s+selected/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Chidi");
    expect(screen.queryByText(/selected/)).toBeNull();
  });
});
