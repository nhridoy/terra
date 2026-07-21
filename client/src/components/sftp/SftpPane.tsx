import { CollisionPriority } from '@dnd-kit/abstract'
import { pointerIntersection } from '@dnd-kit/collision'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import {
  DesktopTower,
  DotsSixVertical,
  Folder,
  SplitHorizontal,
  SplitVertical,
  X,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { openDirectoryPicker } from '../../lib/localFs'
import type { Host } from '../../stores/hostStore'
import type { SftpLeafNode } from '../../stores/sftpStore'
import { useSftpStore } from '../../stores/sftpStore'
import Modal from '../ui/Modal'
import { toast } from '../ui/Toast'
import FileBrowser from './FileBrowser'
import LocalFileBrowser from './LocalFileBrowser'
import SftpHostPicker from './SftpHostPicker'

type DropSide = 'left' | 'right' | 'top' | 'bottom'

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

function DropZone({ paneId, side }: { paneId: string; side: DropSide }) {
  const { ref } = useDroppable({
    id: `sftp-drop:${paneId}:${side}`,
    data: { type: 'sftp-pane', paneId, side },
    accept: (draggable) => draggable.data?.type === 'sftp-pane-source',
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

interface SftpPaneProps {
  pane: SftpLeafNode
  isActive: boolean
  closable: boolean
  dropSide: DropSide | null
  onConnectHost: (host: Host) => void
}

export default function SftpPane({
  pane,
  isActive,
  closable,
  dropSide,
  onConnectHost,
}: SftpPaneProps) {
  const { splitPane, removePane, setActivePane, connectLocal } = useSftpStore()
  const [showHostPicker, setShowHostPicker] = useState(false)

  const { ref, isDragging } = useDraggable({
    id: `sftp-pane:${pane.id}`,
    data: { type: 'sftp-pane-source', paneId: pane.id },
  })

  const displayName =
    pane.connectionType === 'host'
      ? pane.hostName || pane.hostAddress || 'Connected'
      : pane.connectionType === 'local'
        ? pane.localPath || 'Local'
        : 'New Pane'

  return (
    <section
      data-pane-id={pane.id}
      aria-label={displayName}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setActivePane(pane.id)
        }
      }}
      onClick={() => setActivePane(pane.id)}
      className={`flex flex-col h-full min-h-0 min-w-0 bg-dark-950 relative ${
        isActive
          ? 'ring-1 ring-inset ring-primary-600/60'
          : 'ring-1 ring-inset ring-dark-800'
      } ${isDragging ? 'opacity-40' : ''}`}
      onMouseDown={() => setActivePane(pane.id)}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 h-7 px-2 flex-shrink-0 border-b border-dark-800 ${
          isActive ? 'bg-dark-800' : 'bg-dark-900'
        }`}
      >
        {/* Status dot */}
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            pane.connectionType ? 'bg-green-500' : 'bg-dark-600'
          }`}
        />

        {/* Drag handle */}
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

        {/* Pane name */}
        <span className="text-xs text-dark-200 truncate flex-1">
          {displayName}
        </span>

        {/* Split horizontal */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            splitPane(pane.id, 'horizontal')
          }}
          className="p-0.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
          title="Split right"
        >
          <SplitHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Split vertical */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            splitPane(pane.id, 'vertical')
          }}
          className="p-0.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
          title="Split down"
        >
          <SplitVertical className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        {closable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removePane(pane.id)
            }}
            className="p-0.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded"
            title="Close pane"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {pane.connectionType === 'host' && pane.hostId ? (
          <FileBrowser
            paneId={pane.id}
            hostId={pane.hostId}
            hostAddress={pane.hostAddress}
            hostPort={pane.hostPort}
            hostUsername={pane.hostUsername}
            onFileSelect={() => {}}
          />
        ) : pane.connectionType === 'local' ? (
          <LocalFileBrowser rootPath={pane.localPath || '/'} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Folder className="w-12 h-12 mx-auto mb-3 text-dark-600" />
              <p className="text-sm text-dark-400 mb-3">
                Connect to a host or local filesystem to browse files
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHostPicker(true)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white transition-colors rounded bg-primary-600 hover:bg-primary-700"
                >
                  <DesktopTower className="w-3.5 h-3.5" />
                  Connect Host
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      const path = await openDirectoryPicker()
                      if (path) connectLocal(pane.id, path)
                    } catch (err) {
                      toast(
                        err instanceof Error
                          ? err.message
                          : 'Failed to open directory picker',
                        'error',
                      )
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
                >
                  <Folder className="w-3.5 h-3.5" />
                  Connect Local
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drop zones */}
        <DropZone paneId={pane.id} side="left" />
        <DropZone paneId={pane.id} side="right" />
        <DropZone paneId={pane.id} side="top" />
        <DropZone paneId={pane.id} side="bottom" />

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
  )
}
