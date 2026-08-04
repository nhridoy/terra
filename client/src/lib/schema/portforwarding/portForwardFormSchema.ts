import { z } from "zod";

export const portForwardFormSchema = z.object({
  localPort: z
    .number()
    .int({ error: "Port must be an integer" })
    .min(1, { error: "Port must be at least 1" })
    .max(65535, { error: "Port must be at most 65535" }),
  remoteHost: z
    .string()
    .trim()
    .min(1, { error: "Remote host is required" })
    .max(255, { error: "Remote host must be at most 255 characters" }),
  remotePort: z
    .number()
    .int({ error: "Port must be an integer" })
    .min(1, { error: "Port must be at least 1" })
    .max(65535, { error: "Port must be at most 65535" }),
});

export type PortForwardFormSchema = z.infer<typeof portForwardFormSchema>;

export const portForwardFormDefaultValues: PortForwardFormSchema = {
  localPort: 8080,
  remoteHost: "localhost",
  remotePort: 80,
};
