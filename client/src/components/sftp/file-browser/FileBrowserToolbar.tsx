import type { FileViewMode } from "../../../lib/sftpTypes";
import SharedFileBrowserToolbar from "../shared/SharedFileBrowserToolbar";

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
  return (
    <SharedFileBrowserToolbar
      currentPath={currentPath}
      searchQuery={searchQuery}
      showHidden={showHidden}
      viewMode={viewMode}
      pathLabel="Remote path"
      onNavigateTo={(path) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        navigateTo(normalized);
      }}
      onNavigateRoot={() => navigateTo("/")}
      onNavigateUp={navigateUp}
      onRefresh={() => loadDirectory(currentPath)}
      onNewFolder={handleNewFolder}
      onSearchChange={setSearchQuery}
      onShowHiddenChange={setShowHidden}
      onViewModeChange={setViewMode}
      beforeActions={
        <label className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-sm cursor-pointer transition-colors">
          Upload
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </label>
      }
    />
  );
}
