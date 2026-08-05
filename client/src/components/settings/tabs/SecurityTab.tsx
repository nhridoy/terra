import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";
import { extractError } from "@/lib/common/extractError";
import {
  type ChangePasswordFormSchema,
  changePasswordFormDefaultValues,
  changePasswordFormSchema,
} from "@/lib/schema/auth/changePasswordFormSchema";
import {
  type ProfileFormSchema,
  profileFormDefaultValues,
  profileFormSchema,
} from "@/lib/schema/settings/profileFormSchema";
import { useAuthStore } from "@/stores/auth/authStore";
import type { SecurityTabProps } from "@/types/settings/types";

export default function SecurityTab({
  tabs,
  onClearAllSessions,
}: SecurityTabProps) {
  const { user, updateProfile, changePassword } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordForm = useForm<ChangePasswordFormSchema>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: changePasswordFormDefaultValues,
  });

  const profileForm = useForm<ProfileFormSchema>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: user?.full_name || profileFormDefaultValues.full_name,
      email: user?.email || profileFormDefaultValues.email,
    },
  });

  const handleProfileUpdate = async (data: ProfileFormSchema) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile({ full_name: data.full_name, email: data.email });
      setSuccess("Profile updated successfully");
    } catch (err: unknown) {
      setError(extractError(err, "Failed to update profile"));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (data: ChangePasswordFormSchema) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      setSuccess("Password changed successfully");
      passwordForm.reset();
    } catch (err: unknown) {
      setError(extractError(err, "Failed to change password"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div>
        <h3 className="text-sm font-medium text-white mb-3">Change Password</h3>
        <form
          onSubmit={passwordForm.handleSubmit(handlePasswordChange)}
          className="space-y-4"
        >
          <FormInput
            name="currentPassword"
            label="Current Password"
            control={passwordForm.control}
            type="password"
            required
          />
          <FormInput
            name="newPassword"
            label="New Password"
            control={passwordForm.control}
            type="password"
            required
          />
          <FormInput
            name="confirmPassword"
            label="Confirm New Password"
            control={passwordForm.control}
            type="password"
            required
          />
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </div>

      <div className="border-t border-dark-700 pt-6">
        <h3 className="text-sm font-medium text-white mb-3">Profile</h3>
        <form
          onSubmit={profileForm.handleSubmit(handleProfileUpdate)}
          className="space-y-4"
        >
          <FormInput
            name="full_name"
            label="Full Name"
            control={profileForm.control}
          />
          <FormInput
            name="email"
            label="Email"
            control={profileForm.control}
            type="email"
          />
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </div>

      <div className="border-t border-dark-700 pt-6">
        <h3 className="text-sm font-medium text-white mb-3">Sessions</h3>
        <Button
          type="button"
          onClick={onClearAllSessions}
          variant="soft-destructive"
          size="sm"
        >
          Close All Sessions ({tabs.length})
        </Button>
      </div>
    </div>
  );
}
