import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  level?: "h2" | "h3" | "h4";
  className?: string;
  children?: ReactNode;
}

const HEADING_CLASSES = "text-white font-semibold";

export function SectionHeader({
  title,
  level = "h2",
  className,
  children,
}: SectionHeaderProps) {
  const Tag = level;
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <Tag className={HEADING_CLASSES}>{title}</Tag>
      {children}
    </div>
  );
}
