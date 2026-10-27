import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";

import en from "../src/messages/en.json";

// The product's own styles and design tokens, so a component looks here exactly as it does in the app.
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Accessibility checks run on every story (the "Accessibility" panel); a violation shows in the panel and fails the test run.
    a11y: { test: "error" },
    nextjs: { appDirectory: true },
  },
  // Components that read the product's words (labels, tab names) get English, as the app does for anyone who has not chosen another language.
  decorators: [(Story) => <NextIntlClientProvider locale="en" messages={en}><Story /></NextIntlClientProvider>],
  tags: ["autodocs"],
};

export default preview;
