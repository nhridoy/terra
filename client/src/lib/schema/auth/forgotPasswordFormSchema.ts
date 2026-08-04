import { z } from "zod";

export const forgotPasswordFormSchema = z.object({
  email: z
    .email({ error: "Please enter a valid email address" })
    .trim()
    .min(1, { error: "Email is required" })
    .max(254, { error: "Email must be at most 254 characters" }),
});

export type ForgotPasswordFormSchema = z.infer<typeof forgotPasswordFormSchema>;

export const forgotPasswordFormDefaultValues: ForgotPasswordFormSchema = {
  email: "",
};
