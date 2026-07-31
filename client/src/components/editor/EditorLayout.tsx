import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  useDragDropManager,
} from "@dnd-kit/react";
import { CodeIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import EditorPaneTree from "./EditorPaneTree";

type Manager = ReturnType<typeof useDragDropManager>;

function refreshDroppableShapes(manager: Manager) {
  if (!manager) return;
  for (const droppable of manager.registry.droppables) {
    (droppable as { refreshShape?: () => void }).refreshShape?.();
  }
}

function ShapeRefresher() {
  const manager = useDragDropManager();

  useEffect(() => {
    if (!manager) return;
    return manager.monitor.addEventListener("beforedragstart", () => {
      refreshDroppableShapes(manager);
    });
  }, [manager]);

  useEffect(() => {
    if (!manager) return;
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshDroppableShapes(manager), 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [manager]);

  return null;
}

type DropSide = "left" | "right" | "top" | "bottom";

export default function EditorLayout() {
  const root = useEditorStore((s) => s.root);
  const activePaneId = useEditorStore((s) => s.activePaneId);
  const movePane = useEditorStore((s) => s.movePane);
  const [dropTarget, setDropTarget] = useState<{
    paneId: string;
    side: DropSide;
  } | null>(null);

  useEffect(() => {
    if (!useEditorStore.getState().root) {
      const firstId = `editor-pane-${Date.now()}`;
      useEditorStore.setState({
        root: {
          type: "leaf",
          id: firstId,
          connectionType: null,
          size: 100,
        },
        activePaneId: firstId,
      });
    }
  }, []);

  const handleDragStart = (_event: DragStartEvent) => {
    // File dragging is added with the explorer (next phase)
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { source, target } = event.operation;
    if (
      source?.data?.type === "editor-pane-source" &&
      target?.data?.type === "editor-pane"
    ) {
      const sourcePaneId = String(source.data.paneId);
      const targetPaneId = String(target.data.paneId);
      const side = target.data.side as DropSide;
      if (sourcePaneId !== targetPaneId) {
        setDropTarget({ paneId: targetPaneId, side });
        return;
      }
    }
    setDropTarget(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation;

    if (event.canceled || !source) {
      setDropTarget(null);
      return;
    }

    if (
      source.data?.type === "editor-pane-source" &&
      target?.data?.type === "editor-pane"
    ) {
      const sourcePaneId = String(source.data.paneId);
      const targetPaneId = String(target.data.paneId);
      const side = target.data.side as DropSide;
      if (sourcePaneId !== targetPaneId) {
        movePane(sourcePaneId, targetPaneId, side);
      }
    }

    setDropTarget(null);
  };

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter(
          (sensor) => sensor !== PointerSensor && sensor !== KeyboardSensor,
        ),
        PointerSensor.configure({
          activationConstraints: (event) => {
            if (event.pointerType === "touch") {
              return [
                new PointerActivationConstraints.Delay({
                  value: 250,
                  tolerance: 5,
                }),
              ];
            }
            return [new PointerActivationConstraints.Distance({ value: 5 })];
          },
        }),
      ]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <ShapeRefresher />
      <div className="flex-1 relative bg-dark-900 overflow-hidden">
        {root && (
          <EditorPaneTree
            node={root}
            activePaneId={activePaneId}
            dropTarget={dropTarget}
          />
        )}
      </div>

      <DragOverlay>
        {(source) => {
          if (source.data?.type === "editor-pane-source") {
            return (
              <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                <div className="flex items-center gap-2">
                  <CodeIcon
                    className="w-4 h-4 text-primary-400"
                    weight="bold"
                  />
                  <span className="text-sm font-medium text-white">
                    Editor Pane
                  </span>
                </div>
              </div>
            );
          }
          return null;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
