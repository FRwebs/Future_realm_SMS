// Matchers like toBeInTheDocument / toHaveFocus, registered once. They only matter in files that opt into jsdom.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // Remembered preferences (hidden columns, drafts) must not leak from one test into the next.
  if (typeof window !== "undefined") window.localStorage.clear();
});

// jsdom has no layout, so it has no scrolling either; components that bring a message into view just need the call to exist.
if (typeof window !== "undefined" && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
