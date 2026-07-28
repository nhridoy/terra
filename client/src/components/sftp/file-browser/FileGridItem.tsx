import SharedFileGridItem from "../shared/SharedFileGridItem";
import type { FileRowProps } from "./types";

export default function FileGridItem({
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
}: FileRowProps) {
  return (
    <SharedFileGridItem
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
