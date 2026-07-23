import { ArrowsClockwiseIcon, SignOutIcon } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { StatusDot } from "../ui/StatusDot";

interface ConnectionStatusProps {
  status: "connected" | "connecting" | "disconnected" | "error";
  hostName?: string;
  lastConnected?: string;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

export default function ConnectionStatus({
  status,
  hostName,
  lastConnected,
  onDisconnect,
  onReconnect,
}: ConnectionStatusProps) {
  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case "connected":
        return "text-green-500";
      case "connecting":
        return "text-yellow-500";
      case "disconnected":
        return "text-dark-400";
      case "error":
        return "text-red-500";
      default:
        return "text-dark-400";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className={`text-sm ${getStatusTextColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {hostName && <span className="text-dark-300 text-sm">•</span>}
      {hostName && <span className="text-white text-sm">{hostName}</span>}

      {lastConnected && status === "disconnected" && (
        <span className="text-dark-500 text-xs">
          Last: {new Date(lastConnected).toLocaleTimeString()}
        </span>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {status === "connected" && onDisconnect && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDisconnect}
            className="hover:text-red-500"
            title="Disconnect"
          >
            <SignOutIcon className="w-4 h-4" weight="bold" />
          </Button>
        )}
        {(status === "disconnected" || status === "error") && onReconnect && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onReconnect}
            className="hover:text-primary-500"
            title="Reconnect"
          >
            <ArrowsClockwiseIcon className="w-4 h-4" weight="bold" />
          </Button>
        )}
      </div>
    </div>
  );
}
