### Task 12: Client API layer

**Files:**
- Modify: `client/src/lib/api/auth.ts` (types at 137-198, `authApi` at 200-316)

**Interfaces:**
- Produces:
  - `interface RegisterResponse extends Partial<TokenPair> { user: User; verification_required?: boolean }`
  - `interface VerifyEmailResponse extends TokenPair { user: User; keyring?: KeyringRows }`
  - `authApi.verifyEmail(params: { email: string; otp: string; device_id: string }): Promise<VerifyEmailResponse>`
  - `authApi.resendVerification(email: string): Promise<{ verification_required: boolean }>`

- [ ] **Step 1: Update the types**

```ts
export interface RegisterResponse extends Partial<TokenPair> {
  user: User;
  verification_required?: boolean;
}

export interface VerifyEmailResponse extends TokenPair {
  user: User;
  keyring?: KeyringRows;
}
```

- [ ] **Step 2: Add the methods**

```ts
async verifyEmail(params: {
  email: string;
  otp: string;
  device_id: string;
}): Promise<VerifyEmailResponse> {
  return apiFetch("POST", "/api/v1/auth/verify-email", params);
},

async resendVerification(email: string): Promise<{
  verification_required: boolean;
}> {
  return apiFetch("POST", "/api/v1/auth/resend-verification", { email });
},
```

(Add inside `authApi` after `register`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (in `client/`)
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api/auth.ts
git commit -m "feat: client api for verify-email and resend"
```

---
