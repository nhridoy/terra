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
}

const sessionMap = new Map<string, Session>();

export function getOrCreateSession(params: SessionParams): Session {
  let session = sessionMap.get(params.paneId);
  if (!session) {
    session = { params: { ...params } };
    sessionMap.set(params.paneId, session);
  }
  return session;
}

export function attachSession(_session: Session, _element: HTMLElement): void {}

export function detachSession(_session: Session, _element: HTMLElement): void {}

export function fitSession(_paneId: string): void {}

export function destroySession(paneId: string): void {
  sessionMap.delete(paneId);
}

export async function createTerminalSession(
  params: SessionParams,
  _onData: (data: string) => void,
  _onExit: (code: number) => void,
): Promise<Session> {
  return getOrCreateSession(params);
}

export async function closeTerminalSession(_paneId: string): Promise<void> {}

export async function disconnectAllSessions(): Promise<void> {}
