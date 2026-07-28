export { formatDate, formatSize, getFileIcon } from "../../../lib/fileHelpers";

export function generateAutoName(
  originalName: string,
  existingNames: string[],
): string {
  const dotIndex = originalName.lastIndexOf(".");
  let base: string;
  let ext: string;
  if (dotIndex > 0) {
    base = originalName.slice(0, dotIndex);
    ext = originalName.slice(dotIndex);
  } else {
    base = originalName;
    ext = "";
  }

  let candidate = `${base} (copy)${ext}`;
  let counter = 2;
  const existingSet = new Set(existingNames);
  while (existingSet.has(candidate)) {
    candidate = `${base} (copy ${counter})${ext}`;
    counter++;
  }
  return candidate;
}
