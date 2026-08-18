# SDD ledger — plan: docs/superpowers/plans/2026-08-07-email-verification.md
Task 1: complete (commits 444b321..80b6bc3, review clean)
Task 1: minor (deferred): TestLoadDefaults off-assert reads live env (pre-existing pattern); parseIntSafe partial-match accepted (pre-existing helper)
Task 2: complete (commits 80b6bc3..a616b36, review clean)
Task 2: minor (deferred): gofmt column realignment noise; test could assert NULL default
Task 3: complete (commits a616b36..0d4261d, review clean)
Task 3: minor (deferred): html-only body, no multipart/alternative (plan-mandated; ruling: acceptable for otp mail); TestNew_DefaultPort misnomer; no log-capture assertion; no smtp-path test
Task 4: complete (commits 0d4261d..9881b8a, review clean)
Task 4: minor (deferred): round-trip hash assert, ignored Count error, inline sha256 dup of hashToken
Task 5: fix round 1/5 (3 addressed, 0 open; commits 8c5a38f..b9f78ae)
Task 5: complete (commits 9881b8a..b9f78ae, review clean)
Task 6: complete (commits b9f78ae..e1a9918, review clean)
Task 6: minor (deferred): dead First fetch in test; verified-login test could assert tokens; also NOTE: spec file 2026-08-07-email-verification-design.md has uncommitted edit (403 email-in-error) - commit at branch finish
Task 7: complete (commits e1a9918..7a35664, review clean)
Task 7: minor (deferred): response user last_login_at not synced after updates; verify sequence non-transactional (plan-mandated shape, low risk); ExpiredCode/UnknownEmail tests assert only status
Task 8: complete (commits 7a35664..7366b15, review clean)
Task 8: minor (deferred): 429 body code unasserted; verified/non-password guard branches + missing-email 400 untested; no delivery-failure injection seam
Task 9: complete (commits 7366b15..e9aff1b, review clean)
Task 10: complete (commits e9aff1b..6f71bcb, review clean)
Task 10: minor (deferred): errors.Is default maps unknown sentinel to link_failed; sentinel-to-redirect mapping untested; gofmt noise unrelated
Task 11: complete (full suite green; committed stray spec edit)
Task 12: complete (commits a363294..e0bb241, review clean)
Task 13: fix round 1/5 (2 addressed, 0 open; commits 1a860fb..c60b15a)
Task 13: complete (commits e0bb241..c60b15a, review clean)
Task 13: minor (deferred): repo biome config is double-quote/semicolons (AGENTS.md stale)
Task 14: complete (commit 0ec22a9, review clean)
Task 14: minors (deferred): countdown no unmount cleanup; resend button not disabled while loading / Verify label during resend; nested card (plan-mandated)
Task 15: fix round 1/1 (2 addressed, 0 open; commits b80ca9c..7723e1b)
Task 15: complete (commits b80ca9c..7723e1b, review clean)
Task 16: complete (commit 4974c1d, review clean)
WHOLE-BRANCH REVIEW: ready for wrap-up (87337ac..4974c1d); follow-up fix dd678ff (recovery stash through gated signup)
