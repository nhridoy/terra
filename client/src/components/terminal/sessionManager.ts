import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { type IPty, spawn } from "tauri-pty";
import { getDefaultShell } from "../../lib/shellDetection";
import { useSettingsStore } from "../../stores/settingsStore";

export interface SessionParams {
  paneId: string;
  tabId: string;
  hostId: string;
  hostName: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  authType?: "password" | "key";
  keyId?: string;
  connectionType?: "ssh" | "local";
  shell?: string;
}

export interface Session {
  params: SessionParams;
  xterm: Terminal;
  pty: IPty;
  fitAddon: FitAddon;
  resizeObserver: ResizeObserver | null;
  resizeTimeout: ReturnType<typeof setTimeout> | null;
  isAttached: boolean;
}

const sessionMap = new Map<string, Session>();

function getTerminalOptions() {
  const { settings } = useSettingsStore.getState();
  return {
    cursorBlink: settings.cursorBlink,
    cursorStyle: settings.cursorStyle as "block" | "underline" | "bar",
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    scrollback: settings.scrollback,
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
    },
  };
}

export function getOrCreateSession(params: SessionParams): Session {
  let session = sessionMap.get(params.paneId);
  if (session) {
    session.params = { ...params };
    return session;
  }

  const opts = getTerminalOptions();
  const term = new Terminal({
    ...opts,
    convertEol: true,
    allowProposedApi: true,
  });

  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  const unicodeAddon = new Unicode11Addon();

  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);
  term.loadAddon(unicodeAddon);
  term.unicode.activeVersion = "11";

  const shell = params.shell ?? getDefaultShell();
  const pty = spawn(shell, [], {
    cols: term.cols,
    rows: term.rows,
    env: {
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
    },
  });

  pty.onData((data) => {
    if (!term.element) return;
    const text =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    term.write(text);
  });

  term.onData((data) => {
    pty.write(data);
  });

  term.onResize(({ cols, rows }) => {
    pty.resize(cols, rows);
  });

  session = {
    params: { ...params },
    xterm: term,
    pty,
    fitAddon,
    resizeObserver: null,
    resizeTimeout: null,
    isAttached: false,
  };

  sessionMap.set(params.paneId, session);
  return session;
}

export function attachSession(session: Session, element: HTMLElement): void {
  if (session.isAttached) return;

  // xterm.open() can only be called once per instance. If already opened
  // (e.g. session was detached then re-attached), just re-parent the existing
  // terminal into the new container — xterm moves the DOM automatically.
  if (!session.xterm.element) {
    session.xterm.open(element);
  }

  // Fit after open so dimensions are available
  requestAnimationFrame(() => {
    session.fitAddon.fit();
  });

  // Set up ResizeObserver for responsive fitting
  session.resizeObserver = new ResizeObserver(() => {
    if (session.resizeTimeout) clearTimeout(session.resizeTimeout);
    session.resizeTimeout = setTimeout(() => {
      session.fitAddon.fit();
    }, 50);
  });
  session.resizeObserver.observe(element);

  session.isAttached = true;
}

export function detachSession(session: Session, _element: HTMLElement): void {
  if (!session.isAttached) return;

  // Cancel any pending resize timeout
  if (session.resizeTimeout) {
    clearTimeout(session.resizeTimeout);
    session.resizeTimeout = null;
  }

  // Disconnect resize observer but keep PTY alive (for background tabs)
  if (session.resizeObserver) {
    session.resizeObserver.disconnect();
    session.resizeObserver = null;
  }

  session.isAttached = false;
}

export function fitSession(paneId: string): void {
  const session = sessionMap.get(paneId);
  if (!session?.isAttached) return;

  requestAnimationFrame(() => {
    session.fitAddon.fit();
  });
}

export function destroySession(paneId: string): void {
  const session = sessionMap.get(paneId);
  if (!session) return;

  if (session.resizeTimeout) clearTimeout(session.resizeTimeout);
  if (session.resizeObserver) session.resizeObserver.disconnect();
  session.pty.kill();
  session.xterm.dispose();
  sessionMap.delete(paneId);
}

export function disconnectAllSessions(): void {
  for (const [, session] of sessionMap) {
    if (session.resizeTimeout) clearTimeout(session.resizeTimeout);
    if (session.resizeObserver) session.resizeObserver.disconnect();
    session.pty.kill();
    session.xterm.dispose();
  }
  sessionMap.clear();
}

export function updateSessionParams(
  paneId: string,
  params: Partial<SessionParams>,
): void {
  const session = sessionMap.get(paneId);
  if (session) {
    session.params = { ...session.params, ...params };
  }
}
