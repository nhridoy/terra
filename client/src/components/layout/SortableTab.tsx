import { useSortable } from '@dnd-kit/react/sortable'
import { closestCenter } from '@dnd-kit/collision'
import type { TerminalTab, PaneNode } from '../../stores/terminalStore'

function collectPaneStatuses(node: PaneNode): string[] {
  if (node.type === 'leaf') return [node.connectionStatus]
  return node.children.flatMap(collectPaneStatuses)
}

function statusDotClass(statuses: string[]): string {
  return statuses.includes('connected')
    ? 'bg-green-500'
    : statuses.includes('connecting')
      ? 'bg-yellow-500 animate-pulse'
      : statuses.includes('error')
        ? 'bg-red-500'
        : 'bg-dark-500'
}

export function TabPreview({ tab }: { tab: TerminalTab }) {
  const dot = statusDotClass(collectPaneStatuses(tab.root))
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-dark-800 text-white shadow-xl pointer-events-none opacity-90 ring-1 ring-primary-500/60">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="truncate max-w-[120px]">{tab.title}</span>
    </div>
  )
}

interface SortableTabProps {
  tab: TerminalTab
  index: number
  isActive: boolean
  onActivate: () => void
  onClose: () => void
}

export default function SortableTab({ tab, index, isActive, onActivate, onClose }: SortableTabProps) {
  const { ref, isDragging } = useSortable({
    id: tab.id,
    index,
    data: { type: 'tab' },
    collisionDetector: closestCenter,
  })
  const dot = statusDotClass(collectPaneStatuses(tab.root))

  return (
    <div
      ref={ref}
      onClick={onActivate}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded cursor-grab active:cursor-grabbing transition-opacity duration-150 max-w-[140px] flex-shrink-0 select-none ${
        isActive
          ? 'bg-dark-800 text-white'
          : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
      } ${isDragging ? 'opacity-40' : ''}`}
      style={{ touchAction: 'none' }}
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="truncate">{tab.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="ml-0.5 text-dark-500 hover:text-white flex-shrink-0"
        aria-label="Close tab"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
