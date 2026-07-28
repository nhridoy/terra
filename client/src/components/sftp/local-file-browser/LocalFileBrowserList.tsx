import type {
  FileItem,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";
import {
  type ColumnDef,
  useResizableColumns,
} from "../shared/useResizableColumns";
import LocalFileBrowserItem from "./LocalFileBrowserItem";

const LOCAL_COLUMNS: ColumnDef[] = [
  { key: "icon", label: "", defaultWidth: 36, minWidth: 36 },
  { key: "name", label: "Name", defaultWidth: 400, minWidth: 120 },
  { key: "size", label: "Size", defaultWidth: 80, minWidth: 60 },
  { key: "modified", label: "Modified", defaultWidth: 140, minWidth: 80 },
];

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
  const { widths, handleMouseDown } = useResizableColumns(
    LOCAL_COLUMNS,
    "local",
  );

  if (viewMode === "list") {
    return (
      <table className="w-full" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {LOCAL_COLUMNS.map((col) => (
            <col key={col.key} style={{ width: widths[col.key] }} />
          ))}
        </colgroup>
        <thead className="bg-dark-800 sticky top-0">
          <tr className="text-left text-dark-400 text-xs">
            <th className="p-2" />
            <th className="p-2 relative group/th">
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
                {/* biome-ignore lint/a11y/noStaticElementInteractions: column resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize group-hover/th:bg-primary-500/10"
                  onMouseDown={(e) => handleMouseDown("name", e)}
                >
                  <div className="absolute right-[2px] top-0 bottom-0 w-px bg-dark-600 group-hover/th:bg-primary-500" />
                </div>
              </th>
              <th className="p-2 relative group/th">
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
                {/* biome-ignore lint/a11y/noStaticElementInteractions: column resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize group-hover/th:bg-primary-500/10"
                  onMouseDown={(e) => handleMouseDown("size", e)}
                >
                  <div className="absolute right-[2px] top-0 bottom-0 w-px bg-dark-600 group-hover/th:bg-primary-500" />
                </div>
            </th>
            <th className="p-2">
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
              columnWidths={widths}
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
