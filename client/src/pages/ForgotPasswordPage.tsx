import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { FormInput } from "../components/ui/forms/FormInput";
import {
  type ForgotPasswordFormSchema,
  forgotPasswordFormDefaultValues,
  forgotPasswordFormSchema,
} from "../lib/schema/forgotPasswordFormSchema";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { control, handleSubmit, watch } = useForm<ForgotPasswordFormSchema>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: forgotPasswordFormDefaultValues,
  });

  const email = watch("email");

  const onSubmit = async (_data: ForgotPasswordFormSchema) => {
    setError("");
    setIsLoading(true);

    try {
      // TODO: call real API — POST /api/v1/auth/forgot-password
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSubmitted(true);
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
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
              Check your email
            </h2>
            <p className="text-dark-400 text-sm mb-6">
              If an account exists for{" "}
              <span className="text-dark-200">{email}</span>, we've sent a
              password reset link.
            </p>
            <Link
              to="/login"
              className="text-primary-500 hover:text-primary-400 text-sm font-medium"
            >
              Back to sign in
            </Link>
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
            Reset your password
          </h2>
          <p className="text-dark-400 text-sm mb-6">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>

          {error && (
            <div className="mb-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              name="email"
              label="Email"
              control={control}
              type="email"
              placeholder="you@example.com"
              required
            />

            <Button
              type="submit"
              disabled={isLoading}
              variant="default"
              size="sm"
              className="w-full"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
