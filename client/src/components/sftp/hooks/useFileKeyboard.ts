import { useEffect } from "react";
import type { FileItem } from "../../../lib/sftpTypes";

interface UseFileKeyboardOptions {
  activePaneId: string | null;
  paneId: string;
  deleteConfirm: {
    files: FileItem[];
    selectedNames: Set<string> | null;
  } | null;
  pasteConflicts:
    | { srcPath: string; dstPath: string; dstName: string }[]
    | null;
  confirmDelete: () => void;
  setDeleteConfirm: (
    val: { files: FileItem[]; selectedNames: Set<string> | null } | null,
  ) => void;
  setPasteConflicts: (
    val: { srcPath: string; dstPath: string; dstName: string }[] | null,
  ) => void;
  selectedFiles: Set<string>;
  files: FileItem[];
  sortedFiles: FileItem[];
  currentPath: string;
  loadDirectory: (path: string) => void;
  startRename: (file: FileItem) => void;
  navigateUp: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDeleteSelected: () => void;
  handleNewFile: () => void;
  handleCopy: () => void;
  setSelectedFiles: (val: Set<string>) => void;
}

export function useFileKeyboard({
  activePaneId,
  paneId,
  deleteConfirm,
  pasteConflicts,
  confirmDelete,
  setDeleteConfirm,
  setPasteConflicts,
  selectedFiles,
  files,
  sortedFiles,
  currentPath,
  loadDirectory,
  startRename,
  navigateUp,
  handleCut,
  handlePaste,
  handleDeleteSelected,
  handleNewFile,
  handleCopy,
  setSelectedFiles,
}: UseFileKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activePaneId && activePaneId !== paneId) return;

      if (deleteConfirm) {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmDelete();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDeleteConfirm(null);
          return;
        }
        return;
      }
      if (pasteConflicts) {
        if (e.key === "Enter") {
          e.preventDefault();
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
          setPasteConflicts(null);
          return;
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Delete") {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (selectedFiles.size === 1) {
          const name = [...selectedFiles][0];
          const file = files.find((f) => f.name === name);
          if (file) startRename(file);
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        loadDirectory(currentPath);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        navigateUp();
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedFiles(new Set(sortedFiles.map((f) => f.name)));
      } else if (e.key === "Escape") {
        setSelectedFiles(new Set());
      } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCopy();
      } else if (e.key === "x" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCut();
      } else if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handlePaste();
      } else if (e.key === "N" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        handleNewFile();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    activePaneId,
    paneId,
    deleteConfirm,
    pasteConflicts,
    confirmDelete,
    setDeleteConfirm,
    setPasteConflicts,
    selectedFiles,
    files,
    sortedFiles,
    currentPath,
    loadDirectory,
    startRename,
    navigateUp,
    handleCut,
    handlePaste,
    handleDeleteSelected,
    handleNewFile,
    handleCopy,
    setSelectedFiles,
  ]);
}
