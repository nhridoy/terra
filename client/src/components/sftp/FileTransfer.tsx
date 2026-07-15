import { useSftpStore } from '../../stores/sftpStore'

export default function FileTransfer() {
  const transfers = useSftpStore((s) => s.transfers)
  const removeTransfer = useSftpStore((s) => s.removeTransfer)
  const clearCompleted = useSftpStore((s) => s.clearCompletedTransfers)

  const activeTransfers = transfers.filter((t) => t.status === 'active' || t.status === 'pending')
  const completedTransfers = transfers.filter((t) => t.status === 'complete')

  if (transfers.length === 0) return null

  return (
    <div className="border-t border-dark-700 bg-dark-900 max-h-48 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-dark-700 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-2 text-dark-300">
          <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>Transfers</span>
          {activeTransfers.length > 0 && (
            <span className="text-primary-400">{activeTransfers.length} active</span>
          )}
        </div>
        {completedTransfers.length > 0 && (
          <button onClick={clearCompleted} className="text-dark-400 hover:text-white">
            Clear done ({completedTransfers.length})
          </button>
        )}
      </div>

      {/* Transfer list */}
      <div className="overflow-y-auto flex-1">
        {transfers.map((t) => (
          <div key={t.id} className="px-3 py-1.5 border-b border-dark-800 last:border-0 flex items-center gap-2 text-xs">
            {/* Direction icon */}
            {t.direction === 'upload' ? (
              <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}

            {/* Filename */}
            <span className="text-white truncate flex-1">{t.fileName}</span>

            {/* Status */}
            {t.status === 'active' && (
              <div className="flex items-center gap-2">
                <div className="w-16 bg-dark-700 rounded-full h-1">
                  <div className="bg-primary-500 h-1 rounded-full transition-all" style={{ width: `${t.progress}%` }} />
                </div>
                <span className="text-dark-400 w-8 text-right">{t.progress}%</span>
              </div>
            )}
            {t.status === 'pending' && <span className="text-dark-400">Queued</span>}
            {t.status === 'complete' && (
              <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {t.status === 'error' && (
              <span className="text-red-400 truncate max-w-[120px]" title={t.error}>{t.error || 'Failed'}</span>
            )}

            {/* Remove */}
            <button onClick={() => removeTransfer(t.id)} className="text-dark-500 hover:text-white flex-shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
