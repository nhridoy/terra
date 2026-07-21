import {
  CaretRight,
  ClockCounterClockwise,
  MagnifyingGlass,
  Terminal,
  X,
} from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

interface SessionLog {
  id: string
  hostId: string
  hostName?: string
  startedAt: string
  endedAt?: string
  data?: string
  sizeBytes?: number
}

export default function HistoryView() {
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>(
    'all',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState<SessionLog | null>(null)

  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await invoke<SessionLog[]>('list_session_logs', {
        userId: '',
      })
      setLogs(result || [])
    } catch (e) {
      console.error('Failed to fetch history:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const filteredLogs = logs.filter((log) => {
    if (
      searchQuery &&
      !log.hostName?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }

    if (filter !== 'all') {
      const logDate = new Date(log.startedAt)
      const now = new Date()
      const diffDays =
        (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)

      if (filter === 'today' && diffDays >= 1) return false
      if (filter === 'week' && diffDays >= 7) return false
      if (filter === 'month' && diffDays >= 30) return false
    }

    return true
  })

  const formatDuration = (startedAt: string, endedAt?: string) => {
    const start = new Date(startedAt).getTime()
    const end = endedAt ? new Date(endedAt).getTime() : Date.now()
    const diff = end - start

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Session History</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-dark-700 rounded-lg overflow-hidden">
            <MagnifyingGlass
              className="w-5 h-5 text-dark-400 px-3"
              weight="bold"
            />
            <input
              type="text"
              placeholder="Search hosts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white placeholder-dark-400 px-3 py-2 w-64 focus:outline-none text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="bg-dark-800 text-white px-3 py-2 rounded-lg border border-dark-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* History List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-dark-500">
          <ClockCounterClockwise
            className="w-16 h-16 mb-4 text-dark-700"
            weight="bold"
          />
          <p className="text-lg font-medium text-white">No sessions found</p>
          <p className="text-sm text-dark-400 mt-1">
            {searchQuery
              ? 'Try adjusting your search'
              : 'Connect to a host to see session history'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredLogs.map((log) => (
            <button
              type="button"
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className={`w-full p-4 rounded-lg hover:bg-dark-800/50 transition-colors text-left flex items-center justify-between gap-4 ${
                selectedLog?.id === log.id
                  ? 'bg-dark-800/50 ring-1 ring-primary-500/50'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Terminal className="w-5 h-5 text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {log.hostName || 'Unknown Host'}
                  </p>
                  <p className="text-sm text-dark-400">
                    {formatDate(log.startedAt)}
                  </p>
                  <p className="text-xs text-dark-500 mt-0.5">
                    Duration: {formatDuration(log.startedAt, log.endedAt)}
                    {log.sizeBytes &&
                      ` • ${(log.sizeBytes / 1024).toFixed(1)} KB`}
                  </p>
                </div>
              </div>
              <CaretRight
                className="w-4 h-4 text-dark-500 flex-shrink-0"
                weight="bold"
              />
            </button>
          ))}
        </div>
      )}

      {/* Session Detail Panel */}
      {selectedLog && (
        <div className="bg-dark-800/50 rounded-lg border border-dark-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">
              Session Details
            </h3>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" weight="bold" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Host
              </p>
              <p className="text-white font-mono text-sm mt-1">
                {selectedLog.hostName || 'Unknown'}
              </p>
            </div>
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Duration
              </p>
              <p className="text-white font-mono text-sm mt-1">
                {formatDuration(selectedLog.startedAt, selectedLog.endedAt)}
              </p>
            </div>
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Started
              </p>
              <p className="text-white text-sm mt-1">
                {formatDate(selectedLog.startedAt)}
              </p>
            </div>
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Ended
              </p>
              <p className="text-white text-sm mt-1">
                {selectedLog.endedAt
                  ? formatDate(selectedLog.endedAt)
                  : 'Active'}
              </p>
            </div>
            {selectedLog.sizeBytes && (
              <div className="bg-dark-900 rounded-lg p-3">
                <p className="text-dark-400 text-xs uppercase tracking-wider">
                  Data Transferred
                </p>
                <p className="text-white text-sm mt-1">
                  {(selectedLog.sizeBytes / 1024).toFixed(2)} KB
                </p>
              </div>
            )}
          </div>

          {selectedLog.data && (
            <div className="bg-dark-900 rounded-lg p-4 max-h-96 overflow-auto">
              <p className="text-dark-400 text-xs uppercase tracking-wider mb-2">
                Session Output
              </p>
              <pre className="font-mono text-sm text-dark-200 whitespace-pre-wrap break-words">
                {selectedLog.data}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
