import { useDraggable } from "@dnd-kit/react";
import { CodeIcon, DesktopTowerIcon, FolderIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { accessibleClickHandler } from "../../lib/accessibleClickHandler";
import { extractError } from "../../lib/extractError";
import { openDirectoryPicker } from "../../lib/localFs";
import { type DropSide, previewStyle } from "../../lib/paneLayout";
import { type EditorLeafNode, useEditorStore } from "../../stores/editorStore";
import type { Host } from "../../stores/hostStore";
import SftpHostPicker from "../sftp/SftpHostPicker";
import { DropZone } from "../shared/DropZone";
import { Button } from "../ui/Button";
import Modal from "../ui/Modal";
import PaneHeader from "../ui/PaneHeader";
import EditorExplorer from "./EditorExplorer";
import EditorViewTree from "./EditorViewTree";

interface EditorPaneProps {
  pane: EditorLeafNode;
  isActive: boolean;
  closable: boolean;
  draggable?: boolean;
  canFocus?: boolean;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  dropSide: DropSide | null;
  onConnectHost: (host: Host) => void;
}

export default function EditorPane({
  pane,
  isActive,
  closable,
  draggable = false,
  canFocus = false,
  isFocused = false,
  onToggleFocus,
  dropSide,
  onConnectHost,
}: EditorPaneProps) {
  const splitPane = useEditorStore((s) => s.splitPane);
  const removePane = useEditorStore((s) => s.removePane);
  const setActivePane = useEditorStore((s) => s.setActivePane);
  const connectLocal = useEditorStore((s) => s.connectLocal);
  const [showHostPicker, setShowHostPicker] = useState(false);

  const { ref, isDragging } = useDraggable({
    id: `editor-pane:${pane.id}`,
    data: { type: "editor-pane-source", paneId: pane.id },
  });

  const displayName =
    pane.connectionType === "host"
      ? pane.hostName || pane.hostAddress || "Connected"
      : pane.connectionType === "local"
        ? pane.localPath || "Local"
        : "New Pane";

  const sides = ["left", "right", "top", "bottom"] as const;

  return (
    <section
      data-pane-id={pane.id}
      aria-label={displayName}
      tabIndex={-1}
      onKeyDown={accessibleClickHandler(() => setActivePane(pane.id))}
      onClick={() => setActivePane(pane.id)}
      className={`flex flex-col h-full min-h-0 min-w-0 bg-dark-950 relative ${
        isActive
          ? "ring-1 ring-inset ring-primary-600/60"
          : "ring-1 ring-inset ring-dark-800"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <PaneHeader
        title={displayName}
        isActive={isActive}
        closable={closable}
        draggable={draggable}
        dragHandleRef={ref}
        isFocused={isFocused}
        onToggleFocus={canFocus ? onToggleFocus : undefined}
        onSplitH={() => splitPane(pane.id, "horizontal")}
        onSplitV={() => splitPane(pane.id, "vertical")}
        onClose={() => removePane(pane.id)}
      />

      {/* Body */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {pane.connectionType === "local" && pane.localPath ? (
          <div className="flex h-full min-h-0 min-w-0">
            <EditorExplorer paneId={pane.id} rootPath={pane.localPath} />
            <EditorViewTree pane={pane} />
          </div>
        ) : pane.connectionType === "host" ? (
          <div className="flex h-full min-h-0 min-w-0">
            <div className="w-1/3 min-w-0 h-full flex items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
              <div>
                <DesktopTowerIcon className="w-8 h-8 mx-auto mb-2 text-dark-600" />
                <p className="text-xs text-dark-400">
                  Remote explorer arrives with the SFTP transport phase
                </p>
              </div>
            </div>
            <EditorViewTree pane={pane} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CodeIcon className="w-12 h-12 mx-auto mb-3 text-dark-600" />
              <p className="text-sm text-dark-400 mb-3">
                Connect to a host or local folder to start editing code
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHostPicker(true);
                  }}
                >
                  <DesktopTowerIcon className="w-3.5 h-3.5" />
                  Connect Host
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const path = await openDirectoryPicker();
                      if (path) connectLocal(pane.id, path);
                    } catch (err) {
                      toast.error(
                        extractError(err, "Failed to open directory picker"),
                      );
                    }
                  }}
                >
                  <FolderIcon className="w-3.5 h-3.5" />
                  Connect Local
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Drop zones */}
        {sides.map((side) => (
          <DropZone
            key={side}
            id={`editor-drop:${pane.id}:${side}`}
            side={side}
            data={{ type: "editor-pane", paneId: pane.id, side }}
            accept={(draggable) =>
              draggable.data?.type === "editor-pane-source"
            }
          />
        ))}

        {/* Drop preview */}
        {dropSide && <div style={previewStyle(dropSide)} />}
      </div>

      {/* Host picker modal */}
      <Modal
        open={showHostPicker}
        onClose={() => setShowHostPicker(false)}
        title="Connect Host"
        maxWidth="max-w-lg"
      >
        <SftpHostPicker
          onConnect={onConnectHost}
          onClose={() => setShowHostPicker(false)}
        />
      </Modal>
    </section>
  );
}
