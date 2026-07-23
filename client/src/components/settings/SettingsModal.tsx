import Modal from "../ui/Modal";
import SettingsPanel from "./SettingsPanel";

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
