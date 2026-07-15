import { useState } from 'react'
import { DragDropProvider, DragOverlay, type DragOverEvent, type DragEndEvent } from '@dnd-kit/react'
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { useSftpStore } from '../../stores/sftpStore'
import SftpPaneTree from './SftpPaneTree'
import FileTransfer from './FileTransfer'

type DropSide = 'left' | 'right' | 'top' | 'bottom'

export default function SftpLayout() {
  const root = useSftpStore((s) => s.root)
  const activePaneId = useSftpStore((s) => s.activePaneId)
  const movePane = useSftpStore((s) => s.movePane)
  const [dropTarget, setDropTarget] = useState<{ paneId: string; side: DropSide } | null>(null)

  const handleDragOver = (event: DragOverEvent) => {
    const { source, target } = event.operation
    if (source?.data?.type === 'sftp-pane-source' && target?.data?.type === 'sftp-pane') {
      const sourcePaneId = String(source.data.paneId)
      const targetPaneId = String(target.data.paneId)
      const side = target.data.side as DropSide
      if (sourcePaneId !== targetPaneId) {
        setDropTarget({ paneId: targetPaneId, side })
        return
      }
    }
    setDropTarget(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation
    if (event.canceled || !source) {
      setDropTarget(null)
      return
    }

    if (source.data?.type === 'sftp-pane-source' && target?.data?.type === 'sftp-pane') {
      const sourcePaneId = String(source.data.paneId)
      const targetPaneId = String(target.data.paneId)
      const side = target.data.side as DropSide
      if (sourcePaneId !== targetPaneId) {
        movePane(sourcePaneId, targetPaneId, side)
      }
    }
    setDropTarget(null)
  }

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: (event) => {
            if (event.pointerType === 'touch') {
              return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
            }
            return [new PointerActivationConstraints.Distance({ value: 5 })]
          },
        }),
      ]}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 relative bg-dark-900 overflow-hidden">
        <SftpPaneTree node={root} activePaneId={activePaneId} dropTarget={dropTarget} />
      </div>

      <FileTransfer />

      <DragOverlay>
        {(source) => {
          if (source.data?.type === 'sftp-pane-source') {
            return (
              <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-white">SFTP Pane</span>
                </div>
              </div>
            )
          }
          return null
        }}
      </DragOverlay>
    </DragDropProvider>
  )
}
