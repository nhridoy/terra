import { FileIcon, FolderIcon } from "react-material-icon-theme";
import type { FileItem } from "./sftpTypes";

export function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFileIcon(file: FileItem, size = 20, isOpen = false) {
  if (file.type === "directory") {
    return <FolderIcon folderName={file.name} size={size} isOpen={isOpen} />;
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop() || ""
    : undefined;

  return <FileIcon fileName={file.name} fileExtension={ext} size={size} />;
}

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
