import { useDroppable } from "@dnd-kit/react";
import { Button } from "@/components/ui/Button";

export function BreadcrumbDropTarget({
  groupId,
  onClick,
  children,
}: {
  groupId: string | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: groupId ? `breadcrumb:${groupId}` : "breadcrumb:root",
    data: groupId ? { type: "group-target", groupId } : { type: "root-target" },
  });
  return (
    <Button
      type="button"
      ref={ref}
      onClick={onClick}
      variant="ghost"
      size="sm"
      className={`rounded-md ${
        isDropTarget
          ? "bg-primary-600/20 text-primary-400 ring-1 ring-primary-500"
          : "bg-dark-800 text-dark-300 hover:bg-dark-700"
      }`}
    >
      {children}
    </Button>
  );
}
