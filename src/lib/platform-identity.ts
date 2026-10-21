/**
 * What the platform calls itself and how a school reaches it. Kept as a plain snapshot, refreshed by the platform policy
 * whenever it is read or saved, so code that is not built through Nest's injection (the mailer, helpers) can read it.
 */
export type PlatformIdentity = { platformName: string; supportEmail: string; supportPhone: string; timeZone: string };

let current: PlatformIdentity = { platformName: "FutureRealm SMS", supportEmail: "", supportPhone: "", timeZone: "Africa/Lagos" };

export const platformIdentity = () => current;
export const setPlatformIdentity = (next: PlatformIdentity) => {
  current = next;
};

/** Two lines appended to what the platform emails, so a school always knows who wrote and how to reach them. */
export function identityFooter(): string {
  const { platformName, supportEmail, supportPhone } = current;
  const contact = [supportEmail && `Support: ${supportEmail}`, supportPhone && `Phone: ${supportPhone}`].filter(Boolean).join(" · ");
  return `\n\n— ${platformName}${contact ? `\n${contact}` : ""}`;
}
