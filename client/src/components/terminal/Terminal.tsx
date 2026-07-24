import { useEffect, useRef } from "react";
import { useTerminalStore } from "../../stores/terminalStore";
import {
  attachSession,
  destroySession,
  detachSession,
  fitSession,
  getOrCreateSession,
  type Session,
  updateSessionParams,
} from "./sessionManager";

interface TerminalProps {
  hostId: string;
  hostName: string;
  tabId: string;
  paneId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  authType?: "password" | "key";
  keyId?: string;
  connectionType?: "ssh" | "local";
  shell?: string;
  isActive?: boolean;
}

export default function Terminal({
  hostId,
  hostName,
  tabId,
  paneId,
  hostAddress,
  hostPort,
  hostUsername,
  authType,
  keyId,
  connectionType,
  shell,
  isActive,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach to (or create) the persistent session for this pane. Keyed on
  // paneId only — moving the pane between tabs or updating connection params
  // must NOT reconnect; the PTY session is reused.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const session: Session = getOrCreateSession({
      paneId,
      tabId,
      hostId,
      hostName,
      hostAddress,
      hostPort,
      hostUsername,
      authType,
      keyId,
      connectionType,
      shell,
    });
    attachSession(session, el);

    return () => {
      detachSession(session, el);
      // Destroy only if the pane no longer exists anywhere (it was closed,
      // not moved to another tab).
      const exists = useTerminalStore
        .getState()
        .tabs.some((t) => paneExistsInTree(t.root, paneId));
      if (!exists) destroySession(paneId);
    };
    // paneId never changes for a given component instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId]);

  // When connection params change, update the session metadata without
  // re-attaching (the PTY is already running).
  useEffect(() => {
    updateSessionParams(paneId, {
      tabId,
      hostId,
      hostName,
      hostAddress,
      hostPort,
      hostUsername,
      authType,
      keyId,
      connectionType,
      shell,
    });
  }, [
    paneId,
    tabId,
    hostId,
    hostName,
    hostAddress,
    hostPort,
    hostUsername,
    authType,
    keyId,
    connectionType,
    shell,
  ]);

  // Re-fit when this tab becomes active.
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => fitSession(paneId), 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, paneId]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function paneExistsInTree(
  node: import("../../stores/terminalStore").PaneNode,
  paneId: string,
): boolean {
  if (node.type === "leaf") return node.id === paneId;
  return node.children.some((c) => paneExistsInTree(c, paneId));
}
