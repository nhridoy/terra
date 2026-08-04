import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useModal } from "@/hooks/useModal";
import { usePortForwardingStore } from "@/stores/portforwarding/portForwardingStore";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import Spinner from "@/components/ui/Spinner";
import { ForwardCard } from "@/components/portforwarding/cards/ForwardCard";
import PortForwardForm from "@/components/portforwarding/forms/PortForwardForm";

interface PortForwardingProps {
  hostId?: string;
}

export default function PortForwarding({ hostId }: PortForwardingProps) {
  const {
    forwards,
    isLoading,
    error,
    loadForwards,
    startForward,
    stopForward,
    toggleForward,
    clearError,
  } = usePortForwardingStore();
  const createModal = useModal();
  const deleteDialog = useModal();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadForwards();
  }, [loadForwards]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const onSubmit = async (data: {
    localPort: number;
    remoteHost: string;
    remotePort: number;
  }) => {
    if (!hostId) {
      toast.error("Connect to a host first");
      return;
    }
    await startForward(
      hostId,
      data.localPort,
      data.remoteHost,
      data.remotePort,
    );
    toast.success(`Port forward started on :${data.localPort}`);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    deleteDialog.show();
  };

  const confirmDeleteAction = async () => {
    deleteDialog.hide();
    const id = deleteTargetId;
    setDeleteTargetId(null);
    if (!id) return;
    await stopForward(id);
    toast.success("Port forward stopped");
  };

  const handleToggle = async (id: string) => {
    await toggleForward(id);
  };

  const displayForwards = hostId
    ? forwards.filter((f) => f.sessionId === hostId)
    : forwards;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <SectionHeader title="Port Forwarding" className="text-lg">
          <Button type="button" onClick={createModal.show} size="sm">
            + Add Forward
          </Button>
        </SectionHeader>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center text-dark-400 py-8">
            <Spinner className="mx-auto mb-4" />
            <p>Loading port forwards...</p>
          </div>
        ) : displayForwards.length === 0 ? (
          <EmptyState
            icon={ArrowsLeftRightIcon}
            title="No port forwards configured"
            description="Create a tunnel to forward ports"
          />
        ) : (
          <div className="space-y-3">
            {displayForwards.map((forward) => (
              <ForwardCard
                key={forward.id}
                forward={forward}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
      {createModal.open && (
        <PortForwardForm onClose={createModal.hide} onSubmit={onSubmit} />
      )}

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        message="Delete this port forward?"
        onConfirm={confirmDeleteAction}
        onCancel={() => {
          deleteDialog.hide();
          setDeleteTargetId(null);
        }}
      />
    </div>
  );
}
