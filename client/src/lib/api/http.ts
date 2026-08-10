import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const SESSION_REVOKED_EVENT = "http://session-revoked";

/**
 * Frontend facade over the Rust `http_request` command. The webview never
 * holds tokens; Rust attaches the Bearer header and performs single-flight
 * auto-refresh + one retry on 401. Error surface (contract with http.rs):
 * - throws `HttpError(kind: "network")` for offline conditions;
 * - throws `HttpError(kind: "auth_expired")` when the session was revoked
 *   (the `http://session-revoked` event fires alongside).
 */
export class HttpError extends Error {
  constructor(
    public readonly kind: "network" | "auth_expired",
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface HttpResponse {
  status: number;
  body: string;
}

export async function httpRequest(
  method: string,
  path: string,
  body?: unknown,
  opts: { auth?: boolean } = {},
): Promise<HttpResponse> {
  try {
    const res = await invoke<[number, string]>("http_request", {
      method,
      path,
      body: body ?? null,
      auth: opts.auth ?? true,
    });
    return { status: res[0], body: res[1] };
  } catch (raw) {
    const msg = String(raw);
    if (msg.startsWith("network:")) {
      throw new HttpError("network", msg.slice("network:".length));
    }
    throw new HttpError(
      "auth_expired",
      "Your session has expired. Please sign in again.",
    );
  }
}

export function onSessionRevoked(cb: () => void): Promise<() => void> {
  return listen(SESSION_REVOKED_EVENT, cb);
}
