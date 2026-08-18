# SDD ledger — plan: docs/superpowers/plans/2026-08-04-auth-encryption-core.md

Task 1: complete (commits eaa267e..6fd5fe9, review clean — reviewer's index/FK findings were false positives, models already correct; one genuine fix: RefreshToken.ReplacedBy constraint moved from json to gorm tag)
Task 2: complete (commit 1383a61, 9/9 tests passing — responses envelope, JWT generation/verification, HMAC-SHA256 verifier)
