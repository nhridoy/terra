# Task 6: Server Password Change + Recovery

**Files:**
- Modify: `server/internal/auth/handlers.go`

**Interfaces:**
- Produces: `auth.HandlePasswordChange(db, cfg)`, `auth.HandleRecovery(db, cfg)`

## Steps

1. Write password change handler tests:
- Test: Password change with valid old_proof → 204
- Test: Password change with wrong old_proof → 401
- Test: Password change → revokes all other sessions

2. Implement HandlePasswordChange:
- Parse {old_proof, new_encrypted_dek, new_verifier, new_nonce, new_kdf, new_server_salt, new_salt_cl}
- Verify old_proof against stored verifier
- Update user's verifier, DEK encryption params, keyring
- Revoke all other refresh tokens (security)

3. Write recovery handler tests:
- Test: Recovery with valid signature → 204
- Test: Recovery with invalid signature → 401
- Test: Recovery → replaces verifier + keyring

4. Implement HandleRecovery:
- Parse {recovery_code, signature, new_encrypted_dek, new_verifier, new_nonce, new_kdf, new_server_salt, new_salt_cl}
- Verify recovery_code matches stored recovery_hash
- Verify signature is valid
- Replace verifier and keyring blob
- Revoke all sessions

5. Wire routes in main.go (protected), run all tests → PASS

6. Commit
