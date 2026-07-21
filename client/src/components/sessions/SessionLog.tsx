import { FileText, Trash } from '@phosphor-icons/react'
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
              // biome-ignore lint/a11y/useSemanticElements: contains nested <button> for delete
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedSession(session.id)
                  }
                }}
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="text-dark-400 hover:text-red-500 p-1"
                  >
                    <Trash className="w-4 h-4" />
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
                <FileText
                  className="w-16 h-16 mx-auto mb-4 text-dark-600"
                  weight="bold"
                />
                <p>Select a session to view logs</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
