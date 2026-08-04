import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  type WorkspaceFormSchema,
  workspaceFormDefaultValues,
  workspaceFormSchema,
} from "@/lib/schema/workspaces/workspaceFormSchema";
import ModalForm from "@/components/common/ModalForm";
import { FormInput } from "@/components/ui/forms/FormInput";

interface WorkspaceFormProps {
  title: string;
  initialName?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export default function WorkspaceForm({
  title,
  initialName = "",
  submitLabel = "Save",
  onSubmit,
  onClose,
}: WorkspaceFormProps) {
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, reset } = useForm<WorkspaceFormSchema>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: workspaceFormDefaultValues,
  });

  useEffect(() => {
    reset(initialName ? { name: initialName } : workspaceFormDefaultValues);
  }, [initialName, reset]);

  const getButtonText = () => {
    if (isPending) return "Saving...";
    return submitLabel;
  };

  const handleWorkspaceSubmit = (data: WorkspaceFormSchema) => {
    onSubmit(data.name);
    reset();
    onClose();
  };

  const onValid = (data: WorkspaceFormSchema) => {
    startTransition(async () => {
      await handleWorkspaceSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title={title}
      isPending={isPending}
      onSubmit={handleSubmit(onValid)}
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="name"
        label="Workspace name"
        control={control}
        placeholder="e.g. Production Cluster"
        required
      />
    </ModalForm>
  );
}
