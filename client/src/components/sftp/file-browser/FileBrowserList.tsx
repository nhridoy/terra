import { FolderIcon } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import type {
  FileItem,
  FileSortDirection,
  FileSortField,
  FileViewMode,
} from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";
import ContextMenu from "../../ui/ContextMenu";
import { buildContextMenuItems } from "./buildContextMenuItems";
import FileGridItem from "./FileGridItem";
import FileTableRow from "./FileTableRow";
import { formatDate, formatSize, getFileIcon } from "./helpers";

export interface FileBrowserActions {
  handleDoubleClick: (file: FileItem) => void;
  handleSelect: (
    fileName: string,
    isMultiSelect: boolean,
    isShift?: boolean,
    allFiles?: FileItem[],
  ) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDelete: (file: FileItem) => void;
  handleNewFolder: () => void;
  handleNewFile: () => void;
  handleDownload: (file: FileItem) => void;
}

interface FileBrowserListProps {
  isLoading: boolean;
  sortedFiles: FileItem[];
  viewMode: FileViewMode;
  searchQuery: string;
  sortField: FileSortField;
  sortDirection: FileSortDirection;
  setSortField: (field: FileSortField) => void;
  setSortDirection: React.Dispatch<React.SetStateAction<FileSortDirection>>;
  paneId: string;
  hostId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  selectedFiles: Set<string>;
  files: FileItem[];
  clipboard: { paths: string[] } | null;
  renamingPath: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  commitRename: () => void;
  setRenamingPath: (path: string | null) => void;
  setRenameValue: (value: string) => void;
  actions: FileBrowserActions;
}

export default function FileBrowserList({
  isLoading,
  sortedFiles,
  viewMode,
  searchQuery,
  sortField,
  sortDirection,
  setSortField,
  setSortDirection,
  paneId,
  hostId,
  hostAddress,
  hostPort,
  hostUsername,
  selectedFiles,
  files,
  clipboard,
  renamingPath,
  renameValue,
  renameInputRef,
  commitRename,
  setRenamingPath,
  setRenameValue,
  actions,
}: FileBrowserListProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileItem | null;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem | null = null) => {
      e.preventDefault();
      e.stopPropagation();
      if (file) {
        if (!selectedFiles.has(file.name)) {
          actions.handleSelect(file.name, false);
        }
      }
      setContextMenu({ x: e.clientX, y: e.clientY, file });
    },
    [selectedFiles, actions],
  );

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];
    return buildContextMenuItems(
      contextMenu.file,
      clipboard,
      actions,
      (path, name) => {
        setRenamingPath(path);
        setRenameValue(name);
      },
    );
  }, [contextMenu, clipboard, actions, setRenamingPath, setRenameValue]);

  if (isLoading) {
    return (
      <div className="flex-1 p-3 space-y-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div
            key={`skel-${n}`}
            className="flex items-center gap-3 p-2 animate-pulse"
          >
            <div className="w-5 h-5 bg-dark-700 rounded" />
            <div
              className="h-3 bg-dark-700 rounded flex-1"
              style={{ width: `${40 + Math.random() * 40}%` }}
            />
            <div className="h-3 bg-dark-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (sortedFiles.length === 0) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: empty state click handler needs div
      <div
        role="button"
        tabIndex={0}
        className="flex-1 flex flex-col items-center justify-center text-dark-400"
        onContextMenu={(e) => handleContextMenu(e)}
        onKeyDown={(e) => {
          if (e.key === "ContextMenu") {
            handleContextMenu(e as unknown as React.MouseEvent);
          }
        }}
      >
        <FolderIcon className="w-16 h-16 mb-3 text-dark-600" />
        <p>{searchQuery ? "No matching files" : "Empty directory"}</p>
      </div>
    );
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: file list click handler needs div */}
      <div
        role="button"
        tabIndex={0}
        className="flex-1 overflow-y-auto"
        onContextMenu={(e) => handleContextMenu(e)}
        onKeyDown={(e) => {
          if (e.key === "ContextMenu") {
            handleContextMenu(e as unknown as React.MouseEvent);
          }
        }}
      >
        {viewMode === "list" ? (
          <table className="w-full">
            <thead className="bg-dark-800 sticky top-0">
              <tr className="text-left text-dark-400 text-xs">
                <th className="p-2 w-8" />
                <th className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSortField("name");
                      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                    }}
                    className="justify-start"
                  >
                    Name{" "}
                    {sortField === "name" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </Button>
                </th>
                <th className="p-2 w-20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSortField("size");
                      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                    }}
                    className="justify-start"
                  >
                    Size{" "}
                    {sortField === "size" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </Button>
                </th>
                <th className="p-2 w-24">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSortField("permissions");
                      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                    }}
                    className="justify-start"
                  >
                    Perms{" "}
                    {sortField === "permissions" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </Button>
                </th>
                <th className="p-2 w-36">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSortField("modifiedAt");
                      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                    }}
                    className="justify-start"
                  >
                    Modified{" "}
                    {sortField === "modifiedAt" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <FileTableRow
                  key={file.path}
                  file={file}
                  paneId={paneId}
                  hostId={hostId}
                  hostAddress={hostAddress}
                  hostPort={hostPort}
                  hostUsername={hostUsername}
                  selectedFiles={selectedFiles}
                  files={files}
                  renamingPath={renamingPath}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  commitRename={commitRename}
                  setRenamingPath={setRenamingPath}
                  setRenameValue={setRenameValue}
                  onDoubleClick={() => actions.handleDoubleClick(file)}
                  onSelect={actions.handleSelect}
                  sortedFiles={sortedFiles}
                  onContextMenu={handleContextMenu}
                  getFileIcon={getFileIcon}
                  formatSize={formatSize}
                  formatDate={formatDate}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
            {sortedFiles.map((file) => (
              <FileGridItem
                key={file.path}
                file={file}
                paneId={paneId}
                hostId={hostId}
                hostAddress={hostAddress}
                hostPort={hostPort}
                hostUsername={hostUsername}
                selectedFiles={selectedFiles}
                files={files}
                renamingPath={renamingPath}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                commitRename={commitRename}
                setRenamingPath={setRenamingPath}
                setRenameValue={setRenameValue}
                onDoubleClick={() => actions.handleDoubleClick(file)}
                onSelect={actions.handleSelect}
                sortedFiles={sortedFiles}
                onContextMenu={handleContextMenu}
                getFileIcon={getFileIcon}
                formatSize={formatSize}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
