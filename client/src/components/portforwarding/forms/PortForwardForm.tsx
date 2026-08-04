import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  type PortForwardFormSchema,
  portForwardFormDefaultValues,
  portForwardFormSchema,
} from "@/lib/schema/portforwarding/portForwardFormSchema";
import ModalForm from "@/components/common/ModalForm";
import { FormInput } from "@/components/ui/forms/FormInput";

interface PortForwardFormProps {
  onClose: () => void;
  onSubmit: (data: PortForwardFormSchema) => Promise<void>;
}

export default function PortForwardForm({
  onClose,
  onSubmit,
}: PortForwardFormProps) {
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, watch, reset } =
    useForm<PortForwardFormSchema>({
      resolver: zodResolver(portForwardFormSchema),
      defaultValues: portForwardFormDefaultValues,
    });

  const localPort = watch("localPort");
  const remoteHost = watch("remoteHost");
  const remotePort = watch("remotePort");

  const getButtonText = () => {
    if (isPending) return "Creating...";
    return "Create";
  };

  const handleForwardSubmit = async (data: PortForwardFormSchema) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  const onValid = (data: PortForwardFormSchema) => {
    startTransition(async () => {
      await handleForwardSubmit(data);
    });
  };

  return (
    <ModalForm
      onClose={onClose}
      title="Add Port Forward"
      isPending={isPending}
      onSubmit={handleSubmit(onValid)}
      submitButtonText={getButtonText()}
    >
      <FormInput
        name="localPort"
        label="Local Port"
        control={control}
        type="number"
        required
      />

      <FormInput
        name="remoteHost"
        label="Remote Host"
        control={control}
        placeholder="localhost"
        required
      />

      <FormInput
        name="remotePort"
        label="Remote Port"
        control={control}
        type="number"
        required
      />

      <div className="bg-dark-800 p-3 rounded-lg text-sm text-dark-400">
        <p>
          Local port <span className="text-white">:{localPort}</span> will be
          forwarded to{" "}
          <span className="text-white">
            {remoteHost}:{remotePort}
          </span>
        </p>
      </div>
    </ModalForm>
  );
}
