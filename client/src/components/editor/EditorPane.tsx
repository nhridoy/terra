import { CodeIcon, DesktopTowerIcon, FolderIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { extractError } from "../../lib/extractError";
import { openDirectoryPicker } from "../../lib/localFs";
import { useEditorStore } from "../../stores/editorStore";
import type { Host } from "../../stores/hostStore";
import SftpHostPicker from "../sftp/SftpHostPicker";
import { Button } from "../ui/Button";
import Modal from "../ui/Modal";
import PaneHeader from "../ui/PaneHeader";
import EditorExplorer from "./EditorExplorer";
import EditorViewTree from "./EditorViewTree";

export default function EditorPane() {
  const connectionType = useEditorStore((s) => s.connectionType);
  const hostName = useEditorStore((s) => s.hostName);
  const hostAddress = useEditorStore((s) => s.hostAddress);
  const localPath = useEditorStore((s) => s.localPath);
  const connectLocal = useEditorStore((s) => s.connectLocal);
  const connectHost = useEditorStore((s) => s.connectHost);
  const disconnect = useEditorStore((s) => s.disconnect);
  const [showHostPicker, setShowHostPicker] = useState(false);

  const isHost = connectionType === "host";
  const displayName = isHost
    ? hostName || hostAddress || "Connected"
    : connectionType === "local"
      ? localPath || "Local"
      : "Editor";

  const handleConnectHost = (host: Host) => {
    connectHost(host.id, host.name, host.address, host.port, host.username);
  };

  const handleConnectLocal = async () => {
    try {
      const path = await openDirectoryPicker();
      if (path) connectLocal(path);
    } catch (err) {
      toast.error(extractError(err, "Failed to open directory picker"));
    }
  };

  return (
    <section
      aria-label={displayName}
      className="flex flex-col h-full min-h-0 min-w-0 bg-dark-950 relative"
    >
      {connectionType ? (
        <PaneHeader
          title={displayName}
          isActive
          closable
          onClose={disconnect}
        />
      ) : null}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {connectionType === "local" && localPath ? (
          <div className="flex h-full min-h-0 min-w-0">
            <EditorExplorer rootPath={localPath} />
            <EditorViewTree />
          </div>
        ) : connectionType === "host" ? (
          <div className="flex h-full min-h-0 min-w-0">
            <div className="w-1/3 min-w-0 h-full flex items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
              <div>
                <DesktopTowerIcon className="w-8 h-8 mx-auto mb-2 text-dark-600" />
                <p className="text-xs text-dark-400">
                  Remote explorer arrives with the SFTP transport phase
                </p>
              </div>
            </div>
            <EditorViewTree />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CodeIcon className="w-12 h-12 mx-auto mb-3 text-dark-600" />
              <p className="text-sm text-dark-400 mb-3">
                Connect to a host or local folder to start editing code
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => setShowHostPicker(true)}>
                  <DesktopTowerIcon className="w-3.5 h-3.5" />
                  Connect Host
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleConnectLocal}
                >
                  <FolderIcon className="w-3.5 h-3.5" />
                  Connect Local
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showHostPicker}
        onClose={() => setShowHostPicker(false)}
        title="Connect Host"
        maxWidth="max-w-lg"
      >
        <SftpHostPicker
          onConnect={handleConnectHost}
          onClose={() => setShowHostPicker(false)}
        />
      </Modal>
    </section>
  );
}
