import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { extractError } from "../../../lib/extractError";
import { nameFormSchema } from "../../../lib/schema/nameFormSchema";
import type {
  FileItem,
  FileSortDirection,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { findAllLeaves } from "../../../lib/treeUtils";
import { useSftpStore } from "../../../stores/sftpStore";
import { generateAutoName } from "./helpers";

interface UseFileOperationsOptions {
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
  onFileSelect,
}: UseFileOperationsOptions) {
  const addTransfer = useSftpStore((s) => s.addTransfer);
  const updateTransfer = useSftpStore((s) => s.updateTransfer);
  const clipboard = useSftpStore((s) => s.clipboard);
  const clipboardMode = useSftpStore((s) => s.clipboardMode);
  const setClipboard = useSftpStore((s) => s.setClipboard);
  const clearClipboard = useSftpStore((s) => s.clearClipboard);
  const activePaneId = useSftpStore((s) => s.activePaneId);
  const requestRefresh = useSftpStore((s) => s.requestRefresh);
  const refreshVersion = useSftpStore((s) => s.refreshRequests[paneId] ?? 0);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const [showHidden, setShowHidden] = useState(false);
  const [sortField, setSortField] = useState<FileSortField>("name");
  const [sortDirection, setSortDirection] = useState<FileSortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pasteConflicts, setPasteConflicts] = useState<
    { srcPath: string; dstPath: string; dstName: string }[] | null
  >(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    files: FileItem[];
    selectedNames: Set<string> | null;
  } | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    files: FileItem[];
    sourceHostId: string;
    destHostId: string;
    destDirPath: string;
    sourceDirect?: { host?: string; port?: number; username?: string };
    sourcePaneId?: string;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(
    async (_path: string) => {
      setIsLoading(true);
      setError(null);
      try {
        setFiles([]);
      } catch (err: unknown) {
        setError(extractError(err, "Failed to load directory"));
      } finally {
        setIsLoading(false);
      }
    },
    [hostId],
  );

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  useEffect(() => {
    if (refreshVersion > 0) loadDirectory(currentPath);
  }, [refreshVersion, loadDirectory, currentPath]);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
    setSearchQuery("");
  }, []);

  const navigateUp = useCallback(() => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    navigateTo(parent);
  }, [currentPath, navigateTo]);

  const handleDoubleClick = useCallback(
    (file: FileItem) => {
      if (file.type === "directory") navigateTo(file.path);
      else onFileSelect?.(file);
    },
    [navigateTo, onFileSelect],
  );

  const handleSelect = useCallback(
    (
      fileName: string,
      isMultiSelect: boolean,
      isShift = false,
      allFiles: FileItem[] = [],
    ) => {
      setSelectedFiles((prev) => {
        const newSet = new Set(isMultiSelect ? prev : []);
        if (isShift && !isMultiSelect && prev.size > 0 && allFiles.length > 0) {
          const lastSelected = [...prev].pop();
          const lastIdx = allFiles.findIndex((f) => f.name === lastSelected);
          const currentIdx = allFiles.findIndex((f) => f.name === fileName);
          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            for (let i = start; i <= end; i++) newSet.add(allFiles[i].name);
          }
        } else if (newSet.has(fileName)) {
          newSet.delete(fileName);
        } else {
          newSet.add(fileName);
        }
        return newSet;
      });
    },
    [],
  );

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      const filesArray = Array.from(fileList);
      const transfers = filesArray.map((file) => {
        const transferId = `upload_${Date.now()}_${file.name}`;
        addTransfer({
          id: transferId,
          fileName: file.name,
          remotePath: `${currentPath}/${file.name}`,
          direction: "upload",
          status: "active",
          progress: 0,
          size: file.size,
          transferred: 0,
        });
        return { file, transferId };
      });

      const results = await Promise.allSettled(
        transfers.map(({ file }) => file.text()),
      );

      let successCount = 0;
      for (let i = 0; i < results.length; i++) {
        const { transferId, file } = transfers[i];
        const result = results[i];
        if (result.status === "fulfilled") {
          updateTransfer(transferId, { status: "complete", progress: 100 });
          successCount++;
        } else {
          updateTransfer(transferId, {
            status: "error",
            error: extractError(result.reason, "Upload failed"),
          });
          toast.error(
            `Failed to upload ${file.name}: ${extractError(result.reason)}`,
          );
        }
      }

      if (successCount > 0) {
        toast.success(
          `Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`,
        );
        loadDirectory(currentPath);
      }
    },
    [currentPath, hostId, addTransfer, updateTransfer, loadDirectory],
  );

  const handleDownload = useCallback(
    async (file: FileItem) => {
      const transferId = `download_${Date.now()}_${file.name}`;
      addTransfer({
        id: transferId,
        fileName: file.name,
        remotePath: file.path,
        direction: "download",
        status: "active",
        progress: 0,
        size: file.size,
        transferred: 0,
      });
      try {
        const content = "";
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        updateTransfer(transferId, { status: "complete", progress: 100 });
        toast.success(`Downloaded ${file.name}`);
      } catch (err: unknown) {
        updateTransfer(transferId, {
          status: "error",
          error: extractError(err, "Download failed"),
        });
        toast.error(`Failed to download ${file.name}: ${extractError(err)}`);
      }
    },
    [hostId, addTransfer, updateTransfer],
  );

  const handleDelete = useCallback(async (file: FileItem) => {
    setDeleteConfirm({ files: [file], selectedNames: null });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const toDelete = [...selectedFiles];
    if (toDelete.length === 0) return;
    const fileItems = toDelete.flatMap((name) => {
      const file = files.find((f) => f.name === name);
      return file ? [file] : [];
    });
    setDeleteConfirm({ files: fileItems, selectedNames: new Set(toDelete) });
  }, [selectedFiles, files]);

  const confirmDeleteAction = useCallback(async () => {
    if (!deleteConfirm) return;
    const { files: toDelete, selectedNames } = deleteConfirm;
    setDeleteConfirm(null);
    const pathsToRemove = new Set(toDelete.map((f) => f.path));
    setFiles((prev) => prev.filter((f) => !pathsToRemove.has(f.path)));
    if (selectedNames) setSelectedFiles(new Set());

    let failed = 0;
    for (const _file of toDelete) {
      try {
        // no-op
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} item${failed > 1 ? "s" : ""}`);
      loadDirectory(currentPath);
    } else {
      toast.success(
        `Deleted ${toDelete.length} item${toDelete.length > 1 ? "s" : ""}`,
      );
    }
  }, [deleteConfirm, hostId, currentPath, loadDirectory]);

  const startRename = useCallback((file: FileItem) => {
    setRenamingPath(file.path);
    setRenameValue(file.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingPath) return;
    const file = files.find((f) => f.path === renamingPath);
    if (!file || renameValue === file.name || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const newName = renameValue.trim();
    const result = nameFormSchema.safeParse({ name: newName });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      setRenamingPath(null);
      return;
    }
    const newPath =
      currentPath === "/" ? `/${newName}` : `${currentPath}/${newName}`;
    if (files.some((f) => f.path !== renamingPath && f.name === newName)) {
      toast.error(`A file named "${newName}" already exists`);
      setRenamingPath(null);
      return;
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.path === renamingPath
          ? {
              ...f,
              name: newName,
              path: newPath,
              isHidden: newName.startsWith("."),
            }
          : f,
      ),
    );
    setRenamingPath(null);
    try {
      toast.success(`Renamed to ${newName}`);
    } catch (err: unknown) {
      toast.error(`Failed to rename: ${extractError(err)}`);
    }
  }, [renamingPath, files, renameValue, currentPath, hostId]);

  const handleNewFolder = useCallback(async () => {
    const name = window.prompt("Enter folder name:");
    if (!name) return;
    const newPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
    setFiles((prev) => [
      ...prev,
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
    try {
      toast.success(`Created folder ${name}`);
    } catch (err: unknown) {
      setFiles((prev) => prev.filter((f) => f.path !== newPath));
      toast.error(`Failed to create folder: ${extractError(err)}`);
    }
  }, [currentPath, hostId]);

  const handleNewFile = useCallback(async () => {
    const name = window.prompt("Enter file name:");
    if (!name) return;
    const filePath =
      currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
    setFiles((prev) => [
      ...prev,
      {
        name,
        path: filePath,
        type: "file",
        size: 0,
        permissions: "-rw-r--r--",
        owner: "",
        group: "",
        modifiedAt: new Date().toISOString(),
        isHidden: name.startsWith("."),
      },
    ]);
    try {
      toast.success(`Created file ${name}`);
    } catch (err: unknown) {
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
      toast.error(`Failed to create file: ${extractError(err)}`);
    }
  }, [currentPath, hostId]);

  const executeFileDrop = useCallback(
    async (
      dragFiles: FileItem[],
      sourceHostId: string,
      destHostId: string,
      destDirPath: string,
      overrides?: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
      sourceDirect?: { host?: string; port?: number; username?: string },
      sourcePaneId?: string,
    ) => {
      const isMove = sourceHostId === destHostId;
      let successCount = 0;
      let failCount = 0;
      try {
        const destResult: FileItem[] = [];
        const destNames = new Set(destResult.map((f) => f.name));
        const conflicts = dragFiles.filter((f) => destNames.has(f.name));
        if (conflicts.length > 0) {
          setPasteConflicts(
            conflicts.map((f) => ({
              srcPath: f.path,
              dstPath:
                destDirPath === "/" ? `/${f.name}` : `${destDirPath}/${f.name}`,
              dstName: f.name,
            })),
          );
          setPendingDrop({
            files: dragFiles,
            sourceHostId,
            destHostId,
            destDirPath,
            sourceDirect,
            sourcePaneId,
          });
          useSftpStore.getState().setFileDragState(null);
          return;
        }
      } catch (e) {
        console.error(
          "executeFileDrop: failed to list destination directory",
          e,
        );
      }

      if (destDirPath === currentPath) {
        const newFileEntries: FileItem[] = dragFiles.map((f) => ({
          ...f,
          path: destDirPath === "/" ? `/${f.name}` : `${destDirPath}/${f.name}`,
        }));
        setFiles((prev) => [...prev, ...newFileEntries]);
      }
      if (isMove) {
        const movedPaths = new Set(dragFiles.map((f) => f.path));
        setFiles((prev) => prev.filter((f) => !movedPaths.has(f.path)));
      }

      const autoNames = new Map<string, string>();
      if (overrides) {
        const existingNames = dragFiles.map((f) => f.name);
        for (const [srcPath, res] of overrides) {
          if (res.action === "auto") {
            const srcName = srcPath.split("/").pop() || "";
            autoNames.set(srcPath, generateAutoName(srcName, existingNames));
            existingNames.push(autoNames.get(srcPath) ?? "");
          }
        }
      }
      for (const file of dragFiles) {
        const override = overrides?.get(file.path);
        if (override?.action === "skip") continue;
        try {
          if (isMove) {
            /* no-op */
          } else if (sourceHostId !== destHostId) {
            throw new Error("Cross-host copy not available in sync-only mode");
          }
          successCount++;
        } catch (e) {
          console.error(
            `executeFileDrop: failed to ${isMove ? "move" : "copy"} ${file.path}`,
            e,
          );
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `${isMove ? "Moved" : "Copied"} ${successCount} item${successCount > 1 ? "s" : ""}`,
        );
        if (isMove && sourcePaneId && sourcePaneId !== paneId)
          requestRefresh(sourcePaneId);
      }
      if (failCount > 0) {
        toast.error(
          `Failed to ${isMove ? "move" : "copy"} ${failCount} item${failCount > 1 ? "s" : ""}`,
        );
        loadDirectory(currentPath);
      }
    },
    [currentPath, paneId, requestRefresh, loadDirectory],
  );

  const handleCopy = useCallback(() => {
    const paths = [...selectedFiles].map((name) => {
      const file = files.find((f) => f.name === name);
      return file?.path || `${currentPath}/${name}`;
    });
    if (paths.length === 0) return;
    const srcDirect = hostId.startsWith("direct_")
      ? { host: hostAddress, port: hostPort, username: hostUsername }
      : undefined;
    setClipboard(hostId, paths, "copy", srcDirect);
    toast.info(`Copied ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [
    selectedFiles,
    files,
    currentPath,
    hostId,
    hostAddress,
    hostPort,
    hostUsername,
    setClipboard,
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
    setClipboard(hostId, paths, "cut", srcDirect);
    toast.info(`Cut ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [
    selectedFiles,
    files,
    currentPath,
    hostId,
    hostAddress,
    hostPort,
    hostUsername,
    setClipboard,
  ]);

  const executePaste = useCallback(
    async (
      overrides?: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
    ) => {
      if (!clipboard || !clipboardMode) return;
      let successCount = 0;
      let failCount = 0;

      const autoNames = new Map<string, string>();
      if (overrides) {
        const existingNames = files.map((f) => f.name);
        for (const [srcPath, res] of overrides) {
          if (res.action === "auto") {
            const srcName = srcPath.split("/").pop() || "";
            autoNames.set(srcPath, generateAutoName(srcName, existingNames));
            existingNames.push(autoNames.get(srcPath) ?? "");
          }
        }
      }

      const newFiles: FileItem[] = [];
      const removePaths: string[] = [];
      const replaceEntries: { path: string; file: FileItem }[] = [];
      const filesByPath = new Map(files.map((f) => [f.path, f]));

      for (const srcPath of clipboard.paths) {
        const srcName = srcPath.split("/").pop() || "";
        const override = overrides?.get(srcPath);
        if (override?.action === "skip") continue;

        let dstName: string;
        if (override?.action === "rename" && override.newName)
          dstName = override.newName;
        else if (override?.action === "auto")
          dstName = autoNames.get(srcPath) || srcName;
        else dstName = srcName;

        const dstPath =
          currentPath === "/" ? `/${dstName}` : `${currentPath}/${dstName}`;
        const srcFile = filesByPath.get(srcPath);
        const isReplace =
          override?.action === "replace" ||
          (!override && files.some((f) => f.path === dstPath));

        try {
          const isCrossHost = clipboard.hostId !== hostId;
          if (clipboardMode === "copy") {
            if (isCrossHost)
              throw new Error(
                "Cross-host copy not available in sync-only mode",
              );
          } else {
            if (isCrossHost)
              throw new Error(
                "Cross-host move not available in sync-only mode",
              );
          }
          successCount++;

          if (isReplace) {
            const existing = filesByPath.get(dstPath);
            if (existing)
              replaceEntries.push({
                path: dstPath,
                file: { ...existing, name: dstName, path: dstPath },
              });
          } else {
            newFiles.push({
              name: dstName,
              path: dstPath,
              type: srcFile?.type || "file",
              size: srcFile?.size || 0,
              permissions: srcFile?.permissions || "",
              owner: srcFile?.owner || "",
              group: srcFile?.group || "",
              modifiedAt: new Date().toISOString(),
              isHidden: dstName.startsWith("."),
            });
          }

          if (clipboardMode === "cut") {
            const srcDir = srcPath.split("/").slice(0, -1).join("/") || "/";
            if (srcDir === currentPath && srcFile) removePaths.push(srcPath);
          }
        } catch {
          failCount++;
        }
      }

      if (
        newFiles.length > 0 ||
        removePaths.length > 0 ||
        replaceEntries.length > 0
      ) {
        setFiles((prev) => {
          const removeSet = new Set(removePaths);
          let next = prev.filter((f) => !removeSet.has(f.path));
          for (const { path, file } of replaceEntries)
            next = next.map((f) => (f.path === path ? file : f));
          return [...next, ...newFiles];
        });
      }

      if (clipboardMode === "cut") clearClipboard();
      if (successCount > 0) {
        toast.success(
          `${clipboardMode === "copy" ? "Copied" : "Moved"} ${successCount} item${successCount > 1 ? "s" : ""}`,
        );
        if (clipboardMode === "cut" && clipboard.hostId === hostId) {
          const { root } = useSftpStore.getState();
          const otherPanes = root
            ? findAllLeaves(root).filter(
                (l) => l.id !== paneId && l.hostId === hostId,
              )
            : [];
          for (const p of otherPanes) requestRefresh(p.id);
        }
      }
      if (failCount > 0) {
        toast.error(
          `Failed to ${clipboardMode === "copy" ? "copy" : "move"} ${failCount} item${failCount > 1 ? "s" : ""}`,
        );
        loadDirectory(currentPath);
      }
    },
    [
      clipboard,
      clipboardMode,
      files,
      currentPath,
      hostId,
      paneId,
      clearClipboard,
      requestRefresh,
      loadDirectory,
    ],
  );

  const handlePaste = useCallback(async () => {
    if (!clipboard || !clipboardMode) return;
    const existingNames = new Set(files.map((f) => f.name));
    const conflicts: { srcPath: string; dstPath: string; dstName: string }[] =
      [];
    for (const srcPath of clipboard.paths) {
      const srcName = srcPath.split("/").pop() || "";
      if (existingNames.has(srcName)) {
        const dstPath =
          currentPath === "/" ? `/${srcName}` : `${currentPath}/${srcName}`;
        conflicts.push({ srcPath, dstPath, dstName: srcName });
      }
    }
    if (conflicts.length > 0) {
      setPasteConflicts(conflicts);
      return;
    }
    await executePaste();
  }, [clipboard, clipboardMode, files, currentPath, executePaste]);

  const sortedFiles = useMemo(() => {
    return [...files]
      .filter(
        (f) =>
          (showHidden || !f.isHidden) &&
          (searchQuery === "" ||
            f.name.toLowerCase().includes(searchQuery.toLowerCase())),
      )
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        let cmp = 0;
        if (sortField === "name") cmp = a.name.localeCompare(b.name);
        else if (sortField === "size") cmp = a.size - b.size;
        else if (sortField === "permissions")
          cmp = a.permissions.localeCompare(b.permissions);
        else if (sortField === "modifiedAt")
          cmp =
            new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [files, showHidden, searchQuery, sortField, sortDirection]);

  const actions = useMemo(
    () => ({
      handleDoubleClick,
      handleSelect,
      handleCopy,
      handleCut,
      handlePaste,
      handleDelete,
      handleNewFolder,
      handleNewFile,
      handleDownload,
    }),
    [
      handleDoubleClick,
      handleSelect,
      handleCopy,
      handleCut,
      handlePaste,
      handleDelete,
      handleNewFolder,
      handleNewFile,
      handleDownload,
    ],
  );

  return {
    files,
    setFiles,
    currentPath,
    isLoading,
    error,
    setError,
    selectedFiles,
    setSelectedFiles,
    viewMode,
    setViewMode,
    showHidden,
    setShowHidden,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    searchQuery,
    setSearchQuery,
    renamingPath,
    setRenamingPath,
    renameValue,
    setRenameValue,
    renameInputRef,
    pasteConflicts,
    setPasteConflicts,
    deleteConfirm,
    setDeleteConfirm,
    pendingDrop,
    setPendingDrop,
    sortedFiles,
    actions,
    loadDirectory,
    navigateTo,
    navigateUp,
    startRename,
    commitRename,
    handleUpload,
    handleDeleteSelected,
    confirmDeleteAction,
    executeFileDrop,
    executePaste,
    handlePaste,
    handleCopy,
    handleCut,
    activePaneId,
    clipboard,
    clipboardMode,
    clearClipboard,
  };
}
