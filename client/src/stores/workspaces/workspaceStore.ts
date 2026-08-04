import { create } from "zustand";

interface Workspace {
  id: string;
  name: string;
  layout: string;
  vaultId?: string;
  hostIds?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;

  fetchWorkspaces: (vaultId?: string) => Promise<void>;
  createWorkspace: (
    name: string,
    layout: Record<string, unknown>,
    vaultId?: string,
  ) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((_set) => ({
  workspaces: [],
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {},
  createWorkspace: async () => {},
  renameWorkspace: async () => {},
  deleteWorkspace: async () => {},
  clearError: () => {},
}));
