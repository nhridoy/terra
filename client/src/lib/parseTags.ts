export function parseTags(tags: unknown): string {
  if (!tags) return "";
  if (Array.isArray(tags)) return tags.join(", ");
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.join(", ") : tags;
    } catch {
      return tags;
    }
  }
  return "";
}
