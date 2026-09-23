import type { ModuleContent, TabContent } from "@/lib/modules/panels";

/**
 * "My account" — the personal page every member of staff reaches from the
 * account menu rather than the sidebar. The mockup keeps it outside the sixteen
 * modules: it is about the person, not the school.
 */
export const accountTabs = [
  { slug: "profile", label: "Profile" },
  { slug: "preferences", label: "Preferences" },
  { slug: "security", label: "Security" },
  { slug: "my-activity", label: "My activity" },
] as const;

export const accountPath = "/account/profile";

/** Panels the mockup places on each tab of the account page. */
const plannedPanels: Record<string, string[]> = {
  profile: ["Your details", "Your access", "Photograph and appearance"],
  preferences: ["How the product opens for you", "What reaches me"],
  security: ["Change your password", "Where you are signed in"],
  "my-activity": ["What you have done"],
};

export const accountContent: ModuleContent = Object.fromEntries(
  accountTabs.map((tab): [string, TabContent] => [
    tab.slug,
    {
      title: tab.label,
      desc: "Your own account — what the school holds about you, and how this opens for you.",
      rows: [
        {
          cols: "1fr",
          panels: [
            {
              type: "pending",
              title: `My account · ${tab.label}`,
              body: "The mockup keeps this page outside the sixteen modules, reached from the account menu. This tab's surface is not built yet.",
              contains: plannedPanels[tab.slug] ?? [],
            },
          ],
        },
      ],
    },
  ]),
);
