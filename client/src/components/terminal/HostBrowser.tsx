import { useEffect, useRef, useState } from 'react'
import { useHostStore } from '../../stores/hostStore'

interface HostBrowserProps {
  onConnect: (host: any) => void
}

export default function HostBrowser({ onConnect }: HostBrowserProps) {
  const { hosts } = useHostStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredHosts = hosts.filter(
    (host) =>
      host.name.toLowerCase().includes(query.toLowerCase()) ||
      host.address.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredHosts.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (filteredHosts[selectedIndex]) {
        onConnect(filteredHosts[selectedIndex])
      } else if (query) {
        handleDirectConnect()
      }
    }
  }

  const handleDirectConnect = () => {
    const match = query.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/)
    if (match) {
      const [, username, address, port] = match
      onConnect({
        id: `direct_${Date.now()}`,
        name: address,
        address,
        port: Number.parseInt(port || '22'),
        username: username || 'root',
        authType: 'password',
      })
    }
  }

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
        <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search hosts or type user@host:port"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm text-white bg-transparent placeholder-dark-400 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-xs text-dark-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query && !filteredHosts.some(
          (h) => h.name.toLowerCase() === query.toLowerCase() || h.address.toLowerCase() === query.toLowerCase(),
        ) && (
          <button
            onClick={handleDirectConnect}
            className="flex items-center w-full gap-3 px-4 py-3 text-left hover:bg-dark-800"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-white">Connect to {query}</div>
              <div className="text-xs text-dark-400">Direct connection</div>
            </div>
          </button>
        )}

        {filteredHosts.length === 0 && !query ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-500">
            <svg className="w-12 h-12 mb-3 text-dark-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <p className="text-sm">No hosts available</p>
            <p className="mt-1 text-xs">Add a host or type a connection string</p>
          </div>
        ) : (
          filteredHosts.map((host, index) => (
            <button
              key={host.id}
              onClick={() => onConnect(host)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left ${
                index === selectedIndex ? 'bg-dark-800' : 'hover:bg-dark-800'
              }`}
            >
              <div
                className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg"
                style={{ backgroundColor: host.color || '#64748b' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{host.name}</div>
                <div className="text-xs text-dark-400">
                  {host.username ? `${host.username}@` : ''}{host.address}:{host.port}
                </div>
              </div>
              {host.tags && host.tags.length > 0 && (
                <div className="flex gap-1">
                  {host.tags.slice(0, 2).map((tag: string) => (
                    <span key={tag} className="px-1.5 py-0.5 bg-dark-700 text-dark-300 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between px-4 py-2 text-xs border-t border-dark-700 text-dark-500">
        <span>↑↓ Navigate • ↵ Connect</span>
        <span>{filteredHosts.length} hosts</span>
      </div>
    </div>
  )
}
