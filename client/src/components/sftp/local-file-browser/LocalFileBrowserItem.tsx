import { accessibleClickHandler } from "../../../lib/accessibleClickHandler";
import type { FileItem } from "../../../lib/sftpTypes";
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

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toUpperCase()
    : undefined;

  return (
    <div
      ref={mergedRef}
      role="button"
      tabIndex={0}
      data-file-item
      data-file-name={file.name}
      onKeyDown={accessibleClickHandler(() => onDoubleClick(file))}
      onDoubleClick={() => onDoubleClick(file)}
      onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey)}
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`group relative p-4 rounded-xl cursor-pointer select-none flex flex-col items-center transition-all duration-150 ${
        isDropTarget
          ? "bg-primary-600/15 ring-2 ring-inset ring-primary-500/60 scale-[1.02]"
          : isSelected
            ? "bg-primary-600/15 ring-1 ring-primary-500/40"
            : "bg-dark-800/60 hover:bg-dark-700/80 hover:ring-1 hover:ring-dark-600"
      }`}
    >
      {getFileIcon(file, 56)}

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
