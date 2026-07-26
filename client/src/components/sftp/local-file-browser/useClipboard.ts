import { useCallback } from "react";
import { toast } from "sonner";
import { buildClipboardPaths } from "../../../lib/buildClipboardPaths";
import { extractError } from "../../../lib/extractError";
import { copyLocalFile, moveLocalFile } from "../../../lib/localFs";
import type { FileItem } from "../../../lib/sftpTypes";
import { fileBrowserActions } from "../../../stores/fileBrowserStore";
import { useSftpStore } from "../../../stores/sftpStore";

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

  return { handleCopy, handleCut, handlePaste };
}
