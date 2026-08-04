import { z } from "zod";

export const groupFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Group name is required" })
    .max(255, { error: "Group name must be at most 255 characters" }),
});

export type GroupFormSchema = z.infer<typeof groupFormSchema>;

export const groupFormDefaultValues: GroupFormSchema = {
  name: "",
};
