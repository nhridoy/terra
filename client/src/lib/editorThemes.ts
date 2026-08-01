import type { Extension } from "@codemirror/state";
import {
  amy,
  ayuLight,
  barf,
  bespin,
  birdsOfParadise,
  boysAndGirls,
  clouds,
  cobalt,
  coolGlow,
  dracula,
  espresso,
  noctisLilac,
  rosePineDawn,
  smoothy,
  solarizedLight,
  tomorrow,
} from "thememirror";
import { appEditorThemes } from "./appEditorThemes";

export const DEFAULT_EDITOR_THEME = "dracula";

export interface EditorThemeInfo {
  name: string;
  theme: Extension;
  background: string;
}

export const editorThemes: Record<string, EditorThemeInfo> = {
  amy: { name: "Amy", theme: amy, background: "#200020" },
  "ayu-light": { name: "Ayu Light", theme: ayuLight, background: "#fcfcfc" },
  barf: { name: "Barf", theme: barf, background: "#15191E" },
  bespin: { name: "Bespin", theme: bespin, background: "#2e241d" },
  "birds-of-paradise": {
    name: "Birds of Paradise",
    theme: birdsOfParadise,
    background: "#3b2627",
  },
  "boys-and-girls": {
    name: "Boys and Girls",
    theme: boysAndGirls,
    background: "#000205",
  },
  clouds: { name: "Clouds", theme: clouds, background: "#ffffff" },
  cobalt: { name: "Cobalt", theme: cobalt, background: "#00254b" },
  "cool-glow": { name: "Cool Glow", theme: coolGlow, background: "#060521" },
  dracula: { name: "Dracula", theme: dracula, background: "#2d2f3f" },
  espresso: { name: "Espresso", theme: espresso, background: "#ffffff" },
  "noctis-lilac": {
    name: "Noctis Lilac",
    theme: noctisLilac,
    background: "#f2f1f8",
  },
  "rose-pine-dawn": {
    name: "Rose Pine Dawn",
    theme: rosePineDawn,
    background: "#faf4ed",
  },
  smoothy: { name: "Smoothy", theme: smoothy, background: "#ffffff" },
  "solarized-light": {
    name: "Solarized Light",
    theme: solarizedLight,
    background: "#fef7e5",
  },
  tomorrow: { name: "Tomorrow", theme: tomorrow, background: "#ffffff" },
  ...appEditorThemes,
};
