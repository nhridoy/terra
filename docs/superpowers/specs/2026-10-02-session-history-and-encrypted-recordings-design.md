# Session history and encrypted recordings design

**Status:** Design approved 2026-10-02; implementation pending.

## Purpose and scope

TermVault currently shows Session History and Session Logs screens, but neither reads durable records. This feature records connection attempts, persists them across restarts, and synchronizes a user's private history across their devices. Optional terminal-output recording is encrypted locally and synchronized as ciphertext. It is off by default. This first release covers SSH and local terminal panes, including hosts opened from a shared team vault; history and recordings belong only to the signed-in user, never to the team.

Success means an offline attempt appears immediately, remains after restart, reaches another device after sync, and can be deleted everywhere. A user who has not opted in never has terminal input or output stored as a recording. The server never receives plaintext host details or terminal content.

## Approach

Extend the existing typed encrypted sync protocol with `session_history`, `session_output_chunks`, and one `session_preferences` record in the user's **default personal vault**. Preferences carry the account-wide retention choice; recording opt-in is stored separately on each device. This reuses the durable local outbox, per-vault access checks, pull cursors, idempotency, and conflict rules. A separate authenticated history API would duplicate them; one mutable output blob would hit the 1 MiB record limit and create a large rewrite on every output event.

The client writes session summaries and chunks to local SQLite through Rust, encrypting the `data` field under the account DEK with a distinct record-type AAD. Records use UUIDs and the sync protocol's canonical UTC ISO-8601 millisecond timestamps. The server validates envelope shape, record size, UUIDs, and owner access without decrypting. Only protocol-required IDs, timestamps, revision fields, and neutral table metadata are plaintext. `name` is a fixed, non-identifying value such as `Session` or `Output chunk`; host name, address, username, failure message, and output remain inside `data`.

Session records and output chunks are personal even when the connected host is in a team vault. They never enter the team vault change feed or use its shared key. Account switching, logout, and lock clear decrypted history from frontend memory. A local account must be unlocked before durable history can be written or read; connection behavior must not depend on history storage being available. Recording failures are visible but do not terminate a terminal session.

## Records and lifecycle

A session summary contains an opaque UUID, personal-vault ID, timestamps, lifecycle state (`connecting`, `connected`, `ended`, `failed`, `interrupted`), connection type (`ssh` or `local`), and encrypted details: host ID/label, endpoint display information, outcome/disconnect reason, recording status, and truncation status. No command count or exit code is inferred. A reconnect attempt creates a new summary and closes the previous one. Repeated or out-of-order events must not reopen an ended attempt.

Create the summary when a connection attempt starts, update it on `connected`, and finish it on explicit pane close, remote disconnect, terminal error, or failed connect. Explicit close records `ended`; remote disconnect records `ended` with its reason; a failed attempt records `failed`. A connection still in `connecting` or `connected` when the application next opens is marked `interrupted` after the relevant account unlocks. Startup recovery must be idempotent and must not overwrite an already completed attempt synced from another device. Summary writes are serialized per attempt and preserve monotonic lifecycle transitions.

An output chunk has its own UUID, the parent session ID inside encrypted `data`, a sequence number, timestamp, and encrypted bytes. Chunk ordering is deterministic. Chunks are append-only and at most 64 KiB of raw UTF-8 output before encryption; chunk payloads stay below the sync protocol's 1 MiB record limit. The client batches writes so high-throughput output does not create one SQLite transaction per event. It flushes on a short interval and at session end. Buffered output is best-effort on a process crash; the summary is recovered as interrupted.

Output recording is opted into **per device** in Terminal settings, off by default. Toggling it on affects new connection attempts only. Only remote/local terminal **output** from the existing event stream is recorded; keystrokes/input, passwords, private keys, environment variables, and inferred shell commands are never separately captured. Output can itself contain secrets, so its setting and the History screen must state this clearly. Opt-in records no more than 10 MiB of raw output per attempt. At the limit, the client stops recording output for that attempt, marks it truncated, and shows the limit in History while the terminal continues normally. The cap is applied before buffering so memory stays bounded. The UI must not claim command history, command counts, or exit codes.

## Retention, deletion, and sync

Default retention is 30 days, configurable to 7, 30, or 90 days. The retention choice is a per-account setting synchronized as encrypted personal-vault data; the recording opt-in remains per-device. Retention is measured from an attempt's end time, or start time for an unrecoverable interrupted attempt, using canonical UTC instants. This does not require trusting a device's wall clock to resolve sync conflicts: the existing operation/revision rules remain authoritative. The client applies retention after unlock and periodically while running. Offline expiry queues ordinary tombstones; they propagate when sync resumes. A client that has not yet received the tombstones can temporarily show an old record, but must hide locally expired records after applying its retention setting. Tombstones are never silently discarded before sync.

Deleting one session tombstones its summary **and all known chunks** in a durable local transaction, then queues sync for the personal vault. A later-arriving chunk for a deleted session remains hidden and is tombstoned too. Deletion is idempotent. The History screen offers explicit single-session deletion and explains that an offline device may retain a cached copy until it reconnects. A client must never display orphan chunks. Account deletion and local-data wipe include these tables; a team removal does not delete the removed person's personal history.

Concurrent updates to the same summary (for example, crash recovery on one device while another has a newer terminal event) use the existing deterministic sync conflict rule. Each attempt is created and controlled by one device, so ordinary cross-device edits are limited to retention/deletion. Tombstones take precedence over late output and lifecycle updates. Chunk UUIDs and sequence numbers make upload retries idempotent; duplicate delivery must not duplicate displayed output.

## UI and error behavior

Replace the placeholder `HistoryView` data source and no-op session store with real Rust-backed reads. The History page lists recent attempts with status, host label, connection type, start/end time, and duration; search and date filters operate over decrypted local records. Selecting a session shows its details and, if recording was enabled, output in order. Remove the unused `SessionLog` component, which currently presents an inaccurate command-history UI; keep one history surface backed by the session store. History must distinguish **not recorded**, **recorded**, **truncated**, and **unavailable while locked**. It must not label raw output as commands.

Terminal settings expose the per-device recording toggle and account retention choice with copy that terminal output can contain secrets and will sync encrypted to the user's other devices. An active session shows a recording indicator only when output capture is active. Fetch, decrypt, persistence, and sync failures appear in the appropriate screen or sync status; they do not interrupt SSH/local terminal I/O. Delete failure leaves the record visible with an error; no false success state is shown. Disabling recording stops capture for future attempts and does not implicitly erase earlier recordings.

## Verification

- Rust tests: schema migration, account isolation, encrypted-at-rest inspection, 64 KiB chunking, 10 MiB cap, lifecycle idempotency, crash recovery, retention/tombstones, cascade deletion, outbox atomicity, and unreadable ciphertext rejection.
- Go tests: sync schema/validation, ciphertext-only allowlist, authorization, cross-account denial, chunk idempotency, tombstones, pagination, and records over the size limit.
- Frontend tests: terminal event integration, default-off and per-device opt-in, no input capture, history filters/details/delete, recording and truncation labels, lock/logout clearing, and visible failures.
- Manual suite: two devices and one account; offline SSH/local attempts; reconnect and abnormal disconnect; output opt-in/off; restart and recovery; cross-device pull; deletion/retention; large output; account switching; verify server and local DB contain no plaintext terminal output or host secrets. Test Windows, Linux, and macOS before claiming full platform support.

## Out of scope

Team-shared session history, command parsing, shell exit-code inference, input capture, session replay with timing, export, unlimited output, and server-side decryption. These require separate designs. Existing live terminal behavior and forwarding reconnect policy remain unchanged.
