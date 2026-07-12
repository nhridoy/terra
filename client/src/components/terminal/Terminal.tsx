import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal as XTerminal } from '@xterm/xterm'
import { useCallback, useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'

interface TerminalProps {
  hostId: string
  hostName: string
  tabId: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  isActive?: boolean
}

export default function Terminal({ hostId, hostName, tabId, hostAddress, hostPort, hostUsername, isActive }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const updateTabConnectionStatus = useTerminalStore((s) => s.updateTabConnectionStatus)

  // Standard fit (floor rows) — safe to call from ResizeObserver / window resize.
  const fitTerminal = useCallback(() => {
    const fitAddon = fitAddonRef.current
    const terminal = xtermRef.current
    const el = terminalRef.current
    if (!fitAddon || !terminal || !el) return
    fitAddon.fit()
  }, [])

  // Re-fit only. The sub-cell bottom remainder is handled in CSS (.xterm fills
  // 100% height, viewport transparent) so there is no visible gap and the
  // cursor is never clipped — without drifting the font size.
  const fitAndFill = useCallback(() => {
    fitTerminal()
  }, [fitTerminal])

  useEffect(() => {
    if (!terminalRef.current) return

    const terminal = new XTerminal({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#e2e8f0',
        cursorAccent: '#0f172a',
        selectionBackground: 'rgba(14, 165, 233, 0.3)',
        black: '#0f172a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
    })

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())

    terminal.open(terminalRef.current)
    fitAndFill()

    const cols = terminal.cols
    const rows = terminal.rows

    // Welcome message
    terminal.writeln('\x1b[1;36mTermVault\x1b[0m - Self-hosted SSH Client')
    terminal.writeln('')
    terminal.writeln(`\x1b[33mConnecting to ${hostName}...\x1b[0m`)
    terminal.writeln('')
    updateTabConnectionStatus(tabId, 'connecting')

    // Establish WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    let wsUrl = `${protocol}://localhost:8080/ws/ssh?hostId=${hostId}&cols=${cols}&rows=${rows}`
    if (hostAddress) {
      wsUrl += `&host=${encodeURIComponent(hostAddress)}&port=${hostPort || 22}&username=${encodeURIComponent(hostUsername || 'root')}`
    }
    const socket = new WebSocket(wsUrl)
    wsRef.current = socket

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'connected') {
          updateTabConnectionStatus(tabId, 'connected')
        } else if (msg.type === 'output') {
          terminal.write(msg.payload)
        } else if (msg.type === 'disconnected') {
          terminal.writeln(`\r\n\x1b[31mDisconnected: ${msg.payload}\x1b[0m`)
          updateTabConnectionStatus(tabId, 'disconnected')
        } else if (msg.type === 'error') {
          terminal.writeln(`\r\n\x1b[31mError: ${msg.payload}\x1b[0m`)
          updateTabConnectionStatus(tabId, 'error')
        }
      } catch {
        terminal.write(event.data)
      }
    }

    socket.onerror = () => {
      terminal.writeln(`\r\n\x1b[31mFailed to connect to SSH server\x1b[0m`)
      updateTabConnectionStatus(tabId, 'error')
    }

    socket.onclose = () => {
      terminal.writeln(`\r\n\x1b[33mConnection closed\x1b[0m`)
      updateTabConnectionStatus(tabId, 'disconnected')
    }

    // Handle input
    terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', payload: data }))
      }
    })

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', payload: { cols, rows } }))
      }
    })

    xtermRef.current = terminal

    const handleWindowResize = () => {
      fitAndFill()
    }
    window.addEventListener('resize', handleWindowResize)

    const resizeObserver = new ResizeObserver(() => fitTerminal())
    if (terminalRef.current) resizeObserver.observe(terminalRef.current)

    return () => {
      window.removeEventListener('resize', handleWindowResize)
      resizeObserver.disconnect()
      socket.close()
      terminal.dispose()
      updateTabConnectionStatus(tabId, 'disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, hostName, hostAddress, hostPort, hostUsername, tabId])

  // Re-fit terminal when tab becomes active (e.g. switching back from another tab)
  useEffect(() => {
    if (isActive) {
      // Small delay to ensure container dimensions are settled
      const timer = setTimeout(() => {
        fitAndFill()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isActive, fitAndFill])

  return (
    <div
      ref={terminalRef}
      className="w-full h-full"
    />
  )
}
