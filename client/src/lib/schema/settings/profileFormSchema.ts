import { z } from "zod";

export const profileFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, { error: "Full name is required" })
    .max(255, { error: "Full name must be at most 255 characters" }),
  email: z
    .email({ error: "Please enter a valid email address" })
    .trim()
    .min(1, { error: "Email is required" })
    .max(254, { error: "Email must be at most 254 characters" }),
});

export type ProfileFormSchema = z.infer<typeof profileFormSchema>;

export const profileFormDefaultValues: ProfileFormSchema = {
  full_name: "",
  email: "",
};
