import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface RecoveryRevealModalProps {
  open: boolean;
  recoveryCode: string;
  onDownload: () => void;
  onClose: () => void;
}

export default function RecoveryRevealModal({
  open,
  recoveryCode,
  onDownload,
  onClose,
}: RecoveryRevealModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Save Your Recovery Code">
      <div className="space-y-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 text-sm font-medium mb-1">
            Important: Save this recovery code
          </p>
          <p className="text-dark-300 text-xs">
            This code is the only way to recover your account if you forget your
            encryption password. Store it somewhere safe.
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
            onClick={() => {
              navigator.clipboard.writeText(recoveryCode);
            }}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="flex-1"
            onClick={onDownload}
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
