import {
  ArrowDownIcon,
  ClipboardTextIcon,
  CopyIcon,
  FilePlusIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  PencilSimpleIcon,
  ScissorsIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { FileItem } from "../../../lib/sftpTypes";
import type { ContextMenuItem } from "../../ui/ContextMenu";

interface FileBrowserActions {
  handleDoubleClick: (file: FileItem) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDelete: (file: FileItem) => void;
  handleNewFolder: () => void;
  handleNewFile: () => void;
  handleDownload: (file: FileItem) => void;
}

export function buildContextMenuItems(
  menuFile: FileItem | null,
  clipboard: { paths: string[] } | null,
  actions: FileBrowserActions,
  onRenameStart: (path: string, name: string) => void,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (menuFile) {
    if (menuFile.type === "directory") {
      items.push({
        label: "Open",
        icon: <FolderOpenIcon className="w-4 h-4" />,
        shortcut: "Enter",
        onClick: () => actions.handleDoubleClick(menuFile),
      });
    }
    if (menuFile.type === "file") {
      items.push({
        label: "Download",
        icon: <ArrowDownIcon className="w-4 h-4" />,
        shortcut: "Enter",
        onClick: () => actions.handleDownload(menuFile),
      });
    }
    items.push({ type: "separator" as const });
    items.push({
      label: "Copy",
      icon: <CopyIcon className="w-4 h-4" />,
      shortcut: "Ctrl+C",
      onClick: () => actions.handleCopy(),
    });
    items.push({
      label: "Cut",
      icon: <ScissorsIcon className="w-4 h-4" />,
      shortcut: "Ctrl+X",
      onClick: () => actions.handleCut(),
    });
  }

  if (clipboard && clipboard.paths.length > 0) {
    items.push({
      label: "Paste",
      icon: <ClipboardTextIcon className="w-4 h-4" />,
      shortcut: "Ctrl+V",
      onClick: () => actions.handlePaste(),
    });
  }

  items.push({ type: "separator" as const });
  items.push({
    label: "New Folder",
    icon: <FolderPlusIcon className="w-4 h-4" />,
    shortcut: "Ctrl+Shift+N",
    onClick: () => actions.handleNewFolder(),
  });
  items.push({
    label: "New File",
    icon: <FilePlusIcon className="w-4 h-4" />,
    shortcut: "Ctrl+Shift+N",
    onClick: () => actions.handleNewFile(),
  });

  if (menuFile) {
    items.push({ type: "separator" as const });
    items.push({
      label: "Rename",
      icon: <PencilSimpleIcon className="w-4 h-4" />,
      shortcut: "F2",
      onClick: () => onRenameStart(menuFile.path, menuFile.name),
    });
    items.push({
      label: "Copy path",
      icon: <CopyIcon className="w-4 h-4" />,
      onClick: () => {
        if (menuFile.path) navigator.clipboard.writeText(menuFile.path);
        toast.info("Path copied");
      },
    });
    items.push({ type: "separator" as const });
    items.push({
      label: "Delete",
      icon: <TrashIcon className="w-4 h-4" />,
      shortcut: "Del",
      danger: true,
      onClick: () => actions.handleDelete(menuFile),
    });
  }

  return items;
}
