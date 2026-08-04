import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useModal } from "@/hooks/useModal";
import { extractError } from "@/lib/common/extractError";
import { nameFormSchema } from "@/lib/schema/common/nameFormSchema";
import type { FileItem } from "@/types/sftp/sftpTypes";
import {
  fileBrowserActions,
  useFileBrowserStore,
} from "@/stores/sftp/fileBrowserStore";
import { useSftpStore } from "@/stores/sftp/sftpStore";

interface UseFileOperationsParams {
  paneId: string;
  hostId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  onFileSelect?: (file: FileItem) => void;
}

export function useFileOperations({
  paneId,
  hostId,
  hostAddress,
  hostPort,
  hostUsername,
}: UseFileOperationsParams) {
  const actions = fileBrowserActions;
  const renameInputRef = useRef<HTMLInputElement>(null);

  const pane = useFileBrowserStore((s) => s.panes[paneId]);
  const currentPath = pane?.currentPath ?? "/";
  const files = pane?.files ?? [];
  const selectedFiles = pane?.selectedFiles ?? new Set<string>();
  const renamingPath = pane?.renamingPath ?? null;
  const renameValue = pane?.renameValue ?? "";
  const [deleteConfirm, setDeleteConfirm] = useState<{
    files: FileItem[];
    selectedNames: Set<string> | null;
  } | null>(null);

  const newFileModal = useModal();
  const newFolderModal = useModal();

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
      const newPath =
        currentPath === "/" ? `/${trimmed}` : `${currentPath}/${trimmed}`;
      // TODO: SSH rename when provider is built
      toast.success(`Renamed to ${trimmed}`);
      actions.setFiles(
        paneId,
        files.map((f) =>
          f.path === renamingPath
            ? {
                ...f,
                name: trimmed,
                path: newPath,
                isHidden: trimmed.startsWith("."),
              }
            : f,
        ),
      );
    } catch (err: unknown) {
      toast.error(`Failed to rename: ${extractError(err)}`);
    } finally {
      renamingInProgress.current = false;
      actions.cancelRename(paneId);
    }
  }, [paneId, renamingPath, renameValue, files, currentPath]);

  // ── New file / folder ────────────────────────────────────────────────────
  const handleNewFolder = useCallback(
    () => newFolderModal.show(),
    [newFolderModal],
  );
  const handleNewFile = useCallback(() => newFileModal.show(), [newFileModal]);

  const confirmNewFolder = useCallback(
    async (name: string) => {
      const newPath =
        currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      try {
        // TODO: SSH mkdir when provider is built
        actions.setFiles(paneId, [
          ...files,
          {
            name,
            path: newPath,
            type: "directory",
            size: 0,
            permissions: "drwxr-xr-x",
            owner: "",
            group: "",
            modifiedAt: new Date().toISOString(),
            isHidden: name.startsWith("."),
          },
        ]);
        toast.success(`Created folder ${name}`);
      } catch (err: unknown) {
        toast.error(`Failed to create folder: ${extractError(err)}`);
      }
    },
    [currentPath, paneId, files],
  );

  const confirmNewFile = useCallback(
    async (name: string) => {
      const newPath =
        currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      try {
        // TODO: SSH create file when provider is built
        actions.setFiles(paneId, [
          ...files,
          {
            name,
            path: newPath,
            type: "file",
            size: 0,
            permissions: "-rw-r--r--",
            owner: "",
            group: "",
            modifiedAt: new Date().toISOString(),
            isHidden: name.startsWith("."),
          },
        ]);
        toast.success(`Created file ${name}`);
      } catch (err: unknown) {
        toast.error(`Failed to create file: ${extractError(err)}`);
      }
    },
    [currentPath, paneId, files],
  );

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (file: FileItem) => {
    setDeleteConfirm({ files: [file], selectedNames: null });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const selected = [...selectedFiles]
      .map((name) => files.find((f) => f.name === name))
      .filter((f): f is FileItem => !!f);
    if (selected.length === 0) return;
    setDeleteConfirm({
      files: selected,
      selectedNames: new Set(selectedFiles),
    });
  }, [selectedFiles, files]);

  const confirmDeleteAction = useCallback(async () => {
    if (!deleteConfirm) return;
    const { files: toDelete } = deleteConfirm;
    setDeleteConfirm(null);
    const pathsToRemove = new Set(toDelete.map((f) => f.path));
    let deleted = 0;
    let failed = 0;
    for (const _file of toDelete) {
      try {
        // TODO: SSH delete when provider is built
        deleted++;
      } catch {
        failed++;
      }
    }
    if (deleted > 0) {
      actions.setFiles(
        paneId,
        files.filter((f) => !pathsToRemove.has(f.path)),
      );
      toast.success(`Deleted ${deleted} item${deleted > 1 ? "s" : ""}`);
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} item${failed > 1 ? "s" : ""}`);
    }
  }, [deleteConfirm, paneId, files]);

  // ── Upload / Download ────────────────────────────────────────────────────
  const handleUpload = useCallback(async (fileList: FileList) => {
    // TODO: SSH upload when provider is built
    toast.info(`Upload of ${fileList.length} file(s) — not yet implemented`);
  }, []);

  const handleDownload = useCallback(async (file: FileItem) => {
    // TODO: SSH download when provider is built
    toast.info(`Download of ${file.name} — not yet implemented`);
  }, []);

  // ── Clipboard ────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const paths = [...selectedFiles].map((name) => {
      const file = files.find((f) => f.name === name);
      return file?.path || `${currentPath}/${name}`;
    });
    if (paths.length === 0) return;
    const srcDirect = hostId.startsWith("direct_")
      ? { host: hostAddress, port: hostPort, username: hostUsername }
      : undefined;
    useSftpStore.getState().setClipboard(hostId, paths, "copy", srcDirect);
    toast.info(`Copied ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [
    selectedFiles,
    files,
    currentPath,
    hostId,
    hostAddress,
    hostPort,
    hostUsername,
  ]);

  const handleCut = useCallback(() => {
    const paths = [...selectedFiles].map((name) => {
      const file = files.find((f) => f.name === name);
      return file?.path || `${currentPath}/${name}`;
    });
    if (paths.length === 0) return;
    const srcDirect = hostId.startsWith("direct_")
      ? { host: hostAddress, port: hostPort, username: hostUsername }
      : undefined;
    useSftpStore.getState().setClipboard(hostId, paths, "cut", srcDirect);
    toast.info(`Cut ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [
    selectedFiles,
    files,
    currentPath,
    hostId,
    hostAddress,
    hostPort,
    hostUsername,
  ]);

  const handlePaste = useCallback(async () => {
    const { clipboard, clipboardMode } = useSftpStore.getState();
    if (!clipboard || !clipboardMode) return;
    // TODO: SSH paste when provider is built
    toast.info("Paste — not yet implemented");
  }, []);

  // ── File drop ────────────────────────────────────────────────────────────
  const executeFileDrop = useCallback(
    async (
      _dragFiles: FileItem[],
      _sourceHostId: string,
      _destHostId: string,
      _destDirPath: string,
      _overrides?: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
      _sourceDirect?: { host?: string; port?: number; username?: string },
      _sourcePaneId?: string,
    ) => {
      // TODO: SSH file drop when provider is built
      toast.info("File drop — not yet implemented");
    },
    [],
  );

  const executePaste = useCallback(
    async (
      _overrides?: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
    ) => {
      // TODO: SSH paste with overrides when provider is built
      toast.info("Paste — not yet implemented");
    },
    [],
  );

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
    confirmDeleteAction,
    deleteConfirm,
    setDeleteConfirm,
    handleUpload,
    handleDownload,
    handleCopy,
    handleCut,
    handlePaste,
    executeFileDrop,
    executePaste,
  };
}
