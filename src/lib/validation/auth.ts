import { z } from "zod";

import en from "@/messages/en.json";

/**
 * What a person must give to sign in, recover or reset — one set of rules. The words each rule says under a field are passed in, so the
 * screen can speak the person's language; the English set below is what the API and the tests use. The same schemas can be handed to the
 * API so the screen and the server never disagree about what is acceptable.
 */
export type AuthValidationMessages = typeof en.auth.validation;

export const createSignInSchema = (m: AuthValidationMessages) =>
  z.object({
    identifier: z.string().trim().min(1, m.identifierRequired),
    password: z.string().min(1, m.passwordRequired),
    trustDevice: z.boolean(),
  });
export type SignInValues = z.infer<ReturnType<typeof createSignInSchema>>;

export const createSignInCodeSchema = (m: AuthValidationMessages) => z.object({ code: z.string().trim().min(1, m.codeRequired) });
export type SignInCodeValues = z.infer<ReturnType<typeof createSignInCodeSchema>>;

export const createForgotPasswordSchema = (m: AuthValidationMessages) =>
  z.object({
    email: z.string().trim().superRefine((value, context) => {
      if (!value) context.addIssue({ code: "custom", message: m.emailRequired });
      else if (!z.string().email().safeParse(value).success) context.addIssue({ code: "custom", message: m.emailInvalid });
    }),
  });
export type ForgotPasswordValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

export const createResetPasswordSchema = (m: AuthValidationMessages) =>
  z
    .object({
      // One message at a time: nothing to say about length until something has been typed.
      password: z.string().superRefine((value, context) => {
        if (!value) context.addIssue({ code: "custom", message: m.newPasswordRequired });
        else if (value.length < 8) context.addIssue({ code: "custom", message: m.passwordTooShort });
      }),
      confirmPassword: z.string().min(1, m.confirmRequired),
    })
    .refine((values) => !values.confirmPassword || values.password === values.confirmPassword, { path: ["confirmPassword"], message: m.passwordMismatch });
export type ResetPasswordValues = z.infer<ReturnType<typeof createResetPasswordSchema>>;

export const signInSchema = createSignInSchema(en.auth.validation);
export const signInCodeSchema = createSignInCodeSchema(en.auth.validation);
export const forgotPasswordSchema = createForgotPasswordSchema(en.auth.validation);
export const resetPasswordSchema = createResetPasswordSchema(en.auth.validation);
