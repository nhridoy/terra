import type { FileItem } from "@/types/sftp/sftpTypes";

/**
 * Maps selected file names to their full paths for clipboard operations.
 * Shared between local and remote file browsers.
 */
export function buildClipboardPaths(
  selectedFiles: Set<string>,
  files: FileItem[],
): string[] {
  return [...selectedFiles]
    .map((name) => files.find((f) => f.name === name))
    .filter((f): f is FileItem => !!f)
    .map((f) => f.path);
}
