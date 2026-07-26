import { useEffect } from "react";
import type { FileItem } from "../../lib/sftpTypes";

export interface UseFileKeyboardShortcutsOptions {
  selectedFiles: Set<string>;
  files: FileItem[];

  // Core actions (required)
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRename: (file: FileItem) => void;
  onRefresh: () => void;
  onNavigateUp: () => void;
  onClearSelection: () => void;

  // New file/folder (optional — wire up for local)
  onNewFile?: () => void;
  onNewFolder?: () => void;

  // Select all (optional — wire up for remote)
  onSelectAll?: () => void;

  // Active pane gating (optional — wire up for remote multi-pane)
  activePaneId?: string | null;
  paneId?: string;

  // Modal dialog handling (optional — wire up for remote)
  deleteConfirm?: {
    files: FileItem[];
    selectedNames: Set<string> | null;
  } | null;
  pasteConflicts?:
    | { srcPath: string; dstPath: string; dstName: string }[]
    | null;
  onConfirmDelete?: () => void;
  onDismissDeleteConfirm?: () => void;
  onDismissPasteConflicts?: () => void;
}

export function useFileKeyboardShortcuts({
  selectedFiles,
  files,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onRename,
  onRefresh,
  onNavigateUp,
  onClearSelection,
  onNewFile,
  onNewFolder,
  onSelectAll,
  activePaneId,
  paneId,
  deleteConfirm,
  pasteConflicts,
  onConfirmDelete,
  onDismissDeleteConfirm,
  onDismissPasteConflicts,
}: UseFileKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Active pane gating (remote multi-pane)
      if (activePaneId && paneId && activePaneId !== paneId) return;

      // Modal dialog handling — intercept all keys when a dialog is open
      if (deleteConfirm) {
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirmDelete?.();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onDismissDeleteConfirm?.();
          return;
        }
        return;
      }
      if (pasteConflicts) {
        if (e.key === "Enter") {
          e.preventDefault();
          // Click the confirm button in the paste conflict dialog
          const container = document.querySelector(
            "[data-paste-dialog]",
          ) as HTMLElement | null;
          const btn = container?.querySelector(
            "button:last-child",
          ) as HTMLButtonElement | null;
          btn?.click();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onDismissPasteConflicts?.();
          return;
        }
        return;
      }

      // Skip when typing in inputs
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
      } else if (ctrl && !shift && e.key === "n" && onNewFile) {
        e.preventDefault();
        onNewFile();
      } else if (
        ctrl &&
        shift &&
        (e.key === "N" || e.key === "n") &&
        onNewFolder
      ) {
        e.preventDefault();
        onNewFolder();
      } else if (ctrl && e.key === "a" && onSelectAll) {
        e.preventDefault();
        onSelectAll();
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
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onRename,
    onRefresh,
    onNavigateUp,
    onClearSelection,
    onNewFile,
    onNewFolder,
    onSelectAll,
    activePaneId,
    paneId,
    deleteConfirm,
    pasteConflicts,
    onConfirmDelete,
    onDismissDeleteConfirm,
    onDismissPasteConflicts,
  ]);
}
