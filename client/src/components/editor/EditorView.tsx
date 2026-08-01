import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { useDroppable } from "@dnd-kit/react";
import { CodeIcon, FileTextIcon, XIcon } from "@phosphor-icons/react";
import CodeMirror, { basicSetup } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { languageFor } from "../../lib/editorLanguage";
import { lintExtensionsFor } from "../../lib/editorLint";
import { DEFAULT_EDITOR_THEME, editorThemes } from "../../lib/editorThemes";
import { extractError } from "../../lib/extractError";
import { readLocalFile, writeLocalFile } from "../../lib/localFs";
import { useEditorStore } from "../../stores/editorStore";
import { useThemeStore } from "../../stores/themeStore";

interface EditorViewProps {
  pane: import("../../stores/editorStore").EditorLeafNode;
}

export default function EditorView({ pane }: EditorViewProps) {
  const openFiles = useEditorStore((s) => s.openFiles[pane.id]) ?? [];
  const activePath = useEditorStore((s) => s.activeFile[pane.id]) ?? null;
  const closeFile = useEditorStore((s) => s.closeFile);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const droppable = useDroppable({
    id: `editor-file-drop-${pane.id}`,
    data: { type: "editor-file-drop", paneId: pane.id },
  });

  const isHost = pane.connectionType === "host";
  const detail = isHost
    ? `${pane.hostUsername ? `${pane.hostUsername}@` : ""}${pane.hostName || pane.hostAddress}${pane.hostPort ? `:${pane.hostPort}` : ""}`
    : pane.localPath || "";

  useEffect(() => {
    let cancelled = false;
    if (!activePath) {
      setContent(null);
      setReadError(null);
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

  return (
    <div
      ref={droppable.ref}
      className={`flex flex-col h-full min-w-0 flex-1 transition-colors ${
        droppable.isDropTarget
          ? "bg-primary-500/10 ring-1 ring-inset ring-primary-500"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-700 bg-dark-900">
        <CodeIcon className="w-4 h-4 text-primary-400" weight="bold" />
        <span className="text-xs font-medium text-white">
          {isHost ? "Remote" : "Local"}
        </span>
        <span className="text-xs text-dark-400 truncate">{detail}</span>
      </div>

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
          {openFiles.length > 0 && (
            <div
              role="tablist"
              className="flex items-stretch gap-0.5 px-2 pt-1.5 bg-dark-900 border-b border-dark-700 overflow-x-auto"
            >
              {openFiles.map((f) => {
                const isActive = f.path === activePath;
                const isDirty = dirty[f.path] === true;
                return (
                  <div
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    key={f.path}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer select-none whitespace-nowrap border ${
                      isActive
                        ? "bg-dark-800 text-white border-dark-700"
                        : "bg-transparent text-dark-400 border-transparent hover:text-dark-300"
                    }`}
                    title={f.path}
                    onClick={() => setActiveFile(pane.id, f.path)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveFile(pane.id, f.path);
                      }
                    }}
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
                    <FileTextIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-40 truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`Close ${f.name}`}
                      className="ml-0.5 p-0.5 rounded hover:bg-dark-700 text-dark-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(pane.id, f.path);
                      }}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-0 bg-dark-950 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-dark-600 border-t-primary-400 rounded-full animate-spin" />
              </div>
            ) : readError ? (
              <div className="flex items-center justify-center h-full text-sm text-red-400 px-6 text-center">
                {readError}
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
                  <FileTextIcon className="w-10 h-10 mx-auto mb-3 text-dark-600" />
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
    </div>
  );
}
