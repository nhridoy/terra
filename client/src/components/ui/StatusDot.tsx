import { getStatusColor } from "../../lib/connectionStatus";
import { cn } from "../../lib/utils";

interface StatusDotProps {
  status: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const SIZE: Record<string, string> = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
};

export function StatusDot({ status, size = "sm", className }: StatusDotProps) {
  return (
    <div
      className={cn(
        "rounded-full shrink-0",
        SIZE[size],
        getStatusColor(status),
        className,
      )}
    />
  );
}
