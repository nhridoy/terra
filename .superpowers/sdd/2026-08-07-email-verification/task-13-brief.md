### Task 13: authStore — pendingVerificationEmail state + verify/resend actions

**Files:**
- Modify: `client/src/stores/auth/authStore.ts` (state interface 51-92, register 180-234, login 236-284, catch helpers)

**Interfaces:**
- Consumes: `authApi.verifyEmail`, `authApi.resendVerification`, `AuthApiError` (from `../../lib/api/auth`), `getDeviceId`
- Produces:
  - State: `pendingVerificationEmail: string | null`
  - `verifyEmail: (email: string, otp: string) => Promise<void>` — on success: same state transitions as `login()` (user, tokens, isAuthenticated, isUnlocked, persistTokens, savePassword when `!alwaysAsk`, clear `pendingVerificationEmail`)
  - `resendVerification: (email: string) => Promise<void>`
  - `clearPendingVerification: () => void`

- [ ] **Step 1: Add state + actions to the interface**

In the `AuthState` interface add after `pendingOAuth`:

```ts
pendingVerificationEmail: string | null;
```

Add after `oauthSetup`:

```ts
verifyEmail: (email: string, otp: string, password?: string) => Promise<void>;
resendVerification: (email: string) => Promise<void>;
clearPendingVerification: () => void;
```

> `password` is optional: the OTP panel lives on the same page as the login/register form, so the page can pass the just-typed password through. When provided (and `!alwaysAsk`), the keychain entry is armed after verification; otherwise auto-unlock simply isn't armed.

- [ ] **Step 2: Register — branch on verification_required**

In `register()` (after `authApi.register` call, before `set({...})`):

```ts
if (res.verification_required) {
  set({ pendingVerificationEmail: email, isLoading: false });
  return;
}
```

- [ ] **Step 3: Login — catch VERIFICATION_REQUIRED**

Import `AuthApiError` in the `authApi` import block:

```ts
import {
  authApi,
  loadApiUrl,
  setRefreshTokenGetter,
  setRefreshTokenSetter,
  type AuthApiError,
  type TokenPair,
  type User,
} from "../../lib/api/auth";
```

In `login()`'s catch, before the generic message assignment:

```ts
} catch (err) {
  if (
    err instanceof AuthApiError &&
    err.apiError.code === "VERIFICATION_REQUIRED"
  ) {
    set({
      pendingVerificationEmail: err.apiError.email ?? email,
      isLoading: false,
    });
    return;
  }
  const message = ...
```

- [ ] **Step 4: Add verifyEmail / resendVerification / clearPendingVerification actions**

Add after `register` in the store body:

```ts
verifyEmail: async (email: string, otp: string) => {
  set({ isLoading: true, error: null });
  try {
    const res = await authApi.verifyEmail({
      email,
      otp,
      device_id: await getDeviceId(),
    });

    if (res.keyring) {
      await unwrapDek(res.keyring.dek_wrapped_by_kek);
    }

    const newTokens = {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    };
    set({
      user: res.user,
      tokens: newTokens,
      isAuthenticated: true,
      isUnlocked: true,
      pendingVerificationEmail: null,
      isLoading: false,
    });
    await persistTokens(newTokens);
    if (password && !get().alwaysAsk) {
      await savePassword(password);
    }
  } catch (err) {
    const message =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : "Verification failed";
    set({ error: message, isLoading: false });
    throw err;
  }
},

resendVerification: async (email: string) => {
  set({ isLoading: true, error: null });
  try {
    await authApi.resendVerification(email);
    set({ isLoading: false });
  } catch (err) {
    const message =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : "Resend failed";
    set({ error: message, isLoading: false });
    throw err;
  }
},

clearPendingVerification: () => set({ pendingVerificationEmail: null }),
```

> NOTE on `savePassword`: `savePassword` is called with the raw password in `login()`/`register()`; in `verifyEmail` the caller must pass the password through. **Signature change**: change `verifyEmail: (email: string, otp: string) => Promise<void>` to `verifyEmail: (email: string, otp: string, password?: string) => Promise<void>` and call `savePassword(password)` only when `password` is provided. Update the interface and Task 14 accordingly — the OTP panel can't know the password unless the login/register form passes it through.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` then `pnpm biome check src/stores/auth/authStore.ts`
Expected: exit 0 both.

- [ ] **Step 6: Commit**

```bash
git add client/src/stores/auth/authStore.ts
git commit -m "feat: pending verification state and verify/resend actions"
```

---
