import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { parseTags } from "../../lib/parseTags";
import {
  type HostFormSchema,
  hostFormDefaultValues,
  hostFormSchema,
} from "../../lib/schema/hostFormSchema";
import { useHostStore } from "../../stores/hostStore";
import { useVaultStore } from "../../stores/vaultStore";
import ModalForm from "../shared/ModalForm";
import { Button } from "../ui/Button";
import { FormInput } from "../ui/forms/FormInput";
import { FormSelect } from "../ui/forms/FormSelect";

export interface HostData {
  id: string;
  name: string;
  address: string;
  port: number;
  username: string;
  authType: "password" | "key";
  keyId?: string;
  color?: string;
  groupId?: string;
  tags?: string[];
}

interface HostFormProps {
  host?: HostData;
  defaultGroupId?: string;
  onClose: () => void;
}

export default function HostForm({
  host,
  defaultGroupId,
  onClose,
}: HostFormProps) {
  const { createHost, updateHost, groups } = useHostStore();
  const { currentVaultId } = useVaultStore();
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, watch, reset } = useForm<HostFormSchema>({
    resolver: zodResolver(hostFormSchema),
    defaultValues: {
      name: host?.name || hostFormDefaultValues.name,
      address: host?.address || hostFormDefaultValues.address,
      port: host?.port || hostFormDefaultValues.port,
      username: host?.username || hostFormDefaultValues.username,
      authType: host?.authType || hostFormDefaultValues.authType,
      password: hostFormDefaultValues.password,
      keyId: host?.keyId || hostFormDefaultValues.keyId,
      color: host?.color || hostFormDefaultValues.color,
      groupId: host?.groupId || defaultGroupId || hostFormDefaultValues.groupId,
      tags: host?.tags ? parseTags(host.tags) : hostFormDefaultValues.tags,
    },
  });

  const authType = watch("authType");

  const colors = [
    "#64748b",
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];

  const getButtonText = () => {
    if (isPending) return "Saving...";
    return host ? "Save Changes" : "Add Host";
  };

  const handleHostSubmit = async (data: HostFormSchema) => {
    const hostData = {
      name: data.name,
      address: data.address,
      port: data.port,
      username: data.username,
      authType: data.authType,
      keyId: data.authType === "key" ? data.keyId : undefined,
      password: data.authType === "password" ? data.password : undefined,
      color: data.color,
      groupId: data.groupId || undefined,
      vaultId: currentVaultId || undefined,
      tags: data.tags
        ? data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    if (host) {
      await updateHost(host.id, hostData);
    } else {
      await createHost(hostData);
    }
    reset();
    onClose();
  };

  const onSubmit = async (data: HostFormSchema) => {
    startTransition(async () => {
      await handleHostSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title={host ? "Edit Host" : "Add Host"}
      isPending={isPending}
      onSubmit={handleSubmit(onSubmit)}
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="name"
        label="Name"
        control={control}
        placeholder="My Server"
        required
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <FormInput
            name="address"
            label="Address"
            control={control}
            placeholder="192.168.1.100 or hostname"
            required
          />
        </div>
        <div>
          <FormInput
            name="port"
            label="Port"
            control={control}
            type="number"
            required
          />
        </div>
      </div>

      <FormInput
        name="username"
        label="Username"
        control={control}
        placeholder="root"
        required
      />

      <div>
        <label
          id="auth-type-label"
          className="block text-dark-300 text-sm mb-2"
        >
          Authentication <span className="text-red-400 ml-0.5">*</span>
        </label>
        <Controller
          name="authType"
          control={control}
          render={({ field }) => (
            <div
              role="group"
              aria-labelledby="auth-type-label"
              className="flex gap-2"
            >
              <Button
                type="button"
                onClick={() => field.onChange("password")}
                variant={field.value === "password" ? "default" : "secondary"}
                className="flex-1"
              >
                Password
              </Button>
              <Button
                type="button"
                onClick={() => field.onChange("key")}
                variant={field.value === "key" ? "default" : "secondary"}
                className="flex-1"
              >
                SSH Key
              </Button>
            </div>
          )}
        />
      </div>

      {authType === "password" ? (
        <FormInput
          name="password"
          label="Password"
          control={control}
          type="password"
          placeholder="Enter password"
          required
        />
      ) : (
        <FormSelect
          name="keyId"
          label="SSH Key"
          control={control}
          options={[{ value: "", label: "Select a key" }]}
          required
        />
      )}

      <div>
        <label id="color-label" className="block text-dark-300 text-sm mb-2">
          Color
        </label>
        <Controller
          name="color"
          control={control}
          render={({ field }) => (
            <div
              role="group"
              aria-labelledby="color-label"
              className="flex gap-2"
            >
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => field.onChange(c)}
                  className={`cursor-pointer w-8 h-8 rounded-full ${
                    field.value === c
                      ? "ring-2 ring-white ring-offset-2 ring-offset-dark-900"
                      : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        />
      </div>

      <FormInput
        name="tags"
        label="Tags"
        control={control}
        placeholder="production, web (comma-separated)"
      />

      {!defaultGroupId && (
        <FormSelect
          name="groupId"
          label="Group"
          control={control}
          options={[
            { value: "", label: "No Group" },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      )}
    </ModalForm>
  );
}
