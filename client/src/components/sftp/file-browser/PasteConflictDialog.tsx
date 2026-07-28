import { useState } from "react";
import { generateAutoName } from "../../../lib/fileHelpers";
import { Button } from "../../ui/Button";
import Modal from "../../ui/Modal";

interface PasteConflictDialogProps {
  conflicts: { srcPath: string; dstPath: string; dstName: string }[];
  onConfirm: (
    overrides: Map<
      string,
      { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
    >,
  ) => void;
  onCancel: () => void;
}

export default function PasteConflictDialog({
  conflicts,
  onConfirm,
  onCancel,
}: PasteConflictDialogProps) {
  const [resolutions, setResolutions] = useState<
    Map<
      string,
      { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
    >
  >(() => {
    const map = new Map<
      string,
      { action: "replace" | "rename" | "auto" | "skip"; newName?: string }
    >();
    for (const c of conflicts) {
      map.set(c.srcPath, { action: "replace" });
    }
    return map;
  });

  const setAction = (
    srcPath: string,
    action: "replace" | "rename" | "auto" | "skip",
  ) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      const existing = next.get(srcPath) || { action: "replace" as const };
      next.set(srcPath, { ...existing, action });
      return next;
    });
  };

  const setNewName = (srcPath: string, newName: string) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      const existing = next.get(srcPath) || { action: "replace" as const };
      next.set(srcPath, { ...existing, newName });
      return next;
    });
  };

  const applyToAll = (action: "replace" | "rename" | "auto" | "skip") => {
    setResolutions((prev) => {
      const next = new Map(prev);
      for (const [key, val] of prev) {
        next.set(key, { ...val, action });
      }
      return next;
    });
  };

  return (
    <Modal open onClose={onCancel} title="Paste Conflicts" maxWidth="max-w-md">
      <div data-paste-dialog className="space-y-3">
        <p className="text-sm text-dark-300">
          {conflicts.length} file{conflicts.length > 1 ? "s" : ""} already exist
          {conflicts.length === 1 ? "s" : ""} in this directory.
        </p>

        <div className="flex gap-2 pb-2 border-b border-dark-700">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => applyToAll("replace")}
          >
            Replace all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => applyToAll("auto")}
          >
            Auto rename all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => applyToAll("skip")}
          >
            Skip all
          </Button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {conflicts.map((conflict) => {
            const res = resolutions.get(conflict.srcPath) || {
              action: "replace" as const,
            };
            return (
              <div
                key={conflict.srcPath}
                className="bg-dark-800 rounded-lg p-3 space-y-2"
              >
                <div className="text-sm text-white font-mono truncate">
                  {conflict.dstName}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant={res.action === "replace" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setAction(conflict.srcPath, "replace")}
                  >
                    Replace
                  </Button>
                  <Button
                    variant={res.action === "rename" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setAction(conflict.srcPath, "rename")}
                  >
                    Rename
                  </Button>
                  <Button
                    variant={res.action === "auto" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setAction(conflict.srcPath, "auto")}
                  >
                    Auto rename
                  </Button>
                  <Button
                    variant={res.action === "skip" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setAction(conflict.srcPath, "skip")}
                  >
                    Skip
                  </Button>
                </div>
                {res.action === "rename" && (
                  <input
                    aria-label="New file name"
                    value={res.newName || conflict.dstName}
                    onChange={(e) =>
                      setNewName(conflict.srcPath, e.target.value)
                    }
                    className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary-500 focus:outline-none"
                  />
                )}
                {res.action === "auto" && (
                  <div className="text-xs text-dark-400 font-mono">
                    {generateAutoName(
                      conflict.dstName,
                      conflicts.map((c) => c.dstName),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-dark-700">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(resolutions)}>
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
