import { useCallback, useState } from 'react'
import Terminal from './Terminal'

interface SplitNode {
  id: string
  type: 'leaf' | 'split'
  direction?: 'horizontal' | 'vertical'
  children?: SplitNode[]
  hostId?: string
  hostName?: string
  size?: number
}

interface SplitViewProps {
  root: SplitNode
  onSplit: (nodeId: string, direction: 'horizontal' | 'vertical') => void
  onClose: (nodeId: string) => void
}

export function useSplitView(initialHostId?: string, initialHostName?: string) {
  const [root, setRoot] = useState<SplitNode>({
    id: 'root',
    type: 'leaf',
    hostId: initialHostId,
    hostName: initialHostName,
    size: 100,
  })
  const [focusedId, setFocusedId] = useState<string>('root')

  const findNode = useCallback(
    (node: SplitNode, id: string): SplitNode | null => {
      if (node.id === id) return node
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, id)
          if (found) return found
        }
      }
      return null
    },
    [],
  )

  const findParent = useCallback(
    (node: SplitNode, id: string): SplitNode | null => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === id) return node
          const found = findParent(child, id)
          if (found) return found
        }
      }
      return null
    },
    [],
  )

  const split = useCallback(
    (
      nodeId: string,
      direction: 'horizontal' | 'vertical',
      newHostId?: string,
      newHostName?: string,
    ) => {
      setRoot((prev) => {
        const newRoot = JSON.parse(JSON.stringify(prev)) as SplitNode
        const node = findNode(newRoot, nodeId)
        if (!node || node.type !== 'leaf') return prev

        const newNode: SplitNode = {
          id: `split_${Date.now()}`,
          type: 'split',
          direction,
          children: [
            { ...node, size: 50 },
            {
              id: `leaf_${Date.now() + 1}`,
              type: 'leaf',
              hostId: newHostId,
              hostName: newHostName,
              size: 50,
            },
          ],
          size: node.size,
        }

        // Replace node in parent
        const parent = findParent(newRoot, nodeId)
        if (parent && parent.children) {
          const index = parent.children.findIndex((c) => c.id === nodeId)
          if (index !== -1) {
            parent.children[index] = newNode
          }
        } else {
          return newNode
        }

        return newRoot
      })
    },
    [findNode, findParent],
  )

  const close = useCallback(
    (nodeId: string) => {
      setRoot((prev) => {
        const newRoot = JSON.parse(JSON.stringify(prev)) as SplitNode
        const parent = findParent(newRoot, nodeId)

        if (!parent || !parent.children) return prev

        // If only one child left, promote it
        if (parent.children.length === 2) {
          const otherChild = parent.children.find((c) => c.id !== nodeId)
          if (otherChild && parent.id !== 'root') {
            const grandparent = findParent(newRoot, parent.id)
            if (grandparent && grandparent.children) {
              const index = grandparent.children.findIndex(
                (c) => c.id === parent.id,
              )
              if (index !== -1) {
                grandparent.children[index] = otherChild
              }
            }
          } else if (otherChild) {
            return otherChild
          }
        } else {
          parent.children = parent.children.filter((c) => c.id !== nodeId)
        }

        return newRoot
      })
    },
    [findParent],
  )

  const resize = useCallback(
    (nodeId: string, newSize: number) => {
      setRoot((prev) => {
        const newRoot = JSON.parse(JSON.stringify(prev)) as SplitNode
        const node = findNode(newRoot, nodeId)
        if (node) {
          node.size = newSize
        }
        return newRoot
      })
    },
    [findNode],
  )

  const setHost = useCallback(
    (nodeId: string, hostId: string, hostName: string) => {
      setRoot((prev) => {
        const newRoot = JSON.parse(JSON.stringify(prev)) as SplitNode
        const node = findNode(newRoot, nodeId)
        if (node && node.type === 'leaf') {
          node.hostId = hostId
          node.hostName = hostName
        }
        return newRoot
      })
    },
    [findNode],
  )

  return {
    root,
    focusedId,
    setFocusedId,
    split,
    close,
    resize,
    setHost,
  }
}

export function SplitView({ root, onSplit, onClose }: SplitViewProps) {
  return <SplitNodeComponent node={root} onSplit={onSplit} onClose={onClose} />
}

function SplitNodeComponent({
  node,
  onSplit,
  onClose,
}: {
  node: SplitNode
  onSplit: (nodeId: string, direction: 'horizontal' | 'vertical') => void
  onClose: (nodeId: string) => void
}) {
  if (node.type === 'leaf') {
    return (
      <div className="relative h-full">
        {node.hostId ? (
          <Terminal
            hostId={node.hostId}
            hostName={node.hostName || 'Unknown'}
            tabId={node.id}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-dark-950 text-dark-400">
            <div className="text-center">
              <p>No host selected</p>
              <p className="text-sm mt-2">Connect to a host to start</p>
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSplit(node.id, 'horizontal')}
            className="p-1 bg-dark-700 hover:bg-dark-600 rounded text-dark-300 hover:text-white"
            title="Split horizontal"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 3v18m8-18v18"
              />
            </svg>
          </button>
          <button
            onClick={() => onSplit(node.id, 'vertical')}
            className="p-1 bg-dark-700 hover:bg-dark-600 rounded text-dark-300 hover:text-white"
            title="Split vertical"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8v8m18-8v8"
              />
            </svg>
          </button>
          <button
            onClick={() => onClose(node.id)}
            className="p-1 bg-dark-700 hover:bg-red-600 rounded text-dark-300 hover:text-white"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  const isHorizontal = node.direction === 'horizontal'
  const totalSize =
    node.children?.reduce((sum, c) => sum + (c.size || 50), 0) || 100

  return (
    <div className={`h-full flex ${isHorizontal ? 'flex-row' : 'flex-col'}`}>
      {node.children?.map((child, index) => {
        const sizePercent = ((child.size || 50) / totalSize) * 100
        return (
          <div
            key={child.id}
            style={{
              [isHorizontal ? 'width' : 'height']: `${sizePercent}%`,
            }}
            className="relative"
          >
            <SplitNodeComponent
              node={child}
              onSplit={onSplit}
              onClose={onClose}
            />
            {index < (node.children?.length || 0) - 1 && (
              <div
                className={`absolute ${
                  isHorizontal
                    ? 'right-0 top-0 bottom-0 w-1 cursor-col-resize'
                    : 'bottom-0 left-0 right-0 h-1 cursor-row-resize'
                } bg-dark-700 hover:bg-primary-500`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
