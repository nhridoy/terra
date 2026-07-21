import { CollisionPriority } from '@dnd-kit/abstract'
import { pointerIntersection } from '@dnd-kit/collision'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import {
  ArrowsLeftRight,
  DotsSixVertical,
  SplitHorizontal,
  SplitVertical,
  X,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { type DropSide, useDragStore } from '../../stores/dragStore'
import type { Host } from '../../stores/hostStore'
import { useTerminalStore } from '../../stores/terminalStore'
import PortForwarding from '../portforwarding/PortForwarding'
import HostBrowser from './HostBrowser'
import Terminal from './Terminal'

interface PaneProps {
  tabId: string
  pane: import('../../stores/terminalStore').LeafNode
  isActive: boolean
  closable: boolean
  isActiveTab: boolean
  onRestorePreset: (
    preset: { id?: string; name?: string; layout: string },
    tabId: string,
  ) => void
}

function statusDotClass(status: string): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-dark-500'
  }
}

function previewStyle(side: DropSide): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    border: '2px solid rgb(14, 165, 233)',
    borderRadius: 4,
    zIndex: 30,
  }
  switch (side) {
    case 'left':
      return { ...base, left: 0, top: 0, width: '50%', height: '100%' }
    case 'right':
      return { ...base, right: 0, top: 0, width: '50%', height: '100%' }
    case 'top':
      return { ...base, left: 0, top: 0, width: '100%', height: '50%' }
    case 'bottom':
      return { ...base, left: 0, bottom: 0, width: '100%', height: '50%' }
  }
}

// Four non-overlapping drop zones that partition the pane:
//   - left / right take the outer thirds (full height)
//   - top / bottom split the middle third (top half / bottom half)
// This gives a clean, deterministic side target for every cursor position
// without the zones overlapping each other.
function PaneDropZone({
  tabId,
  paneId,
  side,
}: {
  tabId: string
  paneId: string
  side: DropSide
}) {
  const { ref } = useDroppable({
    id: `${paneId}:${side}`,
    data: { type: 'pane', tabId, paneId, side },
    collisionDetector: pointerIntersection,
    collisionPriority: CollisionPriority.High,
  })
  const style: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 25,
  }
  switch (side) {
    case 'left':
      Object.assign(style, { left: 0, top: 0, width: '33.34%', height: '100%' })
      break
    case 'right':
      Object.assign(style, {
        right: 0,
        top: 0,
        width: '33.34%',
        height: '100%',
      })
      break
    case 'top':
      Object.assign(style, {
        left: '33.33%',
        top: 0,
        width: '33.33%',
        height: '50%',
      })
      break
    case 'bottom':
      Object.assign(style, {
        left: '33.33%',
        bottom: 0,
        width: '33.33%',
        height: '50%',
      })
      break
  }
  return <div ref={ref} style={style} />
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
    useTerminalStore()
  const dropPane = useDragStore((s) => s.dropPane)
  const dropSide: DropSide | null =
    dropPane && dropPane.tabId === tabId && dropPane.paneId === pane.id
      ? dropPane.side
      : null
  const [showPortForwarding, setShowPortForwarding] = useState(false)

  // Grip handle makes this pane draggable for in-tab reordering.
  const { ref, isDragging } = useDraggable({
    id: `pane:${pane.id}`,
    data: { type: 'pane-source', tabId, paneId: pane.id },
  })

  const handleConnect = (host: Host) => {
    connectPane(tabId, pane.id, host.id, host.name, {
      hostAddress: host.address,
      hostPort: host.port,
      hostUsername: host.username,
      authType: host.authType,
      keyId: host.keyId,
    })
  }

  const handleConnectLocal = (shell: string) => {
    connectPane(tabId, pane.id, `local_${Date.now()}`, 'Local', {
      connectionType: 'local',
      shell,
    })
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: terminal pane container with ref and data attributes
    <div
      data-pane-id={pane.id}
      data-tab-id={tabId}
      role="button"
      tabIndex={0}
      className={`flex flex-col h-full min-h-0 min-w-0 bg-dark-950 relative ${
        isActive
          ? 'ring-1 ring-inset ring-primary-600/60'
          : 'ring-1 ring-inset ring-dark-800'
      } ${dropSide ? 'ring-1 ring-inset ring-primary-500' : ''} ${
        isDragging ? 'opacity-40' : ''
      }`}
      onMouseDown={() => setActivePane(tabId, pane.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setActivePane(tabId, pane.id)
        }
      }}
    >
      {/* Pane header */}
      <div
        className={`flex items-center gap-2 h-7 px-2 flex-shrink-0 border-b border-dark-800 ${
          isActive ? 'bg-dark-800' : 'bg-dark-900'
        }`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(pane.connectionStatus)}`}
        />

        {/* Drag handle (only when there is more than one pane to rearrange) */}
        {closable && (
          <button
            type="button"
            ref={ref}
            className="p-0.5 text-dark-500 hover:text-white hover:bg-dark-700 rounded cursor-grab active:cursor-grabbing flex-shrink-0"
            title="Drag to move pane"
            style={{ touchAction: 'none' }}
          >
            <DotsSixVertical className="w-3.5 h-3.5" />
          </button>
        )}

        <span className="text-xs text-dark-200 truncate flex-1">
          {pane.hostName || 'Empty pane'}
        </span>

        {/* Split horizontal */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            splitPane(tabId, pane.id, 'horizontal')
          }}
          className="p-0.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
          title="Split right"
        >
          <SplitHorizontal className="w-3.5 h-3.5" weight="bold" />
        </button>

        {/* Split vertical */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            splitPane(tabId, pane.id, 'vertical')
          }}
          className="p-0.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
          title="Split down"
        >
          <SplitVertical className="w-3.5 h-3.5" weight="bold" />
        </button>

        {/* Port forwarding (only when connected) */}
        {pane.hostId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowPortForwarding(true)
            }}
            className="p-0.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
            title="Port Forwarding"
          >
            <ArrowsLeftRight className="w-3.5 h-3.5" weight="bold" />
          </button>
        )}

        {/* Close (only when more than one pane in the tab) */}
        {closable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removePane(tabId, pane.id)
            }}
            className="p-0.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded"
            title="Close pane"
          >
            <X className="w-3.5 h-3.5" weight="bold" />
          </button>
        )}
      </div>

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
        {isActiveTab && (
          <>
            <PaneDropZone tabId={tabId} paneId={pane.id} side="left" />
            <PaneDropZone tabId={tabId} paneId={pane.id} side="right" />
            <PaneDropZone tabId={tabId} paneId={pane.id} side="top" />
            <PaneDropZone tabId={tabId} paneId={pane.id} side="bottom" />
          </>
        )}
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
              <button
                type="button"
                onClick={() => setShowPortForwarding(false)}
                className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PortForwarding hostId={pane.hostId} />
            </div>
          </div>
          {/* Backdrop */}
          <button
            type="button"
            className="flex-1 bg-black/30 cursor-default"
            onClick={() => setShowPortForwarding(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowPortForwarding(false)
            }}
            aria-label="Close port forwarding panel"
          />
        </div>
      )}
    </div>
  )
}
