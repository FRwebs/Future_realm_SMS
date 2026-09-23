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
    globals: true
  }
});
