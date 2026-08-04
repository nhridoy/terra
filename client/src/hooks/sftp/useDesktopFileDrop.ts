import { type RefObject, useCallback } from "react";
import { joinPath } from "@/lib/sftp/fileTransfer";
import { listLocalFiles, writeLocalFileBytes } from "@/lib/sftp/localFs";
import type { FileItem } from "@/types/sftp/sftpTypes";
import {
  showTransferError,
  showTransferProgress,
  showTransferStart,
  showTransferSuccess,
} from "@/lib/sftp/transferToast";
import { fileBrowserActions } from "@/stores/sftp/fileBrowserStore";

interface UseDesktopFileDropParams {
  paneId: string;
  currentPath: string;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function useDesktopFileDrop({
  paneId,
  currentPath,
  containerRef,
}: UseDesktopFileDropParams) {
  const actions = fileBrowserActions;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set state if not already handled by useDragDropMonitor
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget === containerRef.current) {
        // Reset isDragOver — caller manages state
      }
    },
    [containerRef],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

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

  return { handleDragOver, handleDragLeave, handleDrop };
}
