# SDD ledger — plan: docs/superpowers/plans/2026-10-04-local-first-teams.md

Pre-flight: Task 1 produces account-scoped DTOs and outbox operations consumed by Task 3; use LocalDb and the exact Shared Sync Contract in the plan. Task 2 produces the matching sync endpoint consumed by Task 3; Rust and Go must mirror the listed request/response JSON. Task 3 drives IPC status consumed by Task 4. Current branch main is explicitly user-approved; no commits or pushes without a new request.
