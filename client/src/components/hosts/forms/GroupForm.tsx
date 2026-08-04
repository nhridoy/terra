import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  type GroupFormSchema,
  groupFormDefaultValues,
  groupFormSchema,
} from "@/lib/schema/hosts/groupFormSchema";
import { useHostStore } from "@/stores/hosts/hostStore";
import { useVaultStore } from "@/stores/vault/vaultStore";
import ModalForm from "@/components/common/ModalForm";
import { FormInput } from "@/components/ui/forms/FormInput";

interface Group {
  id: string;
  name: string;
  parentId?: string;
  vaultId?: string;
  sortOrder: number;
  createdAt: string;
}

interface GroupFormProps {
  group?: Group;
  defaultParentId?: string;
  onClose: () => void;
}

export default function GroupForm({
  group,
  defaultParentId,
  onClose,
}: GroupFormProps) {
  const { createGroup, updateGroup } = useHostStore();
  const { currentVaultId } = useVaultStore();
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, reset } = useForm<GroupFormSchema>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: group?.name || groupFormDefaultValues.name,
    },
  });

  const getButtonText = () => {
    if (isPending) return "Saving...";
    return group ? "Save Changes" : "Create Group";
  };

  const handleGroupSubmit = async (data: GroupFormSchema) => {
    const parentId = group?.parentId || defaultParentId || undefined;
    if (group) {
      await updateGroup(group.id, {
        name: data.name,
        parentId,
      });
    } else {
      await createGroup({
        name: data.name,
        parentId,
        vaultId: currentVaultId || undefined,
      });
    }
    reset();
    onClose();
  };

  const onSubmit = async (data: GroupFormSchema) => {
    startTransition(async () => {
      await handleGroupSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title={group ? "Edit Group" : "New Group"}
      isPending={isPending}
      onSubmit={handleSubmit(onSubmit)}
      cancelButtonText="Cancel"
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="name"
        label="Group Name"
        control={control}
        placeholder="Group name"
        required
      />
    </ModalForm>
  );
}
