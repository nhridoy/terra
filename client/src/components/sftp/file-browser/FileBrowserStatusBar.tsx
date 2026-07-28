import SharedFileBrowserStatusBar from "../shared/SharedFileBrowserStatusBar";

interface FileBrowserStatusBarProps {
  itemCount: number;
  selectedCount: number;
}

export default function FileBrowserStatusBar({
  itemCount,
  selectedCount,
}: FileBrowserStatusBarProps) {
  return (
    <SharedFileBrowserStatusBar
      totalCount={itemCount}
      selectedCount={selectedCount}
    />
  );
}
