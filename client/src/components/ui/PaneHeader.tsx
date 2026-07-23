import {
  DotsSixVerticalIcon,
  SplitHorizontalIcon,
  SplitVerticalIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ReactNode, Ref } from "react";
import type { ConnectionStatus } from "../../lib/connectionStatus";
import { Button } from "./Button";
import { StatusDot } from "./StatusDot";

interface PaneHeaderProps {
  title: string;
  isActive: boolean;
  closable: boolean;
  connectionStatus?: ConnectionStatus;
  dragHandleRef?: Ref<HTMLButtonElement>;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
  extra?: ReactNode;
}

export default function PaneHeader({
  title,
  isActive,
  closable,
  connectionStatus,
  dragHandleRef,
  onSplitH,
  onSplitV,
  onClose,
  extra,
}: PaneHeaderProps) {
  return (
    <div
      className={`flex items-center gap-2 h-7 px-2 shrink-0 border-b border-dark-800 ${
        isActive ? "bg-dark-800" : "bg-dark-900"
      }`}
    >
      {connectionStatus && <StatusDot status={connectionStatus} size="xs" />}

      {closable && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          ref={dragHandleRef}
          className="cursor-grab active:cursor-grabbing shrink-0 rounded"
          title="Drag to move pane"
          style={{ touchAction: "none" }}
        >
          <DotsSixVerticalIcon className="w-3.5 h-3.5" />
        </Button>
      )}

      <span className="text-xs text-dark-200 truncate flex-1">{title}</span>

      {onSplitH && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSplitH();
          }}
          className="rounded"
          title="Split right"
        >
          <SplitHorizontalIcon className="w-3.5 h-3.5" weight="bold" />
        </Button>
      )}

      {onSplitV && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSplitV();
          }}
          className="rounded"
          title="Split down"
        >
          <SplitVerticalIcon className="w-3.5 h-3.5" weight="bold" />
        </Button>
      )}

      {extra}

      {closable && onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="hover:text-red-400 rounded"
          title="Close pane"
        >
          <XIcon className="w-3.5 h-3.5" weight="bold" />
        </Button>
      )}
    </div>
  );
}
