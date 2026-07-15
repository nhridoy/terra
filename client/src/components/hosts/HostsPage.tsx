import { useDraggable, useDroppable } from '@dnd-kit/react'
import { useHostStore, type Host, type Group } from '../../stores/hostStore'

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

  const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) : null
  const displayGroups = selectedGroupId ? getChildren(groups, selectedGroupId) : groups.filter((g) => !g.parentId)
  const displayHosts = selectedGroupId ? hosts.filter((h) => h.groupId === selectedGroupId) : hosts

  return (
    <div className="flex-1 p-4 space-y-6 overflow-y-auto">
      {/* Breadcrumb — only in group detail */}
      {selectedGroup && selectedGroupId && (
        (() => {
          const ancestors = getAncestors(groups, selectedGroupId)
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <BreadcrumbDropTarget groupId={null} onClick={() => onSelectGroup(null)}>
                All Groups
              </BreadcrumbDropTarget>
              {ancestors.map((a) => (
                <span key={a.id} className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <BreadcrumbDropTarget groupId={a.id} onClick={() => onSelectGroup(a.id)}>
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
        })()
      )}

      {/* Groups Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400">Groups</h3>
          <button
            onClick={() => onNewGroup(selectedGroupId ?? undefined)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        </div>
        {displayGroups.length === 0 ? (
          <div
            onClick={() => onNewGroup(selectedGroupId ?? undefined)}
            className="p-4 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
          >
            <p className="text-sm text-dark-500">No groups yet — click to create one</p>
          </div>
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
            onClick={() => onNewHost(selectedGroupId ?? undefined)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors rounded bg-primary-600 hover:bg-primary-700"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Host
          </button>
        </div>
        {displayHosts.length === 0 ? (
          <div
            onClick={() => onNewHost(selectedGroupId ?? undefined)}
            className="p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
          >
            <svg className="w-8 h-8 mx-auto mb-2 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <p className="text-sm text-dark-400">No hosts yet — click to add one</p>
          </div>
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
