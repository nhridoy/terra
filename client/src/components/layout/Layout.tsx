import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom'
import { move } from '@dnd-kit/helpers'
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import {
  ClockCounterClockwise,
  DesktopTower,
  FileText,
  FloppyDisk,
  Folder,
  FolderOpen,
  GearSix,
  Key,
  List,
  PencilSimple,
  Plus,
  SignOut,
  Terminal,
  Trash,
  User,
} from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import { getDeviceId } from '../../lib/device'
import { useAuthStore } from '../../stores/authStore'
import { type DropSide, useDragStore } from '../../stores/dragStore'
import { type Group, type Host, useHostStore } from '../../stores/hostStore'
import { useTabGroupStore } from '../../stores/tabGroupStore'
import {
  findLeaf,
  serializeWorkspaceLayout,
  useTerminalStore,
} from '../../stores/terminalStore'
import { useVaultStore } from '../../stores/vaultStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import GroupForm from '../groups/GroupForm'
import HistoryView from '../history/HistoryView'
import HostForm, { type HostData } from '../hosts/HostForm'
import HostsPage from '../hosts/HostsPage'
import KeyList from '../keychain/KeyList'
import SettingsPanel from '../settings/SettingsPanel'
import SftpLayout from '../sftp/SftpLayout'
import SnippetForm from '../snippets/SnippetForm'
import TerminalView from '../terminal/TerminalView'
import Modal from '../ui/Modal'
import WorkspaceForm from '../workspace/WorkspaceForm'
import WorkspaceList from '../workspace/WorkspaceList'
import SortableTab, { TabPreview } from './SortableTab'
import VaultSelector from './VaultSelector'

type SidebarItem =
  | 'hosts'
  | 'workspaces'
  | 'snippets'
  | 'keys'
  | 'history'
  | 'settings'

interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  tags: string[]
  vaultId?: string
  createdAt: string
}

interface KeyItem {
  id: string
  name: string
  description?: string
  keyType: string
  publicKey: string
  encryptedPrivateKey: string
  fingerprint?: string
  createdAt: string
}

function isDescendant(
  groups: Group[],
  groupId: string,
  potentialAncestorId: string,
): boolean {
  let current = groups.find((g) => g.id === groupId)
  while (current?.parentId) {
    if (current.parentId === potentialAncestorId) return true
    current = groups.find((g) => g.id === current?.parentId)
  }
  return false
}

export default function Layout() {
  const { isAuthenticated, user } = useAuthStore()
  const {
    hosts,
    groups,
    fetchHosts,
    fetchGroups,
    updateHost,
    updateGroup,
    deleteHost,
    deleteGroup,
  } = useHostStore()
  const {
    tabs,
    addTab,
    addEmptyTab,
    removeTab,
    setActiveTab,
    closeAllTabs,
    setTabOrder,
    mergeTabIntoPane,
    movePane,
    activeWorkspaceId,
    isDirty,
    activeWorkspaceName,
  } = useTerminalStore()
  const { logout: logoutAuth } = useAuthStore()
  const { currentVaultId, fetchVaults } = useVaultStore()
  const setDropPane = useDragStore((s) => s.setDropPane)
  const setSourcePane = useDragStore((s) => s.setSourcePane)

  const [activeSidebarItem, setActiveSidebarItem] =
    useState<SidebarItem>('hosts')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [activeView, setActiveView] = useState<'vault' | 'sftp' | string>(
    'vault',
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { source } = event.operation
    if (source?.data?.type === 'pane-source') {
      setSourcePane(String(source.data.paneId), String(source.data.tabId))
    }
    setDropPane(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { source, target } = event.operation
    const sourceType = source?.data?.type

    // Host → group drag
    if (sourceType === 'host-source' && target?.data?.type === 'group-target') {
      return
    }

    // Host → root drag
    if (sourceType === 'host-source' && target?.data?.type === 'root-target') {
      return
    }

    // Group → group drag
    if (
      sourceType === 'group-source' &&
      target?.data?.type === 'group-target'
    ) {
      return
    }

    // Group → root drag
    if (sourceType === 'group-source' && target?.data?.type === 'root-target') {
      return
    }

    if (target?.data?.type === 'pane') {
      const isPaneSource = sourceType === 'pane-source'
      // Tab drag: drop only on a different tab's pane.
      // Pane drag: drop only onto a pane within the SAME tab (not itself).
      const sameTab = isPaneSource
        ? target.data.tabId === source?.data?.tabId
        : target.data.tabId !== source?.id
      const isSelf = isPaneSource && target.data.paneId === source?.data?.paneId
      if (sameTab && !isSelf) {
        setDropPane({
          tabId: String(target.data.tabId),
          paneId: String(target.data.paneId),
          side: target.data.side as DropSide,
        })
        return
      }
    }
    setDropPane(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation
    if (event.canceled) {
      setDropPane(null)
      setSourcePane(null, null)
      return
    }
    if (!source) {
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Host → group drop (including breadcrumb segments).
    if (
      source.data?.type === 'host-source' &&
      target?.data?.type === 'group-target'
    ) {
      const hostId = String(source.data.hostId)
      const groupId = String(target.data.groupId)
      updateHost(hostId, { groupId })
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Host → root drop (ungroup host).
    if (
      source.data?.type === 'host-source' &&
      target?.data?.type === 'root-target'
    ) {
      const hostId = String(source.data.hostId)
      updateHost(hostId, { groupId: '' })
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Group → group drop (reparent), including breadcrumb segments.
    if (
      source.data?.type === 'group-source' &&
      target?.data?.type === 'group-target'
    ) {
      const sourceGroupId = String(source.data.groupId)
      const targetGroupId = String(target.data.groupId)
      if (
        sourceGroupId !== targetGroupId &&
        !isDescendant(groups, targetGroupId, sourceGroupId)
      ) {
        updateGroup(sourceGroupId, { parentId: targetGroupId })
      }
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Group → root drop zone (move to root).
    if (
      source.data?.type === 'group-source' &&
      target?.data?.type === 'root-target'
    ) {
      const sourceGroupId = String(source.data.groupId)
      const group = groups.find((g) => g.id === sourceGroupId)
      if (group?.parentId) {
        updateGroup(sourceGroupId, { parentId: '' })
      }
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Pane-to-pane reorder within a tab.
    if (source.data?.type === 'pane-source') {
      const sTabId = String(source.data.tabId)
      const sPaneId = String(source.data.paneId)
      if (
        target?.data?.type === 'pane' &&
        target.data.tabId === sTabId &&
        target.data.paneId !== sPaneId
      ) {
        movePane(
          sTabId,
          sPaneId,
          String(target.data.paneId),
          target.data.side as DropSide,
        )
      }
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Tab-to-pane merge (different tabs).
    if (target?.data?.type === 'pane' && target.data.tabId !== source?.id) {
      mergeTabIntoPane(
        String(source.id),
        String(target.data.tabId),
        String(target.data.paneId),
        target.data.side as DropSide,
      )
      setActiveView(String(target.data.tabId))
      setDropPane(null)
      setSourcePane(null, null)
    } else if (isSortable(source)) {
      const { initialIndex, index } = source
      if (initialIndex !== index) {
        const reordered = move(tabs, event)
        setTabOrder(reordered.map((t) => t.id))
      }
      setDropPane(null)
      setSourcePane(null, null)
    } else {
      setDropPane(null)
      setSourcePane(null, null)
    }
  }

  const [showHostForm, setShowHostForm] = useState(false)
  const [editingHost, setEditingHost] = useState<Host | null>(null)
  const [defaultGroupId, setDefaultGroupId] = useState<string | undefined>()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [newGroupParentId, setNewGroupParentId] = useState<string | null>(null)
  const [showSnippetForm, setShowSnippetForm] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false)
  const [showPresetForm, setShowPresetForm] = useState(false)
  const [presetTargetTabId, setPresetTargetTabId] = useState<string | null>(
    null,
  )

  // Handle mobile breakpoint
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const fetchSnippets = useCallback(async (vaultId?: string) => {
    try {
      const result = await invoke<Snippet[]>('list_snippets', {
        userId: useAuthStore.getState().user?.id || '',
        vaultId: vaultId || null,
      })
      setSnippets(result || [])
    } catch (e) {
      console.error('Failed to fetch snippets:', e)
    }
  }, [])

  const fetchKeys = async (vaultId?: string) => {
    try {
      const result = await invoke<KeyItem[]>('list_keys', {
        userId: useAuthStore.getState().user?.id || '',
        vaultId: vaultId || null,
      })
      return result || []
    } catch (e) {
      console.error('Failed to fetch keys:', e)
      return []
    }
  }

  // Fetch data on mount and whenever the selected vault changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchVaults()
      fetchHosts(currentVaultId || undefined)
      fetchGroups(currentVaultId || undefined)
      fetchSnippets(currentVaultId || undefined)
      useWorkspaceStore.getState().fetchWorkspaces(currentVaultId || undefined)
    }
  }, [
    isAuthenticated,
    currentVaultId,
    fetchHosts,
    fetchGroups,
    fetchVaults,
    fetchSnippets,
  ])

  const handleEditHost = (host: Host) => {
    setEditingHost(host)
    setShowHostForm(true)
  }

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group)
    setShowGroupForm(true)
  }

  const handleNewSnippet = () => {
    setEditingSnippet(null)
    setShowSnippetForm(true)
  }

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setShowSnippetForm(true)
  }

  const handleConnect = (host: Host) => {
    addTab(host.id, host.name, {
      hostAddress: host.address,
      hostPort: host.port,
      hostUsername: host.username,
      authType: host.authType,
      keyId: host.keyId,
    })
    if (isMobile) setSidebarOpen(false)
  }

  const handleSaveWorkspace = () => {
    const tabs = useTerminalStore.getState().tabs
    const payload = serializeWorkspaceLayout(tabs)
    if (payload.tabs.length === 0) return
    setShowWorkspaceForm(true)
  }

  const handleSaveCurrentWorkspace = () => {
    useTerminalStore.getState().saveCurrentWorkspace()
  }

  // Returns false if the user chose to keep their unsaved changes.
  const confirmDiscardUnsaved = async (): Promise<boolean> => {
    const { isDirty, activeWorkspaceId } = useTerminalStore.getState()
    if (isDirty && activeWorkspaceId) {
      return await tauriConfirm(
        'This workspace has unsaved changes. Discard them?',
        { title: 'Unsaved Changes', kind: 'warning' },
      )
    }
    return true
  }

  const handleWorkspaceFormSubmit = (name: string) => {
    // Use saveAsNewWorkspace so terminalStore tracks the new active workspace
    // (sets activeWorkspaceId, clears dirty state, refreshes the list).
    useTerminalStore
      .getState()
      .saveAsNewWorkspace(name, currentVaultId || undefined)
    setShowWorkspaceForm(false)
  }

  const handleSavePreset = (tabId: string) => {
    setPresetTargetTabId(tabId)
    setShowPresetForm(true)
  }

  const handlePresetFormSubmit = async (name: string) => {
    if (presetTargetTabId) {
      const tab = useTerminalStore
        .getState()
        .tabs.find((t) => t.id === presetTargetTabId)
      if (tab) {
        const created = await useTabGroupStore
          .getState()
          .createTabGroup(name, tab.root, currentVaultId || undefined)
        if (created) {
          // Associate this tab with the new preset so the "save as new" button
          // disappears and the per-tab dirty/save-changes UI takes over.
          useTerminalStore
            .getState()
            .setPresetForTab(presetTargetTabId, created.id, created.name)
        }
      }
    }
    setShowPresetForm(false)
    setPresetTargetTabId(null)
  }

  const handleSavePresetChanges = (tabId: string) => {
    useTerminalStore.getState().saveCurrentPreset(tabId)
  }

  const handleLogout = async () => {
    if (!(await confirmDiscardUnsaved())) return
    logoutAuth()
    closeAllTabs()
  }

  const sidebarItems: {
    id: SidebarItem
    label: string
    icon: React.ReactNode
  }[] = [
    {
      id: 'hosts',
      label: 'Hosts',
      icon: <DesktopTower className="w-5 h-5" />,
    },

    {
      id: 'workspaces',
      label: 'Workspaces',
      icon: <FolderOpen className="w-5 h-5" />,
    },

    {
      id: 'snippets',
      label: 'Snippets',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: 'keys',
      label: 'Keys',
      icon: <Key className="w-5 h-5" />,
    },
    {
      id: 'history',
      label: 'History',
      icon: <ClockCounterClockwise className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <GearSix className="w-5 h-5" />,
    },
  ]

  const renderSidebarContent = () => {
    switch (activeSidebarItem) {
      case 'workspaces':
        return (
          <WorkspaceList
            onSaveNew={handleSaveWorkspace}
            onLaunch={async (tabId) => {
              if (!(await confirmDiscardUnsaved())) return
              setActiveTab(tabId)
              setActiveView(tabId)
            }}
          />
        )

      case 'hosts':
        return (
          <HostsPage
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            onNewGroup={(parentId) => {
              setEditingGroup(null)
              setNewGroupParentId(parentId ?? null)
              setShowGroupForm(true)
            }}
            onNewHost={(groupId) => {
              setEditingHost(null)
              setDefaultGroupId(groupId)
              setShowHostForm(true)
            }}
            onEditGroup={handleEditGroup}
            onEditHost={handleEditHost}
            onConnect={handleConnect}
            onDeleteGroup={(id) => {
              deleteGroup(id)
              if (selectedGroupId === id) setSelectedGroupId(null)
            }}
            onDeleteHost={deleteHost}
          />
        )

      case 'snippets':
        return (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Snippets</h2>
              <button
                type="button"
                onClick={handleNewSnippet}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
              >
                <Plus className="w-3 h-3" />
                New Snippet
              </button>
            </div>

            {snippets.length === 0 ? (
              <button
                type="button"
                onClick={handleNewSnippet}
                className="p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50 w-full"
              >
                <FileText className="w-8 h-8 mx-auto mb-2 text-dark-600" />
                <p className="text-sm text-dark-400">
                  No snippets yet — click to create one
                </p>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="relative p-3 transition-colors rounded-lg bg-dark-800/50 hover:bg-dark-800 group"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-white truncate">
                        {snippet.name}
                      </span>
                    </div>
                    <p className="text-dark-500 text-xs mt-1 ml-[22px] truncate font-mono">
                      {snippet.command}
                    </p>
                    <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditSnippet(snippet)
                        }}
                        className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                        title="Edit snippet"
                      >
                        <PencilSimple className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (
                            await tauriConfirm('Delete this snippet?', {
                              title: 'Delete Snippet',
                              kind: 'warning',
                            })
                          ) {
                            const deviceId = await getDeviceId()
                            await invoke('delete_snippet', {
                              id: snippet.id,
                              deviceId,
                            })
                            fetchSnippets(currentVaultId || undefined)
                          }
                        }}
                        className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
                        title="Delete snippet"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'keys':
        return (
          <KeyList onMutation={() => fetchKeys(currentVaultId || undefined)} />
        )

      case 'history':
        return <HistoryView />

      case 'settings':
        return (
          <div className="flex items-center justify-center flex-1 text-sm text-dark-500">
            Settings
          </div>
        )
    }
  }

  const renderMainContent = () => {
    if (activeView === 'sftp') {
      return <SftpLayout />
    }

    if (activeView !== 'vault') {
      const activeTab = tabs.find((t) => t.id === activeView)
      if (activeTab) {
        return (
          <div className="flex flex-col flex-1 min-h-0">
            <TerminalView onSetActiveView={setActiveView} />
          </div>
        )
      }
    }

    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: (event) => {
            if (event.pointerType === 'touch') {
              return [
                new PointerActivationConstraints.Delay({
                  value: 250,
                  tolerance: 5,
                }),
              ]
            }
            return [new PointerActivationConstraints.Distance({ value: 5 })]
          },
        }),
      ]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-dark-950">
        {/* Full-width header (spans over sidebar area) */}
        <header className="fixed top-0 left-0 right-0 z-50 h-10 bg-dark-900 border-b border-dark-800 flex items-center px-2 gap-0.5">
          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors flex-shrink-0 mr-1"
          >
            <List className="w-4 h-4" />
          </button>

          {/* Vaults Tab */}
          <button
            type="button"
            onClick={() => setActiveView('vault')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors flex-shrink-0 ${
              activeView === 'vault'
                ? 'bg-dark-800 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            Vaults
            {activeView === 'vault' && <VaultSelector />}
          </button>

          {/* SFTP Tab */}
          <button
            type="button"
            onClick={() => setActiveView('sftp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors flex-shrink-0 ${
              activeView === 'sftp'
                ? 'bg-dark-800 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            SFTP
          </button>

          {/* Separator */}
          {tabs.length > 0 && (
            <div className="flex-shrink-0 w-px h-4 mx-1 bg-dark-700" />
          )}

          {/* Real Tabs (sortable, powered by dnd-kit) */}
          <div className="flex items-center">
            {tabs.map((tab, index) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                index={index}
                isActive={activeView === tab.id}
                onActivate={() => {
                  setActiveTab(tab.id)
                  setActiveView(tab.id)
                }}
                onSavePreset={handleSavePreset}
                onSavePresetChanges={handleSavePresetChanges}
                onClose={() => {
                  const isClosingActive = activeView === tab.id
                  removeTab(tab.id)
                  if (isClosingActive) {
                    const { tabs: remainingTabs } = useTerminalStore.getState()
                    if (remainingTabs.length > 0) {
                      setActiveView(remainingTabs[remainingTabs.length - 1].id)
                    } else {
                      setActiveView('vault')
                    }
                  }
                }}
              />
            ))}
          </div>

          {/* New Tab Button */}
          <button
            type="button"
            onClick={() => {
              const newTabId = addEmptyTab()
              setActiveView(newTabId)
            }}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors flex-shrink-0"
            title="New Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right-side actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Workspace save group (far right) */}
            {activeWorkspaceId && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="flex items-center gap-1.5 max-w-[140px] px-2 py-0.5 text-xs text-dark-300 bg-dark-800 rounded">
                  <span className="truncate">{activeWorkspaceName}</span>
                  {isDirty && (
                    <span
                      className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                      title="Unsaved changes"
                    />
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleSaveCurrentWorkspace}
                  disabled={!isDirty}
                  title={
                    isDirty
                      ? 'Save workspace (overwrite)'
                      : 'No unsaved changes'
                  }
                  className={`p-1.5 rounded transition-colors ${
                    isDirty
                      ? 'text-primary-400 hover:text-white hover:bg-dark-800'
                      : 'text-dark-600 cursor-default'
                  }`}
                >
                  <FloppyDisk className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSaveWorkspace}
                  disabled={!!activeWorkspaceId}
                  title={
                    activeWorkspaceId
                      ? 'Delete the current workspace to create a new one'
                      : 'Save as new workspace'
                  }
                  className={`p-1.5 rounded transition-colors ${
                    activeWorkspaceId
                      ? 'text-dark-600 cursor-default'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <span className="relative">
                    <FloppyDisk className="w-3.5 h-3.5" />
                    <Plus className="w-2 h-2 absolute -bottom-0.5 -right-0.5" />
                  </span>
                </button>
              </div>
            )}
            {!activeWorkspaceId && tabs.length > 1 && (
              <button
                type="button"
                onClick={handleSaveWorkspace}
                className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors flex-shrink-0"
                title="Save workspace"
              >
                <FloppyDisk className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs text-dark-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Connected</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSidebarItem('settings')
                setShowSettings(true)
              }}
              className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors"
              title="Settings"
            >
              <GearSix className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Sidebar (below header) */}
        {activeView === 'vault' && (
          <aside
            className={`fixed left-0 top-10 bottom-0 z-40 w-72 bg-dark-900 border-r border-dark-800 transform transition-transform duration-300 ease-in-out flex flex-col ${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}`}
          >
            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
              {sidebarItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setActiveSidebarItem(item.id)
                    if (item.id === 'settings') setShowSettings(true)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeSidebarItem === item.id
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
                  }`}
                >
                  <span className="flex items-center justify-center flex-shrink-0 w-5 h-5">
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Bottom: User & Actions */}
            <div className="p-3 space-y-2 border-t border-dark-800">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-dark-800/50">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-primary-600/20">
                  <User className="w-4 h-4 text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-xs truncate text-dark-400">
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center flex-1 gap-2 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-dark-800 hover:bg-red-600"
                >
                  <SignOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Mobile sidebar overlay */}
        {activeView === 'vault' && isMobile && sidebarOpen && (
          <button
            type="button"
            className="fixed bottom-0 left-0 right-0 z-30 top-10 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content (below header, right of sidebar when vault view) */}
        <main
          className={`pt-10 h-screen flex flex-col ${activeView === 'vault' ? 'lg:ml-72' : ''} ${activeView === 'vault' && isMobile && sidebarOpen ? 'ml-72' : ''}`}
        >
          {renderMainContent()}
        </main>

        {/* Modals */}
        <Modal
          open={showHostForm}
          onClose={() => {
            setShowHostForm(false)
            setEditingHost(null)
            setDefaultGroupId(undefined)
          }}
          title={editingHost ? 'Edit Host' : 'Add Host'}
          maxWidth="max-w-md"
        >
          <HostForm
            host={
              editingHost
                ? ({
                    id: editingHost.id,
                    name: editingHost.name,
                    address: editingHost.address,
                    port: editingHost.port,
                    username: editingHost.username || 'root',
                    authType: 'password',
                    color: editingHost.color,
                    groupId: editingHost.groupId || undefined,
                    tags: editingHost.tags,
                  } satisfies HostData)
                : undefined
            }
            defaultGroupId={defaultGroupId}
            onClose={() => {
              setShowHostForm(false)
              setEditingHost(null)
              setDefaultGroupId(undefined)
            }}
          />
        </Modal>

        <Modal
          open={showGroupForm}
          onClose={() => {
            setShowGroupForm(false)
            setEditingGroup(null)
            setNewGroupParentId(null)
          }}
          title={editingGroup ? 'Edit Group' : 'New Group'}
          maxWidth="max-w-md"
        >
          <GroupForm
            group={
              editingGroup
                ? {
                    ...editingGroup,
                    parentId: editingGroup.parentId ?? undefined,
                  }
                : undefined
            }
            defaultParentId={newGroupParentId || undefined}
            onClose={() => {
              setShowGroupForm(false)
              setEditingGroup(null)
              setNewGroupParentId(null)
            }}
          />
        </Modal>

        <Modal
          open={showSnippetForm}
          onClose={() => {
            setShowSnippetForm(false)
            setEditingSnippet(null)
          }}
          title={editingSnippet ? 'Edit Snippet' : 'New Snippet'}
          maxWidth="max-w-md"
        >
          <SnippetForm
            snippet={editingSnippet ?? undefined}
            onClose={() => {
              setShowSnippetForm(false)
              setEditingSnippet(null)
              fetchSnippets(currentVaultId || undefined)
            }}
          />
        </Modal>

        <Modal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          title="Settings"
          maxWidth="max-w-2xl"
        >
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </Modal>

        <WorkspaceForm
          open={showWorkspaceForm}
          title="Save Workspace"
          submitLabel="Save"
          onSubmit={handleWorkspaceFormSubmit}
          onClose={() => {
            setShowWorkspaceForm(false)
          }}
        />

        <WorkspaceForm
          open={showPresetForm}
          title="Save Quick Preset"
          submitLabel="Save"
          initialName=""
          onSubmit={handlePresetFormSubmit}
          onClose={() => {
            setShowPresetForm(false)
            setPresetTargetTabId(null)
          }}
        />

        <DragOverlay>
          {(source) => {
            if (source.data?.type === 'pane-source') {
              const tab = tabs.find((t) => t.id === source.data.tabId)
              const pane = tab ? findLeaf(tab.root, source.data.paneId) : null
              const statusClass =
                pane?.connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : pane?.connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : pane?.connectionStatus === 'error'
                      ? 'bg-red-500'
                      : 'bg-dark-500'
              return (
                <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${statusClass}`}
                    />
                    <Terminal className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {pane?.hostName || 'Empty pane'}
                    </span>
                  </div>
                </div>
              )
            }
            if (source.data?.type === 'host-source') {
              const host = hosts.find((h) => h.id === source.data.hostId)
              if (!host) return null
              return (
                <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: host.color || '#64748b' }}
                    />
                    <span className="text-sm font-medium text-white truncate">
                      {host.name}
                    </span>
                  </div>
                  <p className="text-dark-400 text-xs mt-1 ml-[18px] truncate">
                    {host.username ? `${host.username}@` : ''}
                    {host.address}:{host.port}
                  </p>
                </div>
              )
            }
            if (source.data?.type === 'group-source') {
              const group = groups.find((g) => g.id === source.data.groupId)
              if (!group) return null
              return (
                <div className="w-60 p-3 bg-dark-800 rounded-lg shadow-xl opacity-90 border border-dark-600">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {group.name}
                    </span>
                  </div>
                </div>
              )
            }
            const tab = tabs.find((t) => t.id === source.id)
            if (!tab) return null
            return <TabPreview tab={tab} />
          }}
        </DragOverlay>
      </div>
    </DragDropProvider>
  )
}
