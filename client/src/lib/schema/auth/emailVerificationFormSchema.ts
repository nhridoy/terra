import { z } from "zod";

export const emailVerificationFormSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Enter the 6-digit code" }),
});

export type EmailVerificationFormSchema = z.infer<
  typeof emailVerificationFormSchema
>;

export const emailVerificationFormDefaultValues: EmailVerificationFormSchema = {
  otp: "",
};
