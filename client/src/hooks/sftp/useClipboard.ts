import { useCallback } from "react";
import { toast } from "sonner";
import { extractError } from "@/lib/common/extractError";
import { buildClipboardPaths } from "@/lib/sftp/buildClipboardPaths";
import { generateAutoName } from "@/lib/sftp/fileHelpers";
import { joinPath } from "@/lib/sftp/fileTransfer";
import {
  copyLocalFile,
  listLocalFiles,
  moveLocalFile,
} from "@/lib/sftp/localFs";
import {
  fileBrowserActions,
  useFileBrowserStore,
} from "@/stores/sftp/fileBrowserStore";
import { useSftpStore } from "@/stores/sftp/sftpStore";
import type { FileItem } from "@/types/sftp/sftpTypes";

interface UseClipboardParams {
  paneId: string;
  currentPath: string;
  files: FileItem[];
  selectedFiles: Set<string>;
}

export function useClipboard({
  paneId,
  currentPath,
  files,
  selectedFiles,
}: UseClipboardParams) {
  const actions = fileBrowserActions;

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

    const mode = clipboardMode === "copy" ? "copy" : "move";
    const normalize = (p: string) => p.replace(/\\/g, "/");

    const sourceFiles: FileItem[] = clipboard.paths.map((srcPath) => {
      const name = srcPath.split(/[/\\]/).pop() || srcPath;
      return {
        name,
        path: srcPath,
        type: "file" as const,
        size: 0,
        permissions: "",
        owner: "",
        group: "",
        modifiedAt: new Date().toISOString(),
        isHidden: name.startsWith("."),
      };
    });

    const destNames = new Set(files.map((f) => f.name));
    const conflicts = sourceFiles.filter((f) => {
      const destPath = joinPath(currentPath, f.name);
      if (mode === "copy" && normalize(f.path) === normalize(destPath))
        return false;
      return destNames.has(f.name);
    });

    if (conflicts.length > 0) {
      actions.setPasteConflicts(
        paneId,
        conflicts.map((f) => ({
          srcPath: f.path,
          dstPath: joinPath(currentPath, f.name),
          dstName: f.name,
        })),
      );
      actions.setPendingDrop(paneId, {
        files: sourceFiles,
        destDirPath: currentPath,
        mode,
      });
      return;
    }

    const movedPaths = new Set<string>();
    let pasted = 0;

    for (const srcPath of clipboard.paths) {
      const fileName = srcPath.split(/[/\\]/).pop() || srcPath;
      const destPath = joinPath(currentPath, fileName);
      try {
        if (clipboardMode === "copy") {
          const normalize = (p: string) => p.replace(/\\/g, "/");
          let finalPath = destPath;
          if (normalize(srcPath) === normalize(destPath)) {
            const newName = generateAutoName(fileName, [...destNames]);
            finalPath = joinPath(currentPath, newName);
          }
          destNames.add(finalPath.split(/[/\\]/).pop() || finalPath);
          await copyLocalFile(srcPath, finalPath);
        } else {
          await moveLocalFile(srcPath, destPath);
          movedPaths.add(srcPath);
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

      try {
        const freshFiles = await listLocalFiles(currentPath);
        actions.setFiles(paneId, freshFiles);
      } catch {
        // silent fail
      }

      if (clipboardMode === "cut" && movedPaths.size > 0) {
        const sourceDir =
          clipboard.paths[0]?.split(/[/\\]/).slice(0, -1).join("/") || "";
        if (sourceDir) {
          const allPanes = useFileBrowserStore.getState().panes;
          for (const [id, p] of Object.entries(allPanes)) {
            if (id === paneId) continue;
            const paneDir = p.currentPath.replace(/\\/g, "/");
            if (paneDir === sourceDir.replace(/\\/g, "/")) {
              try {
                const srcFresh = await listLocalFiles(p.currentPath);
                fileBrowserActions.setFiles(id, srcFresh);
              } catch {
                // silent fail
              }
            }
          }
        }
      }
    }

    if (clipboardMode === "cut") {
      useSftpStore.getState().clearClipboard();
    }
  }, [currentPath, paneId, files]);

  return { handleCopy, handleCut, handlePaste };
}
