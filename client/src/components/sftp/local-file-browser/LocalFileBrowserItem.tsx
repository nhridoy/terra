import type { FileItem } from "../../../lib/sftpTypes";
import SharedFileGridItem from "../shared/SharedFileGridItem";
import SharedFileListItem from "../shared/SharedFileListItem";

interface LocalFileBrowserItemProps {
  file: FileItem;
  paneId: string;
  viewMode: "list" | "grid";
  selectedFiles: Set<string>;
  allFiles: FileItem[];
  renamingPath: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (
    fileName: string,
    isMultiSelect: boolean,
    isRangeSelect: boolean,
  ) => void;
  onDoubleClick: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onSetRenamingPath: (path: string | null) => void;
}

export default function LocalFileBrowserItem({
  file,
  paneId,
  viewMode,
  selectedFiles,
  allFiles,
  renamingPath,
  renameValue,
  renameInputRef,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onRenameValueChange,
  onCommitRename,
  onSetRenamingPath,
}: LocalFileBrowserItemProps) {
  const sharedProps = {
    file,
    paneId,
    hostId: "local",
    selectedFiles,
    allFiles,
    renamingPath,
    renameValue,
    renameInputRef,
    onSelect,
    onDoubleClick,
    onContextMenu,
    onRenameValueChange,
    onCommitRename,
    onSetRenamingPath,
  };

  if (viewMode === "grid") {
    return <SharedFileGridItem {...sharedProps} />;
  }

  return <SharedFileListItem {...sharedProps} />;
}
