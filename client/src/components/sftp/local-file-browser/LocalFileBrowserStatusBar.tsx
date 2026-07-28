import SharedFileBrowserStatusBar from "../shared/SharedFileBrowserStatusBar";

interface LocalFileBrowserStatusBarProps {
  totalCount: number;
  selectedCount: number;
}

export default function LocalFileBrowserStatusBar({
  totalCount,
  selectedCount,
}: LocalFileBrowserStatusBarProps) {
  return (
    <SharedFileBrowserStatusBar
      totalCount={totalCount}
      selectedCount={selectedCount}
    />
  );
}
