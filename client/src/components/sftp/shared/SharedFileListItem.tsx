import type { FileItem } from "../../../lib/sftpTypes";
import { formatDate, formatSize, getFileIcon } from "./helpers";
import { useFileItemDnD } from "./useFileItemDnD";

export interface SharedFileListItemProps {
  file: FileItem;
  paneId: string;
  hostId: string;
  selectedFiles: Set<string>;
  allFiles: FileItem[];
  renamingPath: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  sourceDirect?: { host?: string; port?: number; username?: string };
  showPermissions?: boolean;
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

export default function SharedFileListItem({
  file,
  paneId,
  hostId,
  selectedFiles,
  allFiles,
  renamingPath,
  renameValue,
  renameInputRef,
  sourceDirect,
  showPermissions = false,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onRenameValueChange,
  onCommitRename,
  onSetRenamingPath,
}: SharedFileListItemProps) {
  const { droppable, mergedRef } = useFileItemDnD({
    paneId,
    file,
    hostId,
    selectedFiles,
    files: allFiles,
    sourceDirect,
  });

  const isSelected = selectedFiles.has(file.name);
  const isDropTarget = droppable.isDropTarget;

  return (
    <tr
      ref={mergedRef}
      data-file-item
      data-file-name={file.name}
      onDoubleClick={() => onDoubleClick(file)}
      onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`hover:bg-dark-600 cursor-pointer select-none rounded ${
        isSelected ? "bg-primary-600/25" : ""
      } ${isDropTarget ? "bg-primary-600/20 ring-1 ring-inset ring-primary-500/50" : ""}`}
    >
      <td className="p-2">{getFileIcon(file)}</td>
      <td className="p-2 text-white text-sm">
        {renamingPath === file.path ? (
          <input
            ref={renameInputRef}
            aria-label="Rename file"
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onSetRenamingPath(null);
              if (e.key === " ") e.stopPropagation();
            }}
            onBlur={onCommitRename}
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
      {showPermissions && (
        <td className="p-2 text-dark-300 font-mono text-xs">
          {file.permissions}
        </td>
      )}
      <td className="p-2 text-dark-300 text-sm">
        {formatDate(file.modifiedAt)}
      </td>
    </tr>
  );
}
