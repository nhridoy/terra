import { type Theme, themes } from "../../../stores/themeStore";
import { Button } from "../../ui/Button";
import Select from "../../ui/Select";
import type { AppearanceTabProps } from "./types";

export default function AppearanceTab({
  currentTheme,
  fontSize,
  fontFamily,
  setTheme,
  setFontSize,
  setFontFamily,
}: AppearanceTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-white">Theme</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(themes).map(([id, theme]) => (
          <Button
            key={id}
            variant="secondary"
            onClick={() => setTheme(id as Theme)}
            className={`p-4 h-auto ${
              currentTheme === id
                ? "border-primary-500 ring-2 ring-primary-500/20 border-2"
                : "border-dark-700"
            }`}
          >
            <div
              className="w-full h-12 rounded mb-2"
              style={{ background: theme.colors.background }}
            />
            <div className="text-sm font-medium text-white capitalize">
              {theme.name}
            </div>
            <div className="text-xs text-dark-400 mt-1">{id}</div>
          </Button>
        ))}
      </div>

      <div className="border-t border-dark-700 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Editor Font</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="font-family"
              className="block text-dark-300 text-sm mb-2"
            >
              Font Family
            </label>
            <Select
              id="font-family"
              value={fontFamily}
              onValueChange={setFontFamily}
              options={[
                { value: "JetBrains Mono", label: "JetBrains Mono" },
                { value: "Fira Code", label: "Fira Code" },
                { value: "Source Code Pro", label: "Source Code Pro" },
                { value: "Monospace", label: "Monospace" },
                { value: "Cascadia Code", label: "Cascadia Code" },
                { value: "Iosevka", label: "Iosevka" },
                { value: "Victor Mono", label: "Victor Mono" },
                { value: "Ubuntu Mono", label: "Ubuntu Mono" },
              ]}
            />
          </div>
          <div>
            <label
              htmlFor="font-size"
              className="block text-dark-300 text-sm mb-2"
            >
              Font Size: {fontSize}px
            </label>
            <input
              id="font-size"
              type="range"
              min="10"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
