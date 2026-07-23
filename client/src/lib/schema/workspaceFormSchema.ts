import { z } from "zod";

export const workspaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Workspace name is required" })
    .max(255, { error: "Workspace name must be at most 255 characters" }),
});

export type WorkspaceFormSchema = z.infer<typeof workspaceFormSchema>;

export const workspaceFormDefaultValues: WorkspaceFormSchema = {
  name: "",
};
