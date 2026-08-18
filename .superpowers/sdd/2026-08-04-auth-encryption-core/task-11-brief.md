# Task 11: Client TS Auth API + Store

**Files:**
- Modify: `client/src/lib/api/auth.ts`
- Create: `client/src/stores/auth/authStore.ts`

**Interfaces:**
- Produces: `authApi.prelogin`, `authApi.register`, `authApi.login`, `authApi.refresh`, `authApi.logout`, `authApi.passwordChange`, `authApi.recovery`, `authApi.oauthExchange`, `authApi.setup`; `authStore` (Zustand)

## Steps

1. Write auth API test:
- prelogin returns {nonce, kdf, server_salt, salt_cl}
- register returns {access_token, refresh_token, user}
- login returns {access_token, refresh_token, user, keyring}
- 401 on wrong password
- 429 on rate limit

2. Implement auth.ts:
- prelogin, register, login, refresh, logout, passwordChange, recovery, oauthExchange, setup
- Uses fetch with VITE_API_URL

3. Write auth store test:
- register flow: prelogin → generate material → register → set tokens
- login flow: prelogin → compute proof → login → set tokens → unlock
- refresh flow: 401 → refresh → retry
- logout: clear tokens + local data

4. Implement authStore.ts (Zustand):
- user, tokens, isAuthenticated, isUnlocked
- register, login, refresh, logout, unlock

5. `cd client && pnpm vitest` → PASS

6. Commit
