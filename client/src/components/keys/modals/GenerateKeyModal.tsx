import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { extractError } from "@/lib/common/extractError";
import {
  type GenerateKeyFormSchema,
  generateKeyFormDefaultValues,
  generateKeyFormSchema,
} from "@/lib/schema/keys/generateKeyFormSchema";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";
import { FormSelect } from "@/components/ui/forms/FormSelect";
import Modal from "@/components/ui/Modal";
import type { KeyItem } from "@/types/keys/types";

export default function GenerateKeyModal({
  vaultId: _vaultId,
  onClose,
}: {
  vaultId?: string;
  onClose: (savedKey?: KeyItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generatedPrivKey, _setGeneratedPrivKey] = useState<string | null>(
    null,
  );
  const [savedKey, _setSavedKey] = useState<KeyItem | null>(null);
  const [copied, setCopied] = useState(false);

  const { control, handleSubmit } = useForm<GenerateKeyFormSchema>({
    resolver: zodResolver(generateKeyFormSchema),
    defaultValues: generateKeyFormDefaultValues,
  });

  const getButtonText = () => {
    if (isPending) return "Generating...";
    return "Generate";
  };

  const handleKeySubmit = async (_data: GenerateKeyFormSchema) => {
    setError(null);
    try {
      setError(
        "Key generation is not available in sync-only mode. Use import instead.",
      );
    } catch (err: unknown) {
      setError(extractError(err, "Failed to generate key"));
    }
  };

  const onSubmit = async (data: GenerateKeyFormSchema) => {
    startTransition(async () => {
      await handleKeySubmit(data);
    });
  };

  const handleCopy = async () => {
    if (generatedPrivKey) {
      await navigator.clipboard.writeText(generatedPrivKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (generatedPrivKey) {
    return (
      <Modal
        onClose={() => onClose(savedKey || undefined)}
        title="Key Generated Successfully"
        maxWidth="max-w-lg"
      >
        <p className="mb-4 text-sm text-dark-400">
          Copy and save your private key now. It will not be shown again.
        </p>
        <div className="p-4 mb-4 rounded-lg bg-dark-800">
          <pre className="overflow-y-auto font-mono text-sm break-all whitespace-pre-wrap text-dark-300 max-h-48">
            {generatedPrivKey}
          </pre>
        </div>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={() => onClose(savedKey || undefined)}
            variant="ghost"
            size="sm"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            variant={copied ? "success" : "default"}
            size="sm"
          >
            {copied ? "Copied!" : "Copy Private Key"}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={() => onClose()}
      title="Generate SSH Key"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="name"
          label="Key Name"
          control={control}
          placeholder="My SSH Key"
          required
        />
        <FormInput
          name="description"
          label="Description"
          control={control}
          placeholder="Staging server key"
        />
        <FormSelect
          name="keyType"
          label="Key Type"
          control={control}
          options={[
            { value: "ed25519", label: "Ed25519 (Recommended)" },
            { value: "rsa", label: "RSA (4096-bit)" },
            { value: "ecdsa", label: "ECDSA (P-256)" },
          ]}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={() => onClose()}
            variant="ghost"
            size="sm"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {getButtonText()}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
