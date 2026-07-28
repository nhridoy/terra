import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  ArrowUpIcon,
  GridFourIcon,
  HouseIcon,
  ListDashesIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { FileViewMode } from "../../../lib/sftpTypes";
import { Button } from "../../ui/Button";

export interface FileBrowserToolbarProps {
  currentPath: string;
  searchQuery: string;
  showHidden: boolean;
  viewMode: FileViewMode;
  pathLabel?: string;
  onNavigateTo: (path: string) => void;
  onNavigateRoot: () => void;
  onNavigateUp: () => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onSearchChange: (value: string) => void;
  onShowHiddenChange: (checked: boolean) => void;
  onViewModeChange: (mode: FileViewMode) => void;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  canNavigateBack?: boolean;
  canNavigateForward?: boolean;
  showBackForward?: boolean;
  beforeActions?: React.ReactNode;
  pathInput?: string;
  onPathInputChange?: (value: string) => void;
  onPathInputKeyDown?: (e: React.KeyboardEvent) => void;
  onPathInputBlur?: () => void;
}

export default function FileBrowserToolbar({
  currentPath,
  searchQuery,
  showHidden,
  viewMode,
  pathLabel = "Path",
  onNavigateTo,
  onNavigateRoot,
  onNavigateUp,
  onRefresh,
  onNewFolder,
  onSearchChange,
  onShowHiddenChange,
  onViewModeChange,
  onNavigateBack,
  onNavigateForward,
  canNavigateBack = false,
  canNavigateForward = false,
  showBackForward = false,
  beforeActions,
  pathInput: pathInputProp,
  onPathInputChange,
  onPathInputKeyDown,
  onPathInputBlur,
}: FileBrowserToolbarProps) {
  const [internalPathInput, setInternalPathInput] = useState(currentPath);
  const pathInput = pathInputProp ?? internalPathInput;
  const setPathInput = onPathInputChange ?? setInternalPathInput;

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (onPathInputKeyDown) {
      onPathInputKeyDown(e);
      return;
    }
    if (e.key === "Enter") {
      onNavigateTo(pathInput);
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
          onClick={onNavigateRoot}
          title="Home"
        >
          <HouseIcon className="w-4 h-4 text-dark-300" weight="bold" />
        </Button>
        {showBackForward && onNavigateBack && onNavigateForward && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateBack}
              disabled={!canNavigateBack}
              title="Back"
            >
              <ArrowLeftIcon className="w-4 h-4 text-dark-300" weight="bold" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateForward}
              disabled={!canNavigateForward}
              title="Forward"
            >
              <ArrowRightIcon className="w-4 h-4 text-dark-300" weight="bold" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={onNavigateUp} title="Up">
          <ArrowUpIcon className="w-4 h-4 text-dark-300" weight="bold" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh">
          <ArrowsClockwiseIcon
            className="w-4 h-4 text-dark-300"
            weight="bold"
          />
        </Button>
        <input
          aria-label={pathLabel}
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={handlePathKeyDown}
          onBlur={onPathInputBlur ?? (() => setPathInput(currentPath))}
          className="flex-1 bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        {beforeActions}
        <Button variant="secondary" size="sm" onClick={onNewFolder}>
          New Folder
        </Button>
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon
            className="w-4 h-4 text-dark-400 absolute left-2 top-1/2 -translate-y-1/2"
            weight="bold"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter..."
            className="w-full bg-dark-800 border border-dark-600 rounded pl-8 pr-2 py-1 text-sm text-white placeholder-dark-400 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-dark-400 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => onShowHiddenChange(e.target.checked)}
            className="rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-primary-500"
          />
          Hidden
        </label>
        <div className="flex bg-dark-700 rounded overflow-hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onViewModeChange("list")}
            className={
              viewMode === "list" ? "bg-primary-600/15 text-primary-500" : ""
            }
          >
            <ListDashesIcon className="w-4 h-4" weight="bold" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onViewModeChange("grid")}
            className={
              viewMode === "grid" ? "bg-primary-600/15 text-primary-500" : ""
            }
          >
            <GridFourIcon className="w-4 h-4" weight="bold" />
          </Button>
        </div>
      </div>
    </div>
  );
}
