import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";
import {
  type RecoveryFormSchema,
  recoveryFormDefaultValues,
  recoveryFormSchema,
} from "@/lib/schema/auth/recoveryFormSchema";

export default function RecoveryPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit } = useForm<RecoveryFormSchema>({
    defaultValues: recoveryFormDefaultValues,
    resolver: zodResolver(recoveryFormSchema),
  });

  const onSubmit = async (_data: RecoveryFormSchema) => {
    setError("");
    setIsLoading(true);

    try {
      // TODO: call authApi.recovery with recovery code and new password
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Recovery failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">TV</span>
            </div>
            <h1 className="text-3xl font-bold text-white">TermVault</h1>
          </div>

          <div className="bg-dark-900 rounded-xl p-6 shadow-xl text-center">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-500 text-xl">&#10003;</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Account recovered
            </h2>
            <p className="text-dark-400 text-sm mb-6">
              Your password has been reset. You can now sign in with your new
              password.
            </p>
            <Button
              type="button"
              onClick={() => navigate("/login")}
              variant="default"
              size="sm"
              className="w-full"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">TV</span>
          </div>
          <h1 className="text-3xl font-bold text-white">TermVault</h1>
        </div>

        <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-dark-400 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to sign in
          </Link>

          <h2 className="text-xl font-semibold text-white mb-2">
            Recover Account
          </h2>
          <p className="text-dark-400 text-sm mb-6">
            Enter your recovery code and set a new encryption password.
          </p>

          {error && (
            <div className="mb-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              name="recoveryCode"
              label="Recovery Code"
              control={control}
              placeholder="Enter your recovery code"
              required
            />

            <FormInput
              name="newPassword"
              label="New Encryption Password"
              control={control}
              type="password"
              placeholder="••••••••"
              required
            />

            <FormInput
              name="confirmPassword"
              label="Confirm Password"
              control={control}
              type="password"
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              disabled={isLoading}
              variant="default"
              size="sm"
              className="w-full"
            >
              {isLoading ? "Recovering..." : "Recover Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
