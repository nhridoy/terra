import type { FileRowProps } from "./types";
import { useFileItemDnD } from "./useFileItemDnD";

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
  sortedFiles,
  onContextMenu,
  getFileIcon,
  formatSize,
  formatDate,
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

  return (
    <tr
      ref={mergedRef}
      onDoubleClick={onDoubleClick}
      onClick={(e) =>
        onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey, sortedFiles)
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey, sortedFiles);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`border-t border-dark-800 hover:bg-dark-800/50 cursor-pointer select-none ${
        droppable.isDropTarget
          ? "bg-primary-600/20 ring-1 ring-inset ring-primary-500/50"
          : ""
      } ${selectedFiles.has(file.name) ? "bg-primary-600/15" : ""}`}
    >
      <td className="p-2">{getFileIcon(file)}</td>
      <td className="p-2 text-white text-sm">
        {renamingPath === file.path ? (
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
            className="bg-dark-800 border border-primary-500 rounded px-1 py-0.5 text-sm text-white w-full focus:outline-none"
          />
        ) : (
          <span className={file.type === "directory" ? "text-primary-400" : ""}>
            {file.name}
          </span>
        )}
      </td>
      <td className="p-2 text-dark-300 text-sm">
        {file.type === "directory" ? "-" : formatSize(file.size)}
      </td>
      <td className="p-2 text-dark-300 font-mono text-xs">
        {file.permissions}
      </td>
      <td className="p-2 text-dark-300 text-sm">
        {formatDate(file.modifiedAt)}
      </td>
    </tr>
  );
}
