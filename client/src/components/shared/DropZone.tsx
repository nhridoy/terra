import { CollisionPriority } from "@dnd-kit/abstract";
import { pointerIntersection } from "@dnd-kit/collision";
import { useDroppable } from "@dnd-kit/react";
import type { DropSide } from "../../lib/paneLayout";

interface DropZoneProps {
  id: string;
  side: DropSide;
  data: Record<string, unknown>;
  accept?: (draggable: { data?: Record<string, unknown> }) => boolean;
}

export function DropZone({ id, side, data, accept }: DropZoneProps) {
  const { ref } = useDroppable({
    id,
    data,
    accept: accept
      ? (draggable: { data?: Record<string, unknown> }) => accept(draggable)
      : undefined,
    collisionDetector: pointerIntersection,
    collisionPriority: CollisionPriority.High,
  });

  const style: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 25,
  };

  switch (side) {
    case "left":
      Object.assign(style, {
        left: 0,
        top: 0,
        width: "33.34%",
        height: "100%",
      });
      break;
    case "right":
      Object.assign(style, {
        right: 0,
        top: 0,
        width: "33.34%",
        height: "100%",
      });
      break;
    case "top":
      Object.assign(style, {
        left: "33.33%",
        top: 0,
        width: "33.33%",
        height: "50%",
      });
      break;
    case "bottom":
      Object.assign(style, {
        left: "33.33%",
        bottom: 0,
        width: "33.33%",
        height: "50%",
      });
      break;
  }

  return <div ref={ref} style={style} />;
}
