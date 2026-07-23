import { useDraggable } from "@dnd-kit/react";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { accessibleClickHandler } from "../../lib/accessibleClickHandler";
import { confirmDelete } from "../../lib/confirmDelete";
import type { Host } from "../../stores/hostStore";
import { Button } from "../ui/Button";

export function DraggableHostCard({
  host,
  isDropTarget,
  onConnect,
  onEdit,
  onDelete,
}: {
  host: Host;
  isDropTarget?: boolean;
  onConnect: (host: Host) => void;
  onEdit: (host: Host) => void;
  onDelete: (id: string) => void;
}) {
  const { ref, isDragging } = useDraggable({
    id: `host:${host.id}`,
    data: { type: "host-source", hostId: host.id },
  });

  return (
    // biome-ignore lint/a11y/useSemanticElements: contains nested <button> elements for edit/delete
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => onConnect(host)}
      onKeyDown={accessibleClickHandler(() => onConnect(host))}
      className={`relative p-3 transition-colors rounded-lg cursor-pointer bg-dark-800/50 hover:bg-dark-800 group ${isDragging ? "opacity-50" : ""} ${isDropTarget ? "ring-2 ring-primary-500" : ""}`}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: host.color || "#64748b" }}
        />
        <span className="text-sm font-medium text-white truncate">
          {host.name}
        </span>
      </div>
      <p className="text-dark-500 text-xs mt-1 ml-[18px] truncate">
        {host.username ? `${host.username}@` : ""}
        {host.address}:{host.port}
      </p>
      <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(host);
          }}
          variant="ghost"
          size="icon-xs"
          className="hover:text-yellow-500"
          title="Edit host"
        >
          <PencilSimpleIcon className="w-3 h-3" weight="bold" />
        </Button>
        <Button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            if (await confirmDelete(`Delete host "${host.name}"?`))
              onDelete(host.id);
          }}
          variant="ghost"
          size="icon-xs"
          className="hover:text-red-500"
          title="Delete host"
        >
          <TrashIcon className="w-3 h-3" weight="bold" />
        </Button>
      </div>
    </div>
  );
}
