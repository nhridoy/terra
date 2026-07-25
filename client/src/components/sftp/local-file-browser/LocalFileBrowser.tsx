import { FolderIcon } from "@phosphor-icons/react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { confirmDelete } from "../../../lib/confirmDelete";
import { extractError } from "../../../lib/extractError";
import {
  copyLocalFile,
  createLocalDir,
  isTauriAvailable,
  listLocalFiles,
  moveLocalFile,
  removeLocalFile,
  renameLocalFile,
} from "../../../lib/localFs";
import type {
  FileItem,
  FileSortDirection,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { useSftpStore } from "../../../stores/sftpStore";
import { Button } from "../../ui/Button";
import ContextMenu, { type ContextMenuItem } from "../../ui/ContextMenu";
import LocalFileBrowserList from "./LocalFileBrowserList";
import LocalFileBrowserStatusBar from "./LocalFileBrowserStatusBar";
import LocalFileBrowserToolbar from "./LocalFileBrowserToolbar";
import { useLocalKeyboard } from "./useLocalKeyboard";

interface LocalFileBrowserProps {
  rootPath: string;
}

export default function LocalFileBrowser({ rootPath }: LocalFileBrowserProps) {
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
  const containerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
    setSearchQuery("");
  }, []);

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

  const handleSelect = (fileName: string, isMultiSelect: boolean) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(isMultiSelect ? prev : []);
      if (newSet.has(fileName)) newSet.delete(fileName);
      else newSet.add(fileName);
      return newSet;
    });
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === containerRef.current) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      toast.info(
        "Drag-and-drop from desktop to local filesystem is not yet supported",
      );
    }
  }, []);

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
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    setSelectedFiles(new Set());
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getSelectedPaths = useCallback(() => {
    return [...selectedFiles]
      .map((name) => files.find((f) => f.name === name))
      .filter(Boolean)
      .map((f) => f!.path);
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
    let failed = 0;
    for (const srcPath of clipboard.paths) {
      const fileName = srcPath.split(/[/\\]/).pop() || srcPath;
      const destPath = currentPath.endsWith("\\") || currentPath.endsWith("/")
        ? `${currentPath}${fileName}`
        : `${currentPath}\\${fileName}`;
      try {
        if (clipboardMode === "copy") {
          if (srcPath === destPath) {
            const dir = destPath.substring(0, destPath.lastIndexOf("\\") + 1) ||
              destPath.substring(0, destPath.lastIndexOf("/") + 1);
            const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
            const base = ext ? fileName.substring(0, fileName.length - ext.length) : fileName;
            await copyLocalFile(srcPath, `${dir}${base} (copy)${ext}`);
          } else {
            await copyLocalFile(srcPath, destPath);
          }
        } else {
          await moveLocalFile(srcPath, destPath);
        }
        pasted++;
      } catch (err) {
        failed++;
        toast.error(extractError(err, `Failed to paste ${fileName}`));
      }
    }
    if (pasted > 0) {
      toast.success(`${clipboardMode === "copy" ? "Copied" : "Moved"} ${pasted} item${pasted > 1 ? "s" : ""}`);
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
              try {
                await openPath(contextMenu.file!.path);
              } catch (err) {
                toast.error(extractError(err, "Failed to open file"));
              }
            },
          },
          {
            label: "Show in Explorer",
            onClick: async () => {
              try {
                await revealItemInDir(contextMenu.file!.path);
              } catch (err) {
                toast.error(
                  extractError(err, "Failed to reveal in Explorer"),
                );
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
            onClick: () => startRename(contextMenu.file!),
          },
          { type: "separator" as const },
          {
            label: "Delete",
            danger: true,
            shortcut: "Del",
            onClick: () => handleDelete(contextMenu.file!),
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
      ref={containerRef}
      className="h-full flex flex-col bg-dark-900 relative"
      role="button"
      tabIndex={0}
      onKeyDown={() => {}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleBackgroundContextMenu}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary-600/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-primary-300 text-lg font-medium">
            Drop files here
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

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
