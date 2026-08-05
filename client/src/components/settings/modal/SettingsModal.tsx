import SettingsPanel from "@/components/settings/modal/SettingsPanel";
import Modal from "@/components/ui/Modal";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  return (
    <Modal onClose={onClose} title="Settings" maxWidth="max-w-4xl">
      <div className="h-[70vh]">
        <SettingsPanel />
      </div>
    </Modal>
  );
}
