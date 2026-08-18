### Task T9: Gate pass (plan-level)

- [ ] **Step 1: Full Rust suite**

Run: `cd client/src-tauri && cargo check && cargo test`
Expected: PASS (T0–T3 added ~10 tests).

- [ ] **Step 2: Full TS suite + lint**

Run: `cd client && pnpm vitest run && pnpm biome check .`
Expected: PASS (78 prior + ~15 new; biome only pre-existing warnings — none new).

- [ ] **Step 3: Server untouched**

Run: `cd server && go vet ./... && go test ./...`
Expected: PASS (no server changes in this plan).

- [ ] **Step 4: Manual smoke (`pnpm tauri dev` + dev server)**

1. Boot, login, and: create a group, a host (password auth), an SSH key, a snippet, a workspace. Restart the app → all five persist (hosts/groups/snippets visible in panels, key in list, workspace in list).
2. Delete the host → restart → gone. Devtools: `await invoke("db_outbox")` → entry `{ table_name: "hosts", record_id: ... }` still present (tombstone awaiting sync).
3. Stop the server → create + delete hosts and snippets → all work locally, no error surfaces; restart server → login flows still work.
4. Logout → login again → all previously created data is gone (`wipe_all`); a fresh host you create on the new session persists across app restarts.