import { accessibleClickHandler } from "../../../lib/accessibleClickHandler";
import type { FileRowProps } from "./types";
import { useFileItemDnD } from "./useFileItemDnD";

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
  sortedFiles,
  onContextMenu,
  getFileIcon,
  formatSize,
}: FileRowProps) {
  const { droppable, mergedRef } = useFileItemDnD({
    paneId,
    file,
    hostId,
    hostAddress,
    hostPort,
    hostUsername,
    selectedFiles,
    files,
  });

  const isRenaming = renamingPath === file.path;

  return (
    <div
      ref={mergedRef}
      role={isRenaming ? undefined : "button"}
      tabIndex={isRenaming ? undefined : 0}
      onDoubleClick={isRenaming ? undefined : onDoubleClick}
      onClick={
        isRenaming
          ? undefined
          : (e) =>
              onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey, sortedFiles)
      }
      onKeyDown={
        isRenaming
          ? undefined
          : accessibleClickHandler(() => onDoubleClick())
      }
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`p-3 rounded-lg cursor-pointer select-none flex flex-col items-center text-center transition-colors ${
        droppable.isDropTarget
          ? "bg-primary-600/20 ring-1 ring-inset ring-primary-500/50"
          : ""
      } ${selectedFiles.has(file.name) ? "bg-primary-600/15 border border-primary-500/50" : "bg-dark-800 hover:bg-dark-700"}`}
    >
      {getFileIcon(file)}
      {isRenaming ? (
        <input
          ref={renameInputRef}
          aria-label="Rename file"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenamingPath(null);
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          className="bg-dark-800 border border-primary-500 rounded px-1 py-0.5 text-xs text-white w-full mt-2 text-center focus:outline-none"
        />
      ) : (
        <div className="text-white text-xs mt-2 truncate w-full">
          {file.name}
        </div>
      )}
      <div className="text-dark-400 text-xs mt-1">
        {file.type === "directory" ? "-" : formatSize(file.size)}
      </div>
    </div>
  );
}
