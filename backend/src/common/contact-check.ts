import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

import { emailProblem, phoneProblem, type PhoneKind } from "../../../src/lib/domain/contact";
import { prisma } from "../../../src/lib/db/prisma";

/**
 * The one place the backend asks "is this a phone number / an email address". Two layers, so no path can miss it:
 *  - `phoneText` / `emailText` go inside a request schema and refuse anything that cannot be a number or an address at all;
 *  - `checkContacts` is called once the school is known and applies its country's own phone format from Country Settings.
 */

/** A phone that has the shape of a phone number. Empty stays empty — whether it is required is the schema's business. */
export const phoneText = (kind: PhoneKind = "mobile") =>
  z.string().trim().superRefine((value, ctx) => {
    const problem = phoneProblem(value, { kind, country: "any" });
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** An email address that has a name, an @ and a domain. Empty stays empty. */
export const emailText = () =>
  z.string().trim().superRefine((value, ctx) => {
    const problem = emailProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

export type ContactItem = { field: string; phone?: string | null; email?: string | null; kind?: PhoneKind };

/** The school's country and what Country Settings says its phone numbers look like. */
export async function phoneRuleFor(schoolId: string): Promise<{ pattern: string | null; country: string }> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { country: true } });
  const country = school?.country || "Nigeria";
  const profile = await prisma.countryProfile.findUnique({ where: { country }, select: { phonePattern: true } });
  return { pattern: profile?.phonePattern ?? null, country };
}

/** Refuses, naming each field, every phone or email that is not valid for this school's country. Does nothing for empty values. */
export async function checkContacts(schoolId: string, items: ContactItem[]): Promise<void> {
  const filled = items.filter((item) => item.phone?.trim() || item.email?.trim());
  if (!filled.length) return;
  const rule = filled.some((item) => item.phone?.trim()) ? await phoneRuleFor(schoolId) : { pattern: null, country: "Nigeria" };
  const problems: string[] = [];
  for (const item of filled) {
    const phone = phoneProblem(item.phone, { ...rule, kind: item.kind ?? "mobile" });
    if (phone) problems.push(`${item.field}: ${phone}`);
    const email = emailProblem(item.email);
    if (email) problems.push(`${item.field}: ${email}`);
  }
  if (problems.length) throw new BadRequestException(problems.join(" "));
}
