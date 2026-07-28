import type { FileItem } from "../../../lib/sftpTypes";
import { useFileItemDnD as useSharedFileItemDnD } from "../shared/useFileItemDnD";

interface UseLocalFileItemDnDProps {
  paneId: string;
  file: FileItem;
  selectedFiles: Set<string>;
  files: FileItem[];
}

export function useLocalFileItemDnD({
  paneId,
  file,
  selectedFiles,
  files,
}: UseLocalFileItemDnDProps) {
  return useSharedFileItemDnD({
    paneId,
    file,
    hostId: "local",
    selectedFiles,
    files,
  });
}
