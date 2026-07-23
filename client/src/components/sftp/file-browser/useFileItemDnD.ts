import { CollisionPriority } from "@dnd-kit/abstract";
import { pointerIntersection } from "@dnd-kit/collision";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { useCallback } from "react";
import type { FileItem } from "../../../lib/sftpTypes";

interface UseFileItemDnDProps {
  paneId: string;
  file: FileItem;
  hostId: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  selectedFiles: Set<string>;
  files: FileItem[];
}

export function useFileItemDnD({
  paneId,
  file,
  hostId,
  hostAddress,
  hostPort,
  hostUsername,
  selectedFiles,
  files,
}: UseFileItemDnDProps) {
  const draggable = useDraggable({
    id: `file-drag-${paneId}-${file.path}`,
    data: {
      type: "file-drag",
      paneId,
      hostId,
      files: selectedFiles.has(file.name)
        ? files.filter((f) => selectedFiles.has(f.name))
        : [file],
      sourceDirect: hostId.startsWith("direct_")
        ? { host: hostAddress, port: hostPort, username: hostUsername }
        : undefined,
    },
  });

  const droppable = useDroppable({
    id: `file-drop-${paneId}-${file.path}`,
    data: { type: "file-drop", paneId, hostId, path: file.path },
    disabled: file.type !== "directory",
    collisionDetector: pointerIntersection,
    collisionPriority: CollisionPriority.High,
  });

  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      draggable.ref(node);
      droppable.ref(node);
    },
    [draggable.ref, droppable.ref],
  );

  return { draggable, droppable, mergedRef };
}
