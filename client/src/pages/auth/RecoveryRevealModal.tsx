import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { downloadRecoveryKit } from "@/lib/recovery/recoveryKit";
import { useAuthStore } from "@/stores/auth/authStore";

interface RecoveryRevealModalProps {
  open: boolean;
  recoveryCode: string;
  onClose: () => void;
  context?: "signup" | "recovery";
}

export default function RecoveryRevealModal({
  open,
  recoveryCode,
  onClose,
  context = "signup",
}: RecoveryRevealModalProps) {
  const isRecovery = context === "recovery";
  const user = useAuthStore((s) => s.user);
  const pendingRecoveryEmail = useAuthStore((s) => s.pendingRecoveryEmail);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      toast.success("Recovery code copied to clipboard");
    } catch {
      toast.error("Failed to copy recovery code");
    }
  };

  const handleDownload = async () => {
    try {
      await downloadRecoveryKit(
        recoveryCode,
        pendingRecoveryEmail ?? user?.email ?? "unknown",
      );
    } catch {
      // error is surfaced by the download toast
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isRecovery
          ? "Your Recovery Code Has Changed"
          : "Save Your Recovery Code"
      }
    >
      <div className="space-y-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 text-sm font-medium mb-1">
            Important: Save this recovery code
          </p>
          <p className="text-dark-300 text-xs">
            {isRecovery
              ? "This is your new recovery code. The previous code has been permanently invalidated and will no longer work."
              : "This code is the only way to recover your account if you forget your password. Store it somewhere safe."}
          </p>
        </div>

        <div className="bg-dark-800 rounded-lg p-4">
          <p className="text-dark-400 text-xs mb-2 font-medium">
            Recovery Code
          </p>
          <code className="text-white text-sm font-mono break-all">
            {recoveryCode}
          </code>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={handleCopy}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="flex-1"
            onClick={handleDownload}
          >
            Download Kit
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onClose}
        >
          I've saved it — Continue
        </Button>
      </div>
    </Modal>
  );
}
