import type { FileItem } from "../../../lib/sftpTypes";
import { useFileItemDnD as useSharedFileItemDnD } from "../shared/useFileItemDnD";

interface UseFileItemDnDProps {
  paneId: string;
  file: FileItem;
  hostId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  selectedFiles: Set<string>;
  files: FileItem[];
}

export function useFileItemDnD({
  paneId,
  file,
  hostId,
  hostAddress,
  hostPort,
  hostUsername,
  selectedFiles,
  files,
}: UseFileItemDnDProps) {
  return useSharedFileItemDnD({
    paneId,
    file,
    hostId,
    selectedFiles,
    files,
    sourceDirect: hostId.startsWith("direct_")
      ? { host: hostAddress, port: hostPort, username: hostUsername }
      : undefined,
  });
}
