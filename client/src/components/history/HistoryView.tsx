import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { useVaultStore } from '../../stores/vaultStore'

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
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState<SessionLog | null>(null)
  const { currentVaultId } = useVaultStore()

  useEffect(() => {
    fetchHistory()
  }, [currentVaultId])

  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const res = await api.listSessionLogs({ vaultId: currentVaultId || undefined })
      setLogs(res.logs || [])
    } catch (e) {
      console.error('Failed to fetch history:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (searchQuery && !log.hostName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    if (filter !== 'all') {
      const logDate = new Date(log.startedAt)
      const now = new Date()
      const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)

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
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="h-16 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Session History</h2>
          <div className="hidden sm:flex items-center gap-2 border border-dark-700 rounded-lg overflow-hidden">
            <svg className="w-5 h-5 text-dark-400 px-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search hosts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white placeholder-dark-400 px-3 py-2 w-64 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            onClick={() => { /* close handled by parent */ }}
            className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-dark-500">
            <svg className="w-16 h-16 mb-4 text-dark-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-white">No sessions found</p>
            <p className="text-sm text-dark-400 mt-1">
              {searchQuery ? 'Try adjusting your search' : 'Connect to a host to see session history'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {filteredLogs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`w-full p-4 hover:bg-dark-800/50 transition-colors text-left flex items-center justify-between gap-4 ${
                  selectedLog?.id === log.id ? 'bg-dark-800/50 border-l-2 border-primary-500' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium truncate">{log.hostName || 'Unknown Host'}</p>
                      <p className="text-sm text-dark-400">{formatDate(log.startedAt)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-dark-500 mt-1">
                    Duration: {formatDuration(log.startedAt, log.endedAt)}
                    {log.sizeBytes && ` • ${(log.sizeBytes / 1024).toFixed(1)} KB`}
                  </p>
                </div>
                <svg className="w-5 h-5 text-dark-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Session Detail Panel */}
        {selectedLog && (
          <div className="border-t border-dark-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Session Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-dark-400 text-sm">Host</p>
                <p className="text-white font-mono text-sm">{selectedLog.hostName || 'Unknown'}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-dark-400 text-sm">Duration</p>
                <p className="text-white font-mono text-sm">{formatDuration(selectedLog.startedAt, selectedLog.endedAt)}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-dark-400 text-sm">Started</p>
                <p className="text-white text-sm">{formatDate(selectedLog.startedAt)}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-dark-400 text-sm">Ended</p>
                <p className="text-white text-sm">{selectedLog.endedAt ? formatDate(selectedLog.endedAt) : 'Active'}</p>
              </div>
              {selectedLog.sizeBytes && (
                <div className="bg-dark-800 rounded-lg p-4">
                  <p className="text-dark-400 text-sm">Data Transferred</p>
                  <p className="text-white text-sm">{(selectedLog.sizeBytes / 1024).toFixed(2)} KB</p>
                </div>
              )}
            </div>

            {selectedLog.data && (
              <div className="bg-dark-900 rounded-lg p-4 max-h-96 overflow-auto">
                <p className="text-dark-400 text-sm mb-2">Session Output</p>
                <pre className="font-mono text-sm text-white whitespace-pre-wrap break-words">
                  {selectedLog.data}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}