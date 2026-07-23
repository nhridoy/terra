import { z } from "zod";

export const createTeamFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Team name is required" })
    .max(255, { error: "Team name must be at most 255 characters" }),
  description: z.string().max(1024).optional(),
});

export type CreateTeamFormSchema = z.infer<typeof createTeamFormSchema>;

export const createTeamFormDefaultValues: CreateTeamFormSchema = {
  name: "",
  description: "",
};
