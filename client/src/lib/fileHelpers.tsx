import { FileTextIcon, FolderIcon } from "@phosphor-icons/react";
import type { FileItem } from "./sftpTypes";

const extColors: Record<string, string> = {
  js: "text-yellow-400",
  ts: "text-blue-400",
  tsx: "text-blue-400",
  jsx: "text-blue-400",
  json: "text-green-400",
  md: "text-purple-400",
  py: "text-green-400",
  go: "text-cyan-400",
  rs: "text-orange-400",
  css: "text-pink-400",
  html: "text-orange-300",
  sh: "text-green-300",
  yaml: "text-pink-400",
  yml: "text-pink-400",
  conf: "text-dark-300",
  log: "text-dark-400",
  txt: "text-dark-300",
  png: "text-purple-400",
  jpg: "text-purple-400",
  svg: "text-purple-300",
  pdf: "text-red-400",
  zip: "text-yellow-400",
};

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

export function getFileIcon(file: FileItem) {
  if (file.type === "directory") {
    return (
      <FolderIcon
        className="w-5 h-5 text-yellow-500 shrink-0"
        weight="fill"
      />
    );
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const color = extColors[ext] || "text-dark-400";
  return <FileTextIcon className={`w-5 h-5 ${color} shrink-0`} />;
}
