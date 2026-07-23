import { cn } from "../../lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-2",
};

export default function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary-500 border-t-transparent",
        sizeClasses[size],
        className,
      )}
    />
  );
}
