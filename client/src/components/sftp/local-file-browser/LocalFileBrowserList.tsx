import { accessibleClickHandler } from "../../../lib/accessibleClickHandler";
import type {
  FileItem,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";
import { formatDate, formatSize, getFileIcon } from "./helpers";

interface LocalFileBrowserListProps {
  files: FileItem[];
  viewMode: FileViewMode;
  selectedFiles: Set<string>;
  renamingPath: string | null;
  renameValue: string;
  sortField: FileSortField;
  sortDirection: "asc" | "desc";
  onSelect: (fileName: string, isMultiSelect: boolean, isRangeSelect: boolean) => void;
  onDoubleClick: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onSortFieldChange: (field: FileSortField) => void;
  onSortDirectionChange: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onSetRenamingPath: (path: string | null) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function LocalFileBrowserList({
  files,
  viewMode,
  selectedFiles,
  renamingPath,
  renameValue,
  sortField,
  sortDirection,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onSortFieldChange,
  onSortDirectionChange,
  onRenameValueChange,
  onCommitRename,
  onSetRenamingPath,
  renameInputRef,
}: LocalFileBrowserListProps) {
  if (viewMode === "list") {
    return (
      <table className="w-full border-separate border-spacing-y-1">
        <thead className="bg-dark-800 sticky top-0">
          <tr className="text-left text-dark-400 text-xs">
            <th className="p-2 w-8" />
            <th className="p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSortFieldChange("name");
                  onSortDirectionChange((d) => (d === "asc" ? "desc" : "asc"));
                }}
                className="justify-start"
              >
                Name{" "}
                {sortField === "name" &&
                  (sortDirection === "asc" ? "\u2191" : "\u2193")}
              </Button>
            </th>
            <th className="p-2 w-20">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSortFieldChange("size");
                  onSortDirectionChange((d) => (d === "asc" ? "desc" : "asc"));
                }}
                className="justify-start"
              >
                Size{" "}
                {sortField === "size" &&
                  (sortDirection === "asc" ? "\u2191" : "\u2193")}
              </Button>
            </th>
            <th className="p-2 w-36">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSortFieldChange("modifiedAt");
                  onSortDirectionChange((d) => (d === "asc" ? "desc" : "asc"));
                }}
                className="justify-start"
              >
                Modified{" "}
                {sortField === "modifiedAt" &&
                  (sortDirection === "asc" ? "\u2191" : "\u2193")}
              </Button>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.path}
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
              className={`hover:bg-dark-600 cursor-pointer select-none rounded ${selectedFiles.has(file.name) ? "bg-primary-600/25" : ""}`}
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
                    }}
                    onBlur={onCommitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-dark-800 border border-primary-500 rounded px-1 py-0.5 text-sm text-white w-full focus:outline-none"
                  />
                ) : (
                  <span
                    className={
                      file.type === "directory" ? "text-primary-400" : ""
                    }
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
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
      {files.map((file) => (
        <Button
          key={file.path}
          variant="secondary"
          data-file-item
          data-file-name={file.name}
          onKeyDown={accessibleClickHandler(() => onDoubleClick(file))}
          onDoubleClick={() => onDoubleClick(file)}
          onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey)}
          onContextMenu={(e) => onContextMenu(e, file)}
          className={`p-3 h-auto rounded-lg cursor-pointer select-none flex flex-col items-center text-center transition-colors ${selectedFiles.has(file.name) ? "bg-primary-600/25 ring-1 ring-primary-500/50" : ""}`}
        >
          {getFileIcon(file)}
          <div className="text-white text-xs mt-2 truncate w-full">
            {file.name}
          </div>
          <div className="text-dark-400 text-xs mt-1">
            {file.type === "directory" ? "-" : formatSize(file.size)}
          </div>
        </Button>
      ))}
    </div>
  );
}
