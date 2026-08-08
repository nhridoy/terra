import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormBase } from "@/components/ui/forms/FormBase";
import Input from "@/components/ui/Input";
import {
  type EmailVerificationFormSchema,
  emailVerificationFormDefaultValues,
  emailVerificationFormSchema,
} from "@/lib/schema/auth/emailVerificationFormSchema";
import { useAuthStore } from "@/stores/auth/authStore";

export default function EmailVerification({ password }: { password?: string }) {
  const navigate = useNavigate();
  const {
    pendingVerificationEmail,
    verifyEmail,
    resendVerification,
    clearPendingVerification,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  const { control, handleSubmit, watch } = useForm<EmailVerificationFormSchema>(
    {
      defaultValues: emailVerificationFormDefaultValues,
      resolver: zodResolver(emailVerificationFormSchema),
    },
  );
  const otp = watch("otp") ?? "";

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: cooldown starts once on mount
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

  const onSubmit = async (data: EmailVerificationFormSchema) => {
    clearError();
    await verifyEmail(email, data.otp, password);
  };

  const handleResend = async () => {
    clearError();
    startCooldown();
    await resendVerification(email);
  };

  const handleBackToLogin = () => {
    clearPendingVerification();
    navigate("/login");
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormBase
          control={control}
          name="otp"
          label="Verification code"
          placeholder="123456"
          required
        >
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) =>
                field.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          )}
        </FormBase>

        <Button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          variant="default"
          size="sm"
          className="w-full"
        >
          {isLoading ? "Verifying..." : "Verify"}
        </Button>
      </form>

      <div className="mt-4 space-y-4 mb-0">
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

        <Button
          type="button"
          variant="link"
          size="sm"
          className="w-full"
          onClick={handleBackToLogin}
        >
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
