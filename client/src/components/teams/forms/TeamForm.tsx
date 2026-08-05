import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import ModalForm from "@/components/common/ModalForm";
import { FormInput } from "@/components/ui/forms/FormInput";
import { FormTextarea } from "@/components/ui/forms/FormTextarea";
import {
  type CreateTeamFormSchema,
  createTeamFormDefaultValues,
  createTeamFormSchema,
} from "@/lib/schema/teams/createTeamFormSchema";

interface TeamFormProps {
  onClose: () => void;
  onSubmit: (data: CreateTeamFormSchema) => void;
}

export default function TeamForm({ onClose, onSubmit }: TeamFormProps) {
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, reset } = useForm<CreateTeamFormSchema>({
    resolver: zodResolver(createTeamFormSchema),
    defaultValues: createTeamFormDefaultValues,
  });

  const getButtonText = () => {
    if (isPending) return "Creating...";
    return "Create";
  };

  const handleTeamSubmit = (data: CreateTeamFormSchema) => {
    onSubmit(data);
    reset();
    onClose();
  };

  const onValid = (data: CreateTeamFormSchema) => {
    startTransition(async () => {
      await handleTeamSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title="Create Team"
      isPending={isPending}
      onSubmit={handleSubmit(onValid)}
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="name"
        label="Team Name"
        control={control}
        placeholder="My Team"
        required
      />
      <FormTextarea
        name="description"
        label="Description"
        control={control}
        placeholder="Optional description"
      />
    </ModalForm>
  );
}
