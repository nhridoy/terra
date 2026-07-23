import type { LeafNode } from "../../stores/terminalStore";
import { StatusDot } from "../ui/StatusDot";

export default function PanePreview({ pane }: { pane: LeafNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-dark-800 border border-dark-700 shadow-lg">
      <StatusDot status={pane.connectionStatus} size="xs" />
      <span className="text-xs text-white truncate max-w-[200px]">
        {pane.hostName || "Empty pane"}
      </span>
    </div>
  );
}
