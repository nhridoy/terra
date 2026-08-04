import { useRef } from "react";
import type { PlacedDivider } from "@/lib/common/paneLayout";
import { DIVIDER_SIZE } from "@/lib/common/paneLayout";

interface SplitDividerProps {
  divider: PlacedDivider;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (splitId: string, sizes: number[]) => void;
  findSplit: (splitId: string) => { children: { size: number }[] } | null;
}

export function SplitDivider({
  divider,
  containerRef,
  onResize,
  findSplit,
}: SplitDividerProps) {
  const dragRef = useRef<{
    sizes: number[];
    sumAll: number;
    startPx: number;
  } | null>(null);
  const isHorizontal = divider.direction === "horizontal";
  const MIN_FRACTION = 0.1;

  const geometry = isHorizontal
    ? {
        left: `calc(${divider.posPct}% - ${DIVIDER_SIZE / 2}px)`,
        top: `${divider.crossPct}%`,
        width: `${DIVIDER_SIZE}px`,
        height: `${divider.extentPct}%`,
      }
    : {
        left: `${divider.crossPct}%`,
        top: `calc(${divider.posPct}% - ${DIVIDER_SIZE / 2}px)`,
        width: `${divider.extentPct}%`,
        height: `${DIVIDER_SIZE}px`,
      };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const split = findSplit(divider.splitId);
    const container = containerRef.current;
    if (!split || !container) return;
    const rect = container.getBoundingClientRect();
    const startPx = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;
    const sizes = split.children.map((c) => c.size);
    const sumAll = sizes.reduce((a, b) => a + b, 0) || 1;
    dragRef.current = { sizes, sumAll, startPx };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const axisSize = isHorizontal ? rect.width : rect.height;
    if (axisSize <= 0) return;
    const curPx = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;
    const deltaPx = curPx - drag.startPx;

    const minWeight = MIN_FRACTION * drag.sumAll;
    let w0 = drag.sizes[divider.index] + (deltaPx / axisSize) * drag.sumAll;
    let w1 = drag.sizes[divider.index + 1] - (deltaPx / axisSize) * drag.sumAll;

    if (w0 < minWeight) {
      w0 = minWeight;
      w1 = drag.sumAll - minWeight;
    }
    if (w1 < minWeight) {
      w1 = minWeight;
      w0 = drag.sumAll - minWeight;
    }

    const sizes = [...drag.sizes];
    sizes[divider.index] = w0;
    sizes[divider.index + 1] = w1;
    onResize(divider.splitId, sizes);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute z-20 group ${
        isHorizontal ? "cursor-col-resize" : "cursor-row-resize"
      }`}
      style={geometry}
    >
      <div
        className={`absolute inset-0 m-auto bg-dark-600 transition-colors group-hover:bg-primary-500 ${
          isHorizontal ? "w-[3px] h-full" : "h-[3px] w-full"
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded bg-dark-800/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${
          isHorizontal
            ? "flex-col gap-1 py-1.5 px-1"
            : "flex-row gap-1 px-1.5 py-1"
        }`}
      >
        <span className="w-1 h-1 rounded-full bg-dark-400 group-hover:bg-white" />
        <span className="w-1 h-1 rounded-full bg-dark-400 group-hover:bg-white" />
      </div>
    </div>
  );
}
