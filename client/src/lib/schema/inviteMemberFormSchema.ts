import { z } from "zod";

export const inviteMemberFormSchema = z.object({
  email: z
    .email({ error: "Please enter a valid email address" })
    .trim()
    .min(1, { error: "Email is required" })
    .max(254, { error: "Email must be at most 254 characters" }),
  role: z.enum(["member", "admin"]),
});

export type InviteMemberFormSchema = z.infer<typeof inviteMemberFormSchema>;

export const inviteMemberFormDefaultValues: InviteMemberFormSchema = {
  email: "",
  role: "member",
};
