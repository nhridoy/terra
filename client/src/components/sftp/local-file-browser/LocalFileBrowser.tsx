import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { FolderIcon } from "@phosphor-icons/react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useModal } from "../../../hooks/useModal";
import { buildClipboardPaths } from "../../../lib/buildClipboardPaths";
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
  isSameVolume,
  isTauriAvailable,
  listLocalFiles,
  moveLocalFile,
  removeLocalFile,
  renameLocalFile,
  writeLocalFileBytes,
} from "../../../lib/localFs";
import type { FileItem } from "../../../lib/sftpTypes";
import {
  showTransferError,
  showTransferProgress,
  showTransferStart,
  showTransferSuccess,
} from "../../../lib/transferToast";
import {
  fileBrowserActions,
  useFileBrowserStore,
} from "../../../stores/fileBrowserStore";
import { useSftpStore } from "../../../stores/sftpStore";
import { Button } from "../../ui/Button";
import ContextMenu, { type ContextMenuItem } from "../../ui/ContextMenu";
import PromptDialog from "../../ui/PromptDialog";
import { buildBaseContextMenuItems } from "../buildBaseContextMenuItems";
import PasteConflictDialog from "../file-browser/PasteConflictDialog";
import { useFileKeyboardShortcuts } from "../useFileKeyboardShortcuts";
import LocalFileBrowserList from "./LocalFileBrowserList";
import LocalFileBrowserStatusBar from "./LocalFileBrowserStatusBar";
import LocalFileBrowserToolbar from "./LocalFileBrowserToolbar";

interface LocalFileBrowserProps {
  paneId: string;
  rootPath: string;
}

const localProvider = new LocalFileProvider("local");

export default function LocalFileBrowser({
  paneId,
  rootPath,
}: LocalFileBrowserProps) {
  // ── Store ────────────────────────────────────────────────────────────────
  const paneState = useFileBrowserStore((s) => s.panes[paneId]);
  const getOrCreatePane = useFileBrowserStore((s) => s.getOrCreatePane);

  // Initialize pane on first render
  const initialized = useRef(false);
  if (!initialized.current) {
    getOrCreatePane(paneId, rootPath);
    initialized.current = true;
  }

  const files = paneState?.files ?? [];
  const currentPath = paneState?.currentPath ?? rootPath;
  const isLoading = paneState?.isLoading ?? false;
  const error = paneState?.error ?? null;
  const selectedFiles = paneState?.selectedFiles ?? new Set<string>();
  const viewMode = paneState?.viewMode ?? "list";
  const showHidden = paneState?.showHidden ?? false;
  const sortField = paneState?.sortField ?? "name";
  const sortDirection = paneState?.sortDirection ?? "asc";
  const searchQuery = paneState?.searchQuery ?? "";
  const renamingPath = paneState?.renamingPath ?? null;
  const renameValue = paneState?.renameValue ?? "";
  const history = paneState?.history ?? [rootPath];
  const historyIndex = paneState?.historyIndex ?? 0;
  const pasteConflicts = paneState?.pasteConflicts ?? null;
  const pendingDrop = paneState?.pendingDrop ?? null;

  // ── Component-only state ─────────────────────────────────────────────────
  const [pathInput, setPathInput] = useState(currentPath);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file?: FileItem;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [dropMode, setDropMode] = useState<"move" | "copy">("move");
  const lastVolumeCheck = useRef<{
    src: string;
    dest: string;
    result: boolean;
  } | null>(null);
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
  const newFileModal = useModal();
  const newFolderModal = useModal();

  const fileDragState = useSftpStore((s) => s.fileDragState);
  const pendingFileDrop = useSftpStore((s) => s.pendingFileDrop);
  const setPendingFileDrop = useSftpStore((s) => s.setPendingFileDrop);

  const actions = fileBrowserActions;

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    actions.loadFiles(paneId, currentPath, listLocalFiles);
    setPathInput(currentPath);
  }, [currentPath, paneId]);

  useEffect(() => {
    actions.navigateTo(paneId, rootPath, true);
    setPathInput(rootPath);
  }, [rootPath, paneId]);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (path: string, skipHistory = false) => {
      actions.navigateTo(paneId, path, skipHistory);
      setPathInput(path);
    },
    [paneId],
  );

  const navigateBack = useCallback(
    () => actions.navigateBack(paneId),
    [paneId],
  );

  const navigateForward = useCallback(
    () => actions.navigateForward(paneId),
    [paneId],
  );

  const navigateUp = useCallback(() => actions.navigateUp(paneId), [paneId]);

  const handleDoubleClick = useCallback(
    (file: FileItem) => {
      if (file.type === "directory") navigateTo(file.path);
    },
    [navigateTo],
  );

  const sortedFiles = paneState?.sortedFiles ?? [];

  // ── Recompute sorted files when inputs change ────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need these to trigger recomputation
  useEffect(() => {
    actions.updateSortedFiles(paneId);
  }, [paneId, files, showHidden, searchQuery, sortField, sortDirection]);

  const handleSelect = useCallback(
    (fileName: string, isMultiSelect: boolean, isRangeSelect: boolean) => {
      actions.selectFile(
        paneId,
        fileName,
        isMultiSelect,
        isRangeSelect,
        sortedFiles,
      );
    },
    [paneId, sortedFiles],
  );

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
      actions.setFiles(
        paneId,
        files.map((f) =>
          f.path === renamingPath
            ? { ...f, name: renameValue.trim(), path: newPath }
            : f,
        ),
      );
    } catch (err: unknown) {
      toast.error(`Failed to rename: ${extractError(err)}`);
    } finally {
      actions.cancelRename(paneId);
    }
  }, [paneId, renamingPath, renameValue, files, currentPath]);

  // ── New file / folder ────────────────────────────────────────────────────
  const handleNewFolder = () => newFolderModal.show();
  const handleNewFile = () => newFileModal.show();

  const confirmNewFolder = useCallback(
    async (name: string) => {
      const sep = currentPath.includes("\\") ? "\\" : "/";
      try {
        await createLocalDir(currentPath + sep + name);
        toast.success(`Created folder ${name}`);
        actions.setFiles(paneId, [
          ...files,
          {
            name,
            path: currentPath.endsWith("/")
              ? `${currentPath}${name}`
              : `${currentPath}/${name}`,
            type: "directory",
            size: 0,
            permissions: "",
            owner: "",
            group: "",
            modifiedAt: new Date().toISOString(),
            isHidden: name.startsWith("."),
          },
        ]);
      } catch (err: unknown) {
        toast.error(`Failed to create folder: ${extractError(err)}`);
      }
    },
    [paneId, currentPath, files],
  );

  const confirmNewFile = useCallback(
    async (name: string) => {
      const sep = currentPath.includes("\\") ? "\\" : "/";
      const filePath = currentPath + sep + name;
      try {
        await writeLocalFileBytes(filePath, new Uint8Array(0));
        toast.success(`Created file ${name}`);
        actions.setFiles(paneId, [
          ...files,
          {
            name,
            path: filePath,
            type: "file",
            size: 0,
            permissions: "",
            owner: "",
            group: "",
            modifiedAt: new Date().toISOString(),
            isHidden: name.startsWith("."),
          },
        ]);
      } catch (err: unknown) {
        toast.error(`Failed to create file: ${extractError(err)}`);
      }
    },
    [paneId, currentPath, files],
  );

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (file: FileItem) => {
      if (!(await confirmDelete(`Delete "${file.name}"?`))) return;
      try {
        await removeLocalFile(file.path);
        toast.success(`Deleted ${file.name}`);
        actions.setFiles(
          paneId,
          files.filter((f) => f.path !== file.path),
        );
      } catch (err: unknown) {
        toast.error(`Failed to delete ${file.name}: ${extractError(err)}`);
      }
    },
    [paneId, files],
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
    const deletedPaths = new Set<string>();
    for (const file of selected) {
      try {
        await removeLocalFile(file.path);
        deletedPaths.add(file.path);
        deleted++;
      } catch {
        failed++;
      }
    }
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} item${deleted > 1 ? "s" : ""}`);
      actions.setFiles(
        paneId,
        files.filter((f) => !deletedPaths.has(f.path)),
      );
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} item${failed > 1 ? "s" : ""}`);
    }
  }, [selectedFiles, files, paneId]);

  // ── Clipboard ────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const paths = buildClipboardPaths(selectedFiles, files);
    if (paths.length === 0) return;
    useSftpStore.getState().setClipboard("local", paths, "copy");
    toast.success(`Copied ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [selectedFiles, files]);

  const handleCut = useCallback(() => {
    const paths = buildClipboardPaths(selectedFiles, files);
    if (paths.length === 0) return;
    useSftpStore.getState().setClipboard("local", paths, "cut");
    toast.success(`Cut ${paths.length} item${paths.length > 1 ? "s" : ""}`);
  }, [selectedFiles, files]);

  const handlePaste = useCallback(async () => {
    const { clipboard, clipboardMode } = useSftpStore.getState();
    if (!clipboard || !clipboardMode) return;
    if (clipboard.hostId !== "local") {
      toast.error("Cannot paste remote files to local filesystem");
      return;
    }
    let pasted = 0;
    const copiedPaths = new Set<string>();
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
          copiedPaths.add(srcPath);
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
      if (clipboardMode === "cut") {
        actions.setFiles(
          paneId,
          files.filter((f) => !copiedPaths.has(f.path)),
        );
      }
    }
    if (clipboardMode === "cut") {
      useSftpStore.getState().clearClipboard();
    }
  }, [currentPath, files, paneId]);

  // ── Desktop drag-and-drop ────────────────────────────────────────────────
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
        } catch {
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

      actions.loadFiles(paneId, currentPath, listLocalFiles);
    },
    [currentPath, paneId],
  );

  // ── @dnd-kit droppable ───────────────────────────────────────────────────
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

  // ── @dnd-kit drag monitor ────────────────────────────────────────────────
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
        const dragFiles = source.data.files as FileItem[];
        const destDirPath = target.data.path as string;
        const normalize = (p: string) => p.replace(/\\/g, "/");
        const srcDir =
          normalize(dragFiles[0]?.path ?? "")
            .split("/")
            .slice(0, -1)
            .join("/") || "/";
        const isNoop =
          sourceHostId === destHostId &&
          normalize(srcDir) === normalize(destDirPath);
        const shouldShow = !isNoop && destDirPath === currentPath;
        setIsDropTarget(shouldShow);

        if (shouldShow) {
          if (sourceHostId !== "local" || destHostId !== "local") {
            setDropMode("copy");
          } else {
            const srcPath = dragFiles[0]?.path ?? "";
            const cached = lastVolumeCheck.current;
            if (
              cached &&
              cached.src === srcPath &&
              cached.dest === destDirPath
            ) {
              setDropMode(cached.result ? "move" : "copy");
            } else {
              isSameVolume(srcPath || destDirPath, destDirPath)
                .then((same) => {
                  lastVolumeCheck.current = {
                    src: srcPath,
                    dest: destDirPath,
                    result: same,
                  };
                  setDropMode(same ? "move" : "copy");
                })
                .catch(() => setDropMode("copy"));
            }
          }
        }
      } else {
        setIsDropTarget(false);
      }
    },
    onDragEnd() {
      setIsDropTarget(false);
    },
  });

  // ── Transfer execution ───────────────────────────────────────────────────
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

      // Optimistic UI update
      const isDestCurrentDir = destDirPath === currentPath;
      const isSourceCurrentDir = dragFiles.some(
        (f) => f.path.split(/[/\\]/).slice(0, -1).join("/") === currentPath,
      );

      const prevFiles =
        useFileBrowserStore.getState().panes[paneId]?.files ?? [];
      let next = prevFiles;
      if (mode === "move" && isSourceCurrentDir) {
        const movedPaths = new Set(results.map((r) => r.file.path));
        next = next.filter((f) => !movedPaths.has(f.path));
      }
      if (mode === "copy" && isDestCurrentDir) {
        const added = results
          .filter((r) => r.action !== "skipped")
          .map((r) => ({
            ...r.file,
            path: joinPath(destDirPath, r.file.name),
          }));
        next = [...next, ...added];
      }
      actions.setFiles(paneId, next);
    },
    [currentPath, paneId],
  );

  // ── Handle pending file drops from SftpLayout ────────────────────────────
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
    const sep = destDirPath.includes("\\") ? "\\" : "/";
    const isSameDir =
      dragFiles[0]?.path.split(/[/\\]/).slice(0, -1).join(sep) === destDirPath;

    if (isSamePane && isSameDir) {
      setPendingFileDrop(null);
      return;
    }

    (async () => {
      let mode: "move" | "copy";
      try {
        const same = await isSameVolume(
          dragFiles[0]?.path ?? destDirPath,
          destDirPath,
        );
        mode = same ? "move" : "copy";
      } catch {
        mode = isSamePane ? "move" : "copy";
      }

      let destFiles: FileItem[];
      try {
        destFiles = await listLocalFiles(destDirPath);
      } catch {
        destFiles = [];
      }
      const destNames = new Set(destFiles.map((f) => f.name));
      const conflicts = dragFiles.filter((f) => destNames.has(f.name));

      if (conflicts.length > 0) {
        actions.setPasteConflicts(
          paneId,
          conflicts.map((f) => ({
            srcPath: f.path,
            dstPath: joinPath(destDirPath, f.name),
            dstName: f.name,
          })),
        );
        actions.setPendingDrop(paneId, { files: dragFiles, destDirPath, mode });
      } else {
        await executeTransfer(dragFiles, destDirPath, mode);
      }
    })();

    setPendingFileDrop(null);
  }, [pendingFileDrop, paneId, executeTransfer, setPendingFileDrop]);

  const handleConflictConfirm = useCallback(
    async (
      overrides: Map<
        string,
        { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
      >,
    ) => {
      if (!pendingDrop) return;
      const { files: dragFiles, destDirPath, mode } = pendingDrop;
      actions.setPasteConflicts(paneId, null);
      actions.setPendingDrop(paneId, null);
      await executeTransfer(dragFiles, destDirPath, mode, overrides);
    },
    [pendingDrop, executeTransfer, paneId],
  );

  const handleConflictCancel = useCallback(() => {
    actions.setPasteConflicts(paneId, null);
    actions.setPendingDrop(paneId, null);
  }, [paneId]);

  // ── Marquee selection ────────────────────────────────────────────────────
  const handleMarqueeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (
        !(e.target as HTMLElement).closest("[data-file-item]") &&
        !(e.target as HTMLElement).closest("[data-marquee]")
      ) {
        e.preventDefault();
        setIsMarqueeDragging(true);
        setMarqueeStart({ x: e.clientX, y: e.clientY });
        setMarqueeCurrent({ x: e.clientX, y: e.clientY });
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          actions.clearSelection(paneId);
        }
      }
    },
    [paneId],
  );

  const handleMarqueeMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isMarqueeDragging || !marqueeStart) return;
      const current = { x: e.clientX, y: e.clientY };
      setMarqueeCurrent(current);

      const minX = Math.min(marqueeStart.x, current.x);
      const maxX = Math.max(marqueeStart.x, current.x);
      const minY = Math.min(marqueeStart.y, current.y);
      const maxY = Math.max(marqueeStart.y, current.y);
      if (maxX - minX < 3 && maxY - minY < 3) return;

      const items = containerRef.current?.querySelectorAll("[data-file-item]");
      const base = e.ctrlKey || e.metaKey ? selectedFiles : [];
      const newSelected = new Set(base);
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
      useFileBrowserStore.getState().updatePane(paneId, {
        selectedFiles: newSelected,
      });
    },
    [isMarqueeDragging, marqueeStart, selectedFiles, paneId],
  );

  const handleMarqueeMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isMarqueeDragging) return;
      setIsMarqueeDragging(false);

      if (!marqueeStart) {
        setMarqueeStart(null);
        setMarqueeCurrent(null);
        return;
      }

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
      const base = e.ctrlKey || e.metaKey ? selectedFiles : [];
      const newSelected = new Set(base);
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
      useFileBrowserStore.getState().updatePane(paneId, {
        selectedFiles: newSelected,
      });
      setMarqueeStart(null);
      setMarqueeCurrent(null);
    },
    [isMarqueeDragging, marqueeStart, selectedFiles, paneId],
  );

  // ── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedFiles.has(file.name)) {
        useFileBrowserStore.getState().updatePane(paneId, {
          selectedFiles: new Set([file.name]),
        });
      }
      setContextMenu({ x: e.clientX, y: e.clientY, file });
    },
    [paneId, selectedFiles],
  );

  const handleBackgroundContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      actions.clearSelection(paneId);
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [paneId],
  );

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(
    () => actions.loadFiles(paneId, currentPath, listLocalFiles),
    [currentPath, paneId],
  );

  useFileKeyboardShortcuts({
    selectedFiles,
    files,
    onRename: startRename,
    onNavigateUp: navigateUp,
    onRefresh: handleRefresh,
    onClearSelection: useCallback(
      () => actions.clearSelection(paneId),
      [paneId],
    ),
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onDelete: handleDeleteSelected,
    onNewFile: handleNewFile,
    onNewFolder: handleNewFolder,
  });

  // ── Context menu items ───────────────────────────────────────────────────
  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? contextMenu.file
      ? buildBaseContextMenuItems({
          menuFile: contextMenu.file,
          hasClipboard: !!useSftpStore.getState().clipboard,
          actions: {
            onCopy: handleCopy,
            onCut: handleCut,
            onPaste: handlePaste,
            onDelete: handleDelete,
            onNewFile: handleNewFile,
            onNewFolder: handleNewFolder,
          },
          onRename: startRename,
          beforeItems: [
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
                  toast.error(
                    extractError(err, "Failed to reveal in Explorer"),
                  );
                }
              },
            },
          ],
        })
      : buildBaseContextMenuItems({
          menuFile: null,
          hasClipboard: !!useSftpStore.getState().clipboard,
          actions: {
            onCopy: handleCopy,
            onCut: handleCut,
            onPaste: handlePaste,
            onDelete: handleDelete,
            onNewFile: handleNewFile,
            onNewFolder: handleNewFolder,
          },
          onRename: startRename,
          afterItems: [
            { type: "separator" as const },
            {
              label: "Refresh",
              shortcut: "F5",
              onClick: handleRefresh,
            },
          ],
        })
    : [];

  // ── Path bar ─────────────────────────────────────────────────────────────
  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") navigateTo(pathInput);
    else if (e.key === "Escape") setPathInput(currentPath);
  };

  // ── Guard: Tauri only ───────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    // biome-ignore lint/a11y/useSemanticElements: main file browser container with drag-and-drop
    <div
      ref={setContainerRef}
      className="h-full flex flex-col bg-dark-900 relative select-none"
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
            {dropMode === "move" ? "Drop to move" : "Drop to copy"}
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
        onRefresh={() => actions.loadFiles(paneId, currentPath, listLocalFiles)}
        onNewFolder={handleNewFolder}
        onSearchChange={(q) => actions.setSearchQuery(paneId, q)}
        onShowHiddenChange={(s) => actions.setShowHidden(paneId, s)}
        onViewModeChange={(m) => actions.setViewMode(paneId, m)}
      />

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => actions.clearError(paneId)}
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
            onSortFieldChange={(f) => actions.setSortField(paneId, f)}
            onSortDirectionChange={(fn) =>
              useFileBrowserStore.getState().updatePane(paneId, {
                sortDirection: fn(sortDirection),
              })
            }
            onRenameValueChange={(v) => actions.setRenameValue(paneId, v)}
            onCommitRename={commitRename}
            onSetRenamingPath={(p) => actions.setRenamingPath(paneId, p)}
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

      {newFileModal.open && (
        <PromptDialog
          open={newFileModal.open}
          title="New File"
          placeholder="filename.txt"
          confirmLabel="Create"
          onConfirm={confirmNewFile}
          onClose={newFileModal.hide}
        />
      )}

      {newFolderModal.open && (
        <PromptDialog
          open={newFolderModal.open}
          title="New Folder"
          placeholder="folder name"
          confirmLabel="Create"
          onConfirm={confirmNewFolder}
          onClose={newFolderModal.hide}
        />
      )}
    </div>
  );
}
