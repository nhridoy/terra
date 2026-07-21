import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal as XTerminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useHostStore } from '../../stores/hostStore'
import { useKeyStore } from '../../stores/keyStore'
import { useTerminalStore } from '../../stores/terminalStore'

export interface SessionParams {
  paneId: string
  tabId: string
  hostId: string
  hostName: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  authType?: 'password' | 'key'
  keyId?: string
  connectionType?: 'ssh' | 'local'
  shell?: string
}

export interface Session {
  params: SessionParams
  xterm: XTerminal
  fitAddon: FitAddon
  container: HTMLDivElement
  opened: boolean
  resizeObserver: ResizeObserver | null
  unlisten: (() => void) | null
  unlistenHostKey: (() => void) | null
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
    opened: false,
    resizeObserver: null,
    unlisten: null,
    unlistenHostKey: null,
  }

  return session
}

async function connectViaTauri(session: Session) {
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')

  const { params, xterm } = session
  const cols = xterm.cols
  const rows = xterm.rows

  xterm.writeln('\x1b[1;36mTermVault\x1b[0m - Self-hosted SSH Client')
  xterm.writeln('')
  xterm.writeln(`\x1b[33mConnecting to ${params.hostName}...\x1b[0m`)
  xterm.writeln('')

  const update = useTerminalStore.getState().updatePaneConnectionStatus
  update(params.tabId, params.paneId, 'connecting')

  try {
    let password: string | null = null
    let privateKey: string | null = null
    let passphrase: string | null = null

    if (params.authType === 'key' && params.keyId) {
      const privKey = await useKeyStore
        .getState()
        .getCredentialsForKey(params.keyId)
      if (privKey) {
        privateKey = privKey
      }
    } else {
      const creds = await useHostStore
        .getState()
        .getCredentialsForHost(params.hostId)
      if (creds.password) {
        password = creds.password
      } else if (creds.privateKey) {
        privateKey = creds.privateKey
        passphrase = creds.passphrase || null
      }
    }

    const config = {
      host: params.hostAddress || '',
      port: params.hostPort || 22,
      username: params.hostUsername || 'root',
      password,
      privateKey,
      passphrase,
    }

    // Set up host key change listener BEFORE connect (in case key changed)
    const unlistenHostKey = await listen<{
      host: string
      port: number
      oldFingerprint: string
      newFingerprint: string
    }>('ssh-host-key-changed', async (event) => {
      const { host, port, oldFingerprint, newFingerprint } = event.payload

      // Show confirmation dialog
      const confirmed = await confirm(
        `SSH Host Key Changed!\n\n` +
          `Host: ${host}:${port}\n\n` +
          `Old fingerprint:\n${oldFingerprint}\n\n` +
          `New fingerprint:\n${newFingerprint}\n\n` +
          `This could indicate a MITM attack. Do you trust this new key?`,
        { title: 'Security Warning', kind: 'warning' },
      )

      // Send response to Rust
      await invoke('accept_host_key', { accepted: confirmed })
    })

    // Store host key listener for cleanup
    session.unlistenHostKey = unlistenHostKey

    await invoke('connect', { sessionId: params.paneId, config })

    // Listen for SSH output events
    const unlisten = await listen<{
      sessionId: string
      type: string
      data: string
    }>('ssh-output', (event) => {
      const { sessionId, type, data } = event.payload
      if (sessionId !== params.paneId) return

      switch (type) {
        case 'connected':
          update(params.tabId, params.paneId, 'connected')
          break
        case 'output':
          xterm.write(data)
          break
        case 'disconnected':
          xterm.writeln(`\r\n\x1b[33mConnection closed\x1b[0m`)
          update(params.tabId, params.paneId, 'disconnected')
          break
        case 'error':
          xterm.writeln(`\r\n\x1b[31mError: ${data}\x1b[0m`)
          update(params.tabId, params.paneId, 'error')
          break
      }
    })

    session.unlisten = unlisten

    // Wire up xterm input → Tauri invoke
    xterm.onData(async (data) => {
      try {
        await invoke('send_input', { sessionId: params.paneId, data })
      } catch {
        // Session may have been closed
      }
    })

    xterm.onResize(async ({ cols: _cols, rows: _rows }) => {
      try {
        await invoke('resize', {
          sessionId: params.paneId,
          cols,
          rows,
        })
      } catch {
        // Session may have been closed
      }
    })
  } catch (err) {
    xterm.writeln(`\r\n\x1b[31mFailed to connect: ${err}\x1b[0m`)
    update(params.tabId, params.paneId, 'error')
  }
}

async function connectLocal(session: Session) {
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')

  const { params, xterm } = session
  const cols = xterm.cols
  const rows = xterm.rows

  xterm.writeln('\x1b[1;36mTermVault\x1b[0m - Local Terminal')
  xterm.writeln('')
  xterm.writeln(`\x1b[33mStarting ${params.shell || 'default shell'}...\x1b[0m`)
  xterm.writeln('')

  const update = useTerminalStore.getState().updatePaneConnectionStatus
  update(params.tabId, params.paneId, 'connecting')

  try {
    await invoke('connect_local', {
      sessionId: params.paneId,
      shell: params.shell || null,
      cols,
      rows,
    })

    // Listen for PTY output events (reuses ssh-output channel)
    const unlisten = await listen<{
      sessionId: string
      type: string
      data: string
    }>('ssh-output', (event) => {
      const { sessionId, type, data } = event.payload
      if (sessionId !== params.paneId) return

      switch (type) {
        case 'connected':
          update(params.tabId, params.paneId, 'connected')
          break
        case 'output':
          xterm.write(data)
          break
        case 'disconnected':
          xterm.writeln(`\r\n\x1b[33mShell exited\x1b[0m`)
          update(params.tabId, params.paneId, 'disconnected')
          break
        case 'error':
          xterm.writeln(`\r\n\x1b[31mError: ${data}\x1b[0m`)
          update(params.tabId, params.paneId, 'error')
          break
      }
    })

    session.unlisten = unlisten

    // Wire up xterm input → Tauri invoke
    xterm.onData(async (data) => {
      try {
        await invoke('send_input_local', { sessionId: params.paneId, data })
      } catch {
        // Session may have been closed
      }
    })

    xterm.onResize(async ({ cols: _cols, rows: _rows }) => {
      try {
        await invoke('resize_local', {
          sessionId: params.paneId,
          cols,
          rows,
        })
      } catch {
        // Session may have been closed
      }
    })
  } catch (err) {
    xterm.writeln(`\r\n\x1b[31mFailed to start shell: ${err}\x1b[0m`)
    update(params.tabId, params.paneId, 'error')
  }
}

// Open the xterm instance into its persistent container (first time only),
// establish the Tauri connection, and mount the persistent container into the
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
    if (session.params.connectionType === 'local') {
      connectLocal(session)
    } else {
      connectViaTauri(session)
    }
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

export async function destroySession(paneId: string) {
  const session = sessions.get(paneId)
  if (!session) return
  session.resizeObserver?.disconnect()

  // Unlisten from events
  session.unlisten?.()
  session.unlistenHostKey?.()

  // Disconnect from Rust backend
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    if (session.params.connectionType === 'local') {
      await invoke('disconnect_local', { sessionId: paneId })
    } else {
      await invoke('disconnect', { sessionId: paneId })
    }
  } catch {
    // Ignore — session may already be closed
  }

  session.xterm.dispose()
  sessions.delete(paneId)
}
