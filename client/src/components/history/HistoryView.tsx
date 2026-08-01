import {
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  MagnifyingGlassIcon,
  TerminalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { formatDate } from "../../lib/fileHelpers";
import { formatDurationMs } from "../../lib/formatting";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import Select from "../ui/Select";
import Spinner from "../ui/Spinner";

interface SessionLog {
  id: string;
  hostId: string;
  hostName?: string;
  startedAt: string;
  endedAt?: string;
  data?: string;
  sizeBytes?: number;
}

export default function HistoryView() {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<SessionLog | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      setLogs([]);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredLogs = logs.filter((log) => {
    if (
      searchQuery &&
      !log.hostName?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    if (filter !== "all") {
      const logDate = new Date(log.startedAt);
      const now = new Date();
      const diffDays =
        (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);

      if (filter === "today" && diffDays >= 1) return false;
      if (filter === "week" && diffDays >= 7) return false;
      if (filter === "month" && diffDays >= 30) return false;
    }

    return true;
  });

  const formatDuration = (startedAt: string, endedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    return formatDurationMs(end - start);
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {/* Header */}
      <SectionHeader
        title="Session History"
        level="h3"
        className="text-sm tracking-wider uppercase text-dark-400 mb-3"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-dark-700 rounded-lg overflow-hidden">
            <MagnifyingGlassIcon
              className="w-5 h-5 text-dark-400 px-3"
              weight="bold"
            />
            <input
              type="text"
              placeholder="Search hosts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white placeholder-dark-400 px-3 py-2 w-64 focus:outline-none text-sm"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: "all", label: "All Time" },
              { value: "today", label: "Today" },
              { value: "week", label: "This Week" },
              { value: "month", label: "This Month" },
            ]}
            className="w-40"
          />
        </div>
      </SectionHeader>

      {/* History ListIcon */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={ClockCounterClockwiseIcon}
          title="No sessions found"
          description={
            searchQuery
              ? "Try adjusting your search"
              : "Connect to a host to see session history"
          }
        />
      ) : (
        <div className="space-y-1">
          {filteredLogs.map((log) => (
            <Button
              key={log.id}
              variant="ghost"
              onClick={() => setSelectedLog(log)}
              className={`w-full p-4 h-auto justify-start ${
                selectedLog?.id === log.id
                  ? "bg-dark-800/50 ring-1 ring-primary-500/50"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <TerminalIcon className="w-5 h-5 text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {log.hostName || "Unknown Host"}
                  </p>
                  <p className="text-sm text-dark-400">
                    {formatDate(log.startedAt)}
                  </p>
                  <p className="text-xs text-dark-500 mt-0.5">
                    Duration: {formatDuration(log.startedAt, log.endedAt)}
                    {log.sizeBytes &&
                      ` • ${(log.sizeBytes / 1024).toFixed(1)} KB`}
                  </p>
                </div>
              </div>
              <CaretRightIcon
                className="w-4 h-4 text-dark-500 shrink-0"
                weight="bold"
              />
            </Button>
          ))}
        </div>
      )}

      {/* Session Detail Panel */}
      {selectedLog && (
        <div className="bg-dark-800/50 rounded-lg border border-dark-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">
              Session Details
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedLog(null)}
            >
              <XIcon className="w-4 h-4" weight="bold" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Host
              </p>
              <p className="text-white font-mono text-sm mt-1">
                {selectedLog.hostName || "Unknown"}
              </p>
            </div>
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Duration
              </p>
              <p className="text-white font-mono text-sm mt-1">
                {formatDuration(selectedLog.startedAt, selectedLog.endedAt)}
              </p>
            </div>
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Started
              </p>
              <p className="text-white text-sm mt-1">
                {formatDate(selectedLog.startedAt)}
              </p>
            </div>
            <div className="bg-dark-900 rounded-lg p-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">
                Ended
              </p>
              <p className="text-white text-sm mt-1">
                {selectedLog.endedAt
                  ? formatDate(selectedLog.endedAt)
                  : "Active"}
              </p>
            </div>
            {selectedLog.sizeBytes && (
              <div className="bg-dark-900 rounded-lg p-3">
                <p className="text-dark-400 text-xs uppercase tracking-wider">
                  Data Transferred
                </p>
                <p className="text-white text-sm mt-1">
                  {(selectedLog.sizeBytes / 1024).toFixed(2)} KB
                </p>
              </div>
            )}
          </div>

          {selectedLog.data && (
            <div className="bg-dark-900 rounded-lg p-4 max-h-96 overflow-auto">
              <p className="text-dark-400 text-xs uppercase tracking-wider mb-2">
                Session Output
              </p>
              <pre className="font-mono text-sm text-dark-300 whitespace-pre-wrap break-words">
                {selectedLog.data}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
