import { z } from "zod";

export const registerFormSchema = z
  .object({
    email: z
      .email({ error: "Please enter a valid email address" })
      .trim()
      .min(1, { error: "Email is required" })
      .max(254, { error: "Email must be at most 254 characters" }),
    username: z
      .string()
      .trim()
      .min(1, { error: "Username is required" })
      .min(3, { error: "Username must be at least 3 characters" })
      .max(32, { error: "Username must be at most 32 characters" })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        error:
          "Username can only contain letters, numbers, underscores, and hyphens",
      }),
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

export type RegisterFormSchema = z.infer<typeof registerFormSchema>;

export const requiredFields = Object.entries(registerFormSchema.shape).reduce(
  (acc, [key, schema]) =>
    !schema.safeParse(undefined).success ? [...acc, key] : acc,
  [] as string[],
);

export const registerFormDefaultValues: RegisterFormSchema = {
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
};
