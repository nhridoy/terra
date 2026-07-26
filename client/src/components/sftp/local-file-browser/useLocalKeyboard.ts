import { useEffect } from "react";
import type { FileItem } from "../../../lib/sftpTypes";

interface UseLocalKeyboardOptions {
  selectedFiles: Set<string>;
  files: FileItem[];
  onRename: (file: FileItem) => void;
  onNavigateUp: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

export function useLocalKeyboard({
  selectedFiles,
  files,
  onRename,
  onNavigateUp,
  onRefresh,
  onClearSelection,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onNewFile,
  onNewFolder,
}: UseLocalKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && !shift && e.key === "c") {
        e.preventDefault();
        onCopy();
      } else if (ctrl && !shift && e.key === "x") {
        e.preventDefault();
        onCut();
      } else if (ctrl && !shift && e.key === "v") {
        e.preventDefault();
        onPaste();
      } else if (ctrl && !shift && e.key === "n") {
        e.preventDefault();
        onNewFile();
      } else if (ctrl && shift && e.key === "N") {
        e.preventDefault();
        onNewFolder();
      } else if (e.key === "F2" && selectedFiles.size === 1) {
        e.preventDefault();
        const name = [...selectedFiles][0];
        const file = files.find((f) => f.name === name);
        if (file) onRename(file);
      } else if (e.key === "F5") {
        e.preventDefault();
        onRefresh();
      } else if (e.key === "Delete" && selectedFiles.size > 0) {
        e.preventDefault();
        onDelete();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onNavigateUp();
      } else if (e.key === "Escape") {
        onClearSelection();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    selectedFiles,
    files,
    onRename,
    onNavigateUp,
    onRefresh,
    onClearSelection,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onNewFile,
    onNewFolder,
  ]);
}
