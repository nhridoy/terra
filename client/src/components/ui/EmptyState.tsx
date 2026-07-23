import type { ElementType, ReactNode } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="text-center text-dark-400 py-8">
      <Icon className="w-12 h-12 mx-auto mb-4 text-dark-600" weight="bold" />
      <p>{title}</p>
      {description && <p className="text-sm mt-2">{description}</p>}
      {children}
    </div>
  );
}
