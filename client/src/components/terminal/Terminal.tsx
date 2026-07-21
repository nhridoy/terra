import { useEffect, useRef } from 'react'
import { useTerminalStore } from '../../stores/terminalStore'
import {
  attachSession,
  destroySession,
  detachSession,
  fitSession,
  getOrCreateSession,
  type Session,
} from './sessionManager'

interface TerminalProps {
  hostId: string
  hostName: string
  tabId: string
  paneId: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  authType?: 'password' | 'key'
  keyId?: string
  connectionType?: 'ssh' | 'local'
  shell?: string
  isActive?: boolean
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
  const containerRef = useRef<HTMLDivElement>(null)

  // Attach to (or create) the persistent session for this pane. The effect is
  // keyed on paneId only — moving the pane between tabs changes tabId but must
  // NOT reconnect, so the WebSocket/xterm session is reused.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

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
    })
    attachSession(session, el)

    return () => {
      detachSession(session, el)
      // Destroy only if the pane no longer exists anywhere (it was closed,
      // not moved to another tab).
      const exists = useTerminalStore
        .getState()
        .tabs.some((t) => paneExistsInTree(t.root, paneId))
      if (!exists) destroySession(paneId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paneId,
    hostName,
    hostUsername,
    hostAddress,
    hostPort,
    hostId,
    tabId,
    authType,
    keyId,
    connectionType,
    shell,
  ])

  // Keep status routing pointed at the current owning tab and re-fit on active.
  useEffect(() => {
    const session = getOrCreateSession({
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
    })
    session.params.tabId = tabId
    if (isActive) {
      const timer = setTimeout(() => fitSession(paneId), 50)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isActive,
    tabId,
    paneId,
    hostId,
    hostUsername,
    hostName,
    hostPort,
    hostAddress,
    authType,
    keyId,
    connectionType,
    shell,
  ])

  return <div ref={containerRef} className="w-full h-full" />
}

function paneExistsInTree(
  node: import('../../stores/terminalStore').PaneNode,
  paneId: string,
): boolean {
  if (node.type === 'leaf') return node.id === paneId
  return node.children.some((c) => paneExistsInTree(c, paneId))
}
