import { getTranslations } from "next-intl/server";

import { myProfileContract } from "@/lib/api/contracts";
import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { LOCALES } from "@/i18n/locales";
import { FAMILY_KINDS } from "@/lib/messaging/family-choices";
import { languagePanel, type AccountWords, type MyProfile } from "@/lib/modules/account";
import { row } from "@/lib/modules/panels";
import { PW, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Prefs = {
  matrix: Record<string, boolean>; quiet: string; quietOptions: string[];
  reach: { sms: boolean; email: boolean; phone: string | null; address: string | null };
};

const CHANNELS = [
  { key: "In-app", label: "In-app", sub: "Always available", locked: true },
  { key: "SMS", label: "SMS", sub: "Paid for by the school" },
  { key: "Email", label: "Email", sub: "From the school" },
  // Drawn because the mockup draws it, and fixed off because the school has no WhatsApp sender yet.
  { key: "WhatsApp", label: "WhatsApp", sub: "Not offered yet", unavailable: true },
];

/** Quiet hours are held in the account as the window to keep quiet, so each is offered in the words the delivery worker obeys. */
const QUIET_WORDS: Record<string, string> = { None: "Any time" };

export async function prefsPage(): Promise<ParentContent> {
  const t = await getTranslations("shell.account");
  const words: AccountWords = {
    language: t("language"), languageSub: t("languageSub"), languageHint: LOCALES.length > 1 ? t("languageHint") : t("languageHintOff"),
    saved: t("savedLanguage"), save: t("saveLanguage"),
  };
  const [me, prefs, mine] = await Promise.all([
    loadMe(),
    apiGet(`${PW}/prefs`, observe<Prefs>(localContracts["src/lib/modules/live/parent/prefs.ts#82621fee"])),
    apiGet("/api/v1/profile/me", myProfileContract).catch(() => ({}) as MyProfile),
  ]);
  const gaps = [
    !prefs.reach.sms ? "The school has no mobile number it may text for you, so the SMS column has no effect until it does." : "",
    !prefs.reach.email ? "The school has no email address it may write to for you, so the Email column has no effect until it does." : "",
  ].filter(Boolean).join(" ");
  const quietOptions = prefs.quietOptions.map((option) => QUIET_WORDS[option] ?? `Not ${option.replace(" WAT", "")}`);
  const toLabel = (value: string) => QUIET_WORDS[value] ?? `Not ${value.replace(" WAT", "")}`;
  return {
    eyebrow: "Your account", title: "Notifications",
    desc: `How each kind of message from ${me.school} reaches you.`,
    rows: [
      row("1fr", [{
        type: "embed", component: "student-prefs",
        props: {
          base: PW,
          categories: FAMILY_KINDS.map((kind) => ({ key: kind.key, label: kind.label, sub: kind.sub })),
          channels: CHANNELS,
          matrix: prefs.matrix,
          defaults: Object.fromEntries(FAMILY_KINDS.flatMap((kind) => [[`${kind.key}:SMS`, true], [`${kind.key}:Email`, true]])),
          quiet: toLabel(prefs.quiet), remind: "Combine them",
          quietOptions, remindOptions: ["Combine them"],
          // The embed saves what was clicked; the page turns the words back into what the account keeps.
          quietCodes: Object.fromEntries(prefs.quietOptions.map((option) => [toLabel(option), option])),
          foot: `Safety and emergency messages — closures, safeguarding, your child’s safety — always reach you on every channel, whatever you choose here. Everything also appears in the portal. ${gaps}`.trim(),
          copy: {
            lead: "Channels by kind of message", sub: "Everything always appears here in the portal. SMS and email follow these choices the next time the school writes.",
            first: "Kind of message", timing: "When and how",
            quietTitle: "Quiet hours", quietSub: "Texts and emails in this window wait until it ends — except safety messages.",
            remindTitle: "One message for all your children", remindSub: "Writing about two of your children? The school sends one message to your family with every name in it. Separate messages are not offered yet.",
            remindField: "digest",
          },
        },
      }]),
      row("1fr", [languagePanel(mine, words)]),
    ],
  };
}
