# Task 1 Fix Report — GORM Model Constraints & Indexes

## Summary

Cross-checked all 7 model files against design spec §7 (lines 150-229).

## Findings

### Already correct (no changes needed)

| Model | Status | Details |
|-------|--------|---------|
| `user_key.go` | ✅ | `uniqueIndex:idx_user_keys_user_id_key_type` composite unique, `index` on user_id, `constraint:OnDelete:CASCADE` |
| `oauth_state.go` | ✅ | `index` on expires_at |
| `auth_code.go` | ✅ | `index` on user_id, expires_at; `constraint:OnDelete:CASCADE` on user_id |
| `vault.go` | ✅ | `index` on owner_id; `constraint:OnDelete:CASCADE` on owner_id |
| `record.go` | ✅ | `index:idx_records_vault_id_revision` composite, `index` on user_id, deleted_at; `constraint:OnDelete:CASCADE` on both FKs |
| `user.go` | ✅ | `uniqueIndex` on email, auth_provider+provider_sub |

### Fixed

**`refresh_token.go:18` — ReplacedBy field**

- **Before:** `json:"replaced_by,omitempty;constraint:OnDelete:Set Null"` — constraint tag was in the json tag (no effect)
- **After:** `gorm:"index;foreignkey:ReplacedBy;constraint:OnDelete:Set Null" json:"replaced_by,omitempty"`

Three issues fixed in one change:
1. Moved `constraint:OnDelete:Set Null` from json tag to gorm tag (was silently ignored)
2. Added `foreignkey:ReplacedBy` for self-referential FK → refresh_tokens(id)
3. Added `index` for query performance on replaced_by lookups

## Verification

```
go vet ./...   — clean
go test ./...  — all pass (config: cached, models: 2.464s)
```

## Commit

See git log for commit SHA.
