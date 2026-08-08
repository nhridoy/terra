import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/stores/auth/authStore";

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
  const timerRef = useRef<number | null>(null);

  const startCooldown = () => {
    setCooldown(60);
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current ?? undefined);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCooldown();
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const email = pendingVerificationEmail ?? "";

  const handleResend = async () => {
    clearError();
    startCooldown();
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
        Enter the 6-digit code sent to{" "}
        <span className="text-white">{email}</span>
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="otp">Verification code</FieldLabel>
            <Input
              id="otp"
              name="otp"
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </FieldContent>
        </Field>

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
          className="w-full text-center text-primary-500 hover:text-primary-400 text-sm cursor-pointer"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
