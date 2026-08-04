import {
  CodeIcon,
  DesktopTowerIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { extractError } from "@/lib/common/extractError";
import { openDirectoryPicker } from "@/lib/sftp/localFs";
import {
  DEFAULT_SIDEBAR_WIDTH,
  type SidebarTool,
  useEditorStore,
} from "@/stores/editor/editorStore";
import type { Host } from "@/stores/hosts/hostStore";
import SftpHostPicker from "@/components/sftp/picker/SftpHostPicker";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PaneHeader from "@/components/ui/PaneHeader";
import ActivityBar from "@/components/editor/panels/ActivityBar";
import EditorExplorer from "@/components/editor/panels/EditorExplorer";
import EditorSearch from "@/components/editor/panels/EditorSearch";
import EditorViewTree from "@/components/editor/views/EditorViewTree";
import SourceControlPanel from "@/components/editor/panels/SourceControlPanel";

const COLLAPSE_THRESHOLD = 48;

function SidebarResizer() {
  const width = useEditorStore((s) => s.sidebarWidth);
  const visible = useEditorStore((s) => s.sidebarVisible);
  const setSidebarWidth = useEditorStore((s) => s.setSidebarWidth);
  const setSidebarWidthRaw = useEditorStore((s) => s.setSidebarWidthRaw);
  const setSidebarVisible = useEditorStore((s) => s.setSidebarVisible);
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
        setSidebarVisible(false);
        setSidebarWidthRaw(DEFAULT_SIDEBAR_WIDTH);
      } else {
        setSidebarWidthRaw(next);
      }
    } else if (openedRef.current && delta <= COLLAPSE_THRESHOLD) {
      setSidebarVisible(false);
      setSidebarWidthRaw(DEFAULT_SIDEBAR_WIDTH);
    } else if (delta >= COLLAPSE_THRESHOLD) {
      openedRef.current = true;
      setSidebarVisible(true);
      setSidebarWidthRaw(delta);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    openedRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setSidebarWidth(useEditorStore.getState().sidebarWidth);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: drag handle, hr would break layout
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={visible ? width : 0}
      tabIndex={-1}
      title={visible ? "Drag to resize Sidebar" : "Drag right to show Sidebar"}
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
  const sidebarWidth = useEditorStore((s) => s.sidebarWidth);
  const sidebarVisible = useEditorStore((s) => s.sidebarVisible);
  const sidebarTool = useEditorStore((s) => s.sidebarTool);
  const setSidebarVisible = useEditorStore((s) => s.setSidebarVisible);
  const setSidebarTool = useEditorStore((s) => s.setSidebarTool);
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

  const handleToolSelect = useCallback(
    (tool: SidebarTool) => {
      if (sidebarTool === tool && sidebarVisible) {
        setSidebarVisible(false);
      } else {
        setSidebarVisible(true);
        setSidebarTool(tool);
      }
    },
    [sidebarTool, sidebarVisible, setSidebarVisible, setSidebarTool],
  );

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
                setSidebarVisible(!sidebarVisible);
              }}
              className={`rounded ${sidebarVisible ? "" : "text-primary-400"}`}
              title={
                sidebarVisible
                  ? "Hide Sidebar (Ctrl+B)"
                  : "Show Sidebar (Ctrl+B)"
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
            <ActivityBar active={sidebarTool} onSelect={handleToolSelect} />
            {sidebarVisible && (
              <div
                style={{ width: sidebarWidth }}
                className="h-full shrink-0 min-w-0"
              >
                {sidebarTool === "search" ? (
                  <EditorSearch />
                ) : sidebarTool === "source-control" ? (
                  <SourceControlPanel />
                ) : (
                  <EditorExplorer rootPath={localPath} />
                )}
              </div>
            )}
            <SidebarResizer />
            <EditorViewTree />
          </div>
        ) : connectionType === "host" ? (
          <div className="flex h-full min-h-0 min-w-0">
            <ActivityBar active={sidebarTool} onSelect={handleToolSelect} />
            {sidebarVisible && (
              <div
                style={{ width: sidebarWidth }}
                className="h-full shrink-0 min-w-0"
              >
                {sidebarTool === "search" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
                    <MagnifyingGlassIcon
                      className="w-8 h-8 mb-2 text-dark-600"
                      weight="bold"
                    />
                    <p className="text-xs text-dark-400">
                      Search arrives with the SFTP transport phase
                    </p>
                  </div>
                ) : sidebarTool === "source-control" ? (
                  <SourceControlPanel />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
                    <div>
                      <DesktopTowerIcon className="w-8 h-8 mx-auto mb-2 text-dark-600" />
                      <p className="text-xs text-dark-400">
                        Remote explorer arrives with the SFTP transport phase
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <SidebarResizer />
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
