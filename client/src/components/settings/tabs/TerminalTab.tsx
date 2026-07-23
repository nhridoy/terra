import Select from "../../ui/Select";
import type { TerminalTabProps } from "./types";

export default function TerminalTab({
  cursorStyle,
  cursorBlink,
  scrollback,
  bellStyle,
  setCursorStyle,
  setCursorBlink,
  setScrollback,
  setBellStyle,
}: TerminalTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-white">Cursor</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="cursor-style"
            className="block text-dark-300 text-sm mb-2"
          >
            Cursor Style
          </label>
          <Select
            id="cursor-style"
            value={cursorStyle}
            onValueChange={setCursorStyle}
            options={[
              { value: "block", label: "Block" },
              { value: "underline", label: "Underline" },
              { value: "bar", label: "Bar" },
            ]}
          />
        </div>
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            id="cursor-blink"
            checked={cursorBlink}
            onChange={(e) => setCursorBlink(e.target.checked)}
            className="w-4 h-4 accent-primary-500"
          />
          <label htmlFor="cursor-blink" className="text-white cursor-pointer">
            Cursor Blink
          </label>
        </div>
      </div>

      <div className="border-t border-dark-700 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Scrollback</h3>
        <div>
          <label
            htmlFor="scrollback"
            className="block text-dark-300 text-sm mb-2"
          >
            Scrollback Lines: {scrollback.toLocaleString()}
          </label>
          <input
            id="scrollback"
            type="range"
            min="1000"
            max="100000"
            step="1000"
            value={scrollback}
            onChange={(e) => setScrollback(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
        </div>
      </div>

      <div className="border-t border-dark-700 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Bell Style</h3>
        <Select
          value={bellStyle}
          onValueChange={setBellStyle}
          options={[
            { value: "none", label: "None" },
            { value: "sound", label: "Sound" },
            { value: "visual", label: "Visual Flash" },
          ]}
          className="max-w-xs"
        />
      </div>
    </div>
  );
}
