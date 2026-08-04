import { type Theme, themes } from "@/stores/themeStore";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import type { AppearanceTabProps } from "@/types/settings/types";

export default function AppearanceTab({
  currentTheme,
  fontSize,
  fontFamily,
  setTheme,
  setFontSize,
  setFontFamily,
}: AppearanceTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Theme</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(themes).map(([id, theme]) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              onClick={() => setTheme(id as Theme)}
              className={`p-3 h-auto flex-col ${
                currentTheme === id
                  ? "border-primary-500 ring-2 ring-primary-500/20"
                  : "border-dark-700"
              }`}
            >
              <div
                className="w-full h-10 rounded mb-2"
                style={{ background: theme.colors.background }}
              />
              <span className="text-xs font-medium text-white">
                {theme.name}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-dark-700 pt-6">
        <h3 className="text-sm font-medium text-white mb-3">Editor Font</h3>
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
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="font-size" className="text-dark-300 text-sm">
                Font Size
              </label>
              <span className="text-xs text-dark-400 tabular-nums">
                {fontSize}px
              </span>
            </div>
            <Slider
              id="font-size"
              value={fontSize}
              onValueChange={setFontSize}
              min={10}
              max={24}
              step={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
