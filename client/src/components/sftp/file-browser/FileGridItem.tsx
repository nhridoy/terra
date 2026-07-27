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

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toUpperCase()
    : undefined;

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
              onSelect(
                file.name,
                e.ctrlKey || e.metaKey,
                e.shiftKey,
                sortedFiles,
              )
      }
      onKeyDown={
        isRenaming ? undefined : accessibleClickHandler(() => onDoubleClick())
      }
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`group relative p-4 rounded-xl cursor-pointer select-none flex flex-col items-center transition-all duration-150 ${
        droppable.isDropTarget
          ? "bg-primary-600/15 ring-2 ring-inset ring-primary-500/60 scale-[1.02]"
          : selectedFiles.has(file.name)
            ? "bg-primary-600/15 ring-1 ring-primary-500/40"
            : "bg-dark-800/60 hover:bg-dark-700/80 hover:ring-1 hover:ring-dark-600"
      }`}
    >
      {getFileIcon(file, 56)}

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
          className="bg-dark-900 border border-primary-500 rounded px-2 py-1 text-xs text-white w-full mt-3 text-center focus:outline-none"
        />
      ) : (
        <div className="mt-3 w-full text-center">
          <div className="text-white text-xs font-medium truncate leading-tight">
            {file.name}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {file.type !== "directory" && ext ? (
              <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-dark-700 text-dark-300">
                {ext}
              </span>
            ) : null}
            <span className="text-dark-500 text-[10px]">
              {file.type === "directory" ? "Folder" : formatSize(file.size)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
