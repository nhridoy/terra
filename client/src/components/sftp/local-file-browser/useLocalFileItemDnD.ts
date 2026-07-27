import { CollisionPriority } from "@dnd-kit/abstract";
import { pointerIntersection } from "@dnd-kit/collision";
import { useDragDropMonitor, useDraggable, useDroppable } from "@dnd-kit/react";
import { useCallback, useState } from "react";
import type { FileItem } from "../../../lib/sftpTypes";

interface UseLocalFileItemDnDProps {
  paneId: string;
  file: FileItem;
  selectedFiles: Set<string>;
  files: FileItem[];
}

export function useLocalFileItemDnD({
  paneId,
  file,
  selectedFiles,
  files,
}: UseLocalFileItemDnDProps) {
  const [isDraggingSelf, setIsDraggingSelf] = useState(false);

  useDragDropMonitor({
    onDragStart(event) {
      const source = event.operation.source;
      if (source?.data?.type === "file-drag") {
        const dragFiles = source.data.files as FileItem[];
        if (dragFiles.some((f) => f.path === file.path)) {
          setIsDraggingSelf(true);
        }
      }
    },
    onDragEnd() {
      setIsDraggingSelf(false);
    },
  });

  const draggable = useDraggable({
    id: `file-drag-${paneId}-${file.path}`,
    data: {
      type: "file-drag",
      paneId,
      hostId: "local",
      files: selectedFiles.has(file.name)
        ? files.filter((f) => selectedFiles.has(f.name))
        : [file],
    },
  });

  const droppable = useDroppable({
    id: `file-drop-${paneId}-${file.path}`,
    data: { type: "file-drop", paneId, hostId: "local", path: file.path },
    disabled: file.type !== "directory" || isDraggingSelf,
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
