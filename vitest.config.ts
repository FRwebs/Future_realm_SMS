import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  // tsconfig leaves JSX to Next ("preserve"), so tell esbuild to use the
  // automatic runtime when a test renders a component.
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "node",
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Playwright owns tests/e2e (see playwright.config.ts). Vitest cannot run
      // a Playwright spec, and collecting one fails the whole run.
      "tests/e2e/**",
      // Worktrees the desktop app creates hold full copies of this repo, so
      // without this every test is collected twice — once from a stale copy.
      "**/.claude/worktrees/**"
    ]
  }
});
