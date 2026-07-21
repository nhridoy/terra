import { useDraggable, useDroppable } from '@dnd-kit/react'
import {
  CaretRight,
  DesktopTower,
  Folder,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { type Group, type Host, useHostStore } from '../../stores/hostStore'

function getChildren(groups: Group[], parentId: string): Group[] {
  return groups.filter((g) => g.parentId === parentId)
}

function getAncestors(groups: Group[], groupId: string): Group[] {
  const ancestors: Group[] = []
  let current = groups.find((g) => g.id === groupId)
  while (current?.parentId) {
    const parent = groups.find((g) => g.id === current?.parentId)
    if (parent) {
      ancestors.unshift(parent)
      current = parent
    } else break
  }
  return ancestors
}

function BreadcrumbDropTarget({
  groupId,
  onClick,
  children,
}: {
  groupId: string | null
  onClick: () => void
  children: React.ReactNode
}) {
  const { ref, isDropTarget } = useDroppable({
    id: groupId ? `breadcrumb:${groupId}` : 'breadcrumb:root',
    data: groupId ? { type: 'group-target', groupId } : { type: 'root-target' },
  })
  return (
    <button
      type="button"
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
  host: Host
  isDropTarget?: boolean
  onConnect: (host: Host) => void
  onEdit: (host: Host) => void
  onDelete: (id: string) => void
}) {
  const { ref, isDragging } = useDraggable({
    id: `host:${host.id}`,
    data: { type: 'host-source', hostId: host.id },
  })

  return (
    // biome-ignore lint/a11y/useSemanticElements: contains nested <button> elements for edit/delete
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => onConnect(host)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onConnect(host)
        }
      }}
      className={`relative p-3 transition-colors rounded-lg cursor-pointer bg-dark-800/50 hover:bg-dark-800 group ${isDragging ? 'opacity-50' : ''} ${isDropTarget ? 'ring-2 ring-primary-500' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: host.color || '#64748b' }}
        />
        <span className="text-sm font-medium text-white truncate">
          {host.name}
        </span>
      </div>
      <p className="text-dark-500 text-xs mt-1 ml-[18px] truncate">
        {host.username ? `${host.username}@` : ''}
        {host.address}:{host.port}
      </p>
      <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(host)
          }}
          className="p-1 rounded text-dark-400 hover:text-yellow-500 hover:bg-dark-700"
          title="Edit host"
        >
          <PencilSimple className="w-3 h-3" weight="bold" />
        </button>
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation()
            if (
              await tauriConfirm(`Delete host "${host.name}"?`, {
                title: 'Delete Host',
                kind: 'warning',
              })
            )
              onDelete(host.id)
          }}
          className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
          title="Delete host"
        >
          <Trash className="w-3 h-3" weight="bold" />
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
    // biome-ignore lint/a11y/useSemanticElements: contains nested <button> elements for edit/delete
    <div
      ref={setRefs}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`relative p-3 transition-colors rounded-lg cursor-pointer group ${
        isDragging
          ? 'opacity-50'
          : isDropTarget
            ? 'bg-primary-600/20 ring-2 ring-primary-500'
            : 'bg-dark-800/50 hover:bg-dark-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <Folder
          className="w-4 h-4 text-primary-400 flex-shrink-0"
          weight="bold"
        />
        <span className="flex-1 text-sm font-medium text-white truncate">
          {group.name}
        </span>
      </div>
      <p className="mt-1 ml-6 text-xs text-dark-500">
        {hostCount} host{hostCount === 1 ? '' : 's'}
        {childCount > 0 &&
          ` · ${childCount} sub-group${childCount === 1 ? '' : 's'}`}
      </p>
      <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(group)
          }}
          className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
          title="Edit group"
        >
          <PencilSimple className="w-3 h-3" weight="bold" />
        </button>
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation()
            if (
              await tauriConfirm(`Delete group "${group.name}"?`, {
                title: 'Delete Group',
                kind: 'warning',
              })
            )
              onDelete(group.id)
          }}
          className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
          title="Delete group"
        >
          <Trash className="w-3 h-3" weight="bold" />
        </button>
      </div>
    </div>
  )
}

interface HostsPageProps {
  selectedGroupId: string | null
  onSelectGroup: (id: string | null) => void
  onNewGroup: (parentId?: string) => void
  onNewHost: (groupId?: string) => void
  onEditGroup: (group: Group) => void
  onEditHost: (host: Host) => void
  onConnect: (host: Host) => void
  onDeleteGroup: (id: string) => void
  onDeleteHost: (id: string) => void
}

export default function HostsPage({
  selectedGroupId,
  onSelectGroup,
  onNewGroup,
  onNewHost,
  onEditGroup,
  onEditHost,
  onConnect,
  onDeleteGroup,
  onDeleteHost,
}: HostsPageProps) {
  const { hosts, groups } = useHostStore()

  const selectedGroup = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)
    : null
  const displayGroups = selectedGroupId
    ? getChildren(groups, selectedGroupId)
    : groups.filter((g) => !g.parentId)
  const displayHosts = selectedGroupId
    ? hosts.filter((h) => h.groupId === selectedGroupId)
    : hosts

  return (
    <div className="flex-1 p-4 space-y-6 overflow-y-auto">
      {/* Breadcrumb — only in group detail */}
      {selectedGroup &&
        selectedGroupId &&
        (() => {
          const ancestors = getAncestors(groups, selectedGroupId)
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <BreadcrumbDropTarget
                groupId={null}
                onClick={() => onSelectGroup(null)}
              >
                All Groups
              </BreadcrumbDropTarget>
              {ancestors.map((a) => (
                <span key={a.id} className="flex items-center gap-1.5">
                  <CaretRight
                    className="w-3.5 h-3.5 text-dark-500"
                    weight="bold"
                  />
                  <BreadcrumbDropTarget
                    groupId={a.id}
                    onClick={() => onSelectGroup(a.id)}
                  >
                    {a.name}
                  </BreadcrumbDropTarget>
                </span>
              ))}
              <CaretRight className="w-3.5 h-3.5 text-dark-500" weight="bold" />
              <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary-600/20 text-primary-400">
                {selectedGroup.name}
              </span>
            </div>
          )
        })()}

      {/* Groups Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400">
            Groups
          </h3>
          <button
            type="button"
            onClick={() => onNewGroup(selectedGroupId ?? undefined)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
          >
            <Plus className="w-3 h-3" weight="bold" />
            New Group
          </button>
        </div>
        {displayGroups.length === 0 ? (
          <button
            type="button"
            onClick={() => onNewGroup(selectedGroupId ?? undefined)}
            className="w-full p-4 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
          >
            <p className="text-sm text-dark-500">
              No groups yet — click to create one
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayGroups.map((group) => (
              <DroppableGroupCard
                key={group.id}
                group={group}
                hostCount={hosts.filter((h) => h.groupId === group.id).length}
                childCount={getChildren(groups, group.id).length}
                onClick={() => onSelectGroup(group.id)}
                onEdit={onEditGroup}
                onDelete={onDeleteGroup}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hosts Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400">
            Hosts{selectedGroupId ? ` (${displayHosts.length})` : ''}
          </h3>
          <button
            type="button"
            onClick={() => onNewHost(selectedGroupId ?? undefined)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors rounded bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-3 h-3" weight="bold" />
            New Host
          </button>
        </div>
        {displayHosts.length === 0 ? (
          <button
            type="button"
            onClick={() => onNewHost(selectedGroupId ?? undefined)}
            className="w-full p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
          >
            <DesktopTower
              className="w-8 h-8 mx-auto mb-2 text-dark-600"
              weight="bold"
            />
            <p className="text-sm text-dark-400">
              No hosts yet — click to add one
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayHosts.map((host) => (
              <DraggableHostCard
                key={host.id}
                host={host}
                onConnect={onConnect}
                onEdit={onEditHost}
                onDelete={onDeleteHost}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
