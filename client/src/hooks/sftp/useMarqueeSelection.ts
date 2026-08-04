import { type RefObject, useCallback, useState } from "react";
import { useFileBrowserStore } from "@/stores/sftp/fileBrowserStore";

interface UseMarqueeSelectionParams {
  paneId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  selectedFiles: Set<string>;
  onClearSelection: () => void;
}

interface MarqueePoint {
  x: number;
  y: number;
}

function getItemsInRect(
  container: HTMLDivElement,
  rect: DOMRect,
  existingSelection: Set<string>,
): Set<string> {
  const items = container.querySelectorAll("[data-file-item]");
  const result = new Set(existingSelection);
  items.forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const overlaps =
      itemRect.left < rect.right &&
      itemRect.right > rect.left &&
      itemRect.top < rect.bottom &&
      itemRect.bottom > rect.top;
    if (overlaps) {
      const name = item.getAttribute("data-file-name");
      if (name) result.add(name);
    }
  });
  return result;
}

export function useMarqueeSelection({
  paneId,
  containerRef,
  selectedFiles,
  onClearSelection,
}: UseMarqueeSelectionParams) {
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<MarqueePoint | null>(null);
  const [current, setCurrent] = useState<MarqueePoint | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-file-item]") &&
        !target.closest("[data-marquee]") &&
        !target.closest("input, textarea, select")
      ) {
        e.preventDefault();
        setIsDragging(true);
        setStart({ x: e.clientX, y: e.clientY });
        setCurrent({ x: e.clientX, y: e.clientY });
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          onClearSelection();
        }
      }
    },
    [onClearSelection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !start) return;
      const cur = { x: e.clientX, y: e.clientY };
      setCurrent(cur);

      const minX = Math.min(start.x, cur.x);
      const maxX = Math.max(start.x, cur.x);
      const minY = Math.min(start.y, cur.y);
      const maxY = Math.max(start.y, cur.y);
      if (maxX - minX < 3 && maxY - minY < 3) return;

      const base = e.ctrlKey || e.metaKey ? selectedFiles : new Set<string>();
      if (containerRef.current) {
        const newSelected = getItemsInRect(
          containerRef.current,
          new DOMRect(minX, minY, maxX - minX, maxY - minY),
          base,
        );
        useFileBrowserStore.getState().updatePane(paneId, {
          selectedFiles: newSelected,
        });
      }
    },
    [isDragging, start, selectedFiles, paneId, containerRef],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);

      if (!start) {
        setStart(null);
        setCurrent(null);
        return;
      }

      const minX = Math.min(start.x, e.clientX);
      const maxX = Math.max(start.x, e.clientX);
      const minY = Math.min(start.y, e.clientY);
      const maxY = Math.max(start.y, e.clientY);

      if (maxX - minX < 3 && maxY - minY < 3) {
        setStart(null);
        setCurrent(null);
        return;
      }

      const base = e.ctrlKey || e.metaKey ? selectedFiles : new Set<string>();
      if (containerRef.current) {
        const newSelected = getItemsInRect(
          containerRef.current,
          new DOMRect(minX, minY, maxX - minX, maxY - minY),
          base,
        );
        useFileBrowserStore.getState().updatePane(paneId, {
          selectedFiles: newSelected,
        });
      }
      setStart(null);
      setCurrent(null);
    },
    [isDragging, start, selectedFiles, paneId, containerRef],
  );

  return {
    isDragging,
    start,
    current,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
