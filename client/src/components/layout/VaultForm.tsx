import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTransition } from "react";
import {
  type VaultFormSchema,
  vaultFormDefaultValues,
  vaultFormSchema,
} from "../../lib/schema/vaultFormSchema";
import { useVaultStore } from "../../stores/vaultStore";
import { FormInput } from "../ui/forms/FormInput";
import ModalForm from "../shared/ModalForm";

interface VaultFormProps {
  vault?: { id: string; name: string; description?: string };
  onClose: () => void;
}

export default function VaultForm({ vault, onClose }: VaultFormProps) {
  const { createVault } = useVaultStore();
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, reset } = useForm<VaultFormSchema>({
    resolver: zodResolver(vaultFormSchema),
    defaultValues: vaultFormDefaultValues,
  });

  useEffect(() => {
    reset(
      vault
        ? { name: vault.name, description: vault.description || "" }
        : vaultFormDefaultValues,
    );
  }, [vault, reset]);

  const getButtonText = () => {
    if (isPending) return "Saving...";
    return vault ? "Save" : "Create";
  };

  const handleVaultSubmit = async (data: VaultFormSchema) => {
    if (!data.name.trim()) return;

    if (vault) {
      const { fetchVaults } = useVaultStore.getState();
      fetchVaults();
    } else {
      await createVault(data.name.trim(), (data.description || "").trim());
    }
    reset();
    onClose();
  };

  const onSubmit = async (data: VaultFormSchema) => {
    startTransition(async () => {
      await handleVaultSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title={vault ? "Edit Vault" : "Create Vault"}
      isPending={isPending}
      onSubmit={handleSubmit(onSubmit)}
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="name"
        label="Name"
        control={control}
        placeholder="e.g. Personal, Production, Staging"
        required
      />
      <FormInput
        name="description"
        label="Description"
        control={control}
        placeholder="Optional description"
      />
    </ModalForm>
  );
}
