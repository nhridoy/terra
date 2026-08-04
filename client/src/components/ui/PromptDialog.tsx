import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  type NameFormSchema,
  nameFormDefaultValues,
  nameFormSchema,
} from "@/lib/schema/common/nameFormSchema";
import ModalForm from "@/components/common/ModalForm";
import { FormInput } from "@/components/ui/forms/FormInput";

interface PromptDialogProps {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export default function PromptDialog({
  open,
  title,
  placeholder,
  defaultValue = "",
  confirmLabel = "Create",
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, reset } = useForm<NameFormSchema>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: nameFormDefaultValues,
  });

  useEffect(() => {
    if (open)
      reset(defaultValue ? { name: defaultValue } : nameFormDefaultValues);
  }, [open, defaultValue, reset]);

  const onSubmit = (data: NameFormSchema) => {
    startTransition(async () => {
      onConfirm(data.name);
      reset();
      onClose();
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title={title}
      isPending={isPending}
      onSubmit={handleSubmit(onSubmit)}
      submitButtonText={confirmLabel}
    >
      <FormInput
        name="name"
        label="Name"
        control={control}
        placeholder={placeholder}
        required
      />
    </ModalForm>
  );
}
