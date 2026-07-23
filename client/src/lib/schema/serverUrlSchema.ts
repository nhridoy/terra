import { z } from "zod";

export const serverUrlSchema = z.object({
  serverUrl: z.url("Please enter a valid URL").optional().or(z.literal("")),
});

export type ServerUrlSchema = z.infer<typeof serverUrlSchema>;

export const serverUrlDefaultValues: ServerUrlSchema = {
  serverUrl: "",
};
