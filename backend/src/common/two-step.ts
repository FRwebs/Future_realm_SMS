/**
 * Who has to confirm a sign-in with a second step, and whether the school's server can give them one.
 *
 * The people who run the platform and the school's own leaders — its owner, Proprietor, Principal and Bursar — move money and publish
 * results, so each sign-in is confirmed with a code sent to their email. One place says who, so the sign-in, the notice on the sign-in
 * page and what My account tells a person about their own protection can never disagree.
 */
export const EMAIL_MFA_ROLES = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "BURSAR", "PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER", "SUPPORT_AGENT", "SALES_MANAGER", "DEVELOPER"]);

/** Without a mail server the code cannot reach anyone, so requiring it would lock every leader out. AUTH_EMAIL_MFA=on forces it regardless. */
export const emailMfaWorks = () => process.env.AUTH_EMAIL_MFA === "on" || (process.env.AUTH_EMAIL_MFA !== "off" && Boolean(process.env.SMTP_HOST));

export const needsSecondStep = (role: string) => EMAIL_MFA_ROLES.has(role);

/** What a person's own protection is, in the words My account needs: is a second step required of them, and does a code actually reach them. */
export const twoStepFor = (role: string) => ({ required: needsSecondStep(role), byEmail: needsSecondStep(role) && emailMfaWorks() });
