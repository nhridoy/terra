import {
  ArrowCounterClockwiseIcon,
  ArrowUUpLeftIcon,
  CheckIcon,
  GitBranchIcon,
  GitCommitIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { extractError } from "../../lib/extractError";
import { getFileIcon } from "../../lib/fileHelpers";
import { useEditorStore } from "../../stores/editorStore";

interface GitChange {
  path: string;
  index_status: string;
  worktree_status: string;
  staged: boolean;
  untracked: boolean;
}

interface GitStatus {
  branch: string | null;
  ahead: number;
  behind: number;
  changes: GitChange[];
  truncated: boolean;
}

const NOT_A_REPO = "not a git repository";
const GIT_MISSING = "Failed to run git";
const POLL_INTERVAL_MS = 5000;
const CHANGE_CAP = 10000;

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function ChangeRow({
  change,
  busy,
  onOpen,
  onStage,
  onUnstage,
  onDiscard,
}: {
  change: GitChange;
  busy: boolean;
  onOpen: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 pl-2 pr-1 h-7 hover:bg-dark-800/70 min-w-0">
      <button
        type="button"
        onClick={onOpen}
        title={`Open ${fileName(change.path)}`}
        className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
      >
        {getFileIcon(
          {
            name: fileName(change.path),
            path: change.path,
            type: "file",
            size: 0,
            permissions: "",
            owner: "",
            group: "",
            modifiedAt: "",
            isHidden: false,
          },
          14,
        )}
        <span className="text-[11px] text-dark-200 truncate min-w-0">
          {change.path}
        </span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {change.untracked ? (
          <button
            type="button"
            title="Stage changes"
            aria-label={`Stage ${change.path}`}
            disabled={busy}
            onClick={onStage}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-40"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        ) : change.staged ? (
          <>
            <button
              type="button"
              title="Unstage changes"
              aria-label={`Unstage ${change.path}`}
              disabled={busy}
              onClick={onUnstage}
              className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-40"
            >
              <ArrowUUpLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Discard changes"
              aria-label={`Discard changes in ${change.path}`}
              disabled={busy}
              onClick={onDiscard}
              className="p-1 rounded text-dark-400 hover:text-red-400 hover:bg-dark-700 disabled:opacity-40"
            >
              <ArrowCounterClockwiseIcon className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              title="Stage changes"
              aria-label={`Stage ${change.path}`}
              disabled={busy}
              onClick={onStage}
              className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-40"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Discard changes"
              aria-label={`Discard changes in ${change.path}`}
              disabled={busy}
              onClick={onDiscard}
              className="p-1 rounded text-dark-400 hover:text-red-400 hover:bg-dark-700 disabled:opacity-40"
            >
              <ArrowCounterClockwiseIcon className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ChangeSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 h-6 text-[10px] font-semibold uppercase tracking-wider text-dark-400 select-none">
        <span>{title}</span>
        <span className="text-dark-500">{count}</span>
        {action && (
          <span className="ml-auto flex items-center gap-0.5">{action}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function SectionAction({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="px-1 py-0.5 rounded text-[10px] text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
    >
      {label}
    </button>
  );
}
export default function SourceControlPanel() {
  const connectionType = useEditorStore((s) => s.connectionType);
  const localPath = useEditorStore((s) => s.localPath);
  const openFile = useEditorStore((s) => s.openFile);

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requestIdRef = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      if (!localPath) return;
      const id = ++requestIdRef.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await invoke<GitStatus>("git_status", {
          root: localPath,
        });
        if (id === requestIdRef.current) setStatus(result);
      } catch (err) {
        if (id === requestIdRef.current) {
          setStatus(null);
          setError(extractError(err, "Unable to load git status"));
        }
      } finally {
        if (id === requestIdRef.current && !silent) setLoading(false);
      }
    },
    [localPath],
  );

  useEffect(() => {
    setStatus(null);
    setError(null);
    void load();
    const interval = setInterval(() => {
      if (!busyRef.current) void load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const runAction = useCallback(
    async (command: string, args: Record<string, unknown>) => {
      if (!localPath) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await invoke(command, { root: localPath, ...args });
        await load();
      } catch (err) {
        toast.error(extractError(err, "Operation failed"));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [localPath, load],
  );

  const handleDiscard = useCallback(
    async (path: string) => {
      if (!localPath) return;
      const confirmed = await tauriConfirm(
        `Discard all changes in "${path}"? This cannot be undone.`,
        { title: "Discard Changes", kind: "warning" },
      );
      if (confirmed) void runAction("git_discard", { path });
    },
    [localPath, runAction],
  );

  const handleCommit = () => {
    const text = message.trim();
    if (!text || !staged.length || busy) return;
    void runAction("git_commit", { message: text }).then(() => setMessage(""));
  };

  const gitMissing = error?.includes(GIT_MISSING);

  const notARepo =
    !loading && error !== null && error.toLowerCase().includes(NOT_A_REPO);

  const changes = status?.changes ?? [];
  const staged = changes.filter((c) => c.staged);
  const modified = changes.filter((c) => !c.staged && !c.untracked);
  const untracked = changes.filter((c) => c.untracked);

  if (connectionType !== "local" || !localPath) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
        <GitBranchIcon className="w-8 h-8 mb-2 text-dark-600" weight="bold" />
        <p className="text-xs text-dark-400">
          Source control requires a local workspace
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 border-r border-dark-800 min-h-0">
      {/* Panel header */}
      <div className="flex items-center gap-1.5 pl-3 pr-2 h-8 border-b border-dark-800 shrink-0">
        <GitBranchIcon className="w-3.5 h-3.5 text-dark-400" weight="bold" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-300">
          Source Control
        </span>
        <button
          type="button"
          title="Refresh"
          aria-label="Refresh source control"
          onClick={() => void load()}
          className="ml-auto p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-40"
          disabled={loading || busy}
        >
          <ArrowCounterClockwiseIcon
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Branch + commit box */}
      {status && (
        <div className="px-2 py-2 space-y-2 shrink-0 border-b border-dark-800">
          <div className="flex items-center gap-1.5 min-w-0">
            <GitCommitIcon className="w-3.5 h-3.5 text-primary-400 shrink-0" />
            <span className="text-[11px] text-dark-200 truncate min-w-0">
              {status.branch ?? "Detached HEAD"}
            </span>
            {(status.ahead > 0 || status.behind > 0) && (
              <span className="text-[10px] text-dark-400 shrink-0">
                {status.ahead > 0 ? `${status.ahead}\u2191` : ""}
                {status.ahead > 0 && status.behind > 0 ? " " : ""}
                {status.behind > 0 ? `${status.behind}\u2193` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommit();
              }}
              placeholder="Message (Enter to commit)"
              aria-label="Commit message"
              disabled={busy}
              className="flex-1 min-w-0 h-7 bg-dark-950 border border-dark-700 focus:border-primary-500 rounded px-2 text-xs text-white placeholder:text-dark-500 outline-none disabled:opacity-50"
            />
            <button
              type="button"
              title="Commit staged changes"
              aria-label="Commit staged changes"
              onClick={handleCommit}
              disabled={busy || staged.length === 0 || !message.trim()}
              className="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
            >
              <CheckIcon className="w-4 h-4" weight="bold" />
            </button>
          </div>
          {staged.length === 0 && (
            <p className="text-[10px] text-dark-500">
              No staged changes &mdash; stage files below to commit.
            </p>
          )}
        </div>
      )}

      {/* Changes */}
      <div className="flex-1 overflow-y-auto min-h-0 text-xs">
        {loading && !status ? (
          <div className="flex items-center gap-2 px-3 py-2 text-dark-400">
            <ArrowCounterClockwiseIcon className="w-3.5 h-3.5 animate-spin" />
            Loading repository status...
          </div>
        ) : gitMissing ? (
          <div className="px-4 py-6 text-center">
            <GitBranchIcon
              className="w-8 h-8 mx-auto mb-2 text-dark-600"
              weight="bold"
            />
            <p className="text-xs text-dark-400">
              Git could not be found on this system.
            </p>
            <p className="text-[11px] text-dark-500 mt-1">
              Install Git from git-scm.com, then restart the app.
            </p>
          </div>
        ) : notARepo ? (
          <div className="px-4 py-6 text-center">
            <GitBranchIcon
              className="w-8 h-8 mx-auto mb-2 text-dark-600"
              weight="bold"
            />
            <p className="text-xs text-dark-400">
              No Git repository detected in this folder.
            </p>
            <p className="text-[11px] text-dark-500 mt-1">
              Run <code className="text-dark-300">git init</code> in the folder,
              or open a folder inside a repository.
            </p>
          </div>
        ) : error ? (
          <div className="px-3 py-2 text-red-400">{error}</div>
        ) : status ? (
          <div className="pb-2">
            {status.truncated && (
              <div className="px-3 py-1.5 text-[10px] text-dark-500">
                Showing first {CHANGE_CAP} changes.
              </div>
            )}
            <ChangeSection
              title="Staged Changes"
              count={staged.length}
              action={
                <SectionAction
                  label="Unstage All"
                  title="Unstage all staged changes"
                  disabled={busy || staged.length === 0}
                  onClick={() => void runAction("git_unstage_all", {})}
                />
              }
            >
              {staged.map((change) => (
                <ChangeRow
                  key={change.path}
                  change={change}
                  busy={busy}
                  onOpen={() =>
                    openFile(change.path, fileName(change.path), true)
                  }
                  onStage={() =>
                    void runAction("git_stage", { path: change.path })
                  }
                  onUnstage={() =>
                    void runAction("git_unstage", { path: change.path })
                  }
                  onDiscard={() => void handleDiscard(change.path)}
                />
              ))}
            </ChangeSection>
            <ChangeSection
              title="Changes"
              count={modified.length}
              action={
                <SectionAction
                  label="Stage All"
                  title="Stage all modified and untracked files"
                  disabled={busy || modified.length + untracked.length === 0}
                  onClick={() => void runAction("git_stage_all", {})}
                />
              }
            >
              {modified.map((change) => (
                <ChangeRow
                  key={change.path}
                  change={change}
                  busy={busy}
                  onOpen={() =>
                    openFile(change.path, fileName(change.path), true)
                  }
                  onStage={() =>
                    void runAction("git_stage", { path: change.path })
                  }
                  onUnstage={() => {}}
                  onDiscard={() => void handleDiscard(change.path)}
                />
              ))}
            </ChangeSection>
            <ChangeSection title="Untracked" count={untracked.length}>
              {untracked.map((change) => (
                <ChangeRow
                  key={change.path}
                  change={change}
                  busy={busy}
                  onOpen={() =>
                    openFile(change.path, fileName(change.path), true)
                  }
                  onStage={() =>
                    void runAction("git_stage", { path: change.path })
                  }
                  onUnstage={() => {}}
                  onDiscard={() => {}}
                />
              ))}
            </ChangeSection>
            {changes.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-dark-500">
                Clean working tree. Nothing to commit.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
