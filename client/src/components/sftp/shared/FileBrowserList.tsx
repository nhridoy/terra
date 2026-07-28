import type {
  FileItem,
  FileSortDirection,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";
import type { ColumnDef } from "./useResizableColumns";

export interface FileBrowserListProps {
  files: FileItem[];
  viewMode: FileViewMode;
  columns: ColumnDef[];
  columnWidths: Record<string, number>;
  handleColumnMouseDown: (key: string, e: React.MouseEvent) => void;
  sortField: FileSortField;
  sortDirection: FileSortDirection;
  setSortField: (field: FileSortField) => void;
  setSortDirection: React.Dispatch<React.SetStateAction<FileSortDirection>>;
  renderListItem: (file: FileItem) => React.ReactNode;
  renderGridItem: (file: FileItem) => React.ReactNode;
}

export default function FileBrowserList({
  files,
  viewMode,
  columns,
  columnWidths,
  handleColumnMouseDown,
  sortField,
  sortDirection,
  setSortField,
  setSortDirection,
  renderListItem,
  renderGridItem,
}: FileBrowserListProps) {
  if (viewMode === "list") {
    return (
      <table className="w-full" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={{ width: columnWidths[col.key] }} />
          ))}
        </colgroup>
        <thead className="bg-dark-800 sticky top-0">
          <tr className="text-left text-dark-400 text-xs">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`p-2 ${col.key !== "icon" ? "relative group/th" : ""}`}
              >
                {col.sortable !== false && col.key !== "icon" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSortField(col.key as FileSortField);
                      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                    }}
                    className="justify-start"
                  >
                    {col.label}{" "}
                    {sortField === col.key &&
                      (sortDirection === "asc" ? "\u2191" : "\u2193")}
                  </Button>
                ) : null}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: column resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize group-hover/th:bg-primary-500/10"
                  onMouseDown={(e) => handleColumnMouseDown(col.key, e)}
                >
                  <div className="absolute right-[2px] top-0 bottom-0 w-px bg-dark-600 group-hover/th:bg-primary-500" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{files.map((file) => renderListItem(file))}</tbody>
      </table>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
      {files.map((file) => renderGridItem(file))}
    </div>
  );
}
