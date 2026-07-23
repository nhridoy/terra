export function extractError(err: unknown, fallback = "An error occurred"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}
