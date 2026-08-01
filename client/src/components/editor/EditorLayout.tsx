import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  useDragDropManager,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { CodeIcon, FileTextIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { DropSide } from "../../lib/paneLayout";
import { useDragStore } from "../../stores/dragStore";
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

export default function EditorLayout() {
  const root = useEditorStore((s) => s.root);
  const activePaneId = useEditorStore((s) => s.activePaneId);
  const movePane = useEditorStore((s) => s.movePane);
  const setEditorViewDrop = useDragStore((s) => s.setEditorViewDrop);
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

  const handleDragStart = (event: DragStartEvent) => {
    const { source } = event.operation;
    if (source?.data?.type === "editor-tab-source") {
      setEditorViewDrop(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { source, target } = event.operation;
    if (
      source?.data?.type === "editor-tab-source" &&
      target?.data?.type === "editor-view"
    ) {
      const sourcePaneId = String(source.data.paneId);
      const sourceViewId = String(source.data.viewId);
      const targetPaneId = String(target.data.paneId);
      const targetViewId = String(target.data.viewId);
      const side = target.data.side as DropSide;
      if (sourcePaneId === targetPaneId && sourceViewId !== targetViewId) {
        setEditorViewDrop({ paneId: targetPaneId, viewId: targetViewId, side });
        return;
      }
    }
    setEditorViewDrop(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation;

    if (event.canceled || !source) {
      setDropTarget(null);
      setEditorViewDrop(null);
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

    if (
      source.data?.type === "editor-file-source" &&
      target?.data?.type === "editor-file-drop"
    ) {
      const paneId = String(target.data.paneId);
      const viewId = String(target.data.viewId);
      const path = String(source.data.path);
      const name = String(source.data.name);
      const kind = String(source.data.kind);
      if (kind === "file") {
        useEditorStore
          .getState()
          .openFileInView(paneId, viewId, path, name, true);
      }
    }

    if (source.data?.type === "editor-tab-source") {
      const sourcePaneId = String(source.data.paneId);
      const sourceViewId = String(source.data.viewId);
      const path = String(source.data.path);
      const name = String(source.data.name);

      if (
        target?.data?.type === "editor-view" &&
        String(target.data.paneId) === sourcePaneId &&
        String(target.data.viewId) !== sourceViewId
      ) {
        useEditorStore
          .getState()
          .moveFileToView(
            sourcePaneId,
            sourceViewId,
            String(target.data.viewId),
            path,
            name,
            target.data.side as DropSide,
          );
      } else if (
        target?.data?.type === "editor-tab-source" &&
        String(target.data.paneId) === sourcePaneId &&
        String(target.data.viewId) === sourceViewId &&
        isSortable(source)
      ) {
        const files = useEditorStore.getState().openFiles[sourceViewId] ?? [];
        const tabbed = files.map((f) => ({
          ...f,
          id: `editor-file-tab:${sourceViewId}:${f.path}`,
        }));
        const reordered = move(tabbed, event);
        useEditorStore.getState().setFileOrder(
          sourceViewId,
          reordered.map(({ path, name }) => ({ path, name })),
        );
      }
    }

    setDropTarget(null);
    setEditorViewDrop(null);
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
          if (source.data?.type === "editor-file-source") {
            return (
              <div className="flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                <FileTextIcon
                  className="w-4 h-4 text-primary-400"
                  weight="fill"
                />
                <span className="text-sm text-white">
                  {String(source.data.name)}
                </span>
              </div>
            );
          }
          if (source.data?.type === "editor-tab-source") {
            return (
              <div className="flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                <FileTextIcon
                  className="w-4 h-4 text-primary-400"
                  weight="fill"
                />
                <span className="text-sm text-white">
                  {String(source.data.name)}
                </span>
              </div>
            );
          }
          return null;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
