import { toast } from "sonner";
import type { FileItem } from "./sftpTypes";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1.5 w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
      <div
        className="bg-primary-500 h-1.5 rounded-full transition-all duration-200"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function TransferToast({
  label,
  fileNames,
  loaded,
  total,
  isSingle,
}: {
  label: string;
  fileNames: string[];
  loaded: number;
  total: number;
  isSingle: boolean;
}) {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div className="text-sm">
      <div className="font-medium text-white">
        {isSingle ? fileNames[0] : `${fileNames.length} files`}
      </div>
      <div className="text-dark-300 text-xs mt-0.5">
        {label} {formatBytes(loaded)} / {formatBytes(total)} ({percent}%)
      </div>
      <ProgressBar percent={percent} />
    </div>
  );
}

export function showTransferStart(
  files: FileItem[],
  mode: "move" | "copy",
): string | number {
  const count = files.length;
  const verb = mode === "move" ? "Moving" : "Copying";
  const name = count === 1 ? files[0].name : `${count} files`;
  return toast.loading(
    <TransferToast
      label={`${verb} ${count === 1 ? "" : `${count} `}`}
      fileNames={files.map((f) => f.name)}
      loaded={0}
      total={files.reduce((s, f) => s + f.size, 0) || 1}
      isSingle={count === 1}
    />,
    { description: name },
  );
}

export function showTransferProgress(
  toastId: string | number,
  files: FileItem[],
  loaded: number,
  total: number,
  mode: "move" | "copy",
): void {
  const count = files.length;
  const verb = mode === "move" ? "Moving" : "Copying";
  toast.loading(
    <TransferToast
      label={`${verb} ${count === 1 ? "" : `${count} `}`}
      fileNames={files.map((f) => f.name)}
      loaded={loaded}
      total={total}
      isSingle={count === 1}
    />,
    { id: toastId },
  );
}

export function showTransferSuccess(
  toastId: string | number,
  files: FileItem[],
  mode: "move" | "copy",
): void {
  const count = files.length;
  const verb = mode === "move" ? "Moved" : "Copied";
  const name = count === 1 ? files[0].name : `${count} files`;
  toast.success(`${verb} ${name}`, { id: toastId });
}

export function showTransferError(
  toastId: string | number,
  files: FileItem[],
  mode: "move" | "copy",
  error: string,
): void {
  const count = files.length;
  const verb = mode === "move" ? "Move" : "Copy";
  toast.error(
    `Failed to ${verb} ${count === 1 ? files[0].name : `${count} files`}: ${error}`,
    {
      id: toastId,
    },
  );
}
