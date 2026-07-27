import {
  ArrowsClockwiseIcon,
  ArrowUpIcon,
  HouseIcon,
  ListIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { FileViewMode } from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";

interface FileBrowserToolbarProps {
  currentPath: string;
  navigateTo: (path: string) => void;
  navigateUp: () => void;
  loadDirectory: (path: string) => void;
  handleUpload: (fileList: FileList) => void;
  handleNewFolder: () => void;
  viewMode: FileViewMode;
  setViewMode: (mode: FileViewMode) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  showHidden: boolean;
  setShowHidden: (val: boolean) => void;
}

export default function FileBrowserToolbar({
  currentPath,
  navigateTo,
  navigateUp,
  loadDirectory,
  handleUpload,
  handleNewFolder,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  showHidden,
  setShowHidden,
}: FileBrowserToolbarProps) {
  const [pathInput, setPathInput] = useState(currentPath);

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const normalized = pathInput.startsWith("/")
        ? pathInput
        : `/${pathInput}`;
      navigateTo(normalized);
    } else if (e.key === "Escape") {
      setPathInput(currentPath);
    }
  };

  return (
    <div className="p-3 border-b border-dark-700">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateTo("/")}
          title="Home"
        >
          <HouseIcon className="w-4 h-4 text-dark-300" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={navigateUp}
          title="Up (Backspace)"
        >
          <ArrowUpIcon className="w-4 h-4 text-dark-300" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => loadDirectory(currentPath)}
          title="Refresh (F5)"
        >
          <ArrowsClockwiseIcon className="w-4 h-4 text-dark-300" />
        </Button>
        <input
          aria-label="Remote path"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={handlePathKeyDown}
          onBlur={() => setPathInput(currentPath)}
          className="flex-1 bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-sm cursor-pointer transition-colors">
          Upload
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </label>
        <Button variant="secondary" size="sm" onClick={handleNewFolder}>
          New Folder
        </Button>
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 text-dark-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter..."
            className="w-full bg-dark-800 border border-dark-600 rounded pl-8 pr-2 py-1 text-sm text-white placeholder-dark-400 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-dark-400 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-primary-500"
          />
          Hidden
        </label>
        <div className="flex bg-dark-700 rounded overflow-hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewMode("list")}
            className={
              viewMode === "list" ? "bg-primary-600/15 text-primary-500" : ""
            }
          >
            <ListIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewMode("grid")}
            className={
              viewMode === "grid" ? "bg-primary-600/15 text-primary-500" : ""
            }
          >
            <SquaresFourIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
