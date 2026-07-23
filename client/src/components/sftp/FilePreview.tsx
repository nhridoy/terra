import { FileIcon, XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { extractError } from "../../lib/extractError";
import { Button } from "../ui/Button";
import Modal from "../ui/Modal";

interface FilePreviewProps {
  hostId: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export default function FilePreview({
  hostId,
  filePath,
  fileName,
  onClose,
}: FilePreviewProps) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<string>("");

  const loadFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const text = "";
      setContent(text);
      setEditContent(text);
    } catch (err: unknown) {
      setError(extractError(err, "Failed to read file"));
    } finally {
      setIsLoading(false);
    }
  }, [hostId, filePath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      setContent(editContent);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(extractError(err, "Failed to save file"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (name: string) => {
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const isTextFile = () => {
    const textExtensions = [
      "txt",
      "md",
      "json",
      "yaml",
      "yml",
      "toml",
      "xml",
      "js",
      "ts",
      "jsx",
      "tsx",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "sh",
      "bash",
      "zsh",
      "fish",
      "ps1",
      "bat",
      "cmd",
      "html",
      "css",
      "scss",
      "less",
      "sql",
      "csv",
      "log",
      "conf",
      "cfg",
      "ini",
      "env",
      "gitignore",
      "dockerignore",
      "editorconfig",
    ];
    const ext = getFileExtension(fileName);
    return textExtensions.includes(ext) || fileName.startsWith(".");
  };

  return (
    <Modal onClose={onClose}>
      <div className="bg-dark-900 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileIcon className="w-6 h-6 text-primary-500" weight="bold" />
            <div>
              <h3 className="text-white font-medium">{fileName}</h3>
              <p className="text-dark-400 text-sm">{filePath}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTextFile() && !isEditing && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyToClipboard}
            >
              Copy
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              Download
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XIcon className="w-5 h-5" weight="bold" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-dark-400">
              Loading...
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : isEditing ? (
            <div className="h-full flex flex-col">
              <textarea
                aria-label="File content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-dark-800 text-white p-4 font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
              />
              <div className="p-3 border-t border-dark-700 flex justify-end gap-2">
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          ) : (
            <pre className="h-full overflow-auto p-4 font-mono text-sm text-dark-300 bg-dark-800">
              {content}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
}
