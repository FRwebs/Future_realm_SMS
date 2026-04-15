import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  {
    ignores: [".next/**", "dist/**", "node_modules/**", "next-env.d.ts", "postcss.config.js", "playwright-report/**", "test-results/**"]
  }
);
