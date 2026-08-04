import { useCallback, useEffect, useRef, useState } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  sortable?: boolean;
}

const STORAGE_PREFIX = "file-browser-columns:";

function loadWidths(key: string, columns: ColumnDef[]): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const result: Record<string, number> = {};
      for (const col of columns) {
        const stored = parsed[col.key];
        if (typeof stored === "number" && stored >= col.minWidth) {
          result[col.key] = stored;
        } else {
          result[col.key] = col.defaultWidth;
        }
      }
      return result;
    }
  } catch {}
  const result: Record<string, number> = {};
  for (const col of columns) {
    result[col.key] = col.defaultWidth;
  }
  return result;
}

function saveWidths(key: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(widths));
  } catch {}
}

export function useResizableColumns(columns: ColumnDef[], storageKey: string) {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadWidths(storageKey, columns),
  );

  const dragRef = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = widths[columnKey];
      dragRef.current = { columnKey, startX: e.clientX, startWidth };

      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:9999;cursor:col-resize;";
      document.body.appendChild(overlay);
      overlayRef.current = overlay;
    },
    [widths],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const col = columns.find((c) => c.key === drag.columnKey);
      if (!col) return;
      const delta = e.clientX - drag.startX;
      const newWidth = Math.max(col.minWidth, drag.startWidth + delta);
      setWidths((prev) => ({ ...prev, [drag.columnKey]: newWidth }));
    }

    function onMouseUp() {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
      setWidths((prev) => {
        saveWidths(storageKey, prev);
        return prev;
      });
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, [columns, storageKey]);

  const resetWidths = useCallback(() => {
    const defaults: Record<string, number> = {};
    for (const col of columns) {
      defaults[col.key] = col.defaultWidth;
    }
    setWidths(defaults);
    saveWidths(storageKey, defaults);
  }, [columns, storageKey]);

  return {
    widths,
    handleMouseDown,
    resetWidths,
  };
}
