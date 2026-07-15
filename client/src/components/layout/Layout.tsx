import { useState, useEffect } from 'react'
import { DragDropProvider, DragOverlay, DragOverEvent, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { move } from '@dnd-kit/helpers'
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { useHostStore } from '../../stores/hostStore'
import { useTerminalStore, findLeaf, serializeWorkspaceLayout } from '../../stores/terminalStore'
import { useAuthStore } from '../../stores/authStore'
import { useVaultStore } from '../../stores/vaultStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useTabGroupStore } from '../../stores/tabGroupStore'
import { useDragStore, type DropSide } from '../../stores/dragStore'
import api from '../../lib/api'
import Modal from '../ui/Modal'
import HostForm from '../hosts/HostForm'
import GroupForm from '../groups/GroupForm'
import SnippetForm from '../snippets/SnippetForm'
import KeyList from '../keychain/KeyList'
import HistoryView from '../history/HistoryView'
import SettingsPanel from '../settings/SettingsPanel'
import TerminalView from '../terminal/TerminalView'
import VaultSelector from './VaultSelector'
import SortableTab, { TabPreview } from './SortableTab'
import PanePreview from '../terminal/PanePreview'
import WorkspaceList from '../workspace/WorkspaceList'
import WorkspaceForm from '../workspace/WorkspaceForm'

type SidebarItem =
  | 'hosts'
  | 'workspaces'
  | 'snippets'
  | 'keys'
  | 'history'
  | 'settings'

interface Group {
  id: string
  name: string
  parentId?: string | null
  sortOrder: number
  createdAt: string
}

function getChildren(groups: Group[], parentId: string): Group[] {
  return groups.filter((g) => g.parentId === parentId)
}

function getAncestors(groups: Group[], groupId: string): Group[] {
  const ancestors: Group[] = []
  let current = groups.find((g) => g.id === groupId)
  while (current?.parentId) {
    const parent = groups.find((g) => g.id === current!.parentId)
    if (parent) {
      ancestors.unshift(parent)
      current = parent
    } else break
  }
  return ancestors
}

function isDescendant(groups: Group[], groupId: string, potentialAncestorId: string): boolean {
  let current = groups.find((g) => g.id === groupId)
  while (current?.parentId) {
    if (current.parentId === potentialAncestorId) return true
    current = groups.find((g) => g.id === current!.parentId)
  }
  return false
}

function BreadcrumbDropTarget({ groupId, onClick, children }: { groupId: string | null; onClick: () => void; children: React.ReactNode }) {
  const { ref, isDropTarget } = useDroppable({
    id: groupId ? `breadcrumb:${groupId}` : 'breadcrumb:root',
    data: groupId ? { type: 'group-target', groupId } : { type: 'root-target' },
  })
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        isDropTarget
          ? 'bg-primary-600/20 text-primary-400 ring-1 ring-primary-500'
          : 'bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function DraggableHostCard({
  host,
  isDropTarget,
  onConnect,
  onEdit,
  onDelete,
}: {
  host: any
  isDropTarget?: boolean
  onConnect: (host: any) => void
  onEdit: (host: any) => void
  onDelete: (id: string) => void
}) {
  const { ref, isDragging } = useDraggable({
    id: `host:${host.id}`,
    data: { type: 'host-source', hostId: host.id },
  })

  return (
    <div
      ref={ref}
      onClick={() => onConnect(host)}
      className={`relative p-3 transition-colors rounded-lg cursor-pointer bg-dark-800/50 hover:bg-dark-800 group ${isDragging ? 'opacity-50' : ''} ${isDropTarget ? 'ring-2 ring-primary-500' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: host.color || '#64748b' }}
        />
        <span className="text-sm font-medium text-white truncate">{host.name}</span>
      </div>
      <p className="text-dark-500 text-xs mt-1 ml-[18px] truncate">
        {host.username ? `${host.username}@` : ''}{host.address}:{host.port}
      </p>
      <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(host) }}
          className="p-1 rounded text-dark-400 hover:text-yellow-500 hover:bg-dark-700"
          title="Edit host"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete host "${host.name}"?`)) onDelete(host.id) }}
          className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
          title="Delete host"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function DroppableGroupCard({
  group,
  hostCount,
  childCount,
  onClick,
  onEdit,
  onDelete,
}: {
  group: Group
  hostCount: number
  childCount: number
  onClick: () => void
  onEdit: (group: Group) => void
  onDelete: (groupId: string) => void
}) {
  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: `group:${group.id}`,
    data: { type: 'group-target', groupId: group.id },
  })
  const { ref: draggableRef, isDragging } = useDraggable({
    id: `group-drag:${group.id}`,
    data: { type: 'group-source', groupId: group.id },
  })

  const setRefs = (el: HTMLDivElement | null) => {
    droppableRef(el)
    draggableRef(el)
  }

  return (
    <div
      ref={setRefs}
      onClick={onClick}
      className={`relative p-3 transition-colors rounded-lg cursor-pointer group ${
        isDragging
          ? 'opacity-50'
          : isDropTarget
            ? 'bg-primary-600/20 ring-2 ring-primary-500'
            : 'bg-dark-800/50 hover:bg-dark-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="flex-1 text-sm font-medium text-white truncate">{group.name}</span>
      </div>
      <p className="mt-1 ml-6 text-xs text-dark-500">
        {hostCount} host{hostCount === 1 ? '' : 's'}
        {childCount > 0 && ` · ${childCount} sub-group${childCount === 1 ? '' : 's'}`}
      </p>
      <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(group) }}
          className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
          title="Edit group"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete group "${group.name}"?`)) onDelete(group.id) }}
          className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
          title="Delete group"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
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
  const { tabs, addTab, addEmptyTab, removeTab, setActiveTab, closeAllTabs, setTabOrder, mergeTabIntoPane, movePane, activeWorkspaceId, isDirty, activeWorkspaceName } = useTerminalStore()
  const { logout: logoutAuth } = useAuthStore()
  const { currentVaultId } = useVaultStore()
  const setDropPane = useDragStore((s) => s.setDropPane)
  const setSourcePane = useDragStore((s) => s.setSourcePane)

  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarItem>('hosts')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [activeView, setActiveView] = useState<'vault' | 'sftp' | string>('vault')

  const handleDragStart = (event: any) => {
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
    if (sourceType === 'group-source' && target?.data?.type === 'group-target') {
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
    if (source.data?.type === 'host-source' && target?.data?.type === 'group-target') {
      const hostId = String(source.data.hostId)
      const groupId = String(target.data.groupId)
      updateHost(hostId, { groupId })
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Host → root drop (ungroup host).
    if (source.data?.type === 'host-source' && target?.data?.type === 'root-target') {
      const hostId = String(source.data.hostId)
      updateHost(hostId, { groupId: '' })
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Group → group drop (reparent), including breadcrumb segments.
    if (source.data?.type === 'group-source' && target?.data?.type === 'group-target') {
      const sourceGroupId = String(source.data.groupId)
      const targetGroupId = String(target.data.groupId)
      if (sourceGroupId !== targetGroupId && !isDescendant(groups, targetGroupId, sourceGroupId)) {
        updateGroup(sourceGroupId, { parentId: targetGroupId })
      }
      setDropPane(null)
      setSourcePane(null, null)
      return
    }

    // Group → root drop zone (move to root).
    if (source.data?.type === 'group-source' && target?.data?.type === 'root-target') {
      const sourceGroupId = String(source.data.groupId)
      const group = groups.find((g) => g.id === sourceGroupId)
      if (group && group.parentId) {
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
  const [editingHost, setEditingHost] = useState<any>(null)
  const [defaultGroupId, setDefaultGroupId] = useState<string | undefined>()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any>(null)
  const [newGroupParentId, setNewGroupParentId] = useState<string | null>(null)
  const [showSnippetForm, setShowSnippetForm] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [snippets, setSnippets] = useState<any[]>([])
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false)
  const [showPresetForm, setShowPresetForm] = useState(false)
  const [presetTargetTabId, setPresetTargetTabId] = useState<string | null>(null)

  // Handle mobile breakpoint
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const fetchSnippets = async (vaultId?: string) => {
    try {
      const res = await api.listSnippets(vaultId)
      setSnippets(res.snippets || [])
    } catch (e) {
      console.error('Failed to fetch snippets:', e)
    }
  }

  const fetchKeys = async (vaultId?: string) => {
    try {
      const res = await api.listKeys(vaultId)
      return res.keys || []
    } catch (e) {
      console.error('Failed to fetch keys:', e)
      return []
    }
  }

  // Fetch data on mount and whenever the selected vault changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchHosts(currentVaultId || undefined)
      fetchGroups(currentVaultId || undefined)
      fetchSnippets(currentVaultId || undefined)
      useWorkspaceStore.getState().fetchWorkspaces(currentVaultId || undefined)
    }
  }, [isAuthenticated, currentVaultId, fetchHosts, fetchGroups])

  const handleNewHost = () => {
    setEditingHost(null)
    setDefaultGroupId(undefined)
    setShowHostForm(true)
  }

  const handleNewGroupInGroup = (parentId: string) => {
    setEditingGroup(null)
    setNewGroupParentId(parentId)
    setShowGroupForm(true)
  }

  const handleNewHostInGroup = (groupId: string) => {
    setEditingHost(null)
    setDefaultGroupId(groupId)
    setShowHostForm(true)
  }

  const handleEditHost = (host: any) => {
    setEditingHost(host)
    setShowHostForm(true)
  }

  const handleNewGroup = () => {
    setEditingGroup(null)
    setShowGroupForm(true)
  }

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group)
    setShowGroupForm(true)
  }

  const handleNewSnippet = () => {
    setEditingSnippet(null)
    setShowSnippetForm(true)
  }

  const handleEditSnippet = (snippet: any) => {
    setEditingSnippet(snippet)
    setShowSnippetForm(true)
  }

  const handleConnect = (host: any) => {
    addTab(host.id, host.name, host)
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
  const confirmDiscardUnsaved = (): boolean => {
    const { isDirty, activeWorkspaceId } = useTerminalStore.getState()
    if (isDirty && activeWorkspaceId) {
      return window.confirm('This workspace has unsaved changes. Discard them?')
    }
    return true
  }

  const handleWorkspaceFormSubmit = (name: string) => {
    // Use saveAsNewWorkspace so terminalStore tracks the new active workspace
    // (sets activeWorkspaceId, clears dirty state, refreshes the list).
    useTerminalStore.getState().saveAsNewWorkspace(name, currentVaultId || undefined)
    setShowWorkspaceForm(false)
  }

  const handleSavePreset = (tabId: string) => {
    setPresetTargetTabId(tabId)
    setShowPresetForm(true)
  }

  const handlePresetFormSubmit = async (name: string) => {
    if (presetTargetTabId) {
      const tab = useTerminalStore.getState().tabs.find((t) => t.id === presetTargetTabId)
      if (tab) {
        const created = await useTabGroupStore.getState().createTabGroup(name, tab.root, currentVaultId || undefined)
        if (created) {
          // Associate this tab with the new preset so the "save as new" button
          // disappears and the per-tab dirty/save-changes UI takes over.
          useTerminalStore.getState().setPresetForTab(presetTargetTabId, created.id, created.name)
        }
      }
    }
    setShowPresetForm(false)
    setPresetTargetTabId(null)
  }

  const handleSavePresetChanges = (tabId: string) => {
    useTerminalStore.getState().saveCurrentPreset(tabId)
  }

  const handleLogout = () => {
    if (!confirmDiscardUnsaved()) return
    logoutAuth()
    closeAllTabs()
  }

  const sidebarItems: { id: SidebarItem; label: string; icon: React.ReactNode }[] = [
    {
      id: 'hosts',
      label: 'Hosts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
    },

    {
      id: 'workspaces',
      label: 'Workspaces',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v5a1 1 0 001 1h5" />
        </svg>
      ),
    },

    {
      id: 'snippets',
      label: 'Snippets',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'keys',
      label: 'Keys',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  const renderSidebarContent = () => {
    switch (activeSidebarItem) {
      case 'workspaces':
        return (
          <WorkspaceList
            onSaveNew={handleSaveWorkspace}
            onLaunch={(tabId) => {
              if (!confirmDiscardUnsaved()) return
              setActiveTab(tabId)
              setActiveView(tabId)
            }}
          />
        )

      case 'hosts': {
        const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) : null
        const rootGroups = groups.filter((g) => !g.parentId)

        if (selectedGroup && selectedGroupId) {
          const groupHosts = hosts.filter((h) => h.groupId === selectedGroupId)
          const subGroups = getChildren(groups, selectedGroupId)

          return (
            <div className="flex-1 p-4 space-y-6 overflow-y-auto">
              {/* App-style breadcrumb */}
              {(() => {
                const ancestors = getAncestors(groups, selectedGroupId)
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <BreadcrumbDropTarget groupId={null} onClick={() => setSelectedGroupId(null)}>
                      All Groups
                    </BreadcrumbDropTarget>
                    {ancestors.map((a) => (
                      <span key={a.id} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <BreadcrumbDropTarget groupId={a.id} onClick={() => setSelectedGroupId(a.id)}>
                          {a.name}
                        </BreadcrumbDropTarget>
                      </span>
                    ))}
                    <svg className="w-3.5 h-3.5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary-600/20 text-primary-400">
                      {selectedGroup.name}
                    </span>
                  </div>
                )
              })()}

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{selectedGroup.name}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleNewGroupInGroup(selectedGroupId!)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Group
                  </button>
                  <button
                    onClick={() => handleNewHostInGroup(selectedGroupId!)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors rounded bg-primary-600 hover:bg-primary-700"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Host
                  </button>
                  <button
                    onClick={() => handleEditGroup(selectedGroup)}
                    className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                    title="Edit group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete group "${selectedGroup.name}"?`)) { deleteGroup(selectedGroup.id); setSelectedGroupId(null) } }}
                    className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
                    title="Delete group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sub-groups */}
              {subGroups.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400 mb-3">Sub-groups</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {subGroups.map((sg) => (
                      <DroppableGroupCard
                        key={sg.id}
                        group={sg}
                        hostCount={hosts.filter((h) => h.groupId === sg.id).length}
                        childCount={getChildren(groups, sg.id).length}
                        onClick={() => setSelectedGroupId(sg.id)}
                        onEdit={handleEditGroup}
                        onDelete={deleteGroup}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Hosts in this group */}
              <div>
                <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400 mb-3">
                  Hosts ({groupHosts.length})
                </h3>
                {groupHosts.length === 0 ? (
                  <div className="p-6 text-center transition-colors border-2 border-dashed rounded-lg border-dark-600">
                    <p className="text-sm text-dark-400">No hosts in this group</p>
                    <p className="text-xs text-dark-500 mt-1">Drag a host here or click "Add Host"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {groupHosts.map((host) => (
                      <DraggableHostCard
                        key={host.id}
                        host={host}
                        onConnect={handleConnect}
                        onEdit={handleEditHost}
                        onDelete={deleteHost}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Top-level view: groups + all hosts
        return (
          <div className="flex-1 p-4 space-y-6 overflow-y-auto">
            {/* Groups Section — root groups only */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400">Groups</h3>
                <button
                  onClick={handleNewGroup}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Group
                </button>
              </div>
              {rootGroups.length === 0 ? (
                <div
                  onClick={handleNewGroup}
                  className="p-4 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
                >
                  <p className="text-sm text-dark-500">No groups yet — click to create one</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {rootGroups.map((group) => (
                    <DroppableGroupCard
                      key={group.id}
                      group={group}
                      hostCount={hosts.filter((h) => h.groupId === group.id).length}
                      childCount={getChildren(groups, group.id).length}
                      onClick={() => setSelectedGroupId(group.id)}
                      onEdit={handleEditGroup}
                      onDelete={deleteGroup}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Hosts Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400">Hosts</h3>
                <button
                  onClick={handleNewHost}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors rounded bg-primary-600 hover:bg-primary-700"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Host
                </button>
              </div>
              {hosts.length === 0 ? (
                <div
                  onClick={handleNewHost}
                  className="p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
                >
                  <svg className="w-8 h-8 mx-auto mb-2 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                  <p className="text-sm text-dark-400">No hosts yet — click to add one</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {hosts.map((host) => (
                    <DraggableHostCard
                      key={host.id}
                      host={host}
                      onConnect={handleConnect}
                      onEdit={handleEditHost}
                      onDelete={deleteHost}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }

      case 'snippets':
        return (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Snippets</h2>
              <button
                onClick={handleNewSnippet}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Snippet
              </button>
            </div>

            {snippets.length === 0 ? (
              <div
                onClick={handleNewSnippet}
                className="p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-dark-400">No snippets yet — click to create one</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="relative p-3 transition-colors rounded-lg bg-dark-800/50 hover:bg-dark-800 group"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-white truncate">{snippet.name}</span>
                    </div>
                    <p className="text-dark-500 text-xs mt-1 ml-[22px] truncate font-mono">{snippet.command}</p>
                    <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditSnippet(snippet) }}
                        className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                        title="Edit snippet"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this snippet?')) api.deleteSnippet(snippet.id).then(() => fetchSnippets(currentVaultId || undefined)) }}
                        className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
                        title="Delete snippet"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'keys':
        return <KeyList onMutation={() => fetchKeys(currentVaultId || undefined)} />

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
      return (
        <div className="flex items-center justify-center flex-1 text-dark-500">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-dark-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-lg font-medium">SFTP Browser</p>
            <p className="mt-1 text-sm">Coming soon</p>
          </div>
        </div>
      )
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
        <div className="flex-1 overflow-hidden">
          {renderSidebarContent()}
        </div>
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
              return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
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
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors flex-shrink-0 mr-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Vaults Tab */}
          <button
            onClick={() => setActiveView('vault')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors flex-shrink-0 ${
              activeView === 'vault'
                ? 'bg-dark-800 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Vaults
            {activeView === 'vault' && <VaultSelector />}
          </button>

          {/* SFTP Tab */}
          <button
            onClick={() => setActiveView('sftp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors flex-shrink-0 ${
              activeView === 'sftp'
                ? 'bg-dark-800 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            SFTP
          </button>

          {/* Separator */}
          {tabs.length > 0 && <div className="flex-shrink-0 w-px h-4 mx-1 bg-dark-700" />}

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
            onClick={() => {
              const newTabId = addEmptyTab()
              setActiveView(newTabId)
            }}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors flex-shrink-0"
            title="New Tab"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
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
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                  )}
                </span>
                <button
                  onClick={handleSaveCurrentWorkspace}
                  disabled={!isDirty}
                  title={isDirty ? 'Save workspace (overwrite)' : 'No unsaved changes'}
                  className={`p-1.5 rounded transition-colors ${
                    isDirty
                      ? 'text-primary-400 hover:text-white hover:bg-dark-800'
                      : 'text-dark-600 cursor-default'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v5h6V3" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21v-7h8v7" />
                  </svg>
                </button>
                <button
                  onClick={handleSaveWorkspace}
                  disabled={!!activeWorkspaceId}
                  title={activeWorkspaceId ? 'Delete the current workspace to create a new one' : 'Save as new workspace'}
                  className={`p-1.5 rounded transition-colors ${
                    activeWorkspaceId
                      ? 'text-dark-600 cursor-default'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  </svg>
                </button>
              </div>
            )}
            {!activeWorkspaceId && tabs.length > 1 && (
              <button
                onClick={handleSaveWorkspace}
                className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors flex-shrink-0"
                title="Save workspace"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v5h6V3" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21v-7h8v7" />
                </svg>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs text-dark-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Connected</span>
            </div>
            <button
              onClick={() => { setActiveSidebarItem('settings'); setShowSettings(true); }}
              className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
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
                  <span className="flex items-center justify-center flex-shrink-0 w-5 h-5">{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Bottom: User & Actions */}
            <div className="p-3 space-y-2 border-t border-dark-800">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-dark-800/50">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-primary-600/20">
                  <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
                  <p className="text-xs truncate text-dark-400">{user?.email}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center flex-1 gap-2 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-dark-800 hover:bg-red-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Mobile sidebar overlay */}
        {activeView === 'vault' && isMobile && sidebarOpen && (
          <div
            className="fixed bottom-0 left-0 right-0 z-30 top-10 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content (below header, right of sidebar when vault view) */}
        <main className={`pt-10 h-screen flex flex-col ${activeView === 'vault' ? 'lg:ml-72' : ''} ${activeView === 'vault' && isMobile && sidebarOpen ? 'ml-72' : ''}`}>
          {renderMainContent()}
        </main>

        {/* Modals */}
        <Modal open={showHostForm} onClose={() => { setShowHostForm(false); setEditingHost(null); setDefaultGroupId(undefined); }} title={editingHost ? 'Edit Host' : 'Add Host'} maxWidth="max-w-md">
          <HostForm
            host={editingHost}
            defaultGroupId={defaultGroupId}
            onClose={() => { setShowHostForm(false); setEditingHost(null); setDefaultGroupId(undefined); }}
          />
        </Modal>

        <Modal open={showGroupForm} onClose={() => { setShowGroupForm(false); setEditingGroup(null); setNewGroupParentId(null); }} title={editingGroup ? 'Edit Group' : 'New Group'} maxWidth="max-w-md">
          <GroupForm
            group={editingGroup}
            defaultParentId={newGroupParentId || undefined}
            onClose={() => { setShowGroupForm(false); setEditingGroup(null); setNewGroupParentId(null); }}
          />
        </Modal>

        <Modal open={showSnippetForm} onClose={() => { setShowSnippetForm(false); setEditingSnippet(null); }} title={editingSnippet ? 'Edit Snippet' : 'New Snippet'} maxWidth="max-w-md">
          <SnippetForm
            snippet={editingSnippet}
            onClose={() => { setShowSnippetForm(false); setEditingSnippet(null); fetchSnippets(currentVaultId || undefined); }}
          />
        </Modal>

        <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Settings" maxWidth="max-w-2xl">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </Modal>

        <WorkspaceForm
          open={showWorkspaceForm}
          title="Save Workspace"
          submitLabel="Save"
          onSubmit={handleWorkspaceFormSubmit}
          onClose={() => { setShowWorkspaceForm(false) }}
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
              if (tab) {
                const pane = findLeaf(tab.root, source.data.paneId)
                if (pane) return <PanePreview pane={pane} />
              }
              return null
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
                    <span className="text-sm font-medium text-white truncate">{host.name}</span>
                  </div>
                  <p className="text-dark-400 text-xs mt-1 ml-[18px] truncate">
                    {host.username ? `${host.username}@` : ''}{host.address}:{host.port}
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
                    <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-white truncate">{group.name}</span>
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
