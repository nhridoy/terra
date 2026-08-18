### Task 14: OTP panel component + page integration

**Files:**
- Create: `client/src/components/auth/forms/EmailVerification.tsx`
- Modify: `client/src/pages/auth/LoginPage.tsx:17-31`
- Modify: `client/src/pages/auth/RegisterPage.tsx:17-27`

**Interfaces:**
- Consumes: `useAuthStore().pendingVerificationEmail`, `verifyEmail(email, otp, password?)`, `resendVerification(email)`, `clearPendingVerification`, `isLoading`, `error`, `clearError`
- Produces: `EmailVerification` component — shows email, 6-digit input, Resend button (60s countdown), "Back to sign in" link (calls `clearPendingVerification`).

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";
import { useAuthStore } from "@/stores/auth/authStore";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";

export default function EmailVerification({
  onBackToLogin,
  password,
}: {
  onBackToLogin: () => void;
  password?: string;
}) {
  const {
    pendingVerificationEmail,
    verifyEmail,
    resendVerification,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const email = pendingVerificationEmail ?? "";

  const handleResend = async () => {
    clearError();
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    await resendVerification(email);
  };

  const handleVerify = async () => {
    clearError();
    await verifyEmail(email, otp.trim(), password);
  };

  return (
    <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-white mb-2">
        Verify your email
      </h2>
      <p className="text-dark-400 text-sm mb-6">
        Enter the 6-digit code sent to <span className="text-white">{email}</span>
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <FormInput
          control={undefined}
          name="otp"
          label="Verification code"
          placeholder="123456"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />

        <Button
          type="button"
          disabled={isLoading || otp.length !== 6}
          variant="default"
          size="sm"
          className="w-full"
          onClick={handleVerify}
        >
          {isLoading ? "Verifying..." : "Verify"}
        </Button>

        <Button
          type="button"
          disabled={cooldown > 0}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </Button>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center text-primary-500 hover:text-primary-400 text-sm"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
```

> NOTE: `FormInput` is react-hook-form controlled (`control` prop). Check `client/src/components/ui/forms/FormInput.tsx` — if it requires `control`, either (a) use a plain `<input>` with existing input classes for this component, or (b) wrap in a small `useForm` instance. Prefer the plain input if FormInput is controller-bound. Adjust accordingly and run biome.

- [ ] **Step 2: Integrate into LoginPage**

```tsx
const { login, isLoading, error, clearError, pendingVerificationEmail } =
  useAuthStore();
```

At the top of the card (after the `<div className="bg-dark-900 ...">` opening tag):

```tsx
{pendingVerificationEmail && (
  <EmailVerification onBackToLogin={clearPendingVerification} />
)}
{!pendingVerificationEmail && (
  // wrap the existing card content (heading, error, OAuthLogin, form, links, ServerConfig) in this fragment
)}
```

(Extract the existing card content into a `{!pendingVerificationEmail && (...)}` fragment so the OTP panel replaces it. `clearPendingVerification` comes from the store.)

- [ ] **Step 3: Integrate into RegisterPage** — same pattern as LoginPage.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` then `pnpm biome check .`
Expected: exit 0.

**LoginPage password pass-through:** keep `const [password, setPassword] = useState("")` in LoginPage; on form submit `setPassword(data.password)` before calling `login`; render `<EmailVerification onBackToLogin={clearPendingVerification} password={password} />`. In the component, call `verifyEmail(email, otp, password)`. Same on RegisterPage with its form's `password` field.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/auth/forms/EmailVerification.tsx client/src/pages/auth/LoginPage.tsx client/src/pages/auth/RegisterPage.tsx
git commit -m "feat: otp entry panel on login and register pages"
```

---
