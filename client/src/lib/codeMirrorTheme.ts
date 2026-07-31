import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { type Theme, terminalThemeFor } from "../stores/themeStore";

const EDITOR_FONT =
  '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace';

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function codeMirrorThemeFor(appTheme: Theme): Extension {
  const term = terminalThemeFor(appTheme);
  const dim = hexToRgba(term.foreground, 0.06);
  const dimStrong = hexToRgba(term.foreground, 0.12);
  const gutterBg = hexToRgba(term.background, 1);

  const base = EditorView.theme({
    "&": {
      backgroundColor: term.background,
      color: term.foreground,
      fontSize: "13px",
      height: "100%",
    },
    ".cm-scroller": {
      fontFamily: EDITOR_FONT,
      lineHeight: "1.55",
    },
    ".cm-content": {
      caretColor: term.cursor,
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: term.cursor,
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: term.selectionBackground,
      },
    ".cm-gutters": {
      backgroundColor: gutterBg,
      color: term.brightBlack,
      border: "none",
      borderRight: `1px solid ${dim}`,
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 12px",
      minWidth: "32px",
    },
    ".cm-activeLine": {
      backgroundColor: dim,
    },
    ".cm-activeLineGutter": {
      backgroundColor: dim,
      color: term.foreground,
    },
    ".cm-foldGutter .cm-gutterElement": {
      padding: "0 4px",
    },
    ".cm-matchingBracket": {
      backgroundColor: dimStrong,
      outline: `1px solid ${term.brightBlack}`,
    },
    ".cm-nonmatchingBracket": {
      color: term.red,
    },
    ".cm-lintRange-error": {
      textDecoration: `underline wavy ${term.red}`,
    },
    ".cm-lintRange-warning": {
      textDecoration: `underline wavy ${term.yellow}`,
    },
    ".cm-lintRange-info": {
      textDecoration: `underline wavy ${term.brightBlue}`,
    },
    ".cm-lintRange-active": {
      backgroundColor: dim,
    },
    ".cm-lint-marker-error": {
      backgroundColor: term.red,
    },
    ".cm-lint-marker-warning": {
      backgroundColor: term.yellow,
    },
    ".cm-lint-marker-info": {
      backgroundColor: term.brightBlue,
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      backgroundColor: term.background,
      border: `1px solid ${dimStrong}`,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
      color: term.foreground,
    },
    ".cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: dim,
      color: term.foreground,
    },
    ".cm-tooltip.cm-tooltip-autocomplete ul li": {
      fontFamily: EDITOR_FONT,
    },
    ".cm-completionLabel": {
      color: term.foreground,
    },
    ".cm-completionMatchedText": {
      color: term.blue,
      textDecoration: "none",
    },
    ".cm-completionDetail": {
      color: term.brightBlack,
      fontStyle: "italic",
    },
    ".cm-completionIcon": {
      filter: "none",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail, .cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionLabel, .cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionMatchedText, .cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionIcon":
      {
        color: term.foreground,
      },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionMatchedText":
      {
        color: term.brightBlue,
      },
    "&.cm-focused": {
      outline: "none",
    },
  });

  const highlight = HighlightStyle.define([
    { tag: t.keyword, color: term.blue },
    { tag: [t.operatorKeyword, t.controlKeyword], color: term.blue },
    { tag: [t.string, t.special(t.string)], color: term.green },
    { tag: [t.regexp, t.escape], color: term.red },
    { tag: [t.number, t.integer, t.float], color: term.magenta },
    { tag: [t.bool, t.null], color: term.magenta },
    {
      tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
      color: term.brightBlack,
      fontStyle: "italic",
    },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: term.cyan,
    },
    { tag: [t.typeName, t.className, t.namespace], color: term.yellow },
    { tag: [t.propertyName, t.attributeName], color: term.cyan },
    {
      tag: [t.variableName, t.definition(t.variableName)],
      color: term.foreground,
    },
    { tag: [t.operator, t.punctuation], color: term.foreground },
    {
      tag: [t.meta, t.documentMeta, t.processingInstruction],
      color: term.brightBlack,
    },
    { tag: t.heading, color: term.brightBlue, fontWeight: "bold" },
    { tag: [t.link, t.url], color: term.cyan, textDecoration: "underline" },
    { tag: [t.strong], fontWeight: "bold" },
    { tag: [t.emphasis], fontStyle: "italic" },
    { tag: [t.strikethrough], textDecoration: "line-through" },
    { tag: [t.tagName], color: term.red },
    {
      tag: [t.angleBracket, t.paren, t.bracket, t.brace, t.squareBracket],
      color: term.foreground,
    },
    { tag: [t.invalid], color: term.red },
  ]);

  return [base, syntaxHighlighting(highlight)];
}
