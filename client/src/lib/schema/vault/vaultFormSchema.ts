import { z } from "zod";

export const vaultFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Vault name is required" })
    .max(255, { error: "Vault name must be at most 255 characters" }),
  description: z.string().max(1024).optional(),
});

export type VaultFormSchema = z.infer<typeof vaultFormSchema>;

export const vaultFormDefaultValues: VaultFormSchema = {
  name: "",
  description: "",
};
