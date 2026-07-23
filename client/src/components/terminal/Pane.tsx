import { useDraggable } from "@dnd-kit/react";
import { ArrowsLeftRightIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { accessibleClickHandler } from "../../lib/accessibleClickHandler";
import { previewStyle } from "../../lib/paneLayout";
import { type DropSide, useDragStore } from "../../stores/dragStore";
import type { Host } from "../../stores/hostStore";
import { useTerminalStore } from "../../stores/terminalStore";
import PortForwarding from "../portforwarding/PortForwarding";
import { DropZone } from "../shared/DropZone";
import { Button } from "../ui/Button";
import PaneHeader from "../ui/PaneHeader";
import HostBrowser from "./HostBrowser";
import Terminal from "./Terminal";

interface PaneProps {
  tabId: string;
  pane: import("../../stores/terminalStore").LeafNode;
  isActive: boolean;
  closable: boolean;
  isActiveTab: boolean;
  onRestorePreset: (
    preset: { id?: string; name?: string; layout: string },
    tabId: string,
  ) => void;
}

export default function Pane({
  tabId,
  pane,
  isActive,
  closable,
  isActiveTab,
  onRestorePreset,
}: PaneProps) {
  const { setActivePane, splitPane, removePane, connectPane } =
    useTerminalStore();
  const dropPane = useDragStore((s) => s.dropPane);
  const dropSide: DropSide | null =
    dropPane && dropPane.tabId === tabId && dropPane.paneId === pane.id
      ? dropPane.side
      : null;
  const [showPortForwarding, setShowPortForwarding] = useState(false);

  const { ref, isDragging } = useDraggable({
    id: `pane:${pane.id}`,
    data: { type: "pane-source", tabId, paneId: pane.id },
  });

  const handleConnect = (host: Host) => {
    connectPane(tabId, pane.id, host.id, host.name, {
      hostAddress: host.address,
      hostPort: host.port,
      hostUsername: host.username,
      authType: host.authType,
      keyId: host.keyId,
    });
  };

  const handleConnectLocal = (shell: string) => {
    connectPane(tabId, pane.id, `local_${Date.now()}`, "Local", {
      connectionType: "local",
      shell,
    });
  };

  const sides = ["left", "right", "top", "bottom"] as const;

  return (
    // biome-ignore lint/a11y/useSemanticElements: terminal pane container with ref and data attributes
    <div
      data-pane-id={pane.id}
      data-tab-id={tabId}
      role="button"
      tabIndex={0}
      className={`flex flex-col h-full min-h-0 min-w-0 bg-dark-950 relative ${
        isActive
          ? "ring-1 ring-inset ring-primary-600/60"
          : "ring-1 ring-inset ring-dark-800"
      } ${dropSide ? "ring-1 ring-inset ring-primary-500" : ""} ${
        isDragging ? "opacity-40" : ""
      }`}
      onMouseDown={() => setActivePane(tabId, pane.id)}
      onKeyDown={accessibleClickHandler(() => setActivePane(tabId, pane.id))}
    >
      <PaneHeader
        title={pane.hostName || "Empty pane"}
        isActive={isActive}
        closable={closable}
        connectionStatus={pane.connectionStatus}
        dragHandleRef={ref}
        onSplitH={() => splitPane(tabId, pane.id, "horizontal")}
        onSplitV={() => splitPane(tabId, pane.id, "vertical")}
        onClose={() => removePane(tabId, pane.id)}
        extra={
          pane.hostId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                setShowPortForwarding(true);
              }}
              className="rounded"
              title="Port Forwarding"
            >
              <ArrowsLeftRightIcon className="w-3.5 h-3.5" weight="bold" />
            </Button>
          ) : undefined
        }
      />

      {/* Pane body */}
      <div className="flex-1 min-h-0 relative">
        {pane.hostId ? (
          <Terminal
            hostId={pane.hostId}
            hostName={pane.hostName}
            tabId={tabId}
            paneId={pane.id}
            hostAddress={pane.hostAddress}
            hostPort={pane.hostPort}
            hostUsername={pane.hostUsername}
            authType={pane.authType}
            keyId={pane.keyId}
            connectionType={pane.connectionType}
            shell={pane.shell}
            isActive={isActive}
          />
        ) : (
          <HostBrowser
            onConnect={handleConnect}
            onConnectLocal={handleConnectLocal}
            onRestorePreset={(preset) => onRestorePreset(preset, tabId)}
          />
        )}
        {isActiveTab &&
          sides.map((side) => (
            <DropZone
              key={side}
              id={`${pane.id}:${side}`}
              side={side}
              data={{ type: "pane", tabId, paneId: pane.id, side }}
            />
          ))}
        {dropSide && <div style={previewStyle(dropSide)} />}
      </div>

      {/* Port Forwarding Drawer */}
      {showPortForwarding && (
        <div className="absolute inset-0 z-50 flex">
          <div className="w-80 bg-dark-900 border-l border-dark-700 flex flex-col">
            <div className="flex items-center justify-between p-2 border-b border-dark-700">
              <span className="text-sm font-medium text-white">
                Port Forwarding
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPortForwarding(false)}
                className="rounded"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PortForwarding hostId={pane.hostId} />
            </div>
          </div>
          {/* Backdrop */}
          <Button
            type="button"
            variant="ghost"
            className="flex-1 bg-black/30 cursor-default"
            onClick={() => setShowPortForwarding(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowPortForwarding(false);
            }}
            aria-label="Close port forwarding panel"
          />
        </div>
      )}
    </div>
  );
}
