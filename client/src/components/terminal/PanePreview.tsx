import { type LeafNode } from '../../stores/terminalStore'

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

export default function PanePreview({ pane }: { pane: LeafNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-dark-800 border border-dark-700 shadow-lg">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(pane.connectionStatus)}`} />
      <span className="text-xs text-white truncate max-w-[200px]">
        {pane.hostName || 'Empty pane'}
      </span>
    </div>
  )
}
