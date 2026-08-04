import { z } from "zod";

export const recoveryFormSchema = z
  .object({
    recoveryCode: z
      .string()
      .trim()
      .min(1, { error: "Recovery code is required" }),
    newPassword: z
      .string()
      .min(8, { error: "Password must be at least 8 characters" })
      .max(128, { error: "Password must be at most 128 characters" })
      .regex(/[A-Z]/, {
        error: "Password must contain at least one uppercase letter",
      })
      .regex(/[a-z]/, {
        error: "Password must contain at least one lowercase letter",
      })
      .regex(/\d/, { error: "Password must contain at least one number" })
      .regex(/[^A-Za-z0-9]/, {
        error: "Password must contain at least one special character",
      }),
    confirmPassword: z
      .string()
      .trim()
      .min(1, { error: "Please confirm your password" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RecoveryFormSchema = z.infer<typeof recoveryFormSchema>;

export const recoveryFormDefaultValues: RecoveryFormSchema = {
  recoveryCode: "",
  newPassword: "",
  confirmPassword: "",
};
