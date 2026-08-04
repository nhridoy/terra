import type { ReactNode } from "react";
import { cn } from "@/lib/common/utils";

type BadgeVariant = "default" | "primary" | "amber";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-dark-700 text-dark-300",
  primary: "bg-primary-600/20 text-primary-400",
  amber: "bg-amber-500/15 text-amber-400",
};

export function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-xs rounded inline-flex items-center",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
