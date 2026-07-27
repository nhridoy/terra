import type { FileItem } from "../../../lib/sftpTypes";

export interface FileRowProps {
  file: FileItem;
  paneId: string;
  hostId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  selectedFiles: Set<string>;
  files: FileItem[];
  renamingPath: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  commitRename: () => void;
  setRenamingPath: (path: string | null) => void;
  setRenameValue: (value: string) => void;
  onDoubleClick: () => void;
  onSelect: (
    name: string,
    ctrl: boolean,
    shift: boolean,
    files: FileItem[],
  ) => void;
  sortedFiles: FileItem[];
  onContextMenu: (e: React.MouseEvent, file?: FileItem) => void;
  formatSize: (size: number) => string;
  formatDate: (date: string) => string;
}
