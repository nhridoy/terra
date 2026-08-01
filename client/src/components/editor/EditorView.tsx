import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { closestCenter } from "@dnd-kit/collision";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  CodeIcon,
  EyeIcon,
  SplitHorizontalIcon,
  SplitVerticalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import CodeMirror, { basicSetup } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { languageFor } from "../../lib/editorLanguage";
import { lintExtensionsFor } from "../../lib/editorLint";
import { DEFAULT_EDITOR_THEME, editorThemes } from "../../lib/editorThemes";
import { extractError } from "../../lib/extractError";
import { getFileIcon } from "../../lib/fileHelpers";
import {
  classifyFilePath,
  dualModeFor,
  type FileKind,
} from "../../lib/fileKind";
import { readLocalFile, writeLocalFile } from "../../lib/localFs";
import { type DropSide, previewStyle } from "../../lib/paneLayout";
import { countLeaves } from "../../lib/treeUtils";
import { useDragStore } from "../../stores/dragStore";
import { useEditorStore } from "../../stores/editorStore";
import { useThemeStore } from "../../stores/themeStore";
import { DropZone } from "../shared/DropZone";
import MarkdownPreview from "./MarkdownPreview";

interface EditorViewProps {
  viewId: string;
  isActive?: boolean;
  onActivate?: () => void;
}

export default function EditorView({
  viewId,
  isActive = true,
  onActivate,
}: EditorViewProps) {
  const openFiles = useEditorStore((s) => s.openFiles[viewId]) ?? [];
  const activePath = useEditorStore((s) => s.activeFile[viewId]) ?? null;
  const previewPath = useEditorStore((s) => s.previewFile[viewId]) ?? null;
  const closeFileInView = useEditorStore((s) => s.closeFileInView);
  const setActiveFileInView = useEditorStore((s) => s.setActiveFileInView);
  const makeFilePermanentInView = useEditorStore(
    (s) => s.makeFilePermanentInView,
  );
  const splitView = useEditorStore((s) => s.splitView);
  const removeView = useEditorStore((s) => s.removeView);
  const viewTrees = useEditorStore((s) => s.viewTrees);
  const isHost = useEditorStore((s) => s.connectionType === "host");
  const hostName = useEditorStore((s) => s.hostName);
  const hostAddress = useEditorStore((s) => s.hostAddress);
  const hostPort = useEditorStore((s) => s.hostPort);
  const hostUsername = useEditorStore((s) => s.hostUsername);
  const localPath = useEditorStore((s) => s.localPath);
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const editorViewDrop = useDragStore((s) => s.editorViewDrop);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");

  const droppable = useDroppable({
    id: `editor-file-drop-${viewId}`,
    data: { type: "editor-file-drop", viewId },
  });

  const detail = isHost
    ? `${hostUsername ? `${hostUsername}@` : ""}${hostName || hostAddress}${hostPort ? `:${hostPort}` : ""}`
    : localPath || "";

  const viewTree = viewTrees;
  const multiView = viewTree ? countLeaves(viewTree) > 1 : false;

  useEffect(() => {
    let cancelled = false;
    if (!activePath) {
      setContent(null);
      setReadError(null);
      setLoading(false);
      setViewMode("code");
      return;
    }
    const kind = classifyFilePath(activePath);
    const dual = dualModeFor(activePath);
    setViewMode(dual === "svg" ? "preview" : "code");
    if (kind !== "code" && dual !== "svg") {
      setContent(null);
      setReadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setReadError(null);
    readLocalFile(activePath)
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = extractError(err, "Failed to read file");
        setReadError(message);
        setContent(null);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  const handleSave = useCallback(async () => {
    if (!activePath || content === null) return;
    try {
      await writeLocalFile(activePath, content);
      setDirty((prev) => ({ ...prev, [activePath]: false }));
      toast.success("File saved");
    } catch (err) {
      toast.error(extractError(err, "Failed to save file"));
    }
  }, [activePath, content]);

  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            void handleSave();
            return true;
          },
        },
      ]),
    [handleSave],
  );

  const extensions = useMemo(() => {
    const list: Extension[] = [basicSetup(), saveKeymap];
    const lang = languageFor(activePath ?? "");
    if (lang) list.push(lang);
    list.push(...lintExtensionsFor(activePath ?? ""));
    return list;
  }, [saveKeymap, activePath]);

  const editorTheme =
    editorThemes[currentTheme] ?? editorThemes[DEFAULT_EDITOR_THEME];
  const activeFile = openFiles.find((f) => f.path === activePath) ?? null;
  const fileKind: FileKind = activePath ? classifyFilePath(activePath) : "code";
  const dualKind = activePath ? dualModeFor(activePath) : null;

  const effectiveKind: FileKind =
    dualKind === "svg"
      ? viewMode === "code"
        ? "code"
        : "image"
      : dualKind === "markdown"
        ? viewMode === "code"
          ? "code"
          : "markdown"
        : fileKind;
  const fileUrl = activePath ? convertFileSrc(activePath) : null;

  const sides = ["left", "right", "top", "bottom"] as const;
  const dropSide =
    editorViewDrop && editorViewDrop.viewId === viewId
      ? editorViewDrop.side
      : null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: droppable container, interactive children carry semantics
    <div
      ref={droppable.ref}
      onClick={onActivate}
      role="group"
      tabIndex={-1}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onActivate) {
          e.preventDefault();
          onActivate();
        }
      }}
      className={`flex flex-col h-full min-w-0 flex-1 relative transition-colors ${
        droppable.isDropTarget
          ? "bg-primary-500/10 ring-1 ring-inset ring-primary-500"
          : ""
      } ${
        isActive
          ? "ring-1 ring-inset ring-primary-600/40"
          : "ring-1 ring-inset ring-transparent"
      }`}
    >
      {isHost ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm px-6">
            <CodeIcon className="w-10 h-10 mx-auto mb-3 text-dark-600" />
            <p className="text-sm text-dark-300 mb-1">
              Connected to {detail || "remote host"}
            </p>
            <p className="text-xs text-dark-500">
              Remote file browsing arrives with the SFTP transport phase.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            className="flex items-stretch gap-0.5 px-2 pt-1.5 bg-dark-900 border-b border-dark-700 overflow-x-auto shrink-0"
          >
            {openFiles.map((f, index) => (
              <SortableFileTab
                key={f.path}
                viewId={viewId}
                file={f}
                index={index}
                isActive={f.path === activePath}
                isDirty={dirty[f.path] === true}
                isPreview={f.path === previewPath}
                onActivate={() => {
                  onActivate?.();
                  setActiveFileInView(viewId, f.path);
                }}
                onMakePermanent={() => makeFilePermanentInView(viewId, f.path)}
                onClose={() => closeFileInView(viewId, f.path)}
              />
            ))}
            <div className="flex items-center gap-0.5 ml-auto pl-2 shrink-0">
              {activeFile && dualKind && (
                <button
                  type="button"
                  title={
                    viewMode === "code" ? "Open preview" : "Show source code"
                  }
                  className={`p-1.5 rounded ${
                    viewMode === "preview"
                      ? "text-primary-400 bg-dark-800"
                      : "text-dark-400 hover:text-white hover:bg-dark-700"
                  }`}
                  onClick={() =>
                    setViewMode(viewMode === "code" ? "preview" : "code")
                  }
                >
                  {viewMode === "code" ? (
                    <EyeIcon className="w-3.5 h-3.5" />
                  ) : (
                    <CodeIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              <button
                type="button"
                title="Split right"
                className="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                onClick={() => {
                  onActivate?.();
                  splitView(viewId, "horizontal");
                }}
              >
                <SplitHorizontalIcon className="w-3.5 h-3.5" weight="bold" />
              </button>
              <button
                type="button"
                title="Split down"
                className="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                onClick={() => {
                  onActivate?.();
                  splitView(viewId, "vertical");
                }}
              >
                <SplitVerticalIcon className="w-3.5 h-3.5" weight="bold" />
              </button>
              {multiView && (
                <button
                  type="button"
                  title="Close view"
                  className="p-1.5 rounded text-dark-400 hover:text-red-400 hover:bg-dark-700"
                  onClick={() => {
                    onActivate?.();
                    removeView(viewId);
                  }}
                >
                  <XIcon className="w-3.5 h-3.5" weight="bold" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-dark-950 overflow-hidden relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-dark-600 border-t-primary-400 rounded-full animate-spin" />
              </div>
            ) : readError ? (
              <div className="flex items-center justify-center h-full text-sm text-red-400 px-6 text-center">
                {readError}
              </div>
            ) : activeFile && effectiveKind === "markdown" ? (
              <div className="h-full overflow-y-auto bg-dark-950">
                <MarkdownPreview content={content ?? ""} />
              </div>
            ) : activeFile && effectiveKind === "image" ? (
              <div className="flex items-center justify-center h-full overflow-auto p-4">
                <img
                  src={fileUrl ?? undefined}
                  alt={activeFile.name}
                  className="max-w-full max-h-full object-contain rounded shadow-lg"
                />
              </div>
            ) : activeFile && fileKind === "video" ? (
              <div className="flex items-center justify-center h-full overflow-auto p-4 bg-black/40">
                {/* biome-ignore lint/a11y/useMediaCaption: local file player, no caption track available */}
                <video
                  src={fileUrl ?? undefined}
                  controls
                  className="max-w-full max-h-full rounded"
                />
              </div>
            ) : activeFile && fileKind === "audio" ? (
              <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
                {getFileIcon(
                  {
                    name: activeFile.name,
                    path: activeFile.path,
                    type: "file",
                    size: 0,
                    permissions: "",
                    owner: "",
                    group: "",
                    modifiedAt: "",
                    isHidden: false,
                  },
                  56,
                )}
                <p className="text-sm text-dark-300">{activeFile.name}</p>
                {/* biome-ignore lint/a11y/useMediaCaption: local file player, no caption track available */}
                <audio
                  src={fileUrl ?? undefined}
                  controls
                  className="w-full max-w-md"
                />
              </div>
            ) : activeFile && fileKind === "pdf" ? (
              <iframe
                src={fileUrl ?? undefined}
                title={activeFile.name}
                className="w-full h-full bg-white"
              />
            ) : activeFile && fileKind === "binary" ? (
              <div className="flex flex-col items-center justify-center h-full p-6">
                {getFileIcon(
                  {
                    name: activeFile.name,
                    path: activeFile.path,
                    type: "file",
                    size: 0,
                    permissions: "",
                    owner: "",
                    group: "",
                    modifiedAt: "",
                    isHidden: false,
                  },
                  56,
                )}
                <p className="text-sm text-dark-300 mt-4">
                  Unsupported file type
                </p>
                <p className="text-xs text-dark-500 mt-1 max-w-sm text-center">
                  {activeFile.name} cannot be displayed in the editor. Try
                  opening it with an external application instead.
                </p>
              </div>
            ) : activeFile ? (
              <CodeMirror
                value={content ?? ""}
                height="100%"
                style={{ height: "100%" }}
                basicSetup={false}
                theme={editorTheme.theme}
                extensions={extensions}
                onChange={(value) => {
                  setContent(value);
                  if (activePath) {
                    setDirty((prev) => ({ ...prev, [activePath]: true }));
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm px-6">
                  <CodeIcon className="w-10 h-10 mx-auto mb-3 text-dark-600" />
                  <p className="text-sm text-dark-300 mb-1">No file open</p>
                  <p className="text-xs text-dark-500">
                    Open a file from the explorer or drop one here. Ctrl+S
                    saves.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Drop zones for moving tabs between views */}
      {sides.map((side) => (
        <DropZone
          key={side}
          id={`editor-view-drop:${viewId}:${side}`}
          side={side}
          data={{ type: "editor-view", viewId, side }}
          accept={(draggable) => draggable.data?.type === "editor-tab-source"}
        />
      ))}

      {/* Drop preview */}
      {dropSide && <div style={previewStyle(dropSide as DropSide)} />}
    </div>
  );
}

interface SortableFileTabProps {
  viewId: string;
  file: { path: string; name: string };
  index: number;
  isActive: boolean;
  isDirty: boolean;
  isPreview: boolean;
  onActivate: () => void;
  onMakePermanent: () => void;
  onClose: () => void;
}

function SortableFileTab({
  viewId,
  file,
  index,
  isActive,
  isDirty,
  isPreview,
  onActivate,
  onMakePermanent,
  onClose,
}: SortableFileTabProps) {
  const { ref, isDragging } = useSortable({
    id: `editor-file-tab:${viewId}:${file.path}`,
    index,
    data: {
      type: "editor-tab-source",
      viewId,
      path: file.path,
      name: file.name,
    },
    collisionDetector: closestCenter,
  });

  return (
    <div
      ref={ref}
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      onClick={onActivate}
      onDoubleClick={onMakePermanent}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer select-none whitespace-nowrap border ${
        isActive
          ? "bg-dark-800 text-white border-dark-700"
          : "bg-transparent text-dark-400 border-transparent hover:text-dark-300"
      } ${isDragging ? "opacity-40" : ""}`}
      style={{ touchAction: "none" }}
      title={`${file.path}${isPreview ? " — preview, double-click to keep open" : ""}`}
    >
      {isDirty && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            backgroundColor: isActive
              ? "var(--color-primary-400)"
              : "currentColor",
          }}
        />
      )}
      {getFileIcon(
        {
          name: file.name,
          path: file.path,
          type: "file",
          size: 0,
          permissions: "",
          owner: "",
          group: "",
          modifiedAt: "",
          isHidden: false,
        },
        14,
      )}
      <span className={`max-w-40 truncate ${isPreview ? "italic" : ""}`}>
        {file.name}
      </span>
      <button
        type="button"
        aria-label={`Close ${file.name}`}
        className="ml-0.5 p-0.5 rounded hover:bg-dark-700 text-dark-400 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
