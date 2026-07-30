import { listen } from "@tauri-apps/api/event";
import type { DragDropEvent } from "@tauri-apps/api/webviewWindow";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef, useState } from "react";
import { joinPath } from "../../../lib/fileTransfer";
import { listLocalFiles } from "../../../lib/localFs";
import type { FileItem } from "../../../lib/sftpTypes";
import {
  showTransferCancelled,
  showTransferError,
  showTransferProgress,
  showTransferStart,
  showTransferSuccess,
} from "../../../lib/transferToast";
import { fileBrowserActions } from "../../../stores/fileBrowserStore";

interface UseTauriDragDropParams {
  paneId: string;
  currentPath: string;
  hostId: string;
  onDrop?: (paths: string[], destDir: string) => void | Promise<void>;
}

interface DropTarget {
  paneId: string;
  hostId: string;
  path: string;
}

/**
 * Resolves the drop target under the cursor.
 * Priority: directory row > container (without data-file-row).
 */
function resolveDropTarget(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;

  const dirRow = el.closest(
    "[data-drop-target-type='directory']",
  ) as HTMLElement | null;
  if (dirRow) {
    const path = dirRow.dataset.dropTargetPath;
    const paneId = dirRow.dataset.dropTargetPane;
    const hostId = dirRow.dataset.dropTargetHost;
    if (path && paneId && hostId) {
      return { paneId, hostId, path };
    }
  }

  let current: HTMLElement | null = el;
  while (current) {
    if (current.dataset.dropTargetPath && !current.dataset.fileRow) {
      const path = current.dataset.dropTargetPath;
      const paneId = current.dataset.dropTargetPane;
      const hostId = current.dataset.dropTargetHost;
      if (path && paneId && hostId) {
        return { paneId, hostId, path };
      }
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Hook that listens to Tauri's native OS drag-drop events.
 *
 * All panes listen to the same window-level event, but each pane only
 * reacts when the resolved drop target matches its own paneId.
 */
export function useTauriDragDrop({
  paneId,
  currentPath,
  hostId,
  onDrop,
}: UseTauriDragDropParams) {
  const [isDragOver, setIsDragOver] = useState(false);
  const actions = fileBrowserActions;

  // Store mutable values in refs so the effect never needs to re-run
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleDrop = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;

      const lastPos = lastPosRef.current;
      if (!lastPos) return;

      const target = resolveDropTarget(lastPos.x, lastPos.y);
      if (!target) return;
      if (target.paneId !== paneId || target.hostId !== hostId) return;

      const destDir = target.path;

      if (onDropRef.current) {
        await onDropRef.current(paths, destDir);
        return;
      }

      const { invoke } = await import("@tauri-apps/api/core");

      // Get real file sizes before showing the toast
      const sizes = await Promise.all(
        paths.map((p) =>
          invoke<number>("get_file_size", { path: p }).catch(() => 0),
        ),
      );

      const fileItems: FileItem[] = paths.map((p, i) => {
        const name = p.split(/[/\\]/).pop() || p;
        return {
          name,
          path: p,
          type: "file" as const,
          size: sizes[i] || 0,
          permissions: "",
          owner: "",
          group: "",
          modifiedAt: new Date().toISOString(),
          isHidden: name.startsWith("."),
        };
      });

      const operationId = crypto.randomUUID();

      const onCancel = () => {
        invoke("cancel_copy", { operationId });
      };

      const toastId = showTransferStart(fileItems, "copy", onCancel);
      const totalBytes = fileItems.reduce((s, f) => s + f.size, 0);

      // Listen for progress events from Rust — filter by operationId
      const unlisten = await listen<{
        operationId: string;
        source: string;
        copied: number;
        total: number;
        percent: number;
      }>("copy-progress", (event) => {
        if (event.payload.operationId !== operationId) return;
        showTransferProgress(
          toastId,
          fileItems,
          event.payload.copied,
          totalBytes,
          "copy",
          onCancel,
        );
      });

      try {
        const files = paths.map((srcPath) => {
          const name = srcPath.split(/[/\\]/).pop() || srcPath;
          return { source: srcPath, destination: joinPath(destDir, name) };
        });

        const errors: string[] = await invoke("copy_files_with_progress", {
          files,
          operationId,
        });

        if (errors.length === 0) {
          showTransferSuccess(toastId, fileItems, "copy");
        } else if (errors.length === paths.length) {
          const msg = errors[0] || "All files failed";
          if (msg === "Cancelled") {
            showTransferCancelled(toastId, fileItems, "copy");
          } else {
            showTransferError(toastId, fileItems, "copy", msg);
          }
        } else {
          showTransferSuccess(toastId, fileItems, "copy");
        }
      } catch (err) {
        showTransferError(
          toastId,
          fileItems,
          "copy",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        unlisten();
      }

      setTimeout(() => {
        actions.loadFiles(paneId, currentPathRef.current, listLocalFiles);
      }, 200);
    },
    [paneId, hostId],
  );

  const handleDropRef = useRef(handleDrop);
  handleDropRef.current = handleDrop;

  // Single listener — only re-runs if paneId or hostId changes (very rare)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    const onMouseMove = (e: MouseEvent) => {
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);

    const appWindow = getCurrentWebviewWindow();

    appWindow
      .onDragDropEvent((event: DragDropEvent) => {
        if (cancelled) return;
        const payload = event.payload;

        if (payload.type === "enter" || payload.type === "over") {
          const pos = (payload as { position?: { x: number; y: number } })
            .position;
          if (pos) {
            lastPosRef.current = pos;
          }

          const lastPos = lastPosRef.current;
          if (lastPos) {
            const target = resolveDropTarget(lastPos.x, lastPos.y);
            setIsDragOver(
              target?.paneId === paneId && target?.hostId === hostId,
            );
          } else {
            setIsDragOver(false);
          }
        } else if (payload.type === "drop") {
          setIsDragOver(false);
          const droppedPaths: string[] = payload.paths ?? [];
          if (droppedPaths.length > 0) {
            handleDropRef.current(droppedPaths);
          }
        } else {
          setIsDragOver(false);
          lastPosRef.current = null;
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [paneId, hostId]);

  return { isDragOver };
}
