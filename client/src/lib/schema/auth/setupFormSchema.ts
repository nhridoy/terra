import { z } from "zod";

export const setupFormSchema = z
  .object({
    password: z
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
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SetupFormSchema = z.infer<typeof setupFormSchema>;

export const setupFormDefaultValues: SetupFormSchema = {
  password: "",
  confirmPassword: "",
};
