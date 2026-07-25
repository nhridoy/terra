import type {
  FileItem,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";
import LocalFileBrowserItem from "./LocalFileBrowserItem";

interface LocalFileBrowserListProps {
  files: FileItem[];
  viewMode: FileViewMode;
  selectedFiles: Set<string>;
  paneId: string;
  renamingPath: string | null;
  renameValue: string;
  sortField: FileSortField;
  sortDirection: "asc" | "desc";
  onSelect: (
    fileName: string,
    isMultiSelect: boolean,
    isRangeSelect: boolean,
  ) => void;
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
  paneId,
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
            <LocalFileBrowserItem
              key={file.path}
              file={file}
              paneId={paneId}
              viewMode="list"
              selectedFiles={selectedFiles}
              allFiles={files}
              renamingPath={renamingPath}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              onRenameValueChange={onRenameValueChange}
              onCommitRename={onCommitRename}
              onSetRenamingPath={onSetRenamingPath}
            />
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
      {files.map((file) => (
        <LocalFileBrowserItem
          key={file.path}
          file={file}
          paneId={paneId}
          viewMode="grid"
          selectedFiles={selectedFiles}
          allFiles={files}
          renamingPath={renamingPath}
          renameValue={renameValue}
          renameInputRef={renameInputRef}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onRenameValueChange={onRenameValueChange}
          onCommitRename={onCommitRename}
          onSetRenamingPath={onSetRenamingPath}
        />
      ))}
    </div>
  );
}
