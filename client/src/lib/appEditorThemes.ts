import { tags as t } from "@lezer/highlight";
import { createTheme } from "thememirror";
import {
  FALLBACK_ANSI,
  type Theme,
  terminalThemes,
  themes,
} from "../stores/themeStore";
import type { EditorThemeInfo } from "./editorThemes";

const APP_ONLY_THEMES: Theme[] = [
  "dark",
  "light",
  "slate",
  "midnight",
  "nord",
  "solarized",
  "monokai",
  "tokyo-night",
  "gruvbox",
  "catppuccin",
  "rose-pine",
  "onedark",
  "caffeine",
  "claude",
  "everforest",
  "kanagawa",
  "kanagawa-dragon",
  "sage",
  "tide",
  "cyberpunk",
];

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isLightBackground(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

function buildAppEditorTheme(id: Theme): EditorThemeInfo {
  const colors = themes[id].colors;
  const ansi = terminalThemes[id] ?? FALLBACK_ANSI;
  return {
    name: themes[id].name,
    background: colors.background,
    theme: createTheme({
      variant: isLightBackground(colors.background) ? "light" : "dark",
      settings: {
        background: colors.background,
        foreground: colors.text,
        caret: colors.primary,
        selection: hexToRgba(colors.primary, 0.3),
        lineHighlight: hexToRgba(colors.primary, 0.12),
        gutterBackground: colors.surface,
        gutterForeground: colors.textSubtle,
      },
      styles: [
        { tag: t.comment, color: colors.textMuted },
        { tag: t.keyword, color: colors.primary },
        { tag: t.string, color: ansi.green },
        { tag: t.regexp, color: ansi.green },
        { tag: t.number, color: ansi.yellow },
        { tag: t.bool, color: ansi.yellow },
        { tag: t.null, color: ansi.magenta },
        { tag: t.operator, color: colors.textSecondary },
        { tag: t.variableName, color: colors.text },
        { tag: t.self, color: colors.primaryLight },
        { tag: t.function(t.variableName), color: ansi.cyan },
        { tag: t.className, color: ansi.yellow },
        { tag: t.definition(t.typeName), color: ansi.cyan },
        { tag: t.typeName, color: ansi.cyan },
        { tag: t.tagName, color: ansi.blue },
        { tag: t.attributeName, color: ansi.yellow },
        { tag: t.angleBracket, color: colors.textSubtle },
        { tag: t.punctuation, color: colors.textSubtle },
      ],
    }),
  };
}

export const appEditorThemes: Record<string, EditorThemeInfo> =
  Object.fromEntries(
    APP_ONLY_THEMES.map((id) => [id, buildAppEditorTheme(id)]),
  );
