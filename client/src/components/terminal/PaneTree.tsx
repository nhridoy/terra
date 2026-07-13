import { useRef } from 'react'
import { useTerminalStore } from '../../stores/terminalStore'
import type { PaneNode, LeafNode } from '../../stores/terminalStore'
import Pane from './Pane'

interface PaneTreeProps {
  tabId: string
  node: PaneNode
  activePaneId: string | null
  isActiveTab: boolean
}

interface PlacedPane {
  id: string
  left: number
  top: number
  width: number
  height: number
}

interface PlacedDivider {
  id: string
  splitId: string
  index: number
  direction: 'horizontal' | 'vertical'
  posPct: number // position along the split axis (percent of container)
  crossPct: number // start of the cross axis (percent)
  extentPct: number // full extent along the cross axis (percent)
}

const DIV = 10 // hit-area thickness in px

function countLeaves(node: PaneNode): number {
  if (node.type === 'leaf') return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

// Recursively compute absolute rects (in %) for each leaf and divider bars.
function computeLayout(
  node: PaneNode,
  left: number,
  top: number,
  width: number,
  height: number,
  panes: PlacedPane[],
  dividers: PlacedDivider[],
) {
  if (node.type === 'leaf') {
    panes.push({ id: node.id, left, top, width, height })
    return
  }
  const sizes = node.children.map((c) => c.size)
  const sum = sizes.reduce((a, b) => a + b, 0) || 1
  let offset = 0
  node.children.forEach((child, i) => {
    const frac = sizes[i] / sum
    if (node.direction === 'horizontal') {
      const cw = width * frac
      if (i < node.children.length - 1) {
        dividers.push({
          id: `${node.id}_${i}`,
          splitId: node.id,
          index: i,
          direction: 'horizontal',
          posPct: left + offset + cw,
          crossPct: top,
          extentPct: height,
        })
      }
      computeLayout(child, left + offset, top, cw, height, panes, dividers)
      offset += cw
    } else {
      const ch = height * frac
      if (i < node.children.length - 1) {
        dividers.push({
          id: `${node.id}_${i}`,
          splitId: node.id,
          index: i,
          direction: 'vertical',
          posPct: top + offset + ch,
          crossPct: left,
          extentPct: width,
        })
      }
      computeLayout(child, left, top + offset, width, ch, panes, dividers)
      offset += ch
    }
  })
}

function SplitDivider({
  tabId,
  divider,
  containerRef,
}: {
  tabId: string
  divider: PlacedDivider
  containerRef: React.RefObject<HTMLDivElement>
}) {
  const { setPaneSizes } = useTerminalStore()
  const dragRef = useRef<{ sizes: number[]; sumAll: number; startPx: number } | null>(null)
  const isHorizontal = divider.direction === 'horizontal'
  const MIN_FRACTION = 0.1 // neither adjacent pane may shrink below 10% of the split

  const geometry =
    isHorizontal
      ? {
          left: `calc(${divider.posPct}% - ${DIV / 2}px)`,
          top: `${divider.crossPct}%`,
          width: `${DIV}px`,
          height: `${divider.extentPct}%`,
        }
      : {
          left: `${divider.crossPct}%`,
          top: `calc(${divider.posPct}% - ${DIV / 2}px)`,
          width: `${divider.extentPct}%`,
          height: `${DIV}px`,
        }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const split = findSplitInStore(tabId, divider.splitId)
    const container = containerRef.current
    if (!split || !container) return
    const rect = container.getBoundingClientRect()
    const startPx = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top
    const sizes = split.children.map((c) => c.size)
    const sumAll = sizes.reduce((a, b) => a + b, 0) || 1
    dragRef.current = { sizes, sumAll, startPx }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const container = containerRef.current
    if (!drag || !container) return
    const rect = container.getBoundingClientRect()
    const axisSize = isHorizontal ? rect.width : rect.height
    if (axisSize <= 0) return
    const curPx = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top
    const deltaPx = curPx - drag.startPx

    const minWeight = MIN_FRACTION * drag.sumAll
    let w0 = drag.sizes[divider.index] + (deltaPx / axisSize) * drag.sumAll
    let w1 = drag.sizes[divider.index + 1] - (deltaPx / axisSize) * drag.sumAll

    // Keep both adjacent panes within [MIN_FRACTION, 1 - MIN_FRACTION] of the split
    if (w0 < minWeight) {
      w0 = minWeight
      w1 = drag.sumAll - minWeight
    }
    if (w1 < minWeight) {
      w1 = minWeight
      w0 = drag.sumAll - minWeight
    }

    const sizes = [...drag.sizes]
    sizes[divider.index] = w0
    sizes[divider.index + 1] = w1
    setPaneSizes(tabId, divider.splitId, sizes)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute z-20 group ${
        isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize'
      }`}
      style={geometry}
    >
      {/* Persistent boundary line — always visible so splits are discoverable */}
      <div
        className={`absolute inset-0 m-auto bg-dark-600 transition-colors group-hover:bg-primary-500 ${
          isHorizontal ? 'w-[3px] h-full' : 'h-[3px] w-full'
        }`}
      />
      {/* Grip handle — revealed on hover to signal resizability */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded bg-dark-800/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${
          isHorizontal ? 'flex-col gap-1 py-1.5 px-1' : 'flex-row gap-1 px-1.5 py-1'
        }`}
      >
        <span className="w-1 h-1 rounded-full bg-dark-400 group-hover:bg-white" />
        <span className="w-1 h-1 rounded-full bg-dark-400 group-hover:bg-white" />
      </div>
    </div>
  )
}

function findSplitInStore(tabId: string, splitId: string) {
  const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId)
  if (!tab) return null
  const stack: PaneNode[] = [tab.root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.type === 'split') {
      if (n.id === splitId) return n
      stack.push(...n.children)
    }
  }
  return null
}

export default function PaneTree({ tabId, node, activePaneId, isActiveTab }: PaneTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const closable = countLeaves(node) > 1

  const panes: PlacedPane[] = []
  const dividers: PlacedDivider[] = []
  computeLayout(node, 0, 0, 100, 100, panes, dividers)

  return (
    <div ref={containerRef} className="absolute inset-0">
      {panes.map((p) => {
        const leaf = findLeaf(node, p.id)
        if (!leaf) return null
        return (
          <div
            key={p.id}
            className="absolute overflow-hidden"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.width}%`,
              height: `${p.height}%`,
            }}
          >
            <Pane
              tabId={tabId}
              pane={leaf}
              isActive={p.id === activePaneId}
              closable={closable}
              isActiveTab={isActiveTab}
            />
          </div>
        )
      })}

      {dividers.map((d) => (
        <SplitDivider key={d.id} tabId={tabId} divider={d} containerRef={containerRef} />
      ))}
    </div>
  )
}

function findLeaf(node: PaneNode, paneId: string): LeafNode | null {
  if (node.type === 'leaf') return node.id === paneId ? node : null
  for (const c of node.children) {
    const found = findLeaf(c, paneId)
    if (found) return found
  }
  return null
}
