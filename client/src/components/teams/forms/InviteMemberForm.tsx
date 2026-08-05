import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import ModalForm from "@/components/common/ModalForm";
import { FormInput } from "@/components/ui/forms/FormInput";
import { FormSelect } from "@/components/ui/forms/FormSelect";
import {
  type InviteMemberFormSchema,
  inviteMemberFormDefaultValues,
  inviteMemberFormSchema,
} from "@/lib/schema/teams/inviteMemberFormSchema";

interface InviteMemberFormProps {
  onClose: () => void;
  onSubmit: (data: InviteMemberFormSchema) => void;
}

export default function InviteMemberForm({
  onClose,
  onSubmit,
}: InviteMemberFormProps) {
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, reset } = useForm<InviteMemberFormSchema>({
    resolver: zodResolver(inviteMemberFormSchema),
    defaultValues: inviteMemberFormDefaultValues,
  });

  const getButtonText = () => {
    if (isPending) return "Sending...";
    return "Send Invite";
  };

  const handleInviteSubmit = (data: InviteMemberFormSchema) => {
    onSubmit(data);
    reset();
    onClose();
  };

  const onValid = (data: InviteMemberFormSchema) => {
    startTransition(async () => {
      await handleInviteSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title="Invite Member"
      isPending={isPending}
      onSubmit={handleSubmit(onValid)}
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="email"
        label="Email"
        control={control}
        type="email"
        placeholder="user@example.com"
        required
      />
      <FormSelect
        name="role"
        label="Role"
        control={control}
        options={[
          { value: "member", label: "Member" },
          { value: "admin", label: "Admin" },
        ]}
      />
    </ModalForm>
  );
}
