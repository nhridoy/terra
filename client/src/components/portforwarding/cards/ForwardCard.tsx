import { PauseIcon, PlayIcon, TrashIcon } from "@phosphor-icons/react";
import type { PortForward } from "@/stores/portforwarding/portForwardingStore";
import { Button } from "@/components/ui/Button";

interface ForwardCardProps {
  forward: PortForward;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ForwardCard({ forward, onToggle, onDelete }: ForwardCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        forward.active
          ? "bg-dark-800 border-dark-700"
          : "bg-dark-900 border-dark-800 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              forward.active ? "bg-green-500" : "bg-dark-500"
            }`}
          />
          <div>
            <div className="text-white font-medium">
              :{forward.localPort} → {forward.remoteHost}:{forward.remotePort}
            </div>
            <div className="text-dark-400 text-sm">Local Forward</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => onToggle(forward.id)}
            variant="ghost"
            size="icon-sm"
            className={
              forward.active ? "text-green-500 hover:text-green-400" : ""
            }
          >
            {forward.active ? (
              <PauseIcon className="w-5 h-5" weight="bold" />
            ) : (
              <PlayIcon className="w-5 h-5" weight="bold" />
            )}
          </Button>
          <Button
            type="button"
            onClick={() => onDelete(forward.id)}
            variant="ghost"
            size="icon-sm"
            className="hover:text-red-500"
          >
            <TrashIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
