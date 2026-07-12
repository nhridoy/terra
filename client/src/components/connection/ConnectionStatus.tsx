interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  hostName?: string
  lastConnected?: string
  onDisconnect?: () => void
  onReconnect?: () => void
}

export default function ConnectionStatus({
  status,
  hostName,
  lastConnected,
  onDisconnect,
  onReconnect,
}: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500 animate-pulse'
      case 'disconnected':
        return 'bg-dark-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-dark-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
      case 'error':
        return 'Error'
      default:
        return 'Unknown'
    }
  }

  const getStatusTextColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
        return 'text-yellow-500'
      case 'disconnected':
        return 'text-dark-400'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-dark-400'
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className={`text-sm ${getStatusTextColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Host name */}
      {hostName && <span className="text-dark-300 text-sm">•</span>}
      {hostName && <span className="text-white text-sm">{hostName}</span>}

      {/* Last connected */}
      {lastConnected && status === 'disconnected' && (
        <span className="text-dark-500 text-xs">
          Last: {new Date(lastConnected).toLocaleTimeString()}
        </span>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 ml-auto">
        {status === 'connected' && onDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            className="text-dark-400 hover:text-red-500 p-1"
            title="Disconnect"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Disconnect</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </button>
        )}
        {(status === 'disconnected' || status === 'error') && onReconnect && (
          <button
            type="button"
            onClick={onReconnect}
            className="text-dark-400 hover:text-primary-500 p-1"
            title="Reconnect"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Reconnect</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
