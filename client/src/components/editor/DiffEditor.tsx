import { MergeView } from "@codemirror/merge";
import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { languageFor } from "../../lib/editorLanguage";
import { DEFAULT_EDITOR_THEME, editorThemes } from "../../lib/editorThemes";
import { extractError } from "../../lib/extractError";
import { readLocalFile } from "../../lib/localFs";
import { useEditorStore } from "../../stores/editorStore";
import { useThemeStore } from "../../stores/themeStore";

const DIFF_PREFIX = "diff:";

export function diffTabPath(path: string): string {
  return `${DIFF_PREFIX}${path}`;
}

export function isDiffTab(path: string): boolean {
  return path.startsWith(DIFF_PREFIX);
}

export function diffFilePath(path: string): string {
  return isDiffTab(path) ? path.slice(DIFF_PREFIX.length) : path;
}

interface DiffEditorProps {
  path: string;
  name: string;
}

export default function DiffEditor({ path, name }: DiffEditorProps) {
  const localPath = useEditorStore((s) => s.localPath);
  const statusVersion = useEditorStore((s) => s.statusVersion);
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastDocs = useRef<string | null>(null);
  const hasLoaded = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oldDoc, setOldDoc] = useState("");
  const [newDoc, setNewDoc] = useState<string | null>(null);

  const filePath = diffFilePath(path);

  useEffect(() => {
    let cancelled = false;
    // statusVersion intentionally triggers a reload when the workspace git
    // status changes (stage/commit/discard) — show fresh diffs automatically.
    void statusVersion;
    if (!localPath) {
      setInitialLoading(false);
      return;
    }
    const isFirst = !hasLoaded.current;
    if (isFirst) setInitialLoading(true);
    setError(null);
    // Resolve repo-relative paths against the workspace root.
    const absPath =
      /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith("/")
        ? filePath
        : `${localPath.replace(/\\/g, "/").replace(/\/+$/, "")}/${filePath}`;
    void (async () => {
      let original: string | null = null;
      try {
        original = await invoke<string | null>("git_show_file", {
          root: localPath,
          path: absPath,
        });
      } catch (err) {
        if (!cancelled) setError(extractError(err, "Failed to load original"));
      }
      if (cancelled) return;
      let current: string | null = null;
      try {
        current = await readLocalFile(absPath);
      } catch {
        current = null; // deleted in the working tree
      }
      if (cancelled) return;
      hasLoaded.current = true;
      const key = `${original ?? "\u0000"}|${current ?? "\u0000"}`;
      if (key === lastDocs.current) {
        if (isFirst) setInitialLoading(false);
        return;
      }
      lastDocs.current = key;
      setOldDoc(original ?? "");
      setNewDoc(current);
      if (isFirst) setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath, localPath, statusVersion]);

  const editorTheme =
    editorThemes[currentTheme] ?? editorThemes[DEFAULT_EDITOR_THEME];

  const extensions = useMemo(() => {
    const list: Extension[] = [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      editorTheme.theme,
    ];
    const lang = languageFor(filePath);
    if (lang) list.push(lang);
    return list;
  }, [editorTheme, filePath]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || newDoc === null || error) return;
    const view = new MergeView({
      a: { doc: oldDoc, extensions },
      b: { doc: newDoc, extensions },
      parent: container,
      gutter: true,
      collapseUnchanged: { margin: 3 },
    });
    view.dom.classList.add("termvault-diff-view");
    return () => {
      view.destroy();
    };
  }, [oldDoc, newDoc, error, extensions]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-dark-950">
      <div className="flex items-center gap-1.5 px-3 h-8 border-b border-dark-800 shrink-0 bg-dark-900">
        <ArrowsLeftRightIcon className="w-3.5 h-3.5 text-primary-400 shrink-0" />
        <span className="text-xs text-dark-200 truncate min-w-0">{name}</span>
        <span className="text-[10px] text-dark-500 shrink-0 ml-auto">
          HEAD &rarr; Working Tree
        </span>
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {initialLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-dark-600 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}
        {!initialLoading && error && newDoc === null && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 px-6 text-center">
            {error}
          </div>
        )}
        {!initialLoading && !error && newDoc === null && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-dark-400 px-6 text-center">
            This file was deleted in the working tree.
          </div>
        )}
      </div>
    </div>
  );
}
