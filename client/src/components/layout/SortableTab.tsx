import { closestCenter } from '@dnd-kit/collision'
import { useSortable } from '@dnd-kit/react/sortable'
import { FloppyDisk, X } from '@phosphor-icons/react'
import type { PaneNode, TerminalTab } from '../../stores/terminalStore'
import { computeTabSnapshot } from '../../stores/terminalStore'

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

function countLeaves(node: PaneNode): number {
  if (node.type === 'leaf') return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

interface SortableTabProps {
  tab: TerminalTab
  index: number
  isActive: boolean
  onActivate: () => void
  onClose: () => void
  onSavePreset?: (tabId: string) => void
  onSavePresetChanges?: (tabId: string) => void
}

export default function SortableTab({
  tab,
  index,
  isActive,
  onActivate,
  onClose,
  onSavePreset,
  onSavePresetChanges,
}: SortableTabProps) {
  const { ref, isDragging } = useSortable({
    id: tab.id,
    index,
    data: { type: 'tab' },
    collisionDetector: closestCenter,
  })
  const dot = statusDotClass(collectPaneStatuses(tab.root))
  const multiPane = countLeaves(tab.root) > 1
  const hasPreset = !!tab.activePresetId
  const isPresetDirty =
    hasPreset && computeTabSnapshot(tab.root) !== tab.savedPresetSnapshot

  return (
    // biome-ignore lint/a11y/useSemanticElements: dnd-kit draggable ref requires div
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded cursor-grab active:cursor-grabbing transition-opacity duration-150 max-w-[140px] flex-shrink-0 select-none ${
        isActive
          ? 'bg-dark-800 text-white'
          : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
      } ${isDragging ? 'opacity-40' : ''}`}
      style={{ touchAction: 'none' }}
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="truncate">{tab.title}</span>

      {/* Quick Preset controls */}
      {hasPreset ? (
        <>
          {isPresetDirty && (
            <span
              className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
              title="Unsaved changes"
            />
          )}
          {onSavePresetChanges && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSavePresetChanges(tab.id)
              }}
              disabled={!isPresetDirty}
              title={
                isPresetDirty ? 'Save preset changes' : 'No unsaved changes'
              }
              className={`flex-shrink-0 ${
                isPresetDirty
                  ? 'text-primary-400 hover:text-white'
                  : 'text-dark-600 cursor-default'
              }`}
            >
              <FloppyDisk className="w-3 h-3" />
            </button>
          )}
        </>
      ) : (
        multiPane &&
        onSavePreset && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSavePreset(tab.id)
            }}
            className="text-dark-500 hover:text-white flex-shrink-0"
            title="Save as Quick Preset"
          >
            <FloppyDisk className="w-3 h-3" />
          </button>
        )
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="ml-0.5 text-dark-500 hover:text-white flex-shrink-0"
        aria-label="Close tab"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

export function TabPreview({ tab }: { tab: TerminalTab }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/50">
      <span className="text-xs text-dark-300 truncate max-w-[160px]">
        {tab.title}
      </span>
    </div>
  )
}
