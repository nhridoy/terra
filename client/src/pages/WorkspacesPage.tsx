import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import WorkspaceForm from "../components/workspace/WorkspaceForm";
import WorkspaceList from "../components/workspace/WorkspaceList";
import { useModal } from "../hooks/useModal";
import { useTerminalStore } from "../stores/terminalStore";
import { useVaultStore } from "../stores/vaultStore";

export default function WorkspacesPage() {
  const { currentVaultId } = useVaultStore();
  const { setActiveTab } = useTerminalStore();
  const formModal = useModal();

  const confirmDiscardUnsaved = async (): Promise<boolean> => {
    const { isDirty, activeWorkspaceId } = useTerminalStore.getState();
    if (isDirty && activeWorkspaceId) {
      return await tauriConfirm(
        "This workspace has unsaved changes. Discard them?",
        { title: "Unsaved Changes", kind: "warning" },
      );
    }
    return true;
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <WorkspaceList
        onSaveNew={() => formModal.show()}
        onLaunch={async (tabId) => {
          if (!(await confirmDiscardUnsaved())) return;
          setActiveTab(tabId);
        }}
      />

      {formModal.open && (
        <WorkspaceForm
          title="Save Workspace"
          submitLabel="Save"
          onSubmit={(name) => {
            useTerminalStore
              .getState()
              .saveAsNewWorkspace(name, currentVaultId || undefined);
            formModal.hide();
          }}
          onClose={() => formModal.hide()}
        />
      )}
    </div>
  );
}
