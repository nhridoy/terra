import { create } from "zustand";
import type { PaneNode } from "@/stores/terminal/terminalStore";

export interface TabGroup {
  id: string;
  name: string;
  layout: string;
  vaultId?: string;
  createdAt?: string;
}

export const useTabGroupStore = create<{
  tabGroups: TabGroup[];
  fetchTabGroups: (vaultId?: string) => Promise<void>;
  createTabGroup: (
    name: string,
    root: PaneNode,
    vaultId?: string,
  ) => Promise<TabGroup | null>;
  renameTabGroup: (id: string, name: string) => Promise<void>;
  deleteTabGroup: (id: string) => Promise<void>;
}>((_set) => ({
  tabGroups: [],

  fetchTabGroups: async () => {},
  createTabGroup: async () => null,
  renameTabGroup: async () => {},
  deleteTabGroup: async () => {},
}));
