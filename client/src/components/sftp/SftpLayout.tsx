import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/react";
import { DownloadSimpleIcon, FolderIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { type FileDragState, useSftpStore } from "../../stores/sftpStore";
import FileTransfer from "./FileTransfer";
import SftpPaneTree from "./SftpPaneTree";

type DropSide = "left" | "right" | "top" | "bottom";

export default function SftpLayout() {
  const root = useSftpStore((s) => s.root);
  const activePaneId = useSftpStore((s) => s.activePaneId);
  const movePane = useSftpStore((s) => s.movePane);
  const setFileDragState = useSftpStore((s) => s.setFileDragState);
  const setPendingFileDrop = useSftpStore((s) => s.setPendingFileDrop);
  const [dropTarget, setDropTarget] = useState<{
    paneId: string;
    side: DropSide;
  } | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const source = event.operation.source;
    if (source?.data?.type === "file-drag") {
      setFileDragState({
        isDragging: true,
        files: source.data.files as FileDragState["files"],
        sourceHostId: source.data.hostId as string,
        sourcePaneId: source.data.paneId as string,
        sourceDirect: source.data.sourceDirect as FileDragState["sourceDirect"],
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { source, target } = event.operation;
    if (
      source?.data?.type === "sftp-pane-source" &&
      target?.data?.type === "sftp-pane"
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
      setFileDragState(null);
      return;
    }

    if (
      source.data?.type === "sftp-pane-source" &&
      target?.data?.type === "sftp-pane"
    ) {
      const sourcePaneId = String(source.data.paneId);
      const targetPaneId = String(target.data.paneId);
      const side = target.data.side as DropSide;
      if (sourcePaneId !== targetPaneId) {
        movePane(sourcePaneId, targetPaneId, side);
      }
    } else if (
      source.data?.type === "file-drag" &&
      target?.data?.type === "file-drop"
    ) {
      const sourceHostId = String(source.data.hostId);
      const sourcePaneId = String(source.data.paneId);
      const files = source.data.files as FileDragState["files"];
      const destHostId = String(target.data.hostId);
      const destDirPath = String(target.data.path);
      const destPaneId = String(target.data.paneId);
      const srcDir = files[0]?.path.split("/").slice(0, -1).join("/") || "/";

      // Only execute if not a no-op (same host + same dir)
      if (!(sourceHostId === destHostId && srcDir === destDirPath)) {
        setPendingFileDrop({
          files,
          sourceHostId,
          destHostId,
          destDirPath,
          paneId: destPaneId,
          destPaneId,
          sourceDirect: source.data
            .sourceDirect as FileDragState["sourceDirect"],
          sourcePaneId,
        });
      }
    }

    setDropTarget(null);
    setFileDragState(null);
  };

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
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
      <div className="flex-1 relative bg-dark-900 overflow-hidden">
        {root && (
          <SftpPaneTree
            node={root}
            activePaneId={activePaneId}
            dropTarget={dropTarget}
          />
        )}
      </div>

      <FileTransfer />

      <DragOverlay>
        {(source) => {
          if (source.data?.type === "sftp-pane-source") {
            return (
              <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                <div className="flex items-center gap-2">
                  <FolderIcon
                    className="w-4 h-4 text-primary-400"
                    weight="bold"
                  />
                  <span className="text-sm font-medium text-white">
                    SFTP Pane
                  </span>
                </div>
              </div>
            );
          }
          if (source.data?.type === "file-drag") {
            const files = source.data.files as FileDragState["files"];
            return (
              <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-primary-500/50">
                <div className="flex items-center gap-2">
                  <DownloadSimpleIcon
                    className="w-4 h-4 text-primary-400"
                    weight="bold"
                  />
                  <span className="text-sm font-medium text-white">
                    {files.length > 1
                      ? `${files.length} files`
                      : files[0]?.name || "file"}
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
