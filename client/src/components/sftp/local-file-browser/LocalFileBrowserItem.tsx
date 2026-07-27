import { accessibleClickHandler } from "../../../lib/accessibleClickHandler";
import type { FileItem } from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";
import { formatDate, formatSize, getFileIcon } from "./helpers";
import { useLocalFileItemDnD } from "./useLocalFileItemDnD";

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
  const { droppable, mergedRef } = useLocalFileItemDnD({
    paneId,
    file,
    selectedFiles,
    files: allFiles,
  });

  const isSelected = selectedFiles.has(file.name);
  const isDropTarget = droppable.isDropTarget;

  if (viewMode === "list") {
    return (
      <tr
        ref={mergedRef}
        data-file-item
        data-file-name={file.name}
        onDoubleClick={() => onDoubleClick(file)}
        onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
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
            <span
              className={file.type === "directory" ? "text-primary-400" : ""}
            >
              {file.name}
            </span>
          )}
        </td>
        <td className="p-2 text-dark-300 text-sm">
          {file.type === "directory" ? "-" : formatSize(file.size)}
        </td>
        <td className="p-2 text-dark-300 text-sm">
          {formatDate(file.modifiedAt)}
        </td>
      </tr>
    );
  }

  return (
    <Button
      ref={mergedRef}
      variant="secondary"
      data-file-item
      data-file-name={file.name}
      onKeyDown={accessibleClickHandler(() => onDoubleClick(file))}
      onDoubleClick={() => onDoubleClick(file)}
      onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey)}
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`p-3 h-auto rounded-lg cursor-pointer select-none flex flex-col items-center text-center transition-colors ${
        isSelected ? "bg-primary-600/25 ring-1 ring-primary-500/50" : ""
      } ${isDropTarget ? "bg-primary-600/20 ring-1 ring-inset ring-primary-500/50" : ""}`}
    >
      {getFileIcon(file)}
      <div className="text-white text-xs mt-2 truncate w-full">{file.name}</div>
      <div className="text-dark-400 text-xs mt-1">
        {file.type === "directory" ? "-" : formatSize(file.size)}
      </div>
    </Button>
  );
}
