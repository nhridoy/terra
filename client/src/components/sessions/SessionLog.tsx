import { useEffect, useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'

interface SessionLogProps {
  hostId?: string
}

export default function SessionLog({ hostId }: SessionLogProps) {
  const {
    sessions,
    logs,
    isRecording,
    fetchSessions,
    fetchSessionLogs,
    deleteSession,
  } = useSessionStore()

  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchSessions(hostId)
  }, [hostId, fetchSessions])

  useEffect(() => {
    if (selectedSession) {
      fetchSessionLogs(selectedSession)
    }
  }, [selectedSession, fetchSessionLogs])

  const filteredSessions = sessions.filter((session) =>
    session.hostName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Session Logs</h2>
          {isRecording && (
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm">Recording</span>
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mt-3 bg-dark-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Session List */}
        <div className="w-64 border-r border-dark-700 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-dark-400">
              <p>No sessions found</p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={`p-3 cursor-pointer border-b border-dark-700 ${
                  selectedSession === session.id
                    ? 'bg-primary-600/20 border-l-2 border-l-primary-500'
                    : 'hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          session.isActive ? 'bg-green-500' : 'bg-dark-500'
                        }`}
                      />
                      <span className="text-white text-sm truncate">
                        {session.hostName}
                      </span>
                    </div>
                    <div className="text-dark-400 text-xs mt-1">
                      {formatDate(session.startTime)}
                    </div>
                    <div className="text-dark-500 text-xs">
                      {session.commandCount} commands
                      {session.duration &&
                        ` • ${formatDuration(session.duration)}`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="text-dark-400 hover:text-red-500 p-1"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Log Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedSession ? (
            <div className="p-4">
              <h3 className="text-white font-medium mb-4">Command History</h3>
              {logs.length === 0 ? (
                <div className="text-center text-dark-400 py-8">
                  <p>No commands logged</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-dark-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-primary-400 text-sm">
                          {log.command}
                        </code>
                        <div className="flex items-center gap-2">
                          {log.exitCode !== undefined && (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                log.exitCode === 0
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              Exit: {log.exitCode}
                            </span>
                          )}
                          <span className="text-dark-500 text-xs">
                            {new Date(log.startTime).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      {log.output && (
                        <pre className="bg-dark-900 p-2 rounded text-sm text-dark-300 overflow-x-auto max-h-40 overflow-y-auto">
                          {log.output}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-dark-400">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-dark-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p>Select a session to view logs</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
