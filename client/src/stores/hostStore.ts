import { create } from "zustand";

export interface Host {
  id: string;
  name: string;
  address: string;
  port: number;
  username?: string;
  groupId?: string | null;
  tags: string[];
  color?: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  vaultId?: string;
  authType?: "password" | "key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  keyId?: string;
}

export interface Group {
  id: string;
  name: string;
  parentId?: string | null;
  vaultId?: string;
  sortOrder: number;
  createdAt: string;
}

interface HostState {
  hosts: Host[];
  groups: Group[];
  selectedHost: Host | null;
  isLoading: boolean;
  error: string | null;

  fetchHosts: (vaultId?: string) => Promise<void>;
  fetchGroups: (vaultId?: string) => Promise<void>;
  createHost: (host: Partial<Host>) => Promise<void>;
  updateHost: (id: string, host: Partial<Host>) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;
  selectHost: (host: Host | null) => void;
  getCredentialsForHost: (
    hostId: string,
  ) => Promise<{ password: string; privateKey: string; passphrase: string }>;
  createGroup: (group: Partial<Group>) => Promise<void>;
  updateGroup: (id: string, group: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useHostStore = create<HostState>((_set) => ({
  hosts: [],
  groups: [],
  selectedHost: null,
  isLoading: false,
  error: null,

  fetchHosts: async () => {},
  fetchGroups: async () => {},
  createHost: async () => {},
  updateHost: async () => {},
  deleteHost: async () => {},
  selectHost: () => {},
  getCredentialsForHost: async () => ({
    password: "",
    privateKey: "",
    passphrase: "",
  }),
  createGroup: async () => {},
  updateGroup: async () => {},
  deleteGroup: async () => {},
  clearError: () => {},
}));
