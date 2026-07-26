import { z } from "zod";

export const nameFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Name is required" })
    .max(255, { error: "Name must be at most 255 characters" })
    .refine((val) => !val.includes("/") && !val.includes("\\"), {
      error: "Name cannot contain / or \\",
    }),
});

export type NameFormSchema = z.infer<typeof nameFormSchema>;

export const nameFormDefaultValues: NameFormSchema = {
  name: "",
};
