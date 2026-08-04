import type { ElementType } from "react";
import { Button } from "@/components/ui/Button";

interface EmptyActionStateProps {
  icon?: ElementType;
  message: string;
  onClick: () => void;
  buttonLabel?: string;
}

export function EmptyActionState({
  icon: Icon,
  message,
  onClick,
  buttonLabel,
}: EmptyActionStateProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="w-full p-6 flex-col border-dashed border-2 h-auto"
    >
      {Icon && (
        <Icon className="w-8 h-8 mx-auto mb-2 text-dark-600" weight="bold" />
      )}
      <p className="text-sm text-dark-400">{message}</p>
      {buttonLabel && (
        <p className="text-xs text-dark-500 mt-1">{buttonLabel}</p>
      )}
    </Button>
  );
}
