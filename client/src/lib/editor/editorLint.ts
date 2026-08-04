import { syntaxTree } from "@codemirror/language";
import {
  type Diagnostic,
  type LintSource,
  linter,
  lintGutter,
} from "@codemirror/lint";
import type { Extension } from "@codemirror/state";

const MAX_LINT_SIZE = 500_000;

const PARSER_LANGUAGES = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".mts",
  ".cts",
  ".tsx",
  ".json",
  ".jsonc",
  ".html",
  ".htm",
  ".vue",
  ".svelte",
  ".component.html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".md",
  ".markdown",
  ".py",
  ".pyw",
  ".rs",
  ".go",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".cxx",
  ".hh",
  ".c++",
  ".h++",
  ".java",
  ".php",
  ".phtml",
  ".sql",
  ".xml",
  ".svg",
  ".plist",
  ".xsd",
  ".yaml",
  ".yml",
  ".wat",
]);

function getExt(path: string): string {
  const name = path.toLowerCase();
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : base;
}

function syntaxTreeSource(): LintSource {
  return (view) => {
    if (view.state.doc.length > MAX_LINT_SIZE) return [];
    const diagnostics: Diagnostic[] = [];
    syntaxTree(view.state)
      .cursor()
      .iterate((node) => {
        if (node.name === "⚠" || node.type.isError) {
          diagnostics.push({
            from: node.from,
            to: node.to,
            severity: "error",
            message: `Syntax error at ${node.from}`,
            source: "syntax",
          });
        }
      });
    return diagnostics;
  };
}

function jsonSource(): LintSource {
  return (view) => {
    const text = view.state.doc.toString();
    if (view.state.doc.length > MAX_LINT_SIZE || text.trim() === "") return [];
    const diagnostics: Diagnostic[] = [];
    try {
      JSON.parse(text);
    } catch (err) {
      if (!(err instanceof SyntaxError)) return diagnostics;
      let from: number | null = null;
      const match = err.message.match(/position (\d+)/);
      if (match) from = Math.min(Number(match[1]), view.state.doc.length);
      diagnostics.push({
        from: from ?? 0,
        to: from ?? 0,
        severity: "error",
        message: err.message,
        source: "json",
      });
    }
    return diagnostics;
  };
}

export function lintExtensionsFor(path: string): Extension[] {
  const ext = getExt(path);
  const source =
    ext === ".json" || ext === ".jsonc"
      ? jsonSource()
      : PARSER_LANGUAGES.has(ext)
        ? syntaxTreeSource()
        : null;
  if (!source) return [];
  return [lintGutter(), linter(source, { delay: 300 })];
}
