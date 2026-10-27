// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  plugins: {
    "@next/next": nextPlugin,
    "react-hooks": reactHooks,
    "jsx-a11y": jsxA11y
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    // Hooks: a missing dependency is a stale value waiting to happen.
    // An unused argument kept for the shape of a call (named with a leading underscore) is deliberate.
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // Accessibility: the rules that catch what a screen reader or keyboard user would hit.
    ...jsxA11y.flatConfigs.recommended.rules
  }
}, {
  // Build, seed and deployment scripts run in Node, not the browser.
  files: ["scripts/**", "api/**", "*.config.{js,mjs,cjs}", "prisma/**"],
  languageOptions: { globals: { ...globals.node } },
  rules: { "@typescript-eslint/no-require-imports": "off" }
}, {
  // The service worker runs in a worker, with its own globals (caches, self, clients).
  files: ["public/sw.js"],
  languageOptions: { globals: { ...globals.serviceworker } }
}, {
  ignores: [".next/**", "dist/**", "node_modules/**", "next-env.d.ts", "postcss.config.js", "playwright-report/**", "test-results/**"]
}, storybook.configs["flat/recommended"]);
