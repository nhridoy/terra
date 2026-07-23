import { create } from "zustand";
import { findLeaf as findLeafUtil } from "../lib/treeUtils";

type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export interface LeafNode {
  type: "leaf";
  id: string;
  hostId?: string;
  hostName: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  authType?: "password" | "key";
  keyId?: string;
  connectionType?: "ssh" | "local";
  shell?: string;
  title: string;
  connectionStatus: ConnectionStatus;
  lastConnected?: string;
  size: number;
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: PaneNode[];
  size: number;
}

export type PaneNode = LeafNode | SplitNode;

export interface WorkspaceLayout {
  tabs: Array<{
    title: string;
    root: PaneNode;
  }>;
}

export interface TerminalTab {
  id: string;
  root: PaneNode;
  activePaneId: string | null;
  isActive: boolean;
  title: string;
  activePresetId: string | null;
  activePresetName: string | null;
  savedPresetSnapshot: string;
  presetDirty: boolean;
}

export const findLeaf = findLeafUtil;

export function computeTabSnapshot(_root: PaneNode): string {
  return "";
}

export function serializeWorkspaceLayout(_tabs: TerminalTab[]): {
  tabs: Array<{ title: string; root: PaneNode }>;
  hostIds: string[];
} {
  return { tabs: [], hostIds: [] };
}

interface ConnectOptions {
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  authType?: "password" | "key";
  keyId?: string;
  connectionType?: "ssh" | "local";
  shell?: string;
}

interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;
  isDirty: boolean;
  savedSnapshot: string;

  addTab: (hostId: string, hostName: string, options?: ConnectOptions) => void;
  addEmptyTab: () => string;
  connectPane: (
    tabId: string,
    paneId: string,
    hostId: string,
    hostName: string,
    options?: ConnectOptions,
  ) => void;
  connectActivePane: (
    tabId: string,
    hostId: string,
    hostName: string,
    options?: ConnectOptions,
  ) => void;
  splitPane: (
    tabId: string,
    paneId: string,
    direction: "horizontal" | "vertical",
  ) => string;
  removePane: (tabId: string, paneId: string) => void;
  setActivePane: (tabId: string, paneId: string) => void;
  setActiveTab: (id: string) => void;
  updatePaneConnectionStatus: (
    tabId: string,
    paneId: string,
    status: ConnectionStatus,
  ) => void;
  updatePaneTitle: (tabId: string, paneId: string, title: string) => void;
  setPaneSizes: (tabId: string, splitId: string, sizes: number[]) => void;
  removeTab: (id: string) => void;
  closeAllTabs: () => void;
  reorderTabs: (draggedId: string, targetId: string, before: boolean) => void;
  setTabOrder: (ids: string[]) => void;
  movePane: (
    tabId: string,
    sourcePaneId: string,
    targetPaneId: string,
    side: "left" | "right" | "top" | "bottom",
  ) => void;
  mergeTabIntoPane: (
    sourceTabId: string,
    targetTabId: string,
    targetPaneId: string,
    side: "left" | "right" | "top" | "bottom",
  ) => void;
  launchWorkspace: (
    layout: WorkspaceLayout,
    workspaceId?: string,
    workspaceName?: string,
  ) => void;
  restorePreset: (
    preset: { id?: string; name?: string; layout: string },
    tabId: string,
  ) => void;
  saveCurrentPreset: (tabId: string) => Promise<void>;
  setPresetForTab: (
    tabId: string,
    presetId: string,
    presetName: string,
  ) => void;
  saveCurrentWorkspace: () => Promise<void>;
  saveAsNewWorkspace: (name: string, vaultId?: string) => Promise<void>;
}

export const useTerminalStore = create<TerminalState>(() => ({
  tabs: [],
  activeTabId: null,
  activeWorkspaceId: null,
  activeWorkspaceName: null,
  isDirty: false,
  savedSnapshot: "",

  addTab: () => {},
  addEmptyTab: () => "",
  connectPane: () => {},
  connectActivePane: () => {},
  splitPane: () => "",
  removePane: () => {},
  setActivePane: () => {},
  setActiveTab: () => {},
  updatePaneConnectionStatus: () => {},
  updatePaneTitle: () => {},
  setPaneSizes: () => {},
  removeTab: () => {},
  closeAllTabs: () => {},
  reorderTabs: () => {},
  setTabOrder: () => {},
  movePane: () => {},
  mergeTabIntoPane: () => {},
  launchWorkspace: () => {},
  restorePreset: () => {},
  saveCurrentPreset: async () => {},
  setPresetForTab: () => {},
  saveCurrentWorkspace: async () => {},
  saveAsNewWorkspace: async () => {},
}));
