import { Folder, PencilSimple, Trash } from '@phosphor-icons/react'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { type Host, useHostStore } from '../../stores/hostStore'

interface HostDetailsProps {
  host: Host
  onConnect: (host: Host) => void
  onEdit: (host: Host) => void
  onDelete: (id: string) => void
}

export default function HostDetails({
  host,
  onConnect,
  onEdit,
  onDelete,
}: HostDetailsProps) {
  const { groups } = useHostStore()
  const groupName = host.groupId
    ? groups.find((g) => g.id === host.groupId)?.name
    : null
  const handleSftpClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (
      await tauriConfirm(`Delete host "${host.name}"?`, {
        title: 'Delete Host',
        kind: 'warning',
      })
    ) {
      onDelete(host.id)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onConnect(host)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onConnect(host)
        }}
        className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer hover:bg-dark-800 group transition-colors text-left w-full"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: host.color || '#64748b' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium truncate">
              {host.name}
            </p>
            {groupName && (
              <span className="px-1.5 py-0.5 text-xs bg-dark-700 text-dark-300 rounded">
                {groupName}
              </span>
            )}
          </div>
          <p className="text-dark-400 text-xs truncate">
            {host.username}@{host.address}:{host.port}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleSftpClick}
            className="p-1.5 text-dark-400 hover:text-primary-500 rounded hover:bg-dark-700"
            title="Open SFTP"
          >
            <Folder className="w-4 h-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(host)
            }}
            className="p-1.5 text-dark-400 hover:text-yellow-500 rounded hover:bg-dark-700"
            title="Edit host"
          >
            <PencilSimple className="w-4 h-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-dark-400 hover:text-red-500 rounded hover:bg-dark-700"
            title="Delete host"
          >
            <Trash className="w-4 h-4" weight="bold" />
          </button>
        </div>
      </button>

      {/* SFTP Modal */}
      {/* SFTP view would be handled by the parent Layout component */}
    </>
  )
}
