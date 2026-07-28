import { z } from "zod";

/**
 * Client-side mirrors of the API's validation.
 *
 * These exist to catch mistakes before a round trip, **not** to be a second
 * policy. A rule here that the server does not enforce would reject input the
 * server would have accepted, which is worse than no validation at all — so each
 * one matches the DTO it mirrors.
 *
 * Note the password rules follow the DTO's *validator*, not its message. The
 * backend requires 6 characters (`@MinLength(6)` and
 * `@IsStrongPassword({ minLength: 6, … })`) while its own error text claims 8.
 * The validator is what will actually accept or reject, so the form enforces 6
 * and says so; the server's message is shown verbatim if it ever fires.
 */

export const emailSchema = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase();

/** Mirrors `@Matches(/^[a-z0-9_]+$/)` and `@Length(3, 30)`. The API also
 *  lowercases usernames itself, so the form does too and says so. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(30, "Use 30 characters or fewer.")
  .regex(
    /^[a-z0-9_]+$/,
    "Use lowercase letters, numbers and underscores only.",
  );

export const passwordSchema = z
  .string()
  .min(6, "Use at least 6 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")
  .regex(/[^A-Za-z0-9]/, "Add a symbol.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name."),
    lastName: z.string().trim().optional(),
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
    phoneNumber: z.string().trim().optional(),
  })
  // Confirmation is checked here only: the API's DTO takes it for presence but
  // does not itself compare the two.
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is incomplete."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const recoverAccountSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter the account's password."),
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    newConfirmationPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine(
    (values) => values.newPassword === values.newConfirmationPassword,
    { message: "Passwords do not match.", path: ["newConfirmationPassword"] },
  )
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "Choose a password you have not used here before.",
    path: ["newPassword"],
  });

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code.");

/** Flattens Zod issues into the same `{ field: message }` shape the API's
 *  validation errors are normalised into, so a form renders both identically. */
export function fieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fields[key] ??= issue.message;
  }
  return fields;
}
