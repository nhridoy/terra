import { useEffect, useRef, useState } from 'react'
import { useHostStore } from '../../stores/hostStore'
import Modal from '../ui/Modal'

interface QuickConnectProps {
  onConnect: (host: any) => void
}

export default function QuickConnect({ onConnect }: QuickConnectProps) {
  const { hosts } = useHostStore()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredHosts = hosts.filter(
    (host) =>
      host.name.toLowerCase().includes(query.toLowerCase()) ||
      host.address.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

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
    } else if (e.key === 'Enter' && filteredHosts[selectedIndex]) {
      onConnect(filteredHosts[selectedIndex])
      setIsOpen(false)
      setQuery('')
    }
  }

  const handleSelect = (host: any) => {
    onConnect(host)
    setIsOpen(false)
    setQuery('')
  }

  // Handle direct connection with user@host:port format
  const handleDirectConnect = () => {
    // Parse user@host:port format
    const match = query.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/)
    if (match) {
      const [, username, address, port] = match
      const host = {
        id: `direct_${Date.now()}`,
        name: address,
        address,
        port: Number.parseInt(port || '22'),
        username: username || 'root',
        authType: 'password',
      }
      onConnect(host)
      setIsOpen(false)
      setQuery('')
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-dark-800 hover:bg-dark-700 text-dark-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg border border-dark-700"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        Quick Connect
        <kbd className="px-1.5 py-0.5 bg-dark-700 rounded text-dark-300 text-xs">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
        </kbd>
      </button>
    )
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        setIsOpen(false)
        setQuery('')
      }}
      maxWidth="max-w-lg"
    >
      <div className="p-0">
        {/* Input */}
        <div className="flex items-center gap-3 p-4 border-b border-dark-700">
          <svg
            className="w-5 h-5 text-dark-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search hosts or type user@host:port"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white placeholder-dark-400 focus:outline-none"
          />
          <kbd className="px-2 py-1 bg-dark-700 rounded text-dark-300 text-xs">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={dropdownRef} className="max-h-80 overflow-y-auto">
          {query &&
            !filteredHosts.some(
              (h) =>
                h.name.toLowerCase() === query.toLowerCase() ||
                h.address.toLowerCase() === query.toLowerCase(),
            ) && (
              <button
                type="button"
                onClick={handleDirectConnect}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-800 text-left"
              >
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-white text-sm">Connect to {query}</div>
                  <div className="text-dark-400 text-xs">Direct connection</div>
                </div>
              </button>
            )}

          {filteredHosts.length === 0 && !query ? (
            <div className="p-4 text-center text-dark-400">
              <p>No hosts available</p>
              <p className="text-sm mt-1">
                Add a host first or type a connection string
              </p>
            </div>
          ) : (
            filteredHosts.map((host, index) => (
              <button
                key={host.id}
                type="button"
                onClick={() => handleSelect(host)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left ${
                  index === selectedIndex ? 'bg-dark-800' : 'hover:bg-dark-800'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: host.color || '#64748b' }}
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">{host.name}</div>
                  <div className="text-dark-400 text-xs">
                    {host.username}@{host.address}:{host.port}
                  </div>
                </div>
                {host.tags && host.tags.length > 0 && (
                  <div className="flex gap-1">
                    {host.tags.slice(0, 2).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-dark-700 text-dark-300 text-xs rounded"
                      >
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
        <div className="p-3 border-t border-dark-700 text-dark-500 text-xs flex justify-between">
          <span>↑↓ Navigate • ↵ Connect • Esc Close</span>
          <span>{filteredHosts.length} hosts</span>
        </div>
      </div>
    </Modal>
  )
}
