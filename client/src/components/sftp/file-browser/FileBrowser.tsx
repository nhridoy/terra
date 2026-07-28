import { pointerIntersection } from "@dnd-kit/collision";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { useCallback, useEffect, useState } from "react";
import type { FileItem } from "../../../lib/sftpTypes";
import { useSftpStore } from "../../../stores/sftpStore";
import { Button } from "../../ui/Button";
import Modal from "../../ui/Modal";
import FileBrowserStatusBar from "../shared/FileBrowserStatusBar";
import FileBrowserToolbar from "../shared/FileBrowserToolbar";
import FileBrowserList from "./FileBrowserList";
import {
  DragOverOverlay,
  DropTargetOverlay,
  ErrorBar,
} from "./FileBrowserOverlays";
import PasteConflictDialog from "./PasteConflictDialog";
import { useFileKeyboard } from "./useFileKeyboard";
import { useFileOperations } from "./useFileOperations";

interface FileBrowserProps {
  paneId?: string;
  hostId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  onFileSelect?: (file: FileItem) => void;
}

export default function FileBrowser({
  paneId = "standalone",
  hostId,
  hostAddress,
  hostPort,
  hostUsername,
  onFileSelect,
}: FileBrowserProps) {
  const fileDragState = useSftpStore((s) => s.fileDragState);
  const pendingFileDrop = useSftpStore((s) => s.pendingFileDrop);
  const setPendingFileDrop = useSftpStore((s) => s.setPendingFileDrop);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const ops = useFileOperations({
    paneId,
    hostId,
    hostAddress,
    hostPort,
    hostUsername,
    onFileSelect,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0)
        ops.handleUpload(e.dataTransfer.files);
    },
    [ops.handleUpload],
  );

  const droppable = useDroppable({
    id: `file-drop-${paneId}`,
    data: { type: "file-drop", paneId, hostId, path: ops.currentPath },
    collisionDetector: pointerIntersection,
  });

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => droppable.ref(node),
    [droppable.ref],
  );

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
        const srcDir = files[0]?.path.split("/").slice(0, -1).join("/") || "/";
        const isNoop = sourceHostId === destHostId && srcDir === destDirPath;
        setIsDropTarget(!isNoop && destDirPath === ops.currentPath);
      } else {
        setIsDropTarget(false);
      }
    },
    onDragEnd() {
      setIsDropTarget(false);
    },
  });

  useEffect(() => {
    if (!pendingFileDrop) return;
    if (pendingFileDrop.destPaneId !== paneId) return;
    ops.executeFileDrop(
      pendingFileDrop.files,
      pendingFileDrop.sourceHostId || "",
      pendingFileDrop.destHostId || "",
      pendingFileDrop.destDirPath || "/",
      undefined,
      pendingFileDrop.sourceDirect,
      pendingFileDrop.sourcePaneId,
    );
    setPendingFileDrop(null);
  }, [pendingFileDrop, paneId, ops.executeFileDrop, setPendingFileDrop]);

  useFileKeyboard({
    activePaneId: ops.activePaneId,
    paneId,
    deleteConfirm: ops.deleteConfirm,
    pasteConflicts: ops.pasteConflicts,
    confirmDelete: ops.confirmDeleteAction,
    setDeleteConfirm: ops.setDeleteConfirm,
    setPasteConflicts: ops.setPasteConflicts,
    selectedFiles: ops.selectedFiles,
    files: ops.files,
    sortedFiles: ops.sortedFiles,
    currentPath: ops.currentPath,
    loadDirectory: ops.loadDirectory,
    startRename: ops.startRename,
    navigateUp: ops.navigateUp,
    handleCut: ops.handleCut,
    handlePaste: ops.handlePaste,
    handleDeleteSelected: ops.handleDeleteSelected,
    handleNewFile: ops.actions.handleNewFile,
    handleCopy: ops.handleCopy,
    setSelectedFiles: ops.setSelectedFiles,
  });

  return (
    // biome-ignore lint/a11y/useSemanticElements: drag-and-drop container needs div
    <div
      ref={setContainerRef}
      role="region"
      aria-label="File browser"
      className="h-full flex flex-col bg-dark-900 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DragOverOverlay isDragOver={isDragOver} fileDragState={fileDragState} />
      <DropTargetOverlay
        isDropTarget={isDropTarget}
        fileDragState={fileDragState}
        hostId={hostId}
      />

      <FileBrowserToolbar
        currentPath={ops.currentPath}
        pathLabel="Remote path"
        searchQuery={ops.searchQuery}
        showHidden={ops.showHidden}
        viewMode={ops.viewMode}
        onNavigateTo={(path) => {
          const normalized = path.startsWith("/") ? path : `/${path}`;
          ops.navigateTo(normalized);
        }}
        onNavigateRoot={() => ops.navigateTo("/")}
        onNavigateUp={ops.navigateUp}
        onRefresh={() => ops.loadDirectory(ops.currentPath)}
        onNewFolder={ops.actions.handleNewFolder}
        onSearchChange={ops.setSearchQuery}
        onShowHiddenChange={ops.setShowHidden}
        onViewModeChange={ops.setViewMode}
        beforeActions={
          <label className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-sm cursor-pointer transition-colors">
            Upload
            <input
              type="file"
              className="hidden"
              multiple
              onChange={(e) =>
                e.target.files && ops.handleUpload(e.target.files)
              }
            />
          </label>
        }
      />

      <ErrorBar error={ops.error} setError={ops.setError} />

      <FileBrowserList
        isLoading={ops.isLoading}
        sortedFiles={ops.sortedFiles}
        viewMode={ops.viewMode}
        searchQuery={ops.searchQuery}
        sortField={ops.sortField}
        sortDirection={ops.sortDirection}
        setSortField={ops.setSortField}
        setSortDirection={ops.setSortDirection}
        paneId={paneId}
        hostId={hostId}
        hostAddress={hostAddress}
        hostUsername={hostUsername}
        selectedFiles={ops.selectedFiles}
        clipboard={ops.clipboard}
        renamingPath={ops.renamingPath}
        renameValue={ops.renameValue}
        renameInputRef={ops.renameInputRef}
        commitRename={ops.commitRename}
        setRenamingPath={ops.setRenamingPath}
        setRenameValue={ops.setRenameValue}
        actions={ops.actions}
      />

      <FileBrowserStatusBar
        totalCount={ops.sortedFiles.length}
        selectedCount={ops.selectedFiles.size}
      />

      {ops.pasteConflicts && (
        <PasteConflictDialog
          conflicts={ops.pasteConflicts}
          onConfirm={(overrides) => {
            ops.setPasteConflicts(null);
            if (ops.pendingDrop) {
              ops.executeFileDrop(
                ops.pendingDrop.files,
                ops.pendingDrop.sourceHostId,
                ops.pendingDrop.destHostId,
                ops.pendingDrop.destDirPath,
                overrides,
                ops.pendingDrop.sourceDirect,
                ops.pendingDrop.sourcePaneId,
              );
              ops.setPendingDrop(null);
            } else {
              ops.executePaste(overrides);
            }
          }}
          onCancel={() => {
            ops.setPasteConflicts(null);
            ops.setPendingDrop(null);
            if (ops.clipboardMode === "cut") ops.clearClipboard();
          }}
        />
      )}

      {ops.deleteConfirm && (
        <Modal
          open
          onClose={() => ops.setDeleteConfirm(null)}
          title="Confirm Delete"
          maxWidth="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-dark-300">
              {ops.deleteConfirm.files.length === 1 ? (
                <>
                  Are you sure you want to delete{" "}
                  <span className="text-white font-medium">
                    {ops.deleteConfirm.files[0].name}
                  </span>
                  ?
                </>
              ) : (
                <>
                  Are you sure you want to delete{" "}
                  <span className="text-white font-medium">
                    {ops.deleteConfirm.files.length} items
                  </span>
                  ?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => ops.setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={ops.confirmDeleteAction}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
