import type { FileViewMode } from "../../../lib/sftpTypes";
import SharedFileBrowserToolbar from "../shared/SharedFileBrowserToolbar";

interface LocalFileBrowserToolbarProps {
  rootPath: string;
  currentPath: string;
  pathInput: string;
  searchQuery: string;
  showHidden: boolean;
  viewMode: FileViewMode;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  onPathInputChange: (value: string) => void;
  onPathInputKeyDown: (e: React.KeyboardEvent) => void;
  onPathInputBlur: () => void;
  onNavigateRoot: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateUp: () => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onSearchChange: (value: string) => void;
  onShowHiddenChange: (checked: boolean) => void;
  onViewModeChange: (mode: FileViewMode) => void;
}

export default function LocalFileBrowserToolbar({
  currentPath,
  pathInput,
  searchQuery,
  showHidden,
  viewMode,
  onPathInputChange,
  onPathInputKeyDown,
  onPathInputBlur,
  onNavigateRoot,
  onNavigateBack,
  onNavigateForward,
  onNavigateUp,
  onRefresh,
  canNavigateBack,
  canNavigateForward,
  onNewFolder,
  onSearchChange,
  onShowHiddenChange,
  onViewModeChange,
}: LocalFileBrowserToolbarProps) {
  return (
    <SharedFileBrowserToolbar
      currentPath={currentPath}
      searchQuery={searchQuery}
      showHidden={showHidden}
      viewMode={viewMode}
      pathLabel="Local path"
      pathInput={pathInput}
      onPathInputChange={onPathInputChange}
      onPathInputKeyDown={onPathInputKeyDown}
      onPathInputBlur={onPathInputBlur}
      onNavigateTo={() => {}}
      onNavigateRoot={onNavigateRoot}
      onNavigateUp={onNavigateUp}
      onRefresh={onRefresh}
      onNewFolder={onNewFolder}
      onSearchChange={onSearchChange}
      onShowHiddenChange={onShowHiddenChange}
      onViewModeChange={onViewModeChange}
      onNavigateBack={onNavigateBack}
      onNavigateForward={onNavigateForward}
      canNavigateBack={canNavigateBack}
      canNavigateForward={canNavigateForward}
      showBackForward
    />
  );
}
