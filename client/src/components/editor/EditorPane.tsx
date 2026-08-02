import {
  CodeIcon,
  DesktopTowerIcon,
  FolderIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { extractError } from "../../lib/extractError";
import { openDirectoryPicker } from "../../lib/localFs";
import {
  DEFAULT_EXPLORER_WIDTH,
  useEditorStore,
} from "../../stores/editorStore";
import type { Host } from "../../stores/hostStore";
import SftpHostPicker from "../sftp/SftpHostPicker";
import { Button } from "../ui/Button";
import Modal from "../ui/Modal";
import PaneHeader from "../ui/PaneHeader";
import EditorExplorer from "./EditorExplorer";
import EditorViewTree from "./EditorViewTree";

const COLLAPSE_THRESHOLD = 48;

function ExplorerResizer() {
  const width = useEditorStore((s) => s.explorerWidth);
  const visible = useEditorStore((s) => s.explorerVisible);
  const setExplorerWidth = useEditorStore((s) => s.setExplorerWidth);
  const setExplorerWidthRaw = useEditorStore((s) => s.setExplorerWidthRaw);
  const setExplorerVisible = useEditorStore((s) => s.setExplorerVisible);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    startVisible: boolean;
  } | null>(null);
  const openedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startWidth: width,
      startVisible: visible,
    };
    openedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = e.clientX - drag.startX;
    if (drag.startVisible) {
      const next = drag.startWidth + delta;
      if (next <= COLLAPSE_THRESHOLD) {
        setExplorerVisible(false);
        setExplorerWidthRaw(DEFAULT_EXPLORER_WIDTH);
      } else {
        setExplorerWidthRaw(next);
      }
    } else if (openedRef.current && delta <= COLLAPSE_THRESHOLD) {
      setExplorerVisible(false);
      setExplorerWidthRaw(DEFAULT_EXPLORER_WIDTH);
    } else if (delta >= COLLAPSE_THRESHOLD) {
      openedRef.current = true;
      setExplorerVisible(true);
      setExplorerWidthRaw(delta);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    openedRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setExplorerWidth(useEditorStore.getState().explorerWidth);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: drag handle, hr would break layout
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={visible ? width : 0}
      tabIndex={-1}
      title={
        visible ? "Drag to resize Explorer" : "Drag right to show Explorer"
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`group relative w-1 shrink-0 cursor-col-resize transition-colors ${
        visible
          ? "bg-dark-800 hover:bg-primary-500/50 active:bg-primary-500/70"
          : "bg-dark-900 hover:bg-primary-500/40 active:bg-primary-500/60"
      }`}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

export default function EditorPane() {
  const connectionType = useEditorStore((s) => s.connectionType);
  const hostName = useEditorStore((s) => s.hostName);
  const hostAddress = useEditorStore((s) => s.hostAddress);
  const localPath = useEditorStore((s) => s.localPath);
  const connectLocal = useEditorStore((s) => s.connectLocal);
  const connectHost = useEditorStore((s) => s.connectHost);
  const disconnect = useEditorStore((s) => s.disconnect);
  const explorerWidth = useEditorStore((s) => s.explorerWidth);
  const explorerVisible = useEditorStore((s) => s.explorerVisible);
  const setExplorerVisible = useEditorStore((s) => s.setExplorerVisible);
  const [showHostPicker, setShowHostPicker] = useState(false);

  const isHost = connectionType === "host";
  const displayName = isHost
    ? hostName || hostAddress || "Connected"
    : connectionType === "local"
      ? localPath || "Local"
      : "Editor";

  const handleConnectHost = (host: Host) => {
    connectHost(host.id, host.name, host.address, host.port, host.username);
  };

  const handleConnectLocal = async () => {
    try {
      const path = await openDirectoryPicker();
      if (path) connectLocal(path);
    } catch (err) {
      toast.error(extractError(err, "Failed to open directory picker"));
    }
  };

  return (
    <section
      aria-label={displayName}
      className="flex flex-col h-full min-h-0 min-w-0 bg-dark-950 relative"
    >
      {connectionType ? (
        <PaneHeader
          title={displayName}
          isActive
          closable
          onClose={disconnect}
          extra={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                setExplorerVisible(!explorerVisible);
              }}
              className={`rounded ${explorerVisible ? "" : "text-primary-400"}`}
              title={
                explorerVisible
                  ? "Hide Explorer (Ctrl+B)"
                  : "Show Explorer (Ctrl+B)"
              }
            >
              <SidebarSimpleIcon className="w-3.5 h-3.5" weight="bold" />
            </Button>
          }
        />
      ) : null}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {connectionType === "local" && localPath ? (
          <div className="flex h-full min-h-0 min-w-0">
            <div
              style={{ width: explorerWidth }}
              className={`h-full shrink-0 min-w-0 ${
                explorerVisible ? "" : "hidden"
              }`}
            >
              <EditorExplorer rootPath={localPath} />
            </div>
            <ExplorerResizer />
            <EditorViewTree />
          </div>
        ) : connectionType === "host" ? (
          <div className="flex h-full min-h-0 min-w-0">
            <div
              style={{ width: explorerWidth }}
              className={`h-full shrink-0 min-w-0 ${
                explorerVisible ? "" : "hidden"
              }`}
            >
              <div className="w-full h-full flex items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
                <div>
                  <DesktopTowerIcon className="w-8 h-8 mx-auto mb-2 text-dark-600" />
                  <p className="text-xs text-dark-400">
                    Remote explorer arrives with the SFTP transport phase
                  </p>
                </div>
              </div>
            </div>
            <ExplorerResizer />
            <EditorViewTree />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CodeIcon className="w-12 h-12 mx-auto mb-3 text-dark-600" />
              <p className="text-sm text-dark-400 mb-3">
                Connect to a host or local folder to start editing code
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => setShowHostPicker(true)}>
                  <DesktopTowerIcon className="w-3.5 h-3.5" />
                  Connect Host
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleConnectLocal}
                >
                  <FolderIcon className="w-3.5 h-3.5" />
                  Connect Local
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showHostPicker}
        onClose={() => setShowHostPicker(false)}
        title="Connect Host"
        maxWidth="max-w-lg"
      >
        <SftpHostPicker
          onConnect={handleConnectHost}
          onClose={() => setShowHostPicker(false)}
        />
      </Modal>
    </section>
  );
}
