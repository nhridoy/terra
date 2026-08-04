import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useModal } from "@/hooks/useModal";
import { extractError } from "@/lib/common/extractError";
import {
  createLocalDir,
  listLocalFiles,
  removeLocalFile,
  renameLocalFile,
  writeLocalFileBytes,
} from "@/lib/sftp/localFs";
import { nameFormSchema } from "@/lib/schema/common/nameFormSchema";
import type { FileItem } from "@/types/sftp/sftpTypes";
import {
  fileBrowserActions,
  useFileBrowserStore,
} from "@/stores/sftp/fileBrowserStore";

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

  const deleteDialogOpen = useModal();
  const [deleteMessage, setDeleteMessage] = useState("");
  const pendingDeleteRef = useRef<{
    files: FileItem[];
    toastPrefix?: string;
  } | null>(null);

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

  const renamingInProgress = useRef(false);

  const commitRename = useCallback(async () => {
    if (!renamingPath || renamingInProgress.current) return;
    const file = files.find((f) => f.path === renamingPath);
    if (!file || renameValue === file.name || !renameValue.trim()) {
      actions.cancelRename(paneId);
      return;
    }
    const trimmed = renameValue.trim();
    const result = nameFormSchema.safeParse({ name: trimmed });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    renamingInProgress.current = true;
    try {
      const sep = currentPath.includes("\\") ? "\\" : "/";
      const newPath = currentPath + sep + trimmed;
      await renameLocalFile(file.path, newPath);
      toast.success(`Renamed to ${trimmed}`);
      await reload();
    } catch (err: unknown) {
      toast.error(`Failed to rename: ${extractError(err)}`);
    } finally {
      renamingInProgress.current = false;
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
  const performDelete = useCallback(
    async (toDelete: FileItem[]) => {
      let deleted = 0;
      let failed = 0;
      for (const file of toDelete) {
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
    },
    [reload],
  );

  const confirmDeleteAction = useCallback(() => {
    deleteDialogOpen.hide();
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    if (pending) performDelete(pending.files);
  }, [deleteDialogOpen, performDelete]);

  const cancelDelete = useCallback(() => {
    deleteDialogOpen.hide();
    pendingDeleteRef.current = null;
  }, [deleteDialogOpen]);

  const handleDelete = useCallback(
    (file: FileItem) => {
      pendingDeleteRef.current = { files: [file] };
      setDeleteMessage(`Delete "${file.name}"?`);
      deleteDialogOpen.show();
    },
    [deleteDialogOpen],
  );

  const handleDeleteSelected = useCallback(() => {
    const selected = [...selectedFiles]
      .map((name) => files.find((f) => f.name === name))
      .filter((f): f is FileItem => !!f);
    if (selected.length === 0) return;
    pendingDeleteRef.current = { files: selected };
    const count = selected.length;
    setDeleteMessage(`Delete ${count} item${count > 1 ? "s" : ""}?`);
    deleteDialogOpen.show();
  }, [selectedFiles, files, deleteDialogOpen]);

  return {
    renameInputRef,
    renamingPath,
    renameValue,
    newFileModal,
    newFolderModal,
    deleteDialogOpen: deleteDialogOpen.open,
    deleteMessage,
    confirmDelete: confirmDeleteAction,
    cancelDelete,
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
