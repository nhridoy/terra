import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal as XTerminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'

export interface SessionParams {
  paneId: string
  tabId: string
  hostId: string
  hostName: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
}

export interface Session {
  params: SessionParams
  xterm: XTerminal
  fitAddon: FitAddon
  container: HTMLDivElement
  ws: WebSocket | null
  opened: boolean
  resizeObserver: ResizeObserver | null
}

const sessions = new Map<string, Session>()

function createSession(params: SessionParams): Session {
  const container = document.createElement('div')
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.display = 'block'

  const xterm = new XTerminal({
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
  xterm.loadAddon(fitAddon)
  xterm.loadAddon(new WebLinksAddon())

  const session: Session = {
    params,
    xterm,
    fitAddon,
    container,
    ws: null,
    opened: false,
    resizeObserver: null,
  }

  xterm.onData((data) => {
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: 'input', payload: data }))
    }
  })

  xterm.onResize(({ cols, rows }) => {
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: 'resize', payload: { cols, rows } }))
    }
  })

  return session
}

function connectWs(session: Session) {
  const { params, xterm } = session
  const cols = xterm.cols
  const rows = xterm.rows

  xterm.writeln('\x1b[1;36mTermVault\x1b[0m - Self-hosted SSH Client')
  xterm.writeln('')
  xterm.writeln(`\x1b[33mConnecting to ${params.hostName}...\x1b[0m`)
  xterm.writeln('')

  const update = useTerminalStore.getState().updatePaneConnectionStatus
  update(params.tabId, params.paneId, 'connecting')

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  let wsUrl = `${protocol}://localhost:8080/ws/ssh?hostId=${params.hostId}&cols=${cols}&rows=${rows}`
  if (params.hostAddress) {
    wsUrl += `&host=${encodeURIComponent(params.hostAddress)}&port=${params.hostPort || 22}&username=${encodeURIComponent(params.hostUsername || 'root')}`
  }

  const socket = new WebSocket(wsUrl)
  session.ws = socket

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'connected') {
        update(session.params.tabId, session.params.paneId, 'connected')
      } else if (msg.type === 'output') {
        xterm.write(msg.payload)
      } else if (msg.type === 'disconnected') {
        xterm.writeln(`\r\n\x1b[31mDisconnected: ${msg.payload}\x1b[0m`)
        update(session.params.tabId, session.params.paneId, 'disconnected')
      } else if (msg.type === 'error') {
        xterm.writeln(`\r\n\x1b[31mError: ${msg.payload}\x1b[0m`)
        update(session.params.tabId, session.params.paneId, 'error')
      }
    } catch {
      xterm.write(event.data)
    }
  }

  socket.onerror = () => {
    xterm.writeln(`\r\n\x1b[31mFailed to connect to SSH server\x1b[0m`)
    update(session.params.tabId, session.params.paneId, 'error')
  }

  socket.onclose = () => {
    xterm.writeln(`\r\n\x1b[33mConnection closed\x1b[0m`)
    update(session.params.tabId, session.params.paneId, 'disconnected')
  }
}

// Open the xterm instance into its persistent container (first time only),
// establish the WebSocket, and mount the persistent container into the
// React-provided element. Because the container is moved (not recreated),
// the session survives React unmount/remount across tab moves.
export function attachSession(session: Session, reactEl: HTMLElement) {
  reactEl.appendChild(session.container)
  if (!session.opened) {
    session.xterm.open(session.container)
    session.opened = true
    try {
      session.fitAddon.fit()
    } catch {
      /* container may not be sized yet */
    }
    connectWs(session)
  }

  const ro = new ResizeObserver(() => {
    try {
      session.fitAddon.fit()
    } catch {
      /* not yet sized */
    }
  })
  ro.observe(session.container)
  session.resizeObserver = ro
}

export function detachSession(session: Session, reactEl: HTMLElement) {
  session.resizeObserver?.disconnect()
  session.resizeObserver = null
  if (reactEl.contains(session.container)) {
    reactEl.removeChild(session.container)
  }
}

export function getOrCreateSession(params: SessionParams): Session {
  const existing = sessions.get(params.paneId)
  if (existing) {
    // Pane moved to another tab — just repoint status updates.
    existing.params.tabId = params.tabId
    return existing
  }
  const session = createSession(params)
  sessions.set(params.paneId, session)
  return session
}

export function fitSession(paneId: string) {
  const session = sessions.get(paneId)
  if (!session) return
  try {
    session.fitAddon.fit()
  } catch {
    /* not yet sized */
  }
}

export function destroySession(paneId: string) {
  const session = sessions.get(paneId)
  if (!session) return
  session.resizeObserver?.disconnect()
  try {
    session.ws?.close()
  } catch {
    /* ignore */
  }
  session.xterm.dispose()
  sessions.delete(paneId)
}
