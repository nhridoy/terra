import { useRef } from "react";
import { Button } from "./Button";

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({
  open = true,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`bg-dark-900 rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 shrink-0">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-xl leading-none"
            >
              &times;
            </Button>
          </div>
        )}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
