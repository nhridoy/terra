import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useModal } from "../../../hooks/useModal";
import { confirmDelete } from "../../../lib/confirmDelete";
import { extractError } from "../../../lib/extractError";
import {
  createLocalDir,
  listLocalFiles,
  removeLocalFile,
  renameLocalFile,
  writeLocalFileBytes,
} from "../../../lib/localFs";
import type { FileItem } from "../../../lib/sftpTypes";
import {
  fileBrowserActions,
  useFileBrowserStore,
} from "../../../stores/fileBrowserStore";

interface UseFileOperationsParams {
  paneId: string;
  currentPath: string;
  files: FileItem[];
}

export function useFileOperations({
  paneId,
  currentPath,
  files,
}: UseFileOperationsParams) {
  const actions = fileBrowserActions;
  const renameInputRef = useRef<HTMLInputElement>(null);

  const renamingPath = useFileBrowserStore(
    (s) => s.panes[paneId]?.renamingPath,
  );
  const renameValue = useFileBrowserStore((s) => s.panes[paneId]?.renameValue);
  const selectedFiles = useFileBrowserStore(
    (s) => s.panes[paneId]?.selectedFiles ?? new Set<string>(),
  );

  const newFileModal = useModal();
  const newFolderModal = useModal();

  // Silent reload helper: re-read current directory without loading skeleton
  const reload = useCallback(async () => {
    try {
      const fresh = await listLocalFiles(currentPath);
      actions.setFiles(paneId, fresh);
    } catch {
      // silent fail
    }
  }, [currentPath, paneId]);

  // ── Rename ───────────────────────────────────────────────────────────────
  const startRename = useCallback(
    (file: FileItem) => actions.startRename(paneId, file.path, file.name),
    [paneId],
  );

  const commitRename = useCallback(async () => {
    if (!renamingPath) return;
    const file = files.find((f) => f.path === renamingPath);
    if (!file || renameValue === file.name || !renameValue.trim()) {
      actions.cancelRename(paneId);
      return;
    }
    try {
      const sep = currentPath.includes("\\") ? "\\" : "/";
      const newPath = currentPath + sep + renameValue.trim();
      await renameLocalFile(file.path, newPath);
      toast.success(`Renamed to ${renameValue.trim()}`);
      await reload();
    } catch (err: unknown) {
      toast.error(`Failed to rename: ${extractError(err)}`);
    } finally {
      actions.cancelRename(paneId);
    }
  }, [paneId, renamingPath, renameValue, files, currentPath, reload]);

  // ── New file / folder ────────────────────────────────────────────────────
  const handleNewFolder = useCallback(
    () => newFolderModal.show(),
    [newFolderModal],
  );
  const handleNewFile = useCallback(() => newFileModal.show(), [newFileModal]);

  const confirmNewFolder = useCallback(
    async (name: string) => {
      const sep = currentPath.includes("\\") ? "\\" : "/";
      try {
        await createLocalDir(currentPath + sep + name);
        toast.success(`Created folder ${name}`);
        await reload();
      } catch (err: unknown) {
        toast.error(`Failed to create folder: ${extractError(err)}`);
      }
    },
    [currentPath, reload],
  );

  const confirmNewFile = useCallback(
    async (name: string) => {
      const sep = currentPath.includes("\\") ? "\\" : "/";
      const filePath = currentPath + sep + name;
      try {
        await writeLocalFileBytes(filePath, new Uint8Array(0));
        toast.success(`Created file ${name}`);
        await reload();
      } catch (err: unknown) {
        toast.error(`Failed to create file: ${extractError(err)}`);
      }
    },
    [currentPath, reload],
  );

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (file: FileItem) => {
      if (!(await confirmDelete(`Delete "${file.name}"?`))) return;
      try {
        await removeLocalFile(file.path);
        toast.success(`Deleted ${file.name}`);
        await reload();
      } catch (err: unknown) {
        toast.error(`Failed to delete ${file.name}: ${extractError(err)}`);
      }
    },
    [reload],
  );

  const handleDeleteSelected = useCallback(async () => {
    const selected = [...selectedFiles]
      .map((name) => files.find((f) => f.name === name))
      .filter((f): f is FileItem => !!f);
    if (selected.length === 0) return;
    const count = selected.length;
    if (!(await confirmDelete(`Delete ${count} item${count > 1 ? "s" : ""}?`)))
      return;
    let deleted = 0;
    let failed = 0;
    for (const file of selected) {
      try {
        await removeLocalFile(file.path);
        deleted++;
      } catch {
        failed++;
      }
    }
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} item${deleted > 1 ? "s" : ""}`);
      await reload();
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} item${failed > 1 ? "s" : ""}`);
    }
  }, [selectedFiles, files, reload]);

  return {
    renameInputRef,
    renamingPath,
    renameValue,
    newFileModal,
    newFolderModal,
    startRename,
    commitRename,
    handleNewFile,
    handleNewFolder,
    confirmNewFile,
    confirmNewFolder,
    handleDelete,
    handleDeleteSelected,
  };
}
