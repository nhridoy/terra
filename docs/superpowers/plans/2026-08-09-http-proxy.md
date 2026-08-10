# Plan #1 — Rust HTTP Proxy + TS Facade + Token Custody (Offline-First Phase 1)

Spec: `docs/superpowers/specs/2026-08-09-offline-first-design.md` (phases 1–5 of §9 rollout: current plan covers **phase 1 only**; phases 2–5 get their own plans, listed at the end).

## Goal

All frontend HTTP goes through a single Tauri command `http_request` in Rust. The access token lives only in Rust memory; the refresh token is read/written by Rust through `tauri-plugin-keyring-store` (verified Rust API: `KeyringExt::keyring().store.get_password / set_password`, same raw account `auth.refresh_token` the JS side already uses — same `KeyringStore`, identical prefixing).

- Refresh happens inside Rust: single-flight, retry-once on 401, rotated refresh token persisted to the OS keychain immediately (server reuse-detection would otherwise revoke the stored copy and log the user out — current AGENTS.md invariant moves from JS to Rust).
- Offline (connection refused / DNS / timeout) → classified once in Rust as `NETWORK_ERROR` with the standard friendly message.
- Refresh revoked (retry still 401) → emit `http://session-revoked` event + return 401; the webview shows the login screen (existing `SessionRevokedHandler` flow re-hooked).
- The webview gets a thin facade `lib/api/http.ts`; `lib/api/auth.ts` `apiFetch` stops doing `fetch` + JS refresh entirely.
- Structured request log kept in Rust (`get_request_log` command) — debug surface for offline/sync work in later phases.

Explicitly **out of scope**: local database, outbox, `/sync/*` endpoints, sync engine, offline UI, history table (phases 2–5, separate plans).

## Design decisions (from brainstorm — clamped for this plan)

- Tokens: Rust owns access token (memory) + refresh token (OS keychain writes for **rotations**; restore-on-launch reads stay with existing JS `loadRefreshToken` during this phase — custody of *persistent storage* is what matters; pending cleanup note for phase 2 to delete the JS keychain read path).
- JSON contract for refresh (verified in `server/internal/auth/handlers.go:396-397` and `client/src/lib/api/auth.ts:114-115`): request `POST /api/v1/auth/refresh` body `{"refresh_token": string}` → response envelope `{ data: { access_token, refresh_token } }` (server wraps payloads in `data`).
- Single-flight: `AtomicBool` gate; concurrent callers spin-wait up to 8s (50ms steps) for the in-flight refresh, then re-read the token and retry once.
- No new npm/Go dependencies. One new Rust dependency: `reqwest` (rustls). No external test servers: tests use an in-process `std::net::TcpListener` mock HTTP server.
- Events follow the app's existing `http://...` namespace convention (see `oauth.rs` events).

## Task classes

- **T-scale coding task tracked by todos**: each has tests + verification gate.
- Commits: **none during this plan** (user has not yet tested the pending fix batch; commit only after explicit request).

## File structure

```
client/src-tauri/
  Cargo.toml                     # + reqwest
  src/http.rs                    # NEW (this plan's core)
  src/lib.rs                     # manage HttpState, register 4 commands, existing keyring plugin untouched
  src/main.rs                    # untouched
client/src/
  lib/api/http.ts                # NEW facade (httpRequest, HttpError, onSessionRevoked)
  lib/api/http.test.ts           # NEW tests
  lib/api/auth.ts                # apiFetch rewritten to facade; refresh path removed
  lib/api/auth.test.ts           # NEW tests for apiFetch error mapping
  lib/oauth/oauth.ts             # startOAuthFlow: exchange via facade + set_auth_tokens
  stores/auth/authStore.ts       # startUp: set_base_url + set_auth_tokens; login/register/verify/oAuth set_auth_tokens
  stores/auth/authStore.test.ts  # unchanged mocks keep passing (mocks api/auth wholesale)
  lib/crypto/crypto.ts           # untouched (saveRefreshToken stays for phase-2 cleanup)
```

## Tasks

### T0 — Rename stale Go test (hygiene, 2 min)

`server/internal/auth/handlers_test.go`: `TestRegister_VerifiedUser_ReturnsTokens` now asserts a 409 (fix batch) but keeps its old name. Rename to `TestRegister_VerifiedUser_RejectsDuplicate` and assert the duplicate user's 409 + `EMAIL_ALREADY_REGISTERED` code.

Verify: `cd server && go vet ./... && go test ./internal/auth/`.

### T1 — Add reqwest

`client/src-tauri/Cargo.toml`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

Verify: `cd client/src-tauri && cargo check`.

### T2 — `http.rs`: HttpClient core + refresh single-flight (TDD)

Design for testability: everything testable depends on a `RefreshProvider` trait (production impl wraps the keyring plugin; tests use in-memory). The command layer (T4) stays thin.

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tauri::Emitter;
use tauri_plugin_keyring_store::KeyringExt;

pub const DEFAULT_BASE_URL: &str = "http://localhost:8080";
pub const REFRESH_TOKEN_ACCOUNT: &str = "auth.refresh_token";
pub const SESSION_REVOKED_EVENT: &str = "http://session-revoked";
pub const NETWORK_ERROR_MESSAGE: &str =
    "Cannot reach the server. Check that it is running and your connection is online.";
const REFRESH_WAIT_MS: u64 = 50;
const REFRESH_WAIT_MAX_STEPS: u32 = 160;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct RequestLogEntry {
    pub at: u64,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct HttpState {
    pub access_token: Mutex<Option<String>>,
    pub base_url: Mutex<String>,
    pub refreshing: AtomicBool,
    pub request_log: Mutex<Vec<RequestLogEntry>>,
}

impl HttpState {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url: Mutex::new(base_url),
            ..Default::default()
        }
    }
    pub fn token(&self) -> Option<String> {
        self.access_token.lock().unwrap().clone()
    }
    pub fn set_token(&self, token: Option<String>) {
        *self.access_token.lock().unwrap() = token;
    }
    pub fn base_url(&self) -> String {
        self.base_url.lock().unwrap().clone()
    }
    pub fn set_base_url(&self, url: String) {
        *self.base_url.lock().unwrap() = url;
    }
    pub fn is_refreshing(&self) -> bool {
        self.refreshing.load(Ordering::SeqCst)
    }
    pub fn begin_refresh(&self) -> bool {
        self.refreshing.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok()
    }
    pub fn end_refresh(&self) {
        self.refreshing.store(false, Ordering::SeqCst);
    }
    pub fn push_log(&self, entry: RequestLogEntry) {
        let mut log = self.request_log.lock().unwrap();
        log.push(entry);
        while log.len() > 50 {
            log.remove(0);
        }
    }
}

pub trait RefreshProvider: Send + Sync {
    fn get_refresh_token(&self) -> Option<String>;
    fn persist_rotated_token(&self, token: &str);
    fn clear(&self);
}

pub struct KeyringRefreshProvider;

impl RefreshProvider for KeyringRefreshProvider {
    fn get_refresh_token(&self) -> Option<String> {
        // "never commit keys" does not apply here: this reads the OS keychain.
        // Errors are swallowed deliberately: no refresh token == anonymous request.
        tauri_plugin_keyring_store::KeyringExt::keyring() // placeholder shape — real impl resolves the
        // managed KeyringPlugin via app handle passed at construction (see T4); returns None on error.
        }
    fn persist_rotated_token(&self, _token: &str) {}
    fn clear(&self) {}
}

#[derive(Debug, PartialEq)]
pub enum HttpErrorKind {
    Network,
    SessionExpired,
    /// 4xx/5xx — carries the server body so 409/400 error envelopes reach the forms.
    Http(u16, String),
}

pub struct HttpClient {
    state: Arc<HttpState>,
    refresh: Arc<dyn RefreshProvider>,
    client: reqwest::Client,
}

pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

impl HttpClient {
    pub fn new(state: Arc<HttpState>, refresh: Arc<dyn RefreshProvider>) -> Self {
        Self {
            state,
            refresh,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("reqwest client builds in tests"),
        }
    }

    pub async fn request(
        &self,
        method: &str,
        path: &str,
        body: Option<Value>,
        auth: bool,
    ) -> Result<HttpResponse, HttpErrorKind> {
        let url = format!("{}/{}", self.state.base_url().trim_end_matches('/'), path.trim_start_matches('/'));
        let mut builder = self.client.request(reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET), &url);
        if let Some(b) = body {
            builder = builder.json(&b);
        }
        if auth {
            if let Some(token) = self.state.token() {
                builder = builder.bearer_auth(token);
            }
        }

        let first = self.send(builder).await?;
        let mut status = first.status;
        let mut text = first.text;

        if auth && status == 401 {
            match self.refresh_once().await {
                RefreshOutcome::Ok => {
                    if let Some(token) = self.state.token() {
                        let mut retry = self.client.request(reqwest::Method::from_bytes(method.as_bytes()).unwrap(), &url);
                        if let Some(b) = body {
                            retry = retry.json(&b);
                        }
                        retry = retry.bearer_auth(token);
                        let second = self.send(retry).await?;
                        status = second.status;
                        text = second.text;
                    }
                }
                RefreshOutcome::Revoked | RefreshOutcome::Failed => {
                    let _ = self.state.push_log(RequestLogEntry {
                        at: now_ms(),
                        method: method.to_string(),
                        path: path.to_string(),
                        status,
                        error: Some("session revoked".into()),
                    });
                    return Err(HttpErrorKind::SessionExpired);
                }
            }
        }

        if status == 401 && auth {
            // retry still returned 401
            let _ = self.state.push_log(RequestLogEntry {
                at: now_ms(),
                method: method.to_string(),
                path: path.to_string(),
                status,
                error: Some("session revoked".into()),
            });
            return Err(HttpErrorKind::SessionExpired);
        }

        self.state.push_log(RequestLogEntry {
            at: now_ms(),
            method: method.to_string(),
            path: path.to_string(),
            status,
            error: None,
        });
        if status >= 400 {
            Err(HttpErrorKind::Http(status, text))
        } else {
            Ok(HttpResponse { status, body: text })
        }
    }

    async fn send(&self, builder: reqwest::RequestBuilder) -> Result<(u16, String), HttpErrorKind> {
        let res = builder.send().await.map_err(|e| {
            if e.is_timeout() || e.is_connect() {
                HttpErrorKind::Network
            } else {
                HttpErrorKind::Network
            }
        })?;
        let status = res.status().as_u16();
        let text = res.text().await.unwrap_or_default();
        Ok((status, text))
    }

    async fn refresh_once(&self) -> RefreshOutcome {
        if !self.state.begin_refresh() {
            // another caller is refreshing; wait for it, then reuse the new token
            for _ in 0..REFRESH_WAIT_MAX_STEPS {
                if !self.state.is_refreshing() {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(REFRESH_WAIT_MS)).await;
            }
            return if self.state.token().is_some() { RefreshOutcome::Ok } else { RefreshOutcome::Failed };
        }

        let outcome = self.do_refresh().await;
        self.state.end_refresh();
        outcome
    }

    async fn do_refresh(&self) -> RefreshOutcome {
        let Some(refresh_token) = self.refresh.get_refresh_token() else {
            return RefreshOutcome::Failed;
        };
        let url = format!("{}/api/v1/auth/refresh", self.state.base_url().trim_end_matches('/'));
        let res = match self
            .client
            .post(&url)
            .json(&json!({ "refresh_token": refresh_token }))
            .send().await
        {
            Ok(r) => r,
            Err(_) => return RefreshOutcome::Failed,
        };
        let status = res.status().as_u16();
        let text = res.text().await.unwrap_or_default();
        if status == 401 {
            self.refresh.clear();
            self.state.set_token(None);
            return RefreshOutcome::Revoked;
        }
        if status != 200 {
            return RefreshOutcome::Failed;
        }
        let data = match serde_json::from_str::<Value>(&text) {
            Ok(v) => v.get("data").cloned().unwrap_or(v),
            Err(_) => return RefreshOutcome::Failed,
        };
        let Some(new_access) = data.get("access_token").and_then(Value::as_str) else {
            return RefreshOutcome::Failed;
        };
        if let Some(new_refresh) = data.get("refresh_token").and_then(Value::as_str) {
            // persist NOW: server reuse-detection would revoke the stored copy
            self.refresh.persist_rotated_token(new_refresh);
        }
        self.state.set_token(Some(new_access.to_string()));
        RefreshOutcome::Ok
    }
}

#[derive(PartialEq)]
enum RefreshOutcome { Ok, Revoked, Failed }

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
```

Note: `KeyringRefreshProvider` placeholder shape above is intentional in the plan — T4 implements it for real against `app.keyring().store` (the plugin's `KeyringExt` trait, verified at `plugin.rs:3`); `HttpClient` stays trait-based so unit tests never touch the OS keychain.

Command contract (the facade consumes this shape, T5): `Ok((status, body))` for **any** HTTP response including 4xx (body carries the server error envelope for forms); `Err("network:...")` offline; `Err("auth:...")` revoked — with `http://session-revoked` emitted as a side effect.

Test utility (same file, `#[cfg(test)]`):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    struct MemoryRefresh {
        token: std::sync::Mutex<Option<String>>,
        persisted: std::sync::Mutex<Vec<String>>,
        refresh_calls: std::sync::atomic::AtomicUsize,
    }

    impl RefreshProvider for MemoryRefresh {
        fn get_refresh_token(&self) -> Option<String> { self.token.lock().unwrap().clone() }
        fn persist_rotated_token(&self, t: &str) { self.persisted.lock().unwrap().push(t.to_string()); }
        fn clear(&self) { *self.token.lock().unwrap() = None; }
    }

    // Minimal one-shot mock server: returns `status/body` for every request, optionally
    // counting hits on a path. Runs on a real OS thread; URL comes from the bound addr.
    fn spawn_mock(
        status: u16,
        body: &'static str,
        count_on: Option<&'static str>,
    ) -> (String, Arc<std::sync::atomic::AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let hits = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let hits2 = hits.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { break };
                let mut buf = [0u8; 4096];
                let n = s.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let path = req.lines().next().unwrap_or("").split(' ').nth(1).unwrap_or("").to_string();
                if let Some(c) = count_on {
                    if path.starts_with(c) { hits2.fetch_add(1, std::sync::atomic::Ordering::SeqCst); }
                }
                let resp = format!(
                    "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = s.write_all(resp.as_bytes());
                let _ = s.flush();
            }
        });
        (format!("http://{addr}"), hits)
    }

    #[tokio::test]
    async fn test_http_request_basic_get() {
        let (url, _) = spawn_mock(200, r#"{"ok":true}"#, None);
        let state = Arc::new(HttpState::new(url));
        let client = HttpClient::new(state, Arc::new(MemoryRefresh { token: Mutex::new(None), persisted: Mutex::new(vec![]), refresh_calls: Default::default() }));
        let res = client.request("GET", "/api/v1/ping", None, false).await.unwrap();
        assert_eq!(res.status, 200);
        assert!(res.body.contains("ok"));
    }

    #[tokio::test]
    async fn test_refresh_occurs_once_on_401_and_retries() {
        let (url, _) = spawn_mock(200, r#"{"data":{"access_token":"a2","refresh_token":"r2"}}"#, Some("/api/v1/auth/refresh"));
        let state = Arc::new(HttpState::new(url));
        state.set_token(Some("a1".into()));
        let refresh = Arc::new(MemoryRefresh { token: Mutex::new(Some("r1".into())), persisted: Mutex::new(vec![]), refresh_calls: Default::default() });
        let client = HttpClient::new(state, refresh.clone());
        let res = client.request("GET", "/api/v1/a", None, true).await.unwrap();
        assert_eq!(res.status, 200);
        assert_eq!(*refresh.persisted.lock().unwrap(), vec!["r2".to_string()]);
    }

    #[tokio::test]
    async fn test_single_flight_concurrent_401s() {
        // /api/v1/auth/refresh returns 401 for the first call, then rotates:
        // use a mock that fails once; assert refresh endpoint hit count == 1.
        let (url, hits) = spawn_mock(401, r#"{"data":{"access_token":"a2","refresh_token":"r2"}}"#, Some("/api/v1/auth/refresh"));
        let state = Arc::new(HttpState::new(url));
        state.set_token(Some("a1".into()));
        let refresh = Arc::new(MemoryRefresh { token: Mutex::new(Some("r1".into())), persisted: Mutex::new(vec![]), refresh_calls: Default::default() });
        let client = Arc::new(HttpClient::new(state, refresh));
        let c1 = client.clone();
        let c2 = client.clone();
        let (r1, r2) = tokio::join!(
            c1.request("GET", "/api/v1/a", None, true),
            c2.request("GET", "/api/v1/b", None, true)
        );
        assert!(r1.is_err()); // retry also 401s against failing mock — but refresh ran ONCE
        assert!(r2.is_err());
        assert_eq!(hits.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn test_revoked_refresh_returns_session_expired() {
        let (url, _) = spawn_mock(401, r#"{}"#, None);
        let state = Arc::new(HttpState::new(url));
        state.set_token(Some("a1".into()));
        let refresh = Arc::new(MemoryRefresh { token: Mutex::new(Some("r1".into())), persisted: Mutex::new(vec![]), refresh_calls: Default::default() });
        let client = HttpClient::new(state, refresh.clone());
        let err = client.request("GET", "/api/v1/a", None, true).await.unwrap_err();
        assert_eq!(err, HttpErrorKind::SessionExpired);
        assert!(refresh.get_refresh_token().is_none()); // cleared
    }

    #[tokio::test]
    async fn test_network_error_classification() {
        let state = Arc::new(HttpState::new("http://127.0.0.1:1".into())); // closed port
        let client = HttpClient::new(state, Arc::new(MemoryRefresh { token: Mutex::new(None), persisted: Mutex::new(vec![]), refresh_calls: Default::default() }));
        let err = client.request("GET", "/api/v1/ping", None, false).await.unwrap_err();
        assert_eq!(err, HttpErrorKind::Network);
    }

    #[tokio::test]
    async fn test_http_4xx_is_http_error() {
        let (url, _) = spawn_mock(409, r#"{"error":"EMAIL_ALREADY_REGISTERED"}"#, None);
        let state = Arc::new(HttpState::new(url));
        let client = HttpClient::new(state, Arc::new(MemoryRefresh { token: Mutex::new(None), persisted: Mutex::new(vec![]), refresh_calls: Default::default() }));
        let err = client.request("POST", "/api/v1/auth/register", Some(json!({})), false).await.unwrap_err();
        assert_eq!(err, HttpErrorKind::Http(409, r#"{"error":"EMAIL_ALREADY_REGISTERED"}"#.to_string()));
    }
}
```

Verify: `cd client/src-tauri && cargo test http::` and `cargo test` (all suites, ~25-90s).

### T3 — `http.rs`: `KeyringRefreshProvider` against the real plugin

The plugin registers managed state `KeyringPlugin` (plugin.rs) with `store: Arc<KeyringStore>`; accession via `tauri_plugin_keyring_store::KeyringExt::keyring()` on any `Manager` (`store.rs` exposes sync `get_password(account)`, `set_password(account, password)`, `delete(account)`; raw account `auth.refresh_token` is joined identically for JS and Rust — same store instance).

```rust
pub struct KeyringRefreshProvider {
    app: AppHandle,
}

impl RefreshProvider for KeyringRefreshProvider {
    fn get_refresh_token(&self) -> Option<String> {
        self.app.keyring().store.get_password(REFRESH_TOKEN_ACCOUNT).ok().flatten()
    }
    fn persist_rotated_token(&self, token: &str) {
        let _ = self.app.keyring().store.set_password(REFRESH_TOKEN_ACCOUNT, token);
    }
    fn clear(&self) {
        let _ = self.app.keyring().store.delete(REFRESH_TOKEN_ACCOUNT);
    }
}
```

Verify: `cargo check` (keyring methods resolve; mismatch → step back and adjust to the exact re-export, e.g. `use tauri_plugin_keyring_store::KeyringExt`).

### T4 — Wire commands in `lib.rs`

1. `HttpState` managed in `Builder::default()` setup (next to `CryptoState`): `.manage(HttpState::new(cfg.base_url()))` — resolve persisted API URL from the `auth.json` store file first (read via the existing store path used by startUp; fall back to `DEFAULT_BASE_URL`).
2. `invoke_handler` gains:

```rust
#[tauri::command]
pub async fn http_request(
    app: AppHandle,
    state: tauri::State<'_, HttpState>,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
    auth: Option<bool>,
) -> Result<(u16, String), String> {
    let client = HttpClient::new(
        Arc::new(state.inner().clone()),
        Arc::new(KeyringRefreshProvider { app: app.clone() }),
    );
    match client.request(&method, &path, body, auth.unwrap_or(true)).await {
        Ok(HttpResponse { status, body }) => Ok((status, body)),
        Err(HttpErrorKind::Network) => Err(format!("network:{NETWORK_ERROR_MESSAGE}")),
        Err(HttpErrorKind::SessionExpired) => {
            let _ = app.emit(SESSION_REVOKED_EVENT, ());
            Err("auth:session-expired. Please sign in again.".to_string())
        }
        // pass the server error body through; the facade turns 4xx into errors for the forms
        Err(HttpErrorKind::Http(status, body)) => Ok((status, body)),
    }
}
```

3. More commands:

```rust
#[tauri::command]
pub fn set_auth_tokens(
    app: AppHandle,
    state: tauri::State<'_, HttpState>,
    access_token: String,
    refresh_token: Option<String>,
) -> Result<(), String> {
    state.set_token(Some(access_token));
    if let Some(rt) = refresh_token {
        KeyringRefreshProvider { app }.persist_rotated_token(&rt);
    }
    Ok(())
}

#[tauri::command]
pub fn clear_auth_tokens(state: tauri::State<'_, HttpState>) -> Result<(), String> {
    state.set_token(None);
    Ok(())
}

#[tauri::command]
pub fn set_base_url(state: tauri::State<'_, HttpState>, url: String) -> Result<(), String> {
    state.set_base_url(url);
    Ok(())
}

#[tauri::command]
pub fn get_request_log(state: tauri::State<'_, HttpState>) -> Result<Vec<RequestLogEntry>, String> {
    Ok(state.request_log.lock().unwrap().clone())
}
```

Register all four in `invoke_handler`. (`set_auth_tokens` refresh write-through goes through `KeyringRefreshProvider`, reusing T3.)

Verify: `cargo check`; then `cd client && pnpm tauri dev` smoke: login against dev server — access token set (assert log entry), request log populates (devtools → invoke `get_request_log`).

### T5 — TS facade `lib/api/http.ts` (TDD)

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const SESSION_REVOKED_EVENT = "http://session-revoked";

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
    throw new HttpError("auth_expired", "Your session has expired. Please sign in again.");
  }
}

export function onSessionRevoked(cb: () => void): Promise<() => void> {
  return listen(SESSION_REVOKED_EVENT, cb);
}
```

`http.test.ts` (mock `invoke` + `listen` from `@tauri-apps/api/core` / `.../event` via `vi.mock`):

1. `test_httpRequest_returns_wrapped_response` — invoke resolves `[200, "{...}"]` → `{ status: 200, body: "{...}" }`; assert invoke args (`auth: true`, path passthrough).
2. `test_httpRequest_network_error_maps` — invoke rejects `"network:Cannot reach..."` → `HttpError` kind `"network"` with that message.
3. `test_httpRequest_other_rejections_map_to_auth_expired` — invoke rejects `"auth:..."` → kind `"auth_expired"`.
4. `test_onSessionRevoked_wires_listener` — `listen` called with `SESSION_REVOKED_EVENT`; returned unlisten invoked.

Verify: `cd client && pnpm vitest run src/lib/api/http.test.ts`.

### T6 — Rewire `lib/api/auth.ts` (TDD)

Replace `apiFetch`'s body with facade calls; delete the JS refresh/retry block entirely (`api/auth.ts:101-135`). Keep the exported `AuthApiError` shape the stores rely on:

```ts
import { httpRequest, HttpError } from "./http";

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await httpRequest(method, path, body);
  if (res.status >= 400) {
    const data = safeJson(res.body) as Record<string, unknown> | null;
    throw new AuthApiError(
      res.status,
      (data?.["code"] as string) ?? `HTTP_${res.status}`,
      (data?.["message"] as string) ?? res.body,
    );
  }
  if (res.status === 204) return undefined as T;
  const data = safeJson(res.body) as { data?: T } | null;
  return (data?.data ?? data) as T;
}
```

`safeJson` = existing `tryParseJson` renamed/kept. Keep `AuthApiError` unchanged (status/code/message). `authApi.refresh` keeps its signature (callers unchanged) — it now just hits the facade (Rust performs no refresh inside it, since `auth: false`; keep `{ auth: false }` so it never loops on the refresh endpoint itself).

`auth.test.ts` (new; mock `./http`):

1. `test_apiFetch_returns_wrapped_data` — facade 200 + `{"data": {...}}` → returns inner object.
2. `test_apiFetch_maps_4xx_to_AuthApiError` — facade 409 + error envelope → `AuthApiError(409, "EMAIL_ALREADY_REGISTERED", msg)`.
3. `test_apiFetch_network_error_surfaces_AuthApiError` — HttpError(network) → `AuthApiError(0, "NETWORK_ERROR", std message)`.
4. `test_apiFetch_uses_auth_false_for_refresh_endpoint` — `authApi.refresh` calls facade with `{ auth: false }`.

Verify: `pnpm vitest run src/lib/api` and `pnpm biome check src/lib/api/http.ts src/lib/api/http.test.ts src/lib/api/auth.ts src/lib/api/auth.test.ts`.

### T7 — Startup: base URL + token handoff (TDD)

`stores/auth/authStore.ts` `startUp`:

- after restoring `apiUrl` from `auth.json` (existing logic), call `invoke("set_base_url", { url: apiUrl })` — add to the mock set in `authStore.test.ts`.
- after `loadRefreshToken` succeeds AND a `me()` probe succeeds (existing flow), the access token is still not in Rust — add `invoke("set_auth_tokens", { accessToken: profileJwt?...})`. Phase 1 compromise: the probe response (`me`) does not carry a token, so instead leave access token empty until the first interactive auth; the facade refresh path never runs with `auth: true` on anonymous probes. Simplest correct wiring: any apiFetch call with `auth: true` before login returns NETWORK_ERROR/SESSION_EXPIRED only after a refresh attempt; since `me()` is called with auth, give it `auth: false` in startUp until the app has real tokens. Document this in code, cleanup in phase 2.

Corrections fold into existing tests: `authStore.test.ts` mock add `setBaseUrl`? — no: if we call `invoke` directly the store is untestable; route through `crypto.ts`: add `export async function setBaseUrl(url: string)` (wraps invoke) and `export async function setAuthTokens(access: string, refresh?: string)`; **mock these in tests**; startUp calls them. crypto.test.ts gains:

5. `test_setBaseUrl_invokes_rust` — invoke("set_base_url", { url }).
6. `test_setAuthTokens_invokes_rust` — invoke("set_auth_tokens", { accessToken, refreshToken }).

Login/register/verify-email/oauth flows: after each success, call `setAuthTokens(access, refresh)` before the store transitions to authed (single helper `commitTokens(pair)` in authStore). Update mocks accordingly — the existing tests assert store state transitions only, so this is additive.

Also: `logout` — after server revocation, call `clearAuthTokens()` (new crypto wrapper) + existing keychain delete.

Verify: `pnpm vitest run` (all 58+ new tests) + `pnpm biome check .` + `pnpm tauri dev` manual smoke (see Gate 3).

### T8 — OAuth through the facade

`lib/oauth/oauth.ts` `startOAuthFlow`: replace raw `fetch` uses with `authApi.oauthExchange(...)` (already facade-backed via T6) and on success `setAuthTokens(...)`; `error`/`cancelled` states unchanged. `oauth.ts` unit tests: extend existing suite if present, assert `setAuthTokens` called with exchange pair on success.

Verify: `pnpm vitest run src/lib/oauth` (add tests if the file has none) + biome.

### T9 — Gate pass (plan-level)

1. `cd client/src-tauri && cargo check && cargo test`
2. `cd client && pnpm biome check . && pnpm vitest run`
3. `cd server && go vet ./... && go test ./...` (T0 touched server)
4. Manual smoke (dev server + `pnpm tauri dev`):
   - login → register flow works end-to-end (register → verify → login); `get_request_log` shows entries with 200s.
   - Terminal connect still works (SSH unaffected — no Rust proxy in that path).
   - Shorten `JWT_EXPIRY=1m` in server `.env` → wait → any API call succeeds without user action (Rust refreshed); log shows `/api/v1/auth/refresh`.
   - Set `JWT_EXPIRY=1m`, revoke the refresh token via another login (or recovery) → next API call triggers `session-revoked` event → app lands on login screen.
   - Stop the server → any API call shows the standard "Cannot reach the server…" message (no unhandled errors in devtools) → start server → next call recovers.

## Plan-level gates and definitions of done

- All unit tests named above pass; existing suites untouched-and-green (vitest + cargo + go vet/test).
- No `fetch(`, `XMLHttpRequest`, or axios anywhere in `client/src` (grep-verify).
- `apiFetch` no longer contains a refresh/retry loop (grep-verify). Zero new unsafe blocks; zero secrets in logs (request log stores no headers/bodies).
- Facade contract documented in `http.ts` docblock: `network:`/`auth:` prefixes are the only error surfaces.

## Follow-up plans (phases 2–5 of the spec, separate docs)

- **Plan #2** — Local typed tables + outbox: `groups/hosts/keys/snippets/workspaces/presets` mirror schema in `db.rs`, common envelope, AEAD with AAD=table_name, `outbox`/`sync_conflicts`/`__sync_meta`, migration from `records` table.
- **Plan #3** — Server `/sync/pull` + `/sync/push`: CAS `WHERE revision < :new`, fate enum, per-vault watermark, owner/member AuthZ, host `key_id` same-vault enforcement.
- **Plan #4** — Sync engine (TS): debounce 3s, launch/reconnect/manual triggers, conflict parking, tombstones, banners/badges/status.
- **Plan #5** — History table (activity log) + its sync; keychain custody cleanup (delete JS read path from phase T7).

## Open questions (none blocking)

- `HttpState` clone-vs-arc in `http_request` (T4): fine — state is `Arc`-free in Tauri; `State::inner()` is the managed instance, clone shares the Mutexes.