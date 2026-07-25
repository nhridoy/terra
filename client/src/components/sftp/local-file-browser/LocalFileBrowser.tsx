import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { FolderIcon } from "@phosphor-icons/react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { confirmDelete } from "../../../lib/confirmDelete";
import { extractError } from "../../../lib/extractError";
import {
  joinPath,
  LocalFileProvider,
  transferFiles,
} from "../../../lib/fileTransfer";
import {
  copyLocalFile,
  createLocalDir,
  isTauriAvailable,
  listLocalFiles,
  moveLocalFile,
  removeLocalFile,
  renameLocalFile,
  writeLocalFileBytes,
} from "../../../lib/localFs";
import type {
  FileItem,
  FileSortDirection,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import {
  showTransferError,
  showTransferProgress,
  showTransferStart,
  showTransferSuccess,
} from "../../../lib/transferToast";
import { useSftpStore } from "../../../stores/sftpStore";
import { Button } from "../../ui/Button";
import ContextMenu, { type ContextMenuItem } from "../../ui/ContextMenu";
import PasteConflictDialog from "../file-browser/PasteConflictDialog";
import LocalFileBrowserList from "./LocalFileBrowserList";
import LocalFileBrowserStatusBar from "./LocalFileBrowserStatusBar";
import LocalFileBrowserToolbar from "./LocalFileBrowserToolbar";
import { useLocalKeyboard } from "./useLocalKeyboard";

interface LocalFileBrowserProps {
  paneId: string;
  rootPath: string;
}

const localProvider = new LocalFileProvider("local");

export default function LocalFileBrowser({
  paneId,
  rootPath,
}: LocalFileBrowserProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const [showHidden, setShowHidden] = useState(false);
  const [sortField, setSortField] = useState<FileSortField>("name");
  const [sortDirection, setSortDirection] = useState<FileSortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [pathInput, setPathInput] = useState(currentPath);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file?: FileItem;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const [isMarqueeDragging, setIsMarqueeDragging] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<string[]>([rootPath]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pendingFileDrop = useSftpStore((s) => s.pendingFileDrop);
  const setPendingFileDrop = useSftpStore((s) => s.setPendingFileDrop);
  const fileDragState = useSftpStore((s) => s.fileDragState);

  const [pasteConflicts, setPasteConflicts] = useState<
    { srcPath: string; dstPath: string; dstName: string }[] | null
  >(null);
  const [pendingDrop, setPendingDrop] = useState<{
    files: FileItem[];
    destDirPath: string;
    mode: "move" | "copy";
  } | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listLocalFiles(path);
      setFiles(result);
    } catch (err: unknown) {
      setError(extractError(err, "Failed to load directory"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(currentPath);
    setPathInput(currentPath);
  }, [currentPath, loadDirectory]);

  useEffect(() => {
    setCurrentPath(rootPath);
    setPathInput(rootPath);
  }, [rootPath]);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  const navigateTo = useCallback(
    (path: string, skipHistory = false) => {
      setCurrentPath(path);
      setSelectedFiles(new Set());
      setSearchQuery("");
      if (!skipHistory) {
        setHistory((prev) => [...prev.slice(0, historyIndex + 1), path]);
        setHistoryIndex((prev) => prev + 1);
      }
    },
    [historyIndex],
  );

  const navigateBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    navigateTo(history[newIndex], true);
  }, [history, historyIndex, navigateTo]);

  const navigateForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    navigateTo(history[newIndex], true);
  }, [history, historyIndex, navigateTo]);

  const navigateUp = useCallback(() => {
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const parts = currentPath.split(sep);
    parts.pop();
    const parent = parts.join(sep);
    // On Windows "C:" alone means current dir on C: — always keep trailing sep
    if (sep === "\\" && parent && !parent.endsWith("\\")) {
      navigateTo(`${parent}\\`);
    } else {
      navigateTo(parent || sep);
    }
  }, [currentPath, navigateTo]);

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === "directory") navigateTo(file.path);
  };

  const handleSelect = (
    fileName: string,
    isMultiSelect: boolean,
    isRangeSelect: boolean,
  ) => {
    if (isRangeSelect && lastSelectedIndex !== null) {
      const clickedIndex = sortedFiles.findIndex((f) => f.name === fileName);
      if (clickedIndex === -1) return;
      const start = Math.min(lastSelectedIndex, clickedIndex);
      const end = Math.max(lastSelectedIndex, clickedIndex);
      const rangeNames = sortedFiles.slice(start, end + 1).map((f) => f.name);
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        for (const name of rangeNames) newSet.add(name);
        return newSet;
      });
      return;
    }
    setSelectedFiles((prev) => {
      const newSet = new Set(isMultiSelect ? prev : []);
      if (newSet.has(fileName)) newSet.delete(fileName);
      else newSet.add(fileName);
      return newSet;
    });
    setLastSelectedIndex(sortedFiles.findIndex((f) => f.name === fileName));
  };

  const handleNewFolder = async () => {
    const name = window.prompt("Enter folder name:");
    if (!name) return;
    const sep = currentPath.includes("\\") ? "\\" : "/";
    try {
      await createLocalDir(currentPath + sep + name);
      toast.success(`Created folder ${name}`);
      loadDirectory(currentPath);
    } catch (err: unknown) {
      toast.error(`Failed to create folder: ${extractError(err)}`);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!(await confirmDelete(`Delete "${file.name}"?`))) return;
    try {
      await removeLocalFile(file.path);
      toast.success(`Deleted ${file.name}`);
      loadDirectory(currentPath);
    } catch (err: unknown) {
      toast.error(`Failed to delete ${file.name}: ${extractError(err)}`);
    }
  };

  const startRename = useCallback((file: FileItem) => {
    setRenamingPath(file.path);
    setRenameValue(file.name);
  }, []);

  const commitRename = async () => {
    if (!renamingPath) return;
    const file = files.find((f) => f.path === renamingPath);
    if (!file || renameValue === file.name || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const newPath = currentPath + sep + renameValue.trim();
    try {
      await renameLocalFile(file.path, newPath);
      toast.success(`Renamed to ${renameValue.trim()}`);
      loadDirectory(currentPath);
    } catch (err: unknown) {
      toast.error(`Failed to rename: ${extractError(err)}`);
    } finally {
      setRenamingPath(null);
    }
  };

  // Desktop file drop (native HTML DnD)
  const handleDesktopDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDesktopDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === containerRef.current) setIsDragOver(false);
  }, []);

  const handleDesktopDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length === 0) return;

      const fileItems: FileItem[] = [];
      for (let i = 0; i < droppedFiles.length; i++) {
        const f = droppedFiles[i];
        fileItems.push({
          name: f.name,
          path: f.name,
          type: "file",
          size: f.size,
          permissions: "",
          owner: "",
          group: "",
          modifiedAt: new Date(f.lastModified).toISOString(),
          isHidden: f.name.startsWith("."),
        });
      }

      const toastId = showTransferStart(fileItems, "copy");

      let totalLoaded = 0;
      const totalSize = fileItems.reduce((s, f) => s + f.size, 0);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < droppedFiles.length; i++) {
        const f = droppedFiles[i];
        const destPath = joinPath(currentPath, f.name);
        try {
          const arrayBuffer = await f.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          await writeLocalFileBytes(destPath, bytes);
          totalLoaded += f.size;
          showTransferProgress(
            toastId,
            fileItems,
            totalLoaded,
            totalSize,
            "copy",
          );
          successCount++;
        } catch (_err) {
          failCount++;
        }
      }

      if (failCount === 0) {
        showTransferSuccess(toastId, fileItems, "copy");
      } else if (successCount === 0) {
        showTransferError(toastId, fileItems, "copy", "All files failed");
      } else {
        showTransferSuccess(toastId, fileItems, "copy");
      }

      loadDirectory(currentPath);
    },
    [currentPath, loadDirectory],
  );

  // @dnd-kit: register this container as a droppable zone
  const droppable = useDroppable({
    id: `file-drop-${paneId}`,
    data: { type: "file-drop", paneId, hostId: "local", path: currentPath },
  });

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      droppable.ref(node);
    },
    [droppable.ref],
  );

  // @dnd-kit: monitor drag events for in-app file drops
  useDragDropMonitor({
    onDragOver(event) {
      const source = event.operation.source;
      const target = event.operation.target;
      if (
        source?.data?.type === "file-drag" &&
        target?.data?.type === "file-drop"
      ) {
        const sourceHostId = source.data.hostId as string;
        const destHostId = target.data.hostId as string;
        const files = source.data.files as FileItem[];
        const destDirPath = target.data.path as string;
        const sep = destDirPath.includes("\\") ? "\\" : "/";
        const srcDir =
          files[0]?.path.split(/[/\\]/).slice(0, -1).join(sep) || sep;
        const isNoop = sourceHostId === destHostId && srcDir === destDirPath;
        setIsDropTarget(!isNoop && destDirPath === currentPath);
      } else {
        setIsDropTarget(false);
      }
    },
    onDragEnd() {
      setIsDropTarget(false);
    },
  });

  // Execute a transfer with progress toasts
  const executeTransfer = useCallback(
    async (
      dragFiles: FileItem[],
      destDirPath: string,
      mode: "move" | "copy",
      overrides?: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
    ) => {
      const toastId = showTransferStart(dragFiles, mode);
      const totalSize = dragFiles.reduce((s, f) => s + f.size, 0);
      let loaded = 0;

      const results = await transferFiles({
        source: localProvider,
        dest: localProvider,
        files: dragFiles,
        destPath: destDirPath,
        mode,
        overrides,
        onFileProgress: (_file, _index, fileLoaded) => {
          loaded += fileLoaded;
          showTransferProgress(toastId, dragFiles, loaded, totalSize, mode);
        },
      });

      const errors = results.filter((r) => r.error);
      if (errors.length === 0) {
        showTransferSuccess(toastId, dragFiles, mode);
      } else if (errors.length === dragFiles.length) {
        showTransferError(
          toastId,
          dragFiles,
          mode,
          errors[0].error || "Unknown error",
        );
      } else {
        showTransferSuccess(toastId, dragFiles, mode);
      }

      loadDirectory(currentPath);
    },
    [currentPath, loadDirectory],
  );

  // Handle pending file drops from SftpLayout
  useEffect(() => {
    if (!pendingFileDrop) return;
    if (pendingFileDrop.destPaneId !== paneId) return;

    const {
      files: dragFiles,
      sourceHostId,
      destHostId,
      destDirPath,
      sourcePaneId,
    } = pendingFileDrop;

    if (!dragFiles || !destDirPath) {
      setPendingFileDrop(null);
      return;
    }

    const isLocalToLocal = sourceHostId === "local" && destHostId === "local";
    if (!isLocalToLocal) {
      toast.error("Cross-provider transfer not yet supported");
      setPendingFileDrop(null);
      return;
    }

    const isSamePane = sourcePaneId === paneId;
    const isSameDir =
      dragFiles[0]?.path.split(/[/\\]/).slice(0, -1).join("/") === destDirPath;

    if (isSamePane && isSameDir) {
      setPendingFileDrop(null);
      return;
    }

    const mode = isSamePane ? "move" : "copy";

    // Check for conflicts before transferring
    (async () => {
      let destFiles: FileItem[];
      try {
        destFiles = await listLocalFiles(destDirPath);
      } catch {
        destFiles = [];
      }
      const destNames = new Set(destFiles.map((f) => f.name));
      const conflicts = dragFiles.filter((f) => destNames.has(f.name));

      if (conflicts.length > 0) {
        setPasteConflicts(
          conflicts.map((f) => ({
            srcPath: f.path,
            dstPath: joinPath(destDirPath, f.name),
            dstName: f.name,
          })),
        );
        setPendingDrop({ files: dragFiles, destDirPath, mode });
      } else {
        await executeTransfer(dragFiles, destDirPath, mode);
      }
    })();

    setPendingFileDrop(null);
  }, [pendingFileDrop, paneId, executeTransfer, setPendingFileDrop]);

  // Called when user resolves conflict dialog
  const handleConflictConfirm = useCallback(
    async (
      overrides: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
    ) => {
      if (!pendingDrop) return;
      const { files: dragFiles, destDirPath, mode } = pendingDrop;
      setPasteConflicts(null);
      setPendingDrop(null);
      await executeTransfer(dragFiles, destDirPath, mode, overrides);
    },
    [pendingDrop, executeTransfer],
  );

  // Called when user cancels conflict dialog
  const handleConflictCancel = useCallback(() => {
    setPasteConflicts(null);
    setPendingDrop(null);
  }, []);

  const handleMarqueeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (
      !(e.target as HTMLElement).closest("[data-file-item]") &&
      !(e.target as HTMLElement).closest("[data-marquee]")
    ) {
      setIsMarqueeDragging(true);
      setMarqueeStart({ x: e.clientX, y: e.clientY });
      setMarqueeCurrent({ x: e.clientX, y: e.clientY });
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setSelectedFiles(new Set());
        setLastSelectedIndex(null);
      }
    }
  }, []);

  const handleMarqueeMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isMarqueeDragging) return;
      setMarqueeCurrent({ x: e.clientX, y: e.clientY });
    },
    [isMarqueeDragging],
  );

  const handleMarqueeMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isMarqueeDragging || !marqueeStart || !marqueeCurrent) return;
      setIsMarqueeDragging(false);

      const minX = Math.min(marqueeStart.x, e.clientX);
      const maxX = Math.max(marqueeStart.x, e.clientX);
      const minY = Math.min(marqueeStart.y, e.clientY);
      const maxY = Math.max(marqueeStart.y, e.clientY);

      if (maxX - minX < 3 && maxY - minY < 3) {
        setMarqueeStart(null);
        setMarqueeCurrent(null);
        return;
      }

      const items = containerRef.current?.querySelectorAll("[data-file-item]");
      const newSelected = new Set(e.ctrlKey || e.metaKey ? selectedFiles : []);
      items?.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const overlaps =
          rect.left < maxX &&
          rect.right > minX &&
          rect.top < maxY &&
          rect.bottom > minY;
        if (overlaps) {
          const name = item.getAttribute("data-file-name");
          if (name) newSelected.add(name);
        }
      });
      setSelectedFiles(newSelected);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
    },
    [isMarqueeDragging, marqueeStart, marqueeCurrent, selectedFiles],
  );

  const handleRefresh = useCallback(
    () => loadDirectory(currentPath),
    [currentPath, loadDirectory],
  );
  const handleClearSelection = useCallback(
    () => setSelectedFiles(new Set()),
    [],
  );

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

  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedFiles.has(file.name)) setSelectedFiles(new Set([file.name]));
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedFiles(new Set());
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getSelectedPaths = useCallback(() => {
    return [...selectedFiles]
      .map((name) => files.find((f) => f.name === name))
      .filter((f): f is FileItem => !!f)
      .map((f) => f.path);
  }, [selectedFiles, files]);

  const handleCopy = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length === 0) return;
    useSftpStore.getState().setClipboard("local", paths, "copy");
    toast.success(`Copied ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [getSelectedPaths]);

  const handleCut = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length === 0) return;
    useSftpStore.getState().setClipboard("local", paths, "cut");
    toast.success(`Cut ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [getSelectedPaths]);

  const handlePaste = useCallback(async () => {
    const { clipboard, clipboardMode } = useSftpStore.getState();
    if (!clipboard || !clipboardMode) return;
    if (clipboard.hostId !== "local") {
      toast.error("Cannot paste remote files to local filesystem");
      return;
    }
    let pasted = 0;
    for (const srcPath of clipboard.paths) {
      const fileName = srcPath.split(/[/\\]/).pop() || srcPath;
      const destPath =
        currentPath.endsWith("\\") || currentPath.endsWith("/")
          ? `${currentPath}${fileName}`
          : `${currentPath}\\${fileName}`;
      try {
        if (clipboardMode === "copy") {
          if (srcPath === destPath) {
            const dir =
              destPath.substring(0, destPath.lastIndexOf("\\") + 1) ||
              destPath.substring(0, destPath.lastIndexOf("/") + 1);
            const ext = fileName.includes(".")
              ? fileName.substring(fileName.lastIndexOf("."))
              : "";
            const base = ext
              ? fileName.substring(0, fileName.length - ext.length)
              : fileName;
            await copyLocalFile(srcPath, `${dir}${base} (copy)${ext}`);
          } else {
            await copyLocalFile(srcPath, destPath);
          }
        } else {
          await moveLocalFile(srcPath, destPath);
        }
        pasted++;
      } catch (err) {
        toast.error(extractError(err, `Failed to paste ${fileName}`));
      }
    }
    if (pasted > 0) {
      toast.success(
        `${clipboardMode === "copy" ? "Copied" : "Moved"} ${pasted} item${pasted > 1 ? "s" : ""}`,
      );
      loadDirectory(currentPath);
    }
    if (clipboardMode === "cut") {
      useSftpStore.getState().clearClipboard();
    }
  }, [currentPath, loadDirectory]);

  useLocalKeyboard({
    selectedFiles,
    files,
    onRename: startRename,
    onNavigateUp: navigateUp,
    onRefresh: handleRefresh,
    onClearSelection: handleClearSelection,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
  });

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? contextMenu.file
      ? [
          {
            label: "Open",
            onClick: async () => {
              if (!contextMenu.file) return;
              try {
                await openPath(contextMenu.file.path);
              } catch (err) {
                toast.error(extractError(err, "Failed to open file"));
              }
            },
          },
          {
            label: "Show in Explorer",
            onClick: async () => {
              if (!contextMenu.file) return;
              try {
                await revealItemInDir(contextMenu.file.path);
              } catch (err) {
                toast.error(extractError(err, "Failed to reveal in Explorer"));
              }
            },
          },
          { type: "separator" as const },
          {
            label: "Copy",
            shortcut: "Ctrl+C",
            onClick: handleCopy,
          },
          {
            label: "Cut",
            shortcut: "Ctrl+X",
            onClick: handleCut,
          },
          { type: "separator" as const },
          {
            label: "Paste",
            shortcut: "Ctrl+V",
            disabled: !useSftpStore.getState().clipboard,
            onClick: handlePaste,
          },
          { type: "separator" as const },
          {
            label: "Rename",
            shortcut: "F2",
            onClick: () => {
              if (contextMenu.file) startRename(contextMenu.file);
            },
          },
          { type: "separator" as const },
          {
            label: "Delete",
            danger: true,
            shortcut: "Del",
            onClick: () => {
              if (contextMenu.file) handleDelete(contextMenu.file);
            },
          },
        ]
      : [
          {
            label: "Paste",
            shortcut: "Ctrl+V",
            disabled: !useSftpStore.getState().clipboard,
            onClick: handlePaste,
          },
          { type: "separator" as const },
          {
            label: "New Folder",
            onClick: handleNewFolder,
          },
          {
            label: "Refresh",
            shortcut: "F5",
            onClick: handleRefresh,
          },
        ]
    : [];

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") navigateTo(pathInput);
    else if (e.key === "Escape") setPathInput(currentPath);
  };

  if (!isTauriAvailable()) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-dark-900 text-center px-6">
        <FolderIcon className="w-16 h-16 mb-4 text-dark-600" weight="bold" />
        <p className="text-dark-300 text-sm mb-1">
          Local filesystem is only available in the desktop app
        </p>
        <p className="text-dark-500 text-xs">
          Run{" "}
          <code className="bg-dark-800 px-1.5 py-0.5 rounded">
            npm run tauri dev
          </code>{" "}
          to test locally
        </p>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: main file browser container with drag-and-drop
    <div
      ref={setContainerRef}
      className="h-full flex flex-col bg-dark-900 relative"
      role="button"
      tabIndex={0}
      onKeyDown={() => {}}
      onDragOver={handleDesktopDragOver}
      onDragLeave={handleDesktopDragLeave}
      onDrop={handleDesktopDrop}
      onContextMenu={handleBackgroundContextMenu}
      onMouseDown={handleMarqueeMouseDown}
      onMouseMove={handleMarqueeMouseMove}
      onMouseUp={handleMarqueeMouseUp}
    >
      {isDragOver && !fileDragState?.isDragging && (
        <div className="absolute inset-0 z-50 bg-primary-600/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-primary-300 text-lg font-medium">
            Drop files to import
          </p>
        </div>
      )}

      {isDropTarget && fileDragState?.isDragging && (
        <div className="absolute inset-0 z-50 bg-green-600/20 border-2 border-dashed border-green-500 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-green-300 text-lg font-medium">
            {fileDragState.sourceHostId === "local"
              ? "Drop to move"
              : "Drop to copy"}
          </p>
        </div>
      )}

      <LocalFileBrowserToolbar
        rootPath={rootPath}
        currentPath={currentPath}
        pathInput={pathInput}
        searchQuery={searchQuery}
        showHidden={showHidden}
        viewMode={viewMode}
        onPathInputChange={setPathInput}
        onPathInputKeyDown={handlePathKeyDown}
        onPathInputBlur={() => setPathInput(currentPath)}
        onNavigateRoot={() => navigateTo(rootPath)}
        onNavigateBack={navigateBack}
        onNavigateForward={navigateForward}
        canNavigateBack={historyIndex > 0}
        canNavigateForward={historyIndex < history.length - 1}
        onNavigateUp={navigateUp}
        onRefresh={() => loadDirectory(currentPath)}
        onNewFolder={handleNewFolder}
        onSearchChange={setSearchQuery}
        onShowHiddenChange={setShowHidden}
        onViewModeChange={setViewMode}
      />

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-200"
          >
            &times;
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex-1 p-3 space-y-1">
          {Array.from({ length: 8 }, (_, i) => `sk-${i}`).map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 p-2 animate-pulse"
            >
              <div className="w-5 h-5 bg-dark-700 rounded" />
              <div
                className="h-3 bg-dark-700 rounded flex-1"
                style={{ width: `${40 + Math.random() * 40}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {!isLoading && sortedFiles.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-dark-400">
          <FolderIcon className="w-16 h-16 mb-3 text-dark-600" weight="bold" />
          <p>{searchQuery ? "No matching files" : "Empty directory"}</p>
        </div>
      )}

      {!isLoading && sortedFiles.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <LocalFileBrowserList
            files={sortedFiles}
            viewMode={viewMode}
            selectedFiles={selectedFiles}
            paneId={paneId}
            renamingPath={renamingPath}
            renameValue={renameValue}
            sortField={sortField}
            sortDirection={sortDirection}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onSortFieldChange={setSortField}
            onSortDirectionChange={setSortDirection}
            onRenameValueChange={setRenameValue}
            onCommitRename={commitRename}
            onSetRenamingPath={setRenamingPath}
            renameInputRef={renameInputRef}
          />
        </div>
      )}

      <LocalFileBrowserStatusBar
        totalCount={sortedFiles.length}
        selectedCount={selectedFiles.size}
      />

      {isMarqueeDragging && marqueeStart && marqueeCurrent && (
        <div
          data-marquee
          className="fixed z-50 border border-primary-500 bg-primary-500/10 pointer-events-none"
          style={{
            left: Math.min(marqueeStart.x, marqueeCurrent.x),
            top: Math.min(marqueeStart.y, marqueeCurrent.y),
            width: Math.abs(marqueeCurrent.x - marqueeStart.x),
            height: Math.abs(marqueeCurrent.y - marqueeStart.y),
          }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {pasteConflicts && (
        <PasteConflictDialog
          conflicts={pasteConflicts}
          onConfirm={handleConflictConfirm}
          onCancel={handleConflictCancel}
        />
      )}
    </div>
  );
}
