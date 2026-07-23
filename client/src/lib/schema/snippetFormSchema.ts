import { z } from "zod";

export const snippetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Snippet name is required" })
    .max(255, { error: "Snippet name must be at most 255 characters" }),
  command: z
    .string()
    .trim()
    .min(1, { error: "Command is required" })
    .max(10000, { error: "Command must be at most 10000 characters" }),
  description: z.string().max(1024).optional(),
  tags: z.string().optional(),
});

export type SnippetFormSchema = z.infer<typeof snippetFormSchema>;

export const snippetFormDefaultValues: SnippetFormSchema = {
  name: "",
  command: "",
  description: "",
  tags: "",
};
