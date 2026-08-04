import { z } from "zod";

export const generateKeyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Key name is required" })
    .max(255, { error: "Key name must be at most 255 characters" }),
  description: z.string().max(1024).optional(),
  keyType: z.enum(["ed25519", "rsa", "ecdsa"]),
});

export type GenerateKeyFormSchema = z.infer<typeof generateKeyFormSchema>;

export const generateKeyFormDefaultValues: GenerateKeyFormSchema = {
  name: "",
  description: "",
  keyType: "ed25519",
};
