import { useState } from "react";
import { confirmDelete } from "../../../lib/confirmDelete";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import type { AdvancedTabProps } from "./types";

export default function AdvancedTab({
  currentTheme,
  fontSize,
  fontFamily,
  cursorStyle,
  cursorBlink,
  scrollback,
  bellStyle,
  setTheme,
  setFontSize,
  setFontFamily,
  setCursorStyle,
  setCursorBlink,
  setScrollback,
  setBellStyle,
}: AdvancedTabProps) {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExportSettings = () => {
    const settings = {
      theme: currentTheme,
      fontSize,
      fontFamily,
      cursorStyle,
      cursorBlink,
      scrollback,
      bellStyle,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "termvault-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const settings = JSON.parse(event.target?.result as string);
        if (settings.theme) setTheme(settings.theme);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.fontFamily) setFontFamily(settings.fontFamily);
        if (settings.cursorStyle) setCursorStyle(settings.cursorStyle);
        if (settings.cursorBlink !== undefined)
          setCursorBlink(settings.cursorBlink);
        if (settings.scrollback) setScrollback(settings.scrollback);
        if (settings.bellStyle) setBellStyle(settings.bellStyle);
        setSuccess("Settings imported successfully");
        setError(null);
      } catch {
        setError("Invalid settings file");
        setSuccess(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="bg-dark-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Import / Export Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            type="button"
            onClick={handleExportSettings}
            variant="secondary"
            className="text-left py-3"
          >
            <p className="font-medium">Export Settings</p>
            <p className="text-sm text-dark-400">
              Download current settings as JSON
            </p>
          </Button>
          <div>
            <label
              htmlFor="import-settings"
              className="block text-dark-300 text-sm mb-2"
            >
              Import Settings
            </label>
            <input
              id="import-settings"
              type="file"
              accept=".json"
              onChange={handleImportSettings}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Danger Zone</h3>
        <div className="space-y-4">
          <Button
            type="button"
            onClick={async () => {
              if (
                await confirmDelete(
                  "Are you sure you want to delete all data? This cannot be undone.",
                )
              ) {
                // TODO: Implement data deletion
              }
            }}
            variant="soft-destructive"
            className="w-full text-left py-3"
          >
            <p className="font-medium">Delete All Data</p>
            <p className="text-sm text-red-500">
              Permanently delete all hosts, keys, snippets, and settings
            </p>
          </Button>
        </div>
      </div>
    </div>
  );
}
