import { CodeIcon } from "@phosphor-icons/react";
import type { EditorLeafNode } from "../../stores/editorStore";

interface EditorViewProps {
  pane: EditorLeafNode;
}

export default function EditorView({ pane }: EditorViewProps) {
  const isHost = pane.connectionType === "host";
  const detail = isHost
    ? `${pane.hostUsername ? `${pane.hostUsername}@` : ""}${pane.hostName || pane.hostAddress}${pane.hostPort ? `:${pane.hostPort}` : ""}`
    : pane.localPath || "";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-700 bg-dark-900">
        <CodeIcon className="w-4 h-4 text-primary-400" weight="bold" />
        <span className="text-xs font-medium text-white">
          {isHost ? "Remote" : "Local"}
        </span>
        <span className="text-xs text-dark-400 truncate">{detail}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <CodeIcon className="w-10 h-10 mx-auto mb-3 text-dark-600" />
          <p className="text-sm text-dark-300 mb-1">
            Connected to {detail || (isHost ? "remote host" : "local folder")}
          </p>
          <p className="text-xs text-dark-500">
            File explorer and code editor are coming in the next phase.
          </p>
        </div>
      </div>
    </div>
  );
}
