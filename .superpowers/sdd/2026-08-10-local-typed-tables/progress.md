# SDD ledger — plan: docs/superpowers/plans/2026-08-10-local-typed-tables.md

Branch: ai (continues bc38a4f; plan #1 committed there). No worktree — user works directly on this branch.Task 1 (T0): complete (commits bc38a4f..e131c39, review clean)
Task 1: minor (deferred): wipe_all test covers 2/12 tables (brief-mandated test)
Task 1: minor (deferred): stale records table remains on existing installs (no DROP; hydration later)
Task 1: minor (deferred): wipe_local_data now materializes empty DB file if none existed (T3 rewrites command)
Task 1: note: pre-existing flake http::tests::test_single_flight_concurrent_401s (reproduced at base bc38a4f, not task-caused)
Task 2 (T1): complete (commits e131c39..df31c00, review clean)
Task 2: IMPORTANT - review flagged outbox+row-insert NOT atomic (crash = stranded write, never syncs). Plan amended 2026-08-10 (Amendments section); plan file now committed (9910db1). T2 brief got Step 0 to retrofit atomicity into upsert_sync_row. My earlier constraint list referenced design APIs (sync_key/check_sync_revision/clock helpers) that do NOT exist in the plan - plan is authoritative.
Task 2: minor (deferred): row_from unused table param warning (brief-verbatim); list_sync_rows filter_map(ok()) swallows decode errors; row_vals _ catch-all arm
Task 3 (T2): complete (commits df31c00..5bece7f, review clean) - atomicity retrofit verified ON SHIPPED CODE
Task 3: minor (deferred): outbox_pending filter_map(ok()) swallow (brief-verbatim); missing-row tombstone path untested
Task 4 (T3): complete (commits 5bece7f..562ffd6, review clean)
Task 4: note for T4: SyncRow is snake_case-serialized inside row (vault_id); db_list args table/vaultId/includeDeleted (default false)
Task 4: minor (carry forward): commands use 4-space indent in tab-indented lib.rs region (brief-verbatim)
Task 5 (T4): complete (commits 562ffd6..d6ca049, review clean) - backend contract pinned by tests incl. snake_case passthrough + includeDeleted default
Task 5: minor (deferred): SyncRow name?: string vs null union; getOutbox test doesn't assert command name
Task 6 (T5): complete (commits d6ca049..57deba2, review clean) - AAD=table chain verified to Rust crypto.rs
Task 6: minor (deferred): tests pin contract, not AAD-mismatch failure (lives at Rust layer) - ok; decryptRowData returns unknown (callers cast in T6-T8)
Task 7 (T6): complete (commits 57deba2..20d3289, review clean)
Task 7: CARRY TO T7/T8 pattern notes: (1) pin encrypted-string on upsert: expect.objectContaining({data:\"enc\"}) + expect.not.objectContaining({address:...}); (2) assert the upsert invoke WAS called on update; (3) self-heal: assert stale in-memory row gone after fetch; (4) assert credential lookup invoked with row key_id; (5) getCredentialsForHost missing-row returns empty silently (brief-mandated ok)
Task 7: note: os whitelist field not persisted (Host model verbatim has no os) - deferred/carried
Task 8 (T7): complete (commits 20d3289..ba51034, review clean) - mirror of hostStore pattern, byte-compatible interface
Task 8: harness note: dispatches with DUPLICATE description strings returned empty 3x; varying the description fixed it. Vary descriptions per dispatch.
Task 8: minor (deferred): tests don't pin absence of whitelist fields in encrypt payload (objectContaining); exact-object assert later; passphrase: undefined dropped by stringify (brief-mandated)
Task 9 (T8): complete (commits ba51034..a402f32, review clean) - implementer crashed twice (empty results); controller verified in-tree work, biome --write'd format-only, committed a402f32, reviewer approved
Task 9: minor (deferred): snippetFromRow lacks ?? {} null guard (workspaceFromRow has it); hostIds:undefined not pinned exactly; createSnippet state fidelity weakly asserted
Task 10 (T9): in progress
Task 10 (T9): complete (a402f32 + fix 66d9e27, fix re-review approved) - all suites green; manual GUI smoke items 1-4 remain for human; dev servers need restart (node_modules rebuilt); 2 pre-existing tsc errors authStore.test.ts:493,529 remain (base red too)
Plan execution complete: T0-T9 all reviewed/approved. Next: final whole-branch review.
Final whole-branch review (bc38a4f..5d35678): READY WITH FIXES -> Critical found: db_upsert rejected partial rows (SyncRow no serde defaults) - fixed in 5d35678 (serde(default)+derive(Default) + seam test), re-review APPROVED.
Parked findings (final review, non-blocking):
- Minor: one corrupt row poisons whole fetch (per-store try/catch skip suggested for Plan #4)
- Minor: UI state timestamps (updatedAt) not refreshed from upserted row
- Minor: stale records table on old installs (DROP TABLE IF EXISTS records not added - hydration later)
- Minor: outbox queued_at ms tie-break unstable (Plan #3 push determinism)
- Should-fix (deferred): SyncRow id/data silently default "" at IPC boundary (theoretical; all 8 call sites send both) - harden in Plan #3 boundary work
- Pre-existing: terminalStore.saveAsNewWorkspace is a no-op stub - T9 smoke step 1 'create workspace' can't pass via UI today
- Pre-existing: 2 tsc errors authStore.test.ts:493,529 (base red too); biome 7/3 pre-existing; http flake test_single_flight_concurrent_401s
Plan #2 EXECUTION COMPLETE. Workspace kept (repo practice: gitignored scratch).
