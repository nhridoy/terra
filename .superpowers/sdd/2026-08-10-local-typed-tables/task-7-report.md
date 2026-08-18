# Task T6 Report: Wire `hostStore` (TDD)

Date: 2026-08-10
Branch: `ai` (base `57deba2`)
Brief: `.superpowers/sdd/2026-08-10-local-typed-tables/task-7-brief.md`

## Summary

Replaced the no-op stub bodies in `client/src/stores/hosts/hostStore.ts` with real
implementations backed by the T4 `db.ts` wrapper (`listRows`/`getRow`/`upsertRow`/
`deleteRow`) and T5 helpers (`encryptRowData`/`decryptRowData`, AAD = table name).
Public `Host`, `Group`, and `HostState` interfaces kept verbatim — components are
unaffected. This is the first store-wiring task; the pattern followed here
(payload whitelist split, encrypt on `data`, upsert, state update) is the template
for T7/T8.

## What was implemented

- `fetchHosts(vaultId?)` — `listRows("hosts", vid)` (vid falls back to
  `useVaultStore.getState().currentVaultId`) → decrypt each row's `data` via
  `hostFromRow` → `set({ hosts, isLoading: false })`. Tombstoned rows are not
  returned by `listRows(includeDeleted=false)`, so a full reload self-heals state.
- `fetchGroups(vaultId?)` — same against `"groups"`; payload `{}` verified by
  decrypting each row's `data`; maps `parent_id` → `parentId`.
- `createHost(host)` — vaultId = `host.vaultId ?? currentVaultId`; plaintext
  columns: `name`, `group_id`, `key_id`, `sort_order`; encrypted `data` payload:
  `{ address, port, username, authType, password, tags, color }` with AAD `"hosts"`;
  upsert then prepend the constructed `Host` to state.
- `updateHost(id, patch)` — `getRow`, decrypt existing payload, merge patch's
  sensitive fields (patch wins; unknown payload fields preserved), re-encrypt,
  upsert; plaintext patch fields (`name`, `groupId`, `keyId`, `sortOrder`) merged
  into the row columns; state map-merged.
- `deleteHost(id)` — `deleteRow("hosts", id)` (tombstone) + optimistic state
  removal; clears `selectedHost` when it matches.
- `getCredentialsForHost(hostId)` — decrypt row; `authType === "key"` →
  `useKeyStore.getState().getCredentialsForKey(row.key_id)` →
  `{ password: "", privateKey, passphrase: "" }`; otherwise
  `{ password: payload.password ?? "", privateKey: "", passphrase: "" }`.
- `createGroup` / `updateGroup` / `deleteGroup` — same pattern against `"groups"`
  with `data: await encryptRowData("groups", {})`.
- `selectHost` and `clearError` implemented (stub had no-op bodies).
- All actions: errors are captured into `set({ isLoading: false, error })` and
  never rethrown/logged; no decrypted payload is ever logged.

### Constraint compliance

- Whitelist (`name`, `os`, `group_id`, `key_id`, `sort_order`) stays plaintext —
  everything else lives inside the encrypted `data` payload. NOTE: the current
  `Host` model (kept verbatim per brief) has no `os` field, so `os` is not yet
  persisted by this store (the brief's own upsert sketch also omits it) — will be
  carried once the model gains it (T7/T8 scope).
- `group_id`/`key_id` kept as plaintext id refs; resolution is the UI's job.
- No whitelist fields duplicated into `data`.

## TDD Evidence

### RED — `pnpm vitest run src/stores/hosts/hostStore.test.ts` (before implementation)

```
RUN  v4.1.10 C:/Users/hrido/Desktop/open-term/client
 ❯ src/stores/hosts/hostStore.test.ts (9 tests | 9 failed) 61ms
     × fetchHosts decrypts payloads into the Host model 27ms
     × createHost encrypts payload with AAD hosts and upserts 5ms
     × updateHost preserves unpatched encrypted fields 2ms
     × deleteHost tombstones and clears selection 2ms
     × getCredentialsForHost resolves key auth via keyStore 8ms
     × getCredentialsForHost returns password auth creds 8ms
     × fetchGroups decrypts {} payload into Group 1ms
     × createGroup upserts with data encrypted '{}' 1ms
     × deleteGroup tombstones 1ms
 Test Files  1 failed (1)   Tests  9 failed (9)
```

Failure mode: "expected vi.fn() to be called with arguments" (no-ops not calling
db layer), and `getCredentialsForHost` returning the stub's empty strings.

### GREEN — same command after implementation

```
Test Files  1 passed (1)   Tests  9 passed (9)
```

### Full suite + lint

```
pnpm vitest run            → Test Files 8 passed (8)  Tests 94 passed (94)
pnpm biome check src/stores/hosts  → checked 2 files, no errors (after --write auto-format)
```

## Files changed

- `client/src/stores/hosts/hostStore.ts` — implemented (+281/−16)
- `client/src/stores/hosts/hostStore.test.ts` — new (9 tests)

## Deviations from the brief's verbatim test code

1. `vi.mock("../vault/vaultStore")` (auto-mock) was dropped: the auto-mock
   replaces the zustand hook with a bare `vi.fn()` that has no `setState`/
   `getState`, which crashes `useVaultStore.setState({...})` in the brief's own
   tests. The real (stub) `vaultStore.ts` is imported instead — it has no
   external deps and its `setState`/`getState` interoperate as in production.
   (The brief's parenthetical sanctions adjusting mocks.)
2. Added 4 tests beyond the brief's 5 (brief line 94 explicitly asks for the
   group tests + a password-auth branch): `getCredentialsForHost` password
   branch, `fetchGroups`, `createGroup`, `deleteGroup`.
3. Implementation detail: `createHost`/`createGroup` construct and prepend the
   new Host/Group from the input + upsert result rather than re-listing, so the
   state update is immediate and testable without a `listRows` mock.

## Self-review findings

- No `console.*` calls; decrypted payloads exist only inside `hostFromRow`/
  `getCredentialsForHost`/`updateHost` locals.
- `getCredentialsForHost` has no try/catch (matches brief sketch); a decrypt
  failure rejects the promise — the caller (terminal connect flow) must handle
  it. Consider wrapping in a later task if the UI surfaces unhandled rejections.
- `updateHost` state merge via `{ ...h, ...patch }` keeps shape identical to the
  UI's model; `isLoading` resets on both success and error paths.
- `deleteHost` tombstone + local removal is consistent with the outbox model
  (tombstoned rows enqueue for sync in the db layer).

## Concerns

- `os` whitelist field not yet persisted since the `Host` model (verbatim) lacks
  it — flag for T7/T8 when the model is extended.
- `getCredentialsForHost`'s absence of error handling (as per brief) means
  failures surface as promise rejections to callers.

## Commands used

- `cd client && pnpm vitest run src/stores/hosts/hostStore.test.ts` (RED, GREEN)
- `cd client && pnpm vitest run` (full suite)
- `cd client && pnpm biome check src/stores/hosts` / `--write` (format + import sort)
- `git add client/src/stores/hosts/ && git commit -m "feat: hostStore local-first persistence (hosts+groups via db layer)"`