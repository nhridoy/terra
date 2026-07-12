import { useState } from 'react'

interface TransferItem {
  id: string
  fileName: string
  localPath?: string
  remotePath?: string
  direction: 'upload' | 'download'
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  progress: number
  size: number
  transferred: number
  speed?: number
  error?: string
}

export default function FileTransfer() {
  const [transfers] = useState<TransferItem[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  const removeTransfer = (id: string) => {
    // Placeholder for remove functionality
    console.log('Remove transfer:', id)
  }

  const clearCompleted = () => {
    // Placeholder for clear functionality
    console.log('Clear completed')
  }

  const activeTransfers = transfers.filter((t) => t.status === 'transferring')
  const completedTransfers = transfers.filter((t) => t.status === 'completed')

  if (transfers.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-dark-900 rounded-xl shadow-xl border border-dark-700 z-50">
      {/* Header */}
      <div
        className="p-3 border-b border-dark-700 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-white font-medium">File Transfers</span>
          {activeTransfers.length > 0 && (
            <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
              {activeTransfers.length} active
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-dark-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </div>

      {/* Transfer list */}
      {isExpanded && (
        <div className="max-h-80 overflow-y-auto">
          {transfers.length === 0 ? (
            <div className="p-4 text-center text-dark-400">No transfers</div>
          ) : (
            transfers.map((transfer) => (
              <div
                key={transfer.id}
                className="p-3 border-b border-dark-700 last:border-b-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {transfer.direction === 'upload' ? (
                      <svg
                        className="w-4 h-4 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    )}
                    <span className="text-white text-sm truncate">
                      {transfer.fileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {transfer.status === 'transferring' && (
                      <span className="text-dark-400 text-xs">
                        {transfer.progress}%
                      </span>
                    )}
                    {transfer.status === 'completed' && (
                      <svg
                        className="w-4 h-4 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    {transfer.status === 'failed' && (
                      <svg
                        className="w-4 h-4 text-red-500"
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
                    )}
                    <button
                      onClick={() => removeTransfer(transfer.id)}
                      className="text-dark-400 hover:text-white"
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

                {/* Progress bar */}
                {transfer.status === 'transferring' && (
                  <div className="w-full bg-dark-700 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${transfer.progress}%` }}
                    />
                  </div>
                )}

                {/* Status text */}
                <div className="text-dark-400 text-xs mt-1">
                  {transfer.status === 'pending' && 'Waiting...'}
                  {transfer.status === 'transferring' && (
                    <>
                      {formatSize(transfer.transferred)} /{' '}
                      {formatSize(transfer.size)}
                      {transfer.speed && ` • ${formatSpeed(transfer.speed)}`}
                    </>
                  )}
                  {transfer.status === 'completed' && 'Completed'}
                  {transfer.status === 'failed' && (
                    <span className="text-red-400">
                      {transfer.error || 'Failed'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Clear completed button */}
          {completedTransfers.length > 0 && (
            <div className="p-3 border-t border-dark-700">
              <button
                onClick={clearCompleted}
                className="w-full text-dark-400 hover:text-white text-sm"
              >
                Clear completed ({completedTransfers.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSecond: number) {
  return formatSize(bytesPerSecond) + '/s'
}
