import {
  Check,
  DownloadSimple,
  Lightning,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import { useSftpStore } from '../../stores/sftpStore'

export default function FileTransfer() {
  const transfers = useSftpStore((s) => s.transfers)
  const removeTransfer = useSftpStore((s) => s.removeTransfer)
  const clearCompleted = useSftpStore((s) => s.clearCompletedTransfers)

  const activeTransfers = transfers.filter(
    (t) => t.status === 'active' || t.status === 'pending',
  )
  const completedTransfers = transfers.filter((t) => t.status === 'complete')

  if (transfers.length === 0) return null

  return (
    <div className="border-t border-dark-700 bg-dark-900 max-h-48 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-dark-700 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-2 text-dark-300">
          <Lightning className="w-3.5 h-3.5 text-primary-400" weight="bold" />
          <span>Transfers</span>
          {activeTransfers.length > 0 && (
            <span className="text-primary-400">
              {activeTransfers.length} active
            </span>
          )}
        </div>
        {completedTransfers.length > 0 && (
          <button
            type="button"
            onClick={clearCompleted}
            className="text-dark-400 hover:text-white"
          >
            Clear done ({completedTransfers.length})
          </button>
        )}
      </div>

      {/* Transfer list */}
      <div className="overflow-y-auto flex-1">
        {transfers.map((t) => (
          <div
            key={t.id}
            className="px-3 py-1.5 border-b border-dark-800 last:border-0 flex items-center gap-2 text-xs"
          >
            {/* Direction icon */}
            {t.direction === 'upload' ? (
              <UploadSimple
                className="w-3.5 h-3.5 text-green-400 flex-shrink-0"
                weight="bold"
              />
            ) : (
              <DownloadSimple
                className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"
                weight="bold"
              />
            )}

            {/* Filename */}
            <span className="text-white truncate flex-1">{t.fileName}</span>

            {/* Status */}
            {t.status === 'active' && (
              <div className="flex items-center gap-2">
                <div className="w-16 bg-dark-700 rounded-full h-1">
                  <div
                    className="bg-primary-500 h-1 rounded-full transition-all"
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
                <span className="text-dark-400 w-8 text-right">
                  {t.progress}%
                </span>
              </div>
            )}
            {t.status === 'pending' && (
              <span className="text-dark-400">Queued</span>
            )}
            {t.status === 'complete' && (
              <Check
                className="w-3.5 h-3.5 text-green-400 flex-shrink-0"
                weight="bold"
              />
            )}
            {t.status === 'error' && (
              <span
                className="text-red-400 truncate max-w-[120px]"
                title={t.error}
              >
                {t.error || 'Failed'}
              </span>
            )}

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeTransfer(t.id)}
              className="text-dark-500 hover:text-white flex-shrink-0"
            >
              <X className="w-3 h-3" weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
