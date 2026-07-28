import SharedFileListItem from "../shared/SharedFileListItem";
import type { FileRowProps } from "./types";

export default function FileTableRow({
  file,
  paneId,
  hostId,
  hostAddress,
  hostPort,
  hostUsername,
  selectedFiles,
  files,
  renamingPath,
  renameValue,
  renameInputRef,
  commitRename,
  setRenamingPath,
  setRenameValue,
  onDoubleClick,
  onSelect,
  onContextMenu,
  columnWidths,
}: FileRowProps) {
  return (
    <SharedFileListItem
      file={file}
      paneId={paneId}
      hostId={hostId}
      selectedFiles={selectedFiles}
      allFiles={files}
      renamingPath={renamingPath}
      renameValue={renameValue}
      renameInputRef={renameInputRef}
      sourceDirect={
        hostId.startsWith("direct_")
          ? { host: hostAddress, port: hostPort, username: hostUsername }
          : undefined
      }
      showPermissions
      columnWidths={columnWidths}
      onSelect={(name, isMultiSelect, isRangeSelect) => {
        onSelect(name, isMultiSelect, isRangeSelect, files);
      }}
      onDoubleClick={() => onDoubleClick()}
      onContextMenu={onContextMenu}
      onRenameValueChange={setRenameValue}
      onCommitRename={commitRename}
      onSetRenamingPath={setRenamingPath}
    />
  );
}
