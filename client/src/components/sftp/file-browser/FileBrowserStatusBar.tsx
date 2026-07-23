interface FileBrowserStatusBarProps {
  itemCount: number;
  selectedCount: number;
}

export default function FileBrowserStatusBar({
  itemCount,
  selectedCount,
}: FileBrowserStatusBarProps) {
  return (
    <div className="px-3 py-1.5 border-t border-dark-700 text-dark-400 text-xs flex justify-between">
      <span>
        {itemCount} item{itemCount !== 1 ? "s" : ""}
      </span>
      {selectedCount > 0 && <span>{selectedCount} selected</span>}
    </div>
  );
}
