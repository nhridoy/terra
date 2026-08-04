import type React from "react";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ModalFormProps {
  onClose: () => void;
  title: string;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  cancelButtonText?: string;
  submitButtonText?: string;
  isPending: boolean;
  children?: React.ReactNode;
}

const ModalForm = ({
  onClose,
  title,
  onSubmit,
  cancelButtonText = "Cancel",
  submitButtonText = "Submit",
  isPending,
  children,
}: ModalFormProps) => {
  return (
    <Modal onClose={onClose} title={title} maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        {children}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="sm"
            disabled={isPending}
          >
            {cancelButtonText}
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {submitButtonText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ModalForm;
