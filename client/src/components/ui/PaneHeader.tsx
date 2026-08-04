import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  DotsSixVerticalIcon,
  SplitHorizontalIcon,
  SplitVerticalIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ReactNode, Ref } from "react";
import type { ConnectionStatus } from "@/lib/common/connectionStatus";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";

interface PaneHeaderProps {
  title: string;
  isActive: boolean;
  closable: boolean;
  draggable?: boolean;
  connectionStatus?: ConnectionStatus;
  dragHandleRef?: Ref<HTMLButtonElement>;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
  extra?: ReactNode;
}

export default function PaneHeader({
  title,
  isActive,
  closable,
  draggable = false,
  connectionStatus,
  dragHandleRef,
  isFocused = false,
  onToggleFocus,
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

      {draggable && (
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

      <span className="text-xs text-dark-300 truncate flex-1">{title}</span>

      {onToggleFocus && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFocus();
          }}
          className={`rounded ${isFocused ? "text-primary-400" : ""}`}
          title={isFocused ? "Exit focus mode" : "Focus mode"}
        >
          {isFocused ? (
            <ArrowsInSimpleIcon className="w-3.5 h-3.5" weight="bold" />
          ) : (
            <ArrowsOutSimpleIcon className="w-3.5 h-3.5" weight="bold" />
          )}
        </Button>
      )}

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
